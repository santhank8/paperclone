# End-to-End Monitor: GitHub PR + Issue Digest

A complete proactive agent that:
- Polls GitHub hourly for new PRs and issues
- Stays silent when nothing is new
- Posts a morning digest at 9am with everything since yesterday
- Persists state between sessions

---

## Architecture

```
CronCreate (hourly)
  └─→ Fetch PRs + issues since last check
       ├─→ Nothing new → update cursor, output nothing
       └─→ New items → append to queue in state file

CronCreate (9am daily)
  └─→ Read accumulated queue
       ├─→ Empty → output nothing
       └─→ Has items → format digest, post to Slack/file, clear queue

Stop hook
  └─→ Save agent-state.json

SessionStart hook
  └─→ Load agent-state.json → report queue depth
```

---

## Step 1: Initialize State File

Run once to bootstrap:

```bash
mkdir -p .claude
cat > .claude/github-monitor-state.json << 'EOF'
{
  "version": 1,
  "updatedAt": "",
  "lastCheck": 0,
  "cursors": {
    "lastPRNumber": 0,
    "lastIssueNumber": 0
  },
  "digestQueue": []
}
EOF
```

---

## Step 2: Register the Hourly Collector

```
CronCreate({
  name: "github-hourly-collect",
  cron: "0 * * * *",
  prompt: `GitHub monitor: collect new items.

Read .claude/github-monitor-state.json.
Extract cursors.lastPRNumber and cursors.lastIssueNumber.

Run:
  gh pr list --repo OWNER/REPO --json number,title,author,createdAt,url --limit 50
  gh issue list --repo OWNER/REPO --json number,title,author,createdAt,url --limit 50

Filter for items with number > lastPRNumber (or lastIssueNumber).
If new items found:
  - Append them to digestQueue[] with type ("pr" or "issue"), title, number, author, url, discoveredAt (now)
  - Update cursors.lastPRNumber and cursors.lastIssueNumber to max numbers seen
  - Write updated state to .claude/github-monitor-state.json
  - Output: "Collected N items (M PRs, K issues)"
If no new items:
  - Update updatedAt in state file
  - Write state file
  - Output NOTHING`,
  workingDirectory: "/Users/me/projects/myapp"
})
```

---

## Step 3: Register the Morning Digest

```
CronCreate({
  name: "github-morning-digest",
  cron: "0 9 * * *",
  prompt: `GitHub morning digest.

Read .claude/github-monitor-state.json.
If digestQueue is empty: output nothing.

If digestQueue has items:
  Format a digest:
  ---
  ## GitHub Digest — [today's date]

  ### New Pull Requests ([count])
  - #[number]: [title] by @[author] — [url]
  (one line per PR)

  ### New Issues ([count])
  - #[number]: [title] by @[author] — [url]
  (one line per issue)
  ---

  Write the digest to .claude/digests/$(date +%Y-%m-%d).md
  Clear digestQueue to []
  Write updated state to .claude/github-monitor-state.json
  Output the formatted digest`,
  workingDirectory: "/Users/me/projects/myapp"
})
```

---

## Step 4: Add Stop + SessionStart Hooks

```json
// ~/.claude/settings.json
{
  "hooks": {
    "Stop": [{
      "command": "node -e \"const fs=require('fs'); try { const s=JSON.parse(fs.readFileSync('.claude/github-monitor-state.json')); s.updatedAt=new Date().toISOString(); fs.writeFileSync('.claude/github-monitor-state.json', JSON.stringify(s,null,2)); console.log('State saved'); } catch(e) { console.log('State save skipped: no state file'); }\""
    }],
    "SessionStart": [{
      "command": "node -e \"const fs=require('fs'); try { const s=JSON.parse(fs.readFileSync('.claude/github-monitor-state.json')); const age=s.lastCheck ? Math.round((Date.now()-s.lastCheck)/60000)+'m ago' : 'never'; console.log('GitHub monitor: last check '+age+', '+s.digestQueue.length+' items queued'); } catch(e) { console.log('GitHub monitor: not initialized'); }\""
    }]
  }
}
```

---

## Step 5: Verify the Setup

```bash
# List active crons
CronList()
# Expected: github-hourly-collect, github-morning-digest

# Test the collector manually (before trusting the cron)
# Manually run the hourly prompt once and observe output
# Verify state file was updated: cat .claude/github-monitor-state.json

# Simulate a morning digest
# Temporarily add an item to digestQueue, run morning digest prompt, verify output
```

---

## Full State File After Running

```json
{
  "version": 1,
  "updatedAt": "2026-03-15T10:00:00Z",
  "lastCheck": 1710496800000,
  "cursors": {
    "lastPRNumber": 142,
    "lastIssueNumber": 89
  },
  "digestQueue": [
    {
      "type": "pr",
      "number": 142,
      "title": "Fix auth token refresh",
      "author": "alice",
      "url": "https://github.com/owner/repo/pull/142",
      "discoveredAt": "2026-03-15T09:00:12Z"
    }
  ]
}
```

---

## Extending the Monitor

**Add Slack notifications:**
```
If new items found:
  curl -s -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    -d '{"text": "New PR: #[number] — [title]"}'
```

**Add label filtering:**
```
Filter for issues with label "needs-review" only
```

**Add reviewer assignment alerts:**
```
gh pr list --search "review-requested:@me" --json number,title
Alert only when this list changes
```
