/**
 * Port of run-public-verify-step.js (200 LOC, no external deps)
 * Verifies published WordPress content against draft expectations.
 */

import { readJson, writeJson } from '../utils/filesystem.js';
import path from 'node:path';
import https from 'node:https';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeaturedMediaInfo {
  media_id?: string | number;
  title?: string;
  source_url?: string;
}

export interface PublishRecord {
  ok?: boolean;
  post_id?: string | number;
  url?: string;
  title?: string;
  status?: string;
  image?: string;
  featured_media?: FeaturedMediaInfo | null;
  generated_at?: string;
  mode?: 'dry-run' | 'live-run';
  payload_preview?: {
    title?: string;
    content?: string;
  };
}

export interface DraftRecord {
  title?: string;
  article_html?: string;
  content?: string;
  decisionState?: string;
  decision_state?: string;
  readerDecisionState?: string;
  reader_decision_state?: string;
  decisionSummary?: string;
  decision_summary?: string;
  readerDecisionSummary?: string;
  reader_decision_summary?: string;
  issueIdentifier?: string;
  issue_identifier?: string;
  artifactId?: string;
  artifact_id?: string;
}

export interface WpPost {
  id?: string | number;
  link?: string;
  status?: string;
  title?: { rendered?: string };
  featured_media?: string | number;
}

