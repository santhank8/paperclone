#!/usr/bin/env bun
/**
 * Notion API CLI for Marketing Agent approval workflow
 *
 * Usage:
 *   bun run tools/notion-api.ts setup                    — Create the Marketing Queue database
 *   bun run tools/notion-api.ts draft <platform> <skill> <text> — Add a draft post
 *   bun run tools/notion-api.ts check-approved            — List approved posts ready to publish
 *   bun run tools/notion-api.ts publish-queue             — Post all approved items to X with 3-7 min spacing
 *   bun run tools/notion-api.ts mark-posted <page_id> <url> — Mark a post as published
 *   bun run tools/notion-api.ts list                      — Show all posts and their status
 */

const NOTION_TOKEN = process.env.NOTION_API_TOKEN;
const NOTION_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Database ID gets written to a config file after setup
const CONFIG_PATH = "./tools/.notion-marketing-db";

function checkToken() {
  if (!NOTION_TOKEN) {
    console.error("Missing NOTION_API_TOKEN in .env");
    process.exit(1);
  }
}

// --- HTTP helpers ---

async function notionGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function notionPost(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function notionPatch(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

// --- Config ---

async function getDbId(): Promise<string> {
  const file = Bun.file(CONFIG_PATH);
  if (!(await file.exists())) {
    console.error("Marketing database not set up. Run: bun run tools/notion-api.ts setup");
    process.exit(1);
  }
  return (await file.text()).trim();
}

// --- Property extraction ---

function extractProp(prop: Record<string, unknown>): string {
  if (Array.isArray(prop.title)) {
    return (prop.title as Array<Record<string, unknown>>).map((t) => (t.plain_text as string) ?? "").join("");
  }
  if (Array.isArray(prop.rich_text)) {
    return (prop.rich_text as Array<Record<string, unknown>>).map((t) => (t.plain_text as string) ?? "").join("");
  }
  if (prop.select && typeof prop.select === "object") {
    return ((prop.select as Record<string, unknown>).name as string) ?? "";
  }
  if (typeof prop.url === "string") return prop.url;
  if (prop.created_time) return prop.created_time as string;
  return "";
}

// --- Commands ---

async function addReplyToColumn(): Promise<void> {
  const dbId = await getDbId();
  await notionPatch(`/databases/${dbId}`, {
    properties: {
      "Reply To": { url: {} },
    },
  });
  console.log("Added 'Reply To' column to database.");
}

async function setup(): Promise<void> {
  // Search for a page to use as parent. Look for "AI Skills Lab" or create under first available page.
  const search = await notionPost("/search", {
    query: "Marketing",
    filter: { property: "object", value: "page" },
    page_size: 5,
  });

  const results = search.results as Array<Record<string, unknown>>;

  // Try to find an existing parent page, or use the first page we have access to
  let parentPageId: string | null = null;

  if (results.length > 0) {
    // Use first page result as parent
    parentPageId = results[0].id as string;
    console.log(`Using parent page: ${parentPageId}`);
  } else {
    // Search for any page
    const anySearch = await notionPost("/search", {
      filter: { property: "object", value: "page" },
      page_size: 1,
    });
    const anyResults = anySearch.results as Array<Record<string, unknown>>;
    if (anyResults.length === 0) {
      console.error("No Notion pages found. Make sure the integration has access to at least one page.");
      process.exit(1);
    }
    parentPageId = anyResults[0].id as string;
    console.log(`Using parent page: ${parentPageId}`);
  }

  // Create the database
  const db = await notionPost("/databases", {
    parent: { page_id: parentPageId },
    title: [{ text: { content: "Marketing Queue" } }],
    properties: {
      Skill: { title: {} },
      Platform: {
        select: {
          options: [
            { name: "X", color: "blue" },
            { name: "Reddit", color: "orange" },
          ],
        },
      },
      Draft: { rich_text: {} },
      Status: {
        select: {
          options: [
            { name: "Draft", color: "gray" },
            { name: "Approved", color: "green" },
            { name: "Denied", color: "red" },
            { name: "Posted", color: "purple" },
          ],
        },
      },
      "Posted URL": { url: {} },
      Notes: { rich_text: {} },
    },
  });

  const dbId = db.id as string;
  const url = db.url as string;
  await Bun.write(CONFIG_PATH, dbId);

  console.log(`Marketing Queue database created.`);
  console.log(`ID: ${dbId}`);
  console.log(`URL: ${url}`);
  console.log(`Config saved to ${CONFIG_PATH}`);
}

async function createDraft(platform: string, skill: string, text: string, replyToUrl?: string): Promise<void> {
  const dbId = await getDbId();

  const properties: Record<string, unknown> = {
    Skill: { title: [{ text: { content: skill } }] },
    Platform: { select: { name: platform } },
    Draft: { rich_text: [{ text: { content: text } }] },
    Status: { select: { name: "Draft" } },
  };

  if (replyToUrl) {
    properties["Reply To"] = { url: replyToUrl };
  }

  const result = await notionPost("/pages", {
    parent: { database_id: dbId },
    properties,
  });

  const pageId = result.id as string;
  const url = result.url as string;
  console.log(`Draft created: ${pageId}`);
  console.log(`URL: ${url}`);
}

async function checkApproved(): Promise<void> {
  const dbId = await getDbId();

  const data = await notionPost(`/databases/${dbId}/query`, {
    filter: {
      property: "Status",
      select: { equals: "Approved" },
    },
  });

  const results = data.results as Array<Record<string, unknown>>;
  if (results.length === 0) {
    console.log("No approved posts waiting.");
    return;
  }

  for (const row of results) {
    const props = row.properties as Record<string, Record<string, unknown>>;
    const id = row.id as string;
    const skill = extractProp(props.Skill);
    const platform = extractProp(props.Platform);
    const draft = extractProp(props.Draft);
    const notes = extractProp(props.Notes);

    console.log(`--- ${id} ---`);
    console.log(`Skill: ${skill}`);
    console.log(`Platform: ${platform}`);
    console.log(`Draft: ${draft}`);
    if (notes) console.log(`Notes: ${notes}`);
    console.log();
  }
}

async function markPosted(pageId: string, postedUrl: string): Promise<void> {
  await notionPatch(`/pages/${pageId}`, {
    properties: {
      Status: { select: { name: "Posted" } },
      "Posted URL": { url: postedUrl },
    },
  });
  console.log(`Marked ${pageId} as Posted with URL: ${postedUrl}`);
}

async function updateDraft(pageId: string, newText: string): Promise<void> {
  await notionPatch(`/pages/${pageId}`, {
    properties: {
      Draft: { rich_text: [{ text: { content: newText } }] },
    },
  });
  console.log(`Updated draft for ${pageId}`);
}

async function publishQueue(): Promise<void> {
  const dbId = await getDbId();

  const data = await notionPost(`/databases/${dbId}/query`, {
    filter: {
      property: "Status",
      select: { equals: "Approved" },
    },
  });

  const results = data.results as Array<Record<string, unknown>>;
  if (results.length === 0) {
    console.log("No approved posts to publish.");
    return;
  }

  console.log(`Found ${results.length} approved post(s). Publishing with staggered timing...\n`);

  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    const props = row.properties as Record<string, Record<string, unknown>>;
    const pageId = row.id as string;
    const platform = extractProp(props.Platform);
    const draft = extractProp(props.Draft);

    if (platform !== "X") {
      console.log(`Skipping non-X post (${platform}): ${draft.slice(0, 60)}...`);
      continue;
    }

    // Skip replies (those have Reply To URLs and are for manual posting by Doug)
    const replyTo = extractProp(props["Reply To"] ?? {});
    if (replyTo) {
      console.log(`[${i + 1}/${results.length}] Skipping reply (manual): ${draft.slice(0, 60)}...`);
      continue;
    }

    console.log(`[${i + 1}/${results.length}] Posting new tweet...`);
    console.log(`  Text: ${draft.slice(0, 80)}${draft.length > 80 ? "..." : ""}`);

    // Post via x-api.ts
    const proc = Bun.spawn(
      ["bun", "run", "tools/x-api.ts", "post", draft],
      { stdout: "pipe", stderr: "pipe" }
    );
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      console.error(`  FAILED: ${stderr.trim()}`);
      continue;
    }

    // Extract posted URL from stdout
    const urlMatch = stdout.match(/(https:\/\/x\.com\/\S+)/);
    const postedUrl = urlMatch ? urlMatch[1] : "https://x.com";

    console.log(`  Posted: ${postedUrl}`);

    // Mark as posted in Notion
    await notionPatch(`/pages/${pageId}`, {
      properties: {
        Status: { select: { name: "Posted" } },
        "Posted URL": { url: postedUrl },
      },
    });

    // Stagger: wait 3-7 minutes between posts (skip after last one)
    if (i < results.length - 1) {
      const delaySec = 180 + Math.floor(Math.random() * 240); // 180-420 seconds (3-7 min)
      const delayMin = (delaySec / 60).toFixed(1);
      console.log(`  Waiting ${delayMin} minutes before next post...\n`);
      await new Promise((r) => setTimeout(r, delaySec * 1000));
    }
  }

  console.log("\nAll approved posts published.");
}

