import {
  definePlugin,
  runWorker,
  type PluginContext,
  type PluginEvent,
} from "@paperclipai/plugin-sdk";
import { PLUGIN_ID } from "./manifest.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface BoardNotifyConfig {
  resendApiKeyRef: string;
  fromAddress: string;
  toAddress: string;
  notifyOnAssign: boolean;
  notifyOnBlocked: boolean;
  paperclipBaseUrl: string;
}

const DEFAULT_CONFIG: BoardNotifyConfig = {
  resendApiKeyRef: "",
  fromAddress: "paperclip@notify.digerstudios.com",
  toAddress: "rudy@digerstudios.com",
  notifyOnAssign: true,
  notifyOnBlocked: true,
  paperclipBaseUrl: "",
};

/** A GitHub PR or issue link extracted from markdown. */
interface GitHubLink {
  url: string;
  /** e.g. "PR #13" or "Issue #42" */
  label: string;
  repo: string;
}

interface IssueContext {
  identifier: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  latestComment: string;
  commentAuthor: string;
  issueUrl: string;
  /** GitHub PRs/issues mentioned in the description or latest comment. */
  githubLinks: GitHubLink[];
  /** Plain-English action items extracted from the latest comment / description. */
  actionItems: string[];
}

async function getConfig(ctx: PluginContext): Promise<BoardNotifyConfig> {
  const raw = await ctx.config.get();
  return { ...DEFAULT_CONFIG, ...(raw as Partial<BoardNotifyConfig>) };
}

// ---------------------------------------------------------------------------
// Resend helper
// ---------------------------------------------------------------------------

async function sendEmail(
  ctx: PluginContext,
  config: BoardNotifyConfig,
  subject: string,
  html: string,
): Promise<boolean> {
  if (!config.resendApiKeyRef) {
    ctx.logger.warn("No Resend API key configured — skipping notification");
    return false;
  }

  let apiKey: string;
  try {
    apiKey = await ctx.secrets.resolve(config.resendApiKeyRef);
  } catch (err) {
    ctx.logger.error("Failed to resolve Resend API key secret", { err: String(err) });
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.fromAddress,
        to: [config.toAddress],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      ctx.logger.error("Resend API returned an error", { status: res.status, body });
      return false;
    }

    ctx.logger.info("Notification email sent", { to: config.toAddress, subject });
    return true;
  } catch (err) {
    ctx.logger.error("Failed to send email via Resend", { err: String(err) });
    return false;
  }
}

// ---------------------------------------------------------------------------
// GitHub link extraction
// ---------------------------------------------------------------------------

const GH_URL_RE = /https:\/\/github\.com\/([^/]+\/[^/]+)\/(pull|issues)\/([0-9]+)/g;

/** Deduplicate GitHub PR / issue URLs from one or more markdown strings. */
function extractGitHubLinks(...sources: string[]): GitHubLink[] {
  const seen = new Set<string>();
  const links: GitHubLink[] = [];
  for (const src of sources) {
    for (const m of src.matchAll(GH_URL_RE)) {
      const url = m[0];
      if (seen.has(url)) continue;
      seen.add(url);
      const kind = m[2] === "pull" ? "PR" : "Issue";
      links.push({ url, label: `${kind} #${m[3]}`, repo: m[1]! });
    }
  }
  return links;
}

// ---------------------------------------------------------------------------
// Action-item extraction ("dumb it down" for the board reader)
// ---------------------------------------------------------------------------

/**
 * Pull plain-English action items from markdown.
 *
 * Strategy:
 *  1. Look for bullet lists that contain action verbs directed at the reader.
 *  2. Strip markdown formatting so the result reads like a simple checklist.
 *  3. If nothing is found, summarise the first sentence of the latest comment.
 */
