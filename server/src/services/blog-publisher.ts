import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { blogPublishExecutions } from "@paperclipai/db";
import { unprocessable } from "../errors.js";

type FetchResponseLike = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
  },
) => Promise<FetchResponseLike>;

export type UploadedMediaInput = {
  filename: string;
  mimeType: string;
  body: Buffer;
};

export type BlogPublishConfig = {
  apiUrl?: string;
  user?: string;
  password?: string;
};

export type BlogPublishRequest = {
  blogRunId: string;
  companyId: string;
  approvalId: string;
  publishIdempotencyKey: string;
  siteId: string;
  targetSlug?: string | null;
  title: string;
  content: string;
  status: "draft" | "publish";
  categoryIds?: number[];
  featuredMedia?: UploadedMediaInput | null;
  supportingMedia?: UploadedMediaInput[];
};

export type BlogPublisherServiceDeps = {
  fetchImpl?: FetchLike;
  env?: NodeJS.ProcessEnv;
};

type WordPressUser = {
  name?: string;
  slug?: string;
};

type WordPressPost = {
  id?: number;
  status?: string;
  link?: string;
  title?: { rendered?: string };
  featured_media?: number;
  content?: { rendered?: string };
};

type WordPressMedia = {
  id?: number;
  source_url?: string;
  mime_type?: string;
  title?: { rendered?: string };
};

function getDefaultFetch(): FetchLike {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("fetch_unavailable");
  }
  return globalThis.fetch as unknown as FetchLike;
}

function resolveWordPressConfig(
  env: NodeJS.ProcessEnv,
  override: BlogPublishConfig = {},
): Required<BlogPublishConfig> {
  const apiUrl = String(
    override.apiUrl
    || env.PUBLISH_WP_API_URL
    || env.WP_API_URL
    || "",
  ).trim();
  const user = String(
    override.user
    || env.PUBLISH_WP_USER
    || env.WP_USER
    || "",
  ).trim();
  const password = String(
    override.password
    || env.PUBLISH_WP_APP_PASSWORD
    || env.WP_APP_PASSWORD
    || "",
  ).trim();

  if (!apiUrl) throw unprocessable("WordPress API URL is required");
  if (!user || !password) throw unprocessable("WordPress credentials are required");

  const url = new URL(apiUrl);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    throw unprocessable(`wp_api_url_forbidden:${apiUrl}`);
  }

  return { apiUrl, user, password };
}

function createBasicAuth(user: string, password: string) {
  return Buffer.from(`${user}:${password}`).toString("base64");
}