async function listAll(): Promise<void> {
  const dbId = await getDbId();

  const data = await notionPost(`/databases/${dbId}/query`, { page_size: 50 });
  const results = data.results as Array<Record<string, unknown>>;

  if (results.length === 0) {
    console.log("No posts in queue.");
    return;
  }

  for (const row of results) {
    const props = row.properties as Record<string, Record<string, unknown>>;
    const skill = extractProp(props.Skill);
    const platform = extractProp(props.Platform);
    const status = extractProp(props.Status);
    const draft = extractProp(props.Draft);
    const url = extractProp(props["Posted URL"]);

    const truncDraft = draft.length > 80 ? draft.slice(0, 80) + "..." : draft;
    console.log(`[${status.padEnd(8)}] ${platform.padEnd(6)} | ${skill.padEnd(30)} | ${truncDraft}${url ? ` -> ${url}` : ""}`);
  }
}

// --- CLI ---

const [command, ...args] = process.argv.slice(2);

checkToken();

switch (command) {
  case "setup":
    await setup();
    break;

  case "draft": {
    // Check for --reply-to flag
    const replyToIdx = args.indexOf("--reply-to");
    let replyToUrl: string | undefined;
    const filteredArgs = [...args];
    if (replyToIdx !== -1) {
      replyToUrl = filteredArgs[replyToIdx + 1];
      filteredArgs.splice(replyToIdx, 2);
    }
    const [platform, skill, ...textParts] = filteredArgs;
    const text = textParts.join(" ");
    if (!platform || !skill || !text) {
      console.error('Usage: bun run tools/notion-api.ts draft <X|Reddit> <skill-name> "post text" [--reply-to <url>]');
      process.exit(1);
    }
    await createDraft(platform, skill, text, replyToUrl);
    break;
  }

  case "check-approved":
    await checkApproved();
    break;

  case "mark-posted": {
    const [pageId, url] = args;
    if (!pageId || !url) {
      console.error("Usage: bun run tools/notion-api.ts mark-posted <page_id> <url>");
      process.exit(1);
    }
    await markPosted(pageId, url);
    break;
  }

  case "add-reply-to-column":
    await addReplyToColumn();
    break;

  case "update": {
    const [updPageId, ...updTextParts] = args;
    const updText = updTextParts.join(" ");
    if (!updPageId || !updText) {
      console.error('Usage: bun run tools/notion-api.ts update <page_id> "new draft text"');
      process.exit(1);
    }
    await updateDraft(updPageId, updText);
    break;
  }

  case "publish-queue":
    await publishQueue();
    break;

  case "list":
    await listAll();
    break;

  default:
    console.error("Commands: setup, draft, check-approved, publish-queue, mark-posted, list");
    process.exit(1);
}