export interface PublicPageResult {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface CoreCheck {
  checkId: string;
  status: 'pass' | 'fail';
  overrideable: false;
  summary: string;
}

export interface PublicVerifyResult {
  schemaVersion: 'shared-public-verify.v1';
  verifyId: string;
  approvedArtifactRef: {
    issueIdentifier: string;
    artifactId: string;
    artifactLabel: string;
  };
  approvedArtifact: {
    issueIdentifier: string;
    artifactId: string;
    artifactLabel: string;
    headline: string;
    decisionState: string;
    decisionSummary: string;
    requiredSections: string[];
  };
  publisherExpectations: {
    headline: string;
    decisionState: string;
    decisionSummary: string;
    publishStatus: string;
    featuredMedia: {
      required: boolean;
      label: string;
    };
  };
  publishReceiptId: string;
  publishReceiptLabel: string;
  publishReceipt: {
    receiptId: string;
    label: string;
    mode: 'dry-run' | 'live-run';
    lifecycle: 'simulated' | 'executed';
    target: 'wordpress.production';
    targetUrl: string;
    publishedAt: string;
  };
  publicUrl: string;
  verifiedAt: string;
  verdict: 'pass' | 'fail';
  readerDecisionState: string;
  readerDecisionSummary: string;
  coreChecks: CoreCheck[];
  failureNames: string[];
  warnings: never[];
  evidence: { surface: string; signal: string }[];
  publicObservation: {
    observedAt: string;
    url: string;
    fetchStatus: 'reachable' | 'missing';
    httpStatus: number;
    publishStatus: string | 'missing';
    featuredMediaPresent: boolean;
    featuredMediaLabel: string | null;
    headline: string | null;
    decisionState: string;
    decisionSummary: string;
    summary: string;
  };
  driftSummary: {
    class: string;
    summary: string;
  };
  overrideSummary: {
    applied: never[];
    blocked: string[];
  };
  ok: boolean;
  mode: 'wordpress';
}

export interface DryRunResult {
  ok: boolean;
  mode: 'dry-run';
  verified_at: string;
  checks: {
    publish_file_present: boolean;
    payload_preview_present: boolean;
    image_record_present: boolean;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function resolveWpConfigForPublicVerify(env: NodeJS.ProcessEnv = process.env) {
  const apiUrl = String(env.PUBLISH_WP_API_URL || env.WP_API_URL || 'https://fluxaivory.com/wp-json/wp/v2').trim();
  const user = String(env.PUBLISH_WP_USER || env.WP_USER || '').trim();
  const password = String(env.PUBLISH_WP_APP_PASSWORD || env.WP_APP_PASSWORD || '').trim();
  const host = (() => {
    try {
      return new URL(apiUrl).hostname;
    } catch (_) {
      return '';
    }
  })();
  if (host === 'localhost' || host === '127.0.0.1') {
    throw new Error(`wp_api_url_forbidden:${apiUrl}`);
  }
  return { apiUrl, user, password };
}

function getWpConfig() {
  return resolveWpConfigForPublicVerify(process.env);
}

function wpRequest(method: string, endpoint: string): Promise<unknown> {
  const { apiUrl, user, password } = getWpConfig();
  if (!user || !password) {
    throw new Error('wp_credentials_missing');
  }
  const base = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
  const url = new URL(endpoint.replace(/^\//, ''), base);
  const auth = Buffer.from(`${user}:${password}`).toString('base64');

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed: unknown = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch (_) {
          parsed = text;
        }
        if (res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(
            new Error(
              `wp_request_failed:${res.statusCode}:${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`,
            ),
          );
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function fetchText(url: string, depth = 0): Promise<PublicPageResult> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const location = res.headers?.location;
        if (location && (res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400 && depth < 3) {
          try {
            const nextUrl = new URL(Array.isArray(location) ? location[0] : location, url).toString();
            resolve(fetchText(nextUrl, depth + 1));
            return;
          } catch (_) {
            // ignore and return current response
          }
        }
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[] | undefined>,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function resolveLivePublicPage({
  publishUrl = "",
  postLink = "",
  requestText,
}: {
  publishUrl?: string;
  postLink?: string;
  requestText: typeof fetchText;
}) {
  const candidates = [...new Set([String(publishUrl || "").trim(), String(postLink || "").trim()].filter(Boolean))];
  let fallback: { url: string; page: PublicPageResult | null } | null = null;
  for (const candidate of candidates) {
    const page = await requestText(candidate).catch(() => null);
    if (!page) continue;
    if (!fallback) fallback = { url: candidate, page };
    if (page.statusCode >= 200 && page.statusCode < 400) {
      return { url: candidate, page };
    }
  }
  return fallback ?? { url: firstNonEmptyString(publishUrl, postLink), page: null };
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function inferDecisionStateFromDraft(draft: DraftRecord = {}): string {
  const explicit = firstNonEmptyString(
    draft.decisionState,
    draft.decision_state,
    draft.readerDecisionState,
    draft.reader_decision_state,
  ).toLowerCase();
  if (['adopt', 'wait', 'ignore', 'unclear'].includes(explicit)) return explicit;

  const html = firstNonEmptyString(draft.article_html, draft.content).toLowerCase();
  if (/(무시해도|중요하지 않)/.test(html)) return 'ignore';
  if (/(지켜볼|기다려|다음 업데이트)/.test(html)) return 'wait';
  if (/(지금 바로|써볼 만|시험해볼 만|도입해볼 만)/.test(html)) return 'adopt';
  return 'unclear';
}

function inferDecisionSummaryFromDraft(draft: DraftRecord = {}, decisionState = 'unclear'): string {
  const explicit = firstNonEmptyString(
    draft.decisionSummary,
    draft.decision_summary,
    draft.readerDecisionSummary,
    draft.reader_decision_summary,
  );
  if (explicit) return explicit;
  switch (decisionState) {
    case 'adopt':
      return 'Approved draft expects the reader to reach an adopt decision.';
    case 'wait':
      return 'Approved draft expects the reader to wait for more confirmation.';
    case 'ignore':
      return 'Approved draft expects the reader to ignore the change for now.';
    default:
      return 'Approved draft did not encode a strong reader decision.';
  }
}

function buildFailureNamesFromChecks(coreChecks: CoreCheck[] = []): string[] {
  const failures: string[] = [];
  for (const entry of coreChecks) {
    if (!entry || entry.status !== 'fail') continue;
    if (entry.checkId === 'public_visibility') failures.push('PUBLIC_VERIFY_REGRESSION');
    if (entry.checkId === 'title_framing') failures.push('TITLE_FRAMING_DRIFT');
    if (entry.checkId === 'body_contract') failures.push('BODY_CONTRACT_DRIFT');
    if (entry.checkId === 'media_and_status') failures.push('MEDIA_OR_STATUS_DRIFT');
    if (entry.checkId === 'artifact_parity') failures.push('SILENT_PUBLISH_DRIFT');
    if (entry.checkId === 'reader_decision') failures.push('READER_DECISION_UNCLEAR');
  }
  return [...new Set(failures)];
}

function normalizeSharedPublicVerifyResult({
  draft = {},
  publish = {},
  post = {},
  publicPage = null,
  verifiedAt,
}: {
  draft?: DraftRecord;
  publish?: PublishRecord;
  post?: WpPost;
  publicPage?: PublicPageResult | null;
  verifiedAt: string;
}): PublicVerifyResult {
  draft = draft && typeof draft === 'object' ? draft : {};
  publish = publish && typeof publish === 'object' ? publish : {};
  post = post && typeof post === 'object' ? post : {};

  const expectedTitle = firstNonEmptyString(draft.title, publish.title, post?.title?.rendered);
  const expectedDecisionState = inferDecisionStateFromDraft(draft);
  const expectedDecisionSummary = inferDecisionSummaryFromDraft(draft, expectedDecisionState);
  const expectedPublishStatus = firstNonEmptyString(publish.status, post?.status, 'publish').toLowerCase();
  const featuredMediaInfo = publish.featured_media || null;
  const expectedFeaturedMediaRequired = Boolean(featuredMediaInfo?.media_id || publish.image);
  const expectedFeaturedMediaLabel = firstNonEmptyString(
    featuredMediaInfo?.title,
    featuredMediaInfo?.source_url ? path.basename(String(featuredMediaInfo.source_url)) : '',
    publish.image ? path.basename(String(publish.image)) : '',
    'Featured media expectation',
  );
  const observedPublishStatus = firstNonEmptyString(
    post?.status,
    publish.status,
    publicPage ? 'publish' : 'missing',
  ).toLowerCase();
  const observedFeaturedMediaPresent = Boolean(post?.featured_media || featuredMediaInfo?.media_id);
  const observedFeaturedMediaLabel = observedFeaturedMediaPresent
    ? firstNonEmptyString(
        featuredMediaInfo?.title,
        featuredMediaInfo?.source_url ? path.basename(String(featuredMediaInfo.source_url)) : '',
        expectedFeaturedMediaLabel,
      )
    : null;

  const isDraft = observedPublishStatus === 'draft';
  const publicFetchOk = isDraft
    ? Boolean(publicPage && publicPage.statusCode === 404)
    : Boolean(publicPage && publicPage.statusCode >= 200 && publicPage.statusCode < 400);
  const publicBody = String(publicPage?.body ?? '');
  const titleMatches = Boolean(expectedTitle && String(post?.title?.rendered ?? '').includes(expectedTitle));
  const bodyContractPass = isDraft ? Boolean(post?.id) : Boolean(expectedTitle && publicBody.includes(expectedTitle));
  const mediaAndStatusPass =
    observedPublishStatus === expectedPublishStatus &&
    (!expectedFeaturedMediaRequired || observedFeaturedMediaPresent);
  const entrypointVisible = true;
  const artifactParityPass = publicFetchOk && titleMatches && bodyContractPass && mediaAndStatusPass && entrypointVisible;
  const readerDecisionState = artifactParityPass ? expectedDecisionState : 'unclear';
  const readerDecisionPass = readerDecisionState !== 'unclear';

  const coreChecks: CoreCheck[] = [
    {
      checkId: 'public_visibility',
      status: publicFetchOk ? 'pass' : 'fail',
      overrideable: false,
      summary: publicFetchOk
        ? 'The public URL stayed reachable during verify.'
        : 'The public URL did not remain reachable during verify.',
    },
    {
      checkId: 'title_framing',
      status: titleMatches ? 'pass' : 'fail',
      overrideable: false,
      summary: titleMatches
        ? 'The observed title preserved the approved framing.'
        : 'The observed title drifted from the approved framing.',
    },
    {
      checkId: 'body_contract',
      status: bodyContractPass ? 'pass' : 'fail',
      overrideable: false,
      summary: bodyContractPass
        ? 'The observed body still satisfied the approved article contract.'
        : 'The observed body no longer satisfied the approved article contract.',
    },
    {
      checkId: 'media_and_status',
      status: mediaAndStatusPass ? 'pass' : 'fail',
      overrideable: false,
      summary: mediaAndStatusPass
        ? 'Observed publish status and featured media matched the Publisher expectation.'
        : 'Observed publish status or featured media no longer matched the Publisher expectation.',
    },
    {
      checkId: 'artifact_parity',
      status: artifactParityPass ? 'pass' : 'fail',
      overrideable: false,
      summary: artifactParityPass
        ? 'Public output stayed aligned with the approved article.'
        : 'Public output drifted away from the approved article.',
    },
    {
      checkId: 'reader_decision',
      status: readerDecisionPass ? 'pass' : 'fail',
      overrideable: false,
      summary: readerDecisionPass
        ? 'The public page still leaves the reader with a clear decision.'
        : 'The public page no longer leaves the reader with a clear decision.',
    },
  ];

  const failureNames = buildFailureNamesFromChecks(coreChecks);
  const verdict = failureNames.length ? 'fail' : 'pass';
  const driftClass =
    verdict === 'pass'
      ? 'none'
      : String(coreChecks.find((entry) => entry.status === 'fail')?.checkId ?? 'artifact_parity');

  return {
    schemaVersion: 'shared-public-verify.v1',
    verifyId: firstNonEmptyString(post?.id, publish.post_id, path.basename(String(publish.url ?? 'public-verify'))),
    approvedArtifactRef: {
      issueIdentifier: firstNonEmptyString(draft.issueIdentifier, draft.issue_identifier, 'mac-pipeline'),
      artifactId: firstNonEmptyString(draft.artifactId, draft.artifact_id, publish.post_id, 'publish-artifact'),
      artifactLabel: firstNonEmptyString(expectedTitle, 'Approved article'),
    },
    approvedArtifact: {
      issueIdentifier: firstNonEmptyString(draft.issueIdentifier, draft.issue_identifier, 'mac-pipeline'),
      artifactId: firstNonEmptyString(draft.artifactId, draft.artifact_id, publish.post_id, 'publish-artifact'),
      artifactLabel: firstNonEmptyString(expectedTitle, 'Approved article'),
      headline: expectedTitle,
      decisionState: expectedDecisionState,
      decisionSummary: expectedDecisionSummary,
      requiredSections: ['verdict_overview', 'evidence_breakdown', 'who_should_adopt'],
    },
    publisherExpectations: {
      headline: expectedTitle,
      decisionState: expectedDecisionState,
      decisionSummary: expectedDecisionSummary,
      publishStatus: expectedPublishStatus,
      featuredMedia: {
        required: expectedFeaturedMediaRequired,
        label: expectedFeaturedMediaLabel,
      },
    },
    publishReceiptId: firstNonEmptyString(publish.post_id, post?.id, 'publish-receipt'),
    publishReceiptLabel: firstNonEmptyString(
      publish.generated_at ? `Publish receipt ${publish.generated_at}` : '',
      `Publish receipt ${verifiedAt}`,
    ),
    publishReceipt: {
      receiptId: firstNonEmptyString(publish.post_id, post?.id, 'publish-receipt'),
      label: firstNonEmptyString(
        publish.generated_at ? `Publish receipt ${publish.generated_at}` : '',
        `Publish receipt ${verifiedAt}`,
      ),
      mode: publish.mode === 'dry-run' ? 'dry-run' : 'live-run',
      lifecycle: publish.mode === 'dry-run' ? 'simulated' : 'executed',
      target: 'wordpress.production',
      targetUrl: firstNonEmptyString(post?.link, publish.url),
      publishedAt: firstNonEmptyString(publish.generated_at, verifiedAt),
    },
    publicUrl: firstNonEmptyString(post?.link, publish.url),
    verifiedAt,
    verdict,
    readerDecisionState,
    readerDecisionSummary: readerDecisionPass
      ? 'The public page still supports the approved reader decision.'
      : 'The public page no longer supports a clear reader decision.',
    coreChecks,
    failureNames,
    warnings: [],
    evidence: [
      {
        surface: 'approved_package',
        signal: `headline=${expectedTitle}`,
      },
      {
        surface: 'publication_receipt',
        signal: `status=${expectedPublishStatus} url=${firstNonEmptyString(post?.link, publish.url)}`,
      },
      {
        surface: 'public_verify',
        signal: `http=${String(publicPage?.statusCode ?? 0)} fetch_ok=${String(Boolean(publicFetchOk))}`,
      },
    ],
    publicObservation: {
      observedAt: verifiedAt,
      url: firstNonEmptyString(post?.link, publish.url),
      fetchStatus: publicFetchOk ? 'reachable' : 'missing',
      httpStatus: Number(publicPage?.statusCode ?? 0) || (publicFetchOk ? 200 : 404),
      publishStatus: publicFetchOk ? observedPublishStatus : 'missing',
      featuredMediaPresent: observedFeaturedMediaPresent,
      featuredMediaLabel: observedFeaturedMediaLabel,
      headline: publicFetchOk ? firstNonEmptyString(post?.title?.rendered, expectedTitle) : null,
      decisionState: readerDecisionState,
      decisionSummary: readerDecisionPass
        ? 'The observed page still supports the approved reader decision.'
        : 'The observed page does not support a reliable reader decision.',
      summary:
        verdict === 'pass'
          ? 'Public verify matched the approved article and Publisher expectations.'
          : 'Public verify detected a mismatch between the approved article and the observed public page.',
    },
    driftSummary: {
      class: driftClass,
      summary: verdict === 'pass' ? 'No contract-level drift was detected.' : `Drift detected in ${driftClass}.`,
    },
    overrideSummary: {
      applied: [],
      blocked: failureNames.map((name) => `${name} is non-overrideable`),
    },
    ok: verdict === 'pass',
    mode: 'wordpress',
  };
}

// ---------------------------------------------------------------------------
// Main step
// ---------------------------------------------------------------------------

interface RunPublicVerifyDeps {
  wpRequest?: typeof wpRequest;
  fetchText?: typeof fetchText;
  now?: () => string;
}

export async function runPublicVerifyStep(
  { runDir }: { runDir: string },
  deps: RunPublicVerifyDeps = {},
): Promise<PublicVerifyResult | DryRunResult> {
  const requestPost = deps.wpRequest ?? wpRequest;
  const requestText = deps.fetchText ?? fetchText;
  const now = deps.now ?? (() => new Date().toISOString());

  const publish = (await readJson(path.join(runDir, 'publish.json'))) as PublishRecord | null;
  if (!publish?.ok) {
    throw new Error('publish_result_missing');
  }

  // Dry-run mode
  if (publish.mode === 'dry-run') {
    const result: DryRunResult = {
      ok: true,
      mode: 'dry-run',
      verified_at: new Date().toISOString(),
      checks: {
        publish_file_present: true,
        payload_preview_present: Boolean(publish.payload_preview?.title && publish.payload_preview?.content),
        image_record_present: Boolean(publish.image),
      },
    };
    await writeJson(path.join(runDir, 'verify.json'), result);
    return result;
  }

  if (!publish.post_id) {
    throw new Error('publish_post_id_missing');
  }

  const post = (await requestPost('GET', `/posts/${publish.post_id}?context=edit`)) as WpPost;
  const observedPublic = await resolveLivePublicPage({
    publishUrl: publish.url,
    postLink: String(post?.link || ""),
    requestText,
  });
  const publicPage = observedPublic.page;
  const draft = (await readJson(path.join(runDir, 'draft.json'))) as DraftRecord | null;

  const result = normalizeSharedPublicVerifyResult({
    draft: draft ?? {},
    publish: {
      ...publish,
      url: observedPublic.url || publish.url,
    },
    post,
    publicPage,
    verifiedAt: now(),
  });

  await writeJson(path.join(runDir, 'verify.json'), result);
  return result;
}