function extractActionItems(latestComment: string, description: string): string[] {
  const items: string[] = [];
  const actionVerbs = /^\s*[-*]\s+(merge|approve|review|confirm|deploy|set|configure|run|check|fix|create|add|remove|update|verify|test|push|land|unblock|do one of|please)\b/i;

  // Scan latest comment first (most relevant), then description.
  for (const src of [latestComment, description]) {
    for (const line of src.split('\n')) {
      if (actionVerbs.test(line)) {
        // Strip markdown link syntax, backticks, leading bullet
        let clean = line
          .replace(/^\s*[-*]\s+/, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .trim();
        if (clean.length > 0 && !items.includes(clean)) {
          items.push(clean);
        }
      }
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Issue context fetcher
// ---------------------------------------------------------------------------

async function fetchIssueContext(
  ctx: PluginContext,
  event: PluginEvent,
  config: BoardNotifyConfig,
): Promise<IssueContext> {
  const p = event.payload as Record<string, unknown>;
  const identifier = (p.identifier as string) ?? "";
  const prefix = identifier.split("-")[0] ?? "";

  // Build issue URL
  const baseUrl = config.paperclipBaseUrl.replace(/\/+$/, "");
  const issueUrl = baseUrl ? `${baseUrl}/${prefix}/issues/${identifier}` : "";

  // Fetch full issue and latest comment
  let title = (p.title as string) ?? identifier;
  let description = "";
  let status = (p.status as string) ?? "unknown";
  let priority = (p.priority as string) ?? "";
  let latestComment = "";
  let commentAuthor = "";

  try {
    const issue = await ctx.issues.get(event.entityId ?? "", event.companyId);
    if (issue) {
      title = issue.title || title;
      description = (issue.description ?? "").slice(0, 500);
      status = issue.status || status;
      priority = issue.priority || priority;
    }
  } catch {
    ctx.logger.warn("Could not fetch issue details for notification", {});
  }

  try {
    const comments = await ctx.issues.listComments(event.entityId ?? "", event.companyId);
    if (comments.length > 0) {
      const last = comments[comments.length - 1]!;
      latestComment = (last.body ?? "").slice(0, 800);
      commentAuthor = last.authorAgentId
        ? `Agent ${last.authorAgentId.slice(0, 8)}`
        : last.authorUserId
          ? "Board"
          : "System";
    }
  } catch {
    ctx.logger.warn("Could not fetch comments for notification", {});
  }

  const githubLinks = extractGitHubLinks(description, latestComment);
  const actionItems = extractActionItems(latestComment, description);

  return { identifier, title, description, status, priority, latestComment, commentAuthor, issueUrl, githubLinks, actionItems };
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

const STYLES = {
  wrapper: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;',
  heading: 'margin: 0 0 16px; font-size: 20px; font-weight: 600;',
  table: 'border-collapse: collapse; width: 100%; margin-bottom: 16px;',
  labelCell: 'padding: 6px 12px 6px 0; color: #666; font-size: 14px; vertical-align: top; white-space: nowrap;',
  valueCell: 'padding: 6px 0; font-size: 14px;',
  commentBox: 'background: #f5f5f5; border-left: 3px solid #d1d5db; padding: 12px 16px; margin: 16px 0; border-radius: 4px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;',
  commentAuthor: 'font-weight: 600; margin-bottom: 4px; font-size: 13px; color: #444;',
  button: 'display: inline-block; background: #111; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px; margin-top: 8px;',
  buttonSecondary: 'display: inline-block; background: #fff; color: #111; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 13px; margin-top: 8px; border: 1px solid #d1d5db; margin-right: 8px;',
  footer: 'color: #999; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;',
  ghBadge: 'display: inline-block; background: #24292f; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 500; text-decoration: none; margin-right: 6px; margin-bottom: 6px;',
  actionBox: 'background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 16px 0;',
  actionHeading: 'margin: 0 0 8px; font-size: 15px; font-weight: 600; color: #92400e;',
  actionList: 'margin: 0; padding-left: 20px;',
  actionItem: 'font-size: 14px; line-height: 1.6; color: #1a1a1a;',
  priorityBadge: (p: string) => {
    const colors: Record<string, string> = {
      critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#65a30d',
    };
    const bg = colors[p] ?? '#888';
    return `display: inline-block; background: ${bg}; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 500; text-transform: uppercase;`;
  },
} as const;

function stripMarkdownLinks(md: string): string {
  return md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}

/** Render GitHub PR/issue badges as linked buttons. */
function githubLinksHtml(links: GitHubLink[]): string {
  if (links.length === 0) return '';
  const badges = links.map(l =>
    `<a href="${escapeHtml(l.url)}" style="${STYLES.ghBadge}" title="${escapeHtml(l.repo)}">
      ${escapeHtml(l.label)} · ${escapeHtml(l.repo.split('/')[1] ?? l.repo)}
    </a>`
  ).join('');
  return `
    <div style="margin-bottom: 16px;">
      <div style="font-size: 13px; color: #666; margin-bottom: 6px;">GitHub:</div>
      ${badges}
    </div>
  `;
}

/** Render the "what you need to do" action box. */
function actionItemsHtml(items: string[]): string {
  if (items.length === 0) return '';
  const listItems = items.map(i => `<li style="${STYLES.actionItem}">${escapeHtml(i)}</li>`).join('');
  return `
    <div style="${STYLES.actionBox}">
      <h3 style="${STYLES.actionHeading}">✅ What you need to do:</h3>
      <ol style="${STYLES.actionList}">${listItems}</ol>
    </div>
  `;
}

function assignedEmailHtml(ic: IssueContext): string {
  return `
    <div style="${STYLES.wrapper}">
      <h2 style="${STYLES.heading}">📋 Issue assigned to you</h2>
      <table style="${STYLES.table}">
        <tr><td style="${STYLES.labelCell}">Issue</td><td style="${STYLES.valueCell}"><strong>${escapeHtml(ic.identifier)}</strong></td></tr>
        <tr><td style="${STYLES.labelCell}">Title</td><td style="${STYLES.valueCell}">${escapeHtml(ic.title)}</td></tr>
        <tr><td style="${STYLES.labelCell}">Status</td><td style="${STYLES.valueCell}">${escapeHtml(ic.status)}</td></tr>
        ${ic.priority ? `<tr><td style="${STYLES.labelCell}">Priority</td><td style="${STYLES.valueCell}"><span style="${STYLES.priorityBadge(ic.priority)}">${escapeHtml(ic.priority)}</span></td></tr>` : ''}
      </table>
      ${githubLinksHtml(ic.githubLinks)}
      ${actionItemsHtml(ic.actionItems)}
      ${ic.description ? `<p style="font-size: 14px; color: #444; line-height: 1.5; margin: 0 0 16px;">${escapeHtml(truncate(stripMarkdownLinks(ic.description), 300))}</p>` : ''}
      ${ic.latestComment ? `
        <div style="margin-bottom: 16px;">
          <div style="${STYLES.commentAuthor}">Latest from ${escapeHtml(ic.commentAuthor)}:</div>
          <div style="${STYLES.commentBox}">${escapeHtml(truncate(stripMarkdownLinks(ic.latestComment), 600))}</div>
        </div>
      ` : ''}
      <div style="margin-top: 16px;">
        ${ic.issueUrl ? `<a href="${escapeHtml(ic.issueUrl)}" style="${STYLES.button}">View Issue →</a>` : ''}
        ${ic.githubLinks.length > 0 ? `<a href="${escapeHtml(ic.githubLinks[0]!.url)}" style="${STYLES.buttonSecondary}">Open ${escapeHtml(ic.githubLinks[0]!.label)} →</a>` : ''}
      </div>
      <p style="${STYLES.footer}">Paperclip Board Notifications</p>
    </div>
  `;
}

function blockedEmailHtml(ic: IssueContext): string {
  return `
    <div style="${STYLES.wrapper}">
      <h2 style="${STYLES.heading}">⚠️ Board action needed</h2>
      <table style="${STYLES.table}">
        <tr><td style="${STYLES.labelCell}">Issue</td><td style="${STYLES.valueCell}"><strong>${escapeHtml(ic.identifier)}</strong></td></tr>
        <tr><td style="${STYLES.labelCell}">Title</td><td style="${STYLES.valueCell}">${escapeHtml(ic.title)}</td></tr>
        ${ic.priority ? `<tr><td style="${STYLES.labelCell}">Priority</td><td style="${STYLES.valueCell}"><span style="${STYLES.priorityBadge(ic.priority)}">${escapeHtml(ic.priority)}</span></td></tr>` : ''}
      </table>
      ${githubLinksHtml(ic.githubLinks)}
      ${actionItemsHtml(ic.actionItems)}
      ${ic.latestComment ? `
        <div style="margin-bottom: 16px;">
          <div style="${STYLES.commentAuthor}">Latest from ${escapeHtml(ic.commentAuthor)}:</div>
          <div style="${STYLES.commentBox}">${escapeHtml(truncate(stripMarkdownLinks(ic.latestComment), 600))}</div>
        </div>
      ` : ''}
      <div style="margin-top: 16px;">
        ${ic.issueUrl ? `<a href="${escapeHtml(ic.issueUrl)}" style="${STYLES.button}">View Issue →</a>` : ''}
        ${ic.githubLinks.length > 0 ? `<a href="${escapeHtml(ic.githubLinks[0]!.url)}" style="${STYLES.buttonSecondary}">Open ${escapeHtml(ic.githubLinks[0]!.label)} →</a>` : ''}
      </div>
      <p style="${STYLES.footer}">Paperclip Board Notifications</p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function isAssignedToUser(event: PluginEvent): boolean {
  const p = event.payload as Record<string, unknown>;
  // assigneeUserId is set and changed from previous value
  if (!p.assigneeUserId) return false;
  const prev = p._previous as Record<string, unknown> | undefined;
  if (!prev) return false;
  return prev.assigneeUserId !== p.assigneeUserId;
}

function isNewlyBlocked(event: PluginEvent): boolean {
  const p = event.payload as Record<string, unknown>;
  if (p.status !== "blocked") return false;
  const prev = p._previous as Record<string, unknown> | undefined;
  if (!prev) return false;
  if (prev.status === "blocked") return false;

  // Only notify board when the issue is board-relevant:
  // 1. Assigned to a board user (assigneeUserId is set)
  // 2. Title starts with "Board:" (convention for board-owned tasks)
  const assignedToBoard = Boolean(p.assigneeUserId);
  const titleMentionsBoard = typeof p.title === "string" && /^board:/i.test(p.title.trim());
  return assignedToBoard || titleMentionsBoard;
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin = definePlugin({
  async setup(ctx: PluginContext) {
    ctx.logger.info(`${PLUGIN_ID} setup complete`);

    ctx.events.on("issue.updated", async (event: PluginEvent) => {
      const config = await getConfig(ctx);

      // 1. Issue assigned to board user
      if (config.notifyOnAssign && isAssignedToUser(event)) {
        const ic = await fetchIssueContext(ctx, event, config);
        await sendEmail(
          ctx,
          config,
          `[Paperclip] ${ic.identifier} assigned to you — ${truncate(ic.title, 60)}`,
          assignedEmailHtml(ic),
        );
      }

      // 2. Issue newly blocked — board action may be needed
      if (config.notifyOnBlocked && isNewlyBlocked(event)) {
        const ic = await fetchIssueContext(ctx, event, config);
        await sendEmail(
          ctx,
          config,
          `[Paperclip] ⚠ ${ic.identifier} blocked — ${truncate(ic.title, 60)}`,
          blockedEmailHtml(ic),
        );
      }
    });

    // Also catch new issues created directly assigned to a user
    ctx.events.on("issue.created", async (event: PluginEvent) => {
      const config = await getConfig(ctx);
      if (!config.notifyOnAssign) return;

      const p = event.payload as Record<string, unknown>;
      if (!p.assigneeUserId) return;

      const ic = await fetchIssueContext(ctx, event, config);
      await sendEmail(
        ctx,
        config,
        `[Paperclip] ${ic.identifier} assigned to you — ${truncate(ic.title, 60)}`,
        assignedEmailHtml(ic),
      );
    });
  },

  async onHealth() {
    return { status: "ok", message: "Board notify plugin ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
