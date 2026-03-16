#!/usr/bin/env bun
/**
 * Post X/Twitter replies via headless browser (bypasses API reply restrictions).
 *
 * Usage:
 *   bun run tools/x-reply-browser.ts <tweet_url> "reply text"
 *   bun run tools/x-reply-browser.ts --from-notion   (posts all approved replies with Reply To URLs)
 */

const BROWSE = `${process.env.HOME}/.claude/skills/gstack/browse/dist/browse`;

async function run(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn([BROWSE, ...args], { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function replyToTweet(tweetUrl: string, replyText: string): Promise<boolean> {
  console.log(`  Navigating to ${tweetUrl}...`);
  const nav = await run(["goto", tweetUrl]);
  if (nav.exitCode !== 0) {
    console.error(`  Failed to navigate: ${nav.stderr}`);
    return false;
  }
  await sleep(3000);

  // Click the reply input area on the tweet page
  console.log("  Clicking reply box...");
  const click = await run(["click", '[data-testid="tweetTextarea_0"]']);
  if (click.exitCode !== 0) {
    // Try alternative selector
    const click2 = await run(["click", '[data-testid="reply"]']);
    if (click2.exitCode !== 0) {
      console.error(`  Could not find reply box: ${click2.stderr}`);
      // Take debug screenshot
      await run(["screenshot", "/tmp/x-reply-debug.png"]);
      console.error("  Debug screenshot saved to /tmp/x-reply-debug.png");
      return false;
    }
    await sleep(1000);
    // Now click the text area that should have appeared
    const click3 = await run(["click", '[data-testid="tweetTextarea_0"]']);
    if (click3.exitCode !== 0) {
      console.error(`  Reply box still not found after clicking reply button`);
      await run(["screenshot", "/tmp/x-reply-debug.png"]);
      return false;
    }
  }
  await sleep(500);

  // Type the reply text (type command types into focused element, no selector needed)
  console.log("  Typing reply...");
  const type = await run(["type", replyText]);
  if (type.exitCode !== 0) {
    console.error(`  Failed to type: ${type.stderr}`);
    return false;
  }
  await sleep(1000);

  // Click the Reply button to submit
  console.log("  Submitting reply...");
  const submit = await run(["click", '[data-testid="tweetButtonInline"]']);
  if (submit.exitCode !== 0) {
    console.error(`  Failed to click submit: ${submit.stderr}`);
    await run(["screenshot", "/tmp/x-reply-debug.png"]);
    return false;
  }
  await sleep(3000);

  // Verify by taking a screenshot
  await run(["screenshot", "/tmp/x-reply-success.png"]);
  console.log("  Reply posted. Screenshot at /tmp/x-reply-success.png");
  return true;
}

async function fromNotion(): Promise<void> {
  // Get approved posts with Reply To URLs from Notion
  const proc = Bun.spawn(["bun", "run", "tools/notion-api.ts", "check-approved"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  // Parse the output for entries with Reply To info
  // We need to query Notion directly for Reply To URLs
  // For now, use the notion-api.ts to get full data
  const queryProc = Bun.spawn(
    ["bun", "run", "tools/notion-api.ts", "check-approved-json"],
    { stdout: "pipe", stderr: "pipe" }
  );
  const queryStdout = await new Response(queryProc.stdout).text();
  const queryExitCode = await queryProc.exited;

  if (queryExitCode !== 0) {
    // Fallback: parse the text output
    console.log("Note: check-approved-json not available. Use manual mode:");
    console.log('  bun run tools/x-reply-browser.ts <tweet_url> "reply text"');
    return;
  }

  const entries = JSON.parse(queryStdout) as Array<{
    id: string;
    draft: string;
    replyTo: string;
    platform: string;
  }>;

  const replies = entries.filter((e) => e.replyTo && e.platform === "X");

  if (replies.length === 0) {
    console.log("No approved replies with Reply To URLs found.");
    return;
  }

  console.log(`Found ${replies.length} approved reply(ies). Posting with staggered timing...\n`);

  for (let i = 0; i < replies.length; i++) {
    const { id, draft, replyTo } = replies[i];
    console.log(`[${i + 1}/${replies.length}] Replying to: ${replyTo}`);
    console.log(`  Text: ${draft.slice(0, 80)}${draft.length > 80 ? "..." : ""}`);

    const success = await replyToTweet(replyTo, draft);

    if (success) {
      // Mark as posted in Notion
      Bun.spawn(["bun", "run", "tools/notion-api.ts", "mark-posted", id, replyTo], {
        stdout: "inherit",
        stderr: "inherit",
      });
    }

    // Stagger 3-7 min between replies
    if (i < replies.length - 1) {
      const delaySec = 180 + Math.floor(Math.random() * 240);
      const delayMin = (delaySec / 60).toFixed(1);
      console.log(`  Waiting ${delayMin} minutes before next reply...\n`);
      await sleep(delaySec * 1000);
    }
  }

  console.log("\nAll replies posted.");
}

// --- CLI ---
const [command, ...args] = process.argv.slice(2);

if (command === "--from-notion") {
  await fromNotion();
} else if (command && args.length > 0) {
  const tweetUrl = command;
  const replyText = args.join(" ");
  const success = await replyToTweet(tweetUrl, replyText);
  process.exit(success ? 0 : 1);
} else {
  console.error('Usage:');
  console.error('  bun run tools/x-reply-browser.ts <tweet_url> "reply text"');
  console.error('  bun run tools/x-reply-browser.ts --from-notion');
  process.exit(1);
}