async function parseResponse(response: FetchResponseLike) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function detectMimeType(filename: string, provided: string) {
  if (provided) return provided;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function buildSupportingHtml(title: string, media: Array<{ sourceUrl: string }>) {
  return media
    .map((item) => `<figure class="supporting-image"><img src="${item.sourceUrl}" alt="${title}" /></figure>`)
    .join("");
}

export function blogPublisherService(db: Db, deps: BlogPublisherServiceDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? getDefaultFetch();
  const env = deps.env ?? process.env;

  async function wpRequest<T>(
    config: Required<BlogPublishConfig>,
    method: string,
    endpoint: string,
    body?: Buffer | Record<string, unknown>,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
    const url = new URL(endpoint.replace(/^\//, ""), base);
    const auth = createBasicAuth(config.user, config.password);
    const requestBody = body == null
      ? undefined
      : Buffer.isBuffer(body)
        ? body
        : Buffer.from(JSON.stringify(body));

    const response = await fetchImpl(url.toString(), {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        ...(requestBody && !Buffer.isBuffer(body) ? { "Content-Type": "application/json" } : {}),
        ...(requestBody ? { "Content-Length": String(requestBody.length) } : {}),
        ...extraHeaders,
      },
      body: requestBody,
    });

    const parsed = await parseResponse(response);
    if (!response.ok) {
      throw unprocessable(`wp_request_failed:${response.status}`, parsed);
    }
    return parsed as T;
  }

  async function uploadMedia(
    config: Required<BlogPublishConfig>,
    media: UploadedMediaInput,
    title: string,
  ) {
    const mimeType = detectMimeType(media.filename, media.mimeType);
    const uploaded = await wpRequest<WordPressMedia>(
      config,
      "POST",
      "/media",
      media.body,
      {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${media.filename}"`,
      },
    );

    return {
      mediaId: uploaded.id ?? null,
      sourceUrl: uploaded.source_url ?? null,
      mimeType: uploaded.mime_type ?? mimeType,
      title: uploaded.title?.rendered ?? title,
    };
  }

  async function attachFeaturedMedia(
    config: Required<BlogPublishConfig>,
    postId: number,
    media: UploadedMediaInput,
    title: string,
  ) {
    const uploaded = await uploadMedia(config, media, title);
    if (!uploaded.mediaId) return null;
    const updated = await wpRequest<WordPressPost>(config, "POST", `/posts/${postId}`, {
      featured_media: uploaded.mediaId,
    });
    return {
      ...uploaded,
      postFeaturedMedia: updated.featured_media ?? uploaded.mediaId,
    };
  }

  async function uploadSupportingMedia(
    config: Required<BlogPublishConfig>,
    items: UploadedMediaInput[],
    title: string,
  ) {
    const results: Array<{ mediaId: number | null; sourceUrl: string | null; mimeType: string; title: string }> = [];
    for (const item of items) {
      results.push(await uploadMedia(config, item, `${title} supporting`));
    }
    return results;
  }

  async function publish(input: BlogPublishRequest, configOverride: BlogPublishConfig = {}) {
    if (!input.approvalId) throw unprocessable("Publish approval is required");
    if (!input.publishIdempotencyKey) throw unprocessable("Publish idempotency key is required");

    const config = resolveWordPressConfig(env, configOverride);

    const existing = await db
      .select()
      .from(blogPublishExecutions)
      .where(eq(blogPublishExecutions.publishIdempotencyKey, input.publishIdempotencyKey))
      .then((rows) => rows[0] ?? null);

    if (existing) {
      return {
        reusedExecution: true,
        execution: existing,
        authenticatedUser: "unknown",
        post: existing.resultJson as Record<string, unknown> | null,
        featuredMedia: null,
        supportingMedia: [],
      };
    }

    const me = await wpRequest<WordPressUser>(config, "GET", "/users/me");
    let post = await wpRequest<WordPressPost>(config, "POST", "/posts", {
      title: input.title,
      content: input.content,
      status: input.status,
      ...(input.targetSlug ? { slug: input.targetSlug } : {}),
      ...(Array.isArray(input.categoryIds) && input.categoryIds.length > 0 ? { categories: input.categoryIds } : {}),
    });

    const featuredMedia = input.featuredMedia
      ? await attachFeaturedMedia(config, Number(post.id), input.featuredMedia, input.title)
      : null;

    const supportingMedia = Array.isArray(input.supportingMedia) && input.supportingMedia.length > 0
      ? await uploadSupportingMedia(config, input.supportingMedia, input.title)
      : [];

    if (supportingMedia.length > 0 && post.id) {
      const supportHtml = buildSupportingHtml(
        input.title,
        supportingMedia
          .filter((item) => Boolean(item.sourceUrl))
          .map((item) => ({ sourceUrl: item.sourceUrl! })),
      );
      post = await wpRequest<WordPressPost>(config, "POST", `/posts/${post.id}`, {
        content: `${input.content}${supportHtml}`,
      });
    }

    const execution = await db
      .insert(blogPublishExecutions)
      .values({
        blogRunId: input.blogRunId,
        companyId: input.companyId,
        approvalId: input.approvalId,
        siteId: input.siteId,
        targetSlug: input.targetSlug ?? "",
        publishIdempotencyKey: input.publishIdempotencyKey,
        wordpressPostId: post.id ?? null,
        publishedUrl: post.link ?? null,
        resultJson: post as Record<string, unknown>,
      })
      .returning()
      .then((rows) => rows[0] ?? null);

    return {
      reusedExecution: false,
      execution,
      authenticatedUser: me.name || me.slug || "unknown",
      post,
      featuredMedia,
      supportingMedia,
    };
  }

  return {
    publish,
    publishDraft: (input: Omit<BlogPublishRequest, "status">, config?: BlogPublishConfig) =>
      publish({ ...input, status: "draft" }, config),
    publishPost: (input: Omit<BlogPublishRequest, "status">, config?: BlogPublishConfig) =>
      publish({ ...input, status: "publish" }, config),
    attachFeaturedMedia,
    uploadSupportingMedia,
  };
}
