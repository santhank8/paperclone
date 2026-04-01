---
name: paperclip-api-recovery
description: >
  Recovery playbooks for Paperclip API failures. Load when a Paperclip write
  operation (paperclipRequest POST/PATCH, issue comment, task update) returns 401, 403, or
  500, or when paperclipRequest to the Paperclip API fails. Covers: FK constraint on
  activity_log.run_id, JWT auth failures, stale session runId, and the
  stop-and-diagnose rule for 500s.
---

# Paperclip API Recovery Playbooks

**Rule #1: Never retry blind.** If a Paperclip API call fails, stop and read the error before retrying. Each blind retry wastes ~500 tokens and obscures the real cause. Diagnose once, fix once, retry once.

---

## Playbook A — HTTP 500 on any write endpoint

**Symptoms:** `paperclipRequest` POST or PATCH returns `{"error":"Internal server error"}`

**Step 1 — Is it an FK constraint on activity_log.run_id?**

Check the server log (terminal running `pnpm dev`) for:
```
foreign key constraint "activity_log_run_id_heartbeat_runs_id_fk"
Key (run_id)=(...) is not present in table "heartbeat_runs"
```

If yes: your JWT contains a synthetic `run_id` that isn't a real heartbeat run. This is a known issue. The fix is in place on recent server versions (the sentinel UUID `00000000-0000-0000-0000-000000000000` is automatically nulled out before insert). If you still see it:
- You may be on an older server version — ask a human to update
- Or your auth token is not a proper agent JWT — see Playbook B

**Step 2 — Is it something else?**

Copy the full error from the server log and stop. Do not retry. Post the error to your issue as a comment explaining what you were trying to do, then mark the task blocked. This is a server bug that needs human investigation.

---

## Playbook B — HTTP 401 Unauthorized

**Symptoms:** `paperclipRequest` returns `{"error":"Unauthorized"}` or `{"error":"Agent authentication required"}`

**Decision tree:**

1. **Is `PAPERCLIP_AGENT_JWT_SECRET` set?**
   Check `~/.paperclip/instances/default/.env` for the secret. If missing, `paperclipRequest` cannot mint a JWT.

2. **Is the JWT expired?** Default TTL is 48 hours. If your run started long ago, the token may be stale. `paperclipRequest` mints a fresh JWT each time, so this should not normally happen. If it does, save your work to a comment or file and stop.

3. **Is the server running in authenticated mode?** Check via `ctx_execute`:
   ```javascript
   const res = await fetch('http://localhost:3100/api/health');
   const health = await res.json();
   console.log(health.deploymentMode);
   ```
   If `"authenticated"` and `paperclipRequest` still fails, load `tailscale-jwt-auth` for the full auth chain diagnosis.

4. **Is your identity correct?** `paperclipRequest` resolves identity from `PAPERCLIP_AGENT_ID` / `PAPERCLIP_COMPANY_ID` env vars. If these are not set, pass an explicit `identity` option.

---

## Playbook C — `paperclipRequest` returns empty or unexpected response

**Symptoms:** `paperclipRequest` returns an empty body, an HTML page, or a non-JSON response.

**Causes and fixes:**

1. **Wrong URL format** — `paperclipRequest` expects paths without the `/api` prefix (it adds it automatically):
   ```javascript
   // Wrong: paperclipRequest('http://localhost:3100/api/issues/TIZA-123/comments')
   // Wrong: paperclipRequest('/api/issues/TIZA-123/comments')
   // Right: paperclipRequest('/issues/TIZA-123/comments')
   // Right: paperclipRequest(`/companies/${companyId}/issues`)
   ```

2. **Server not running** — `paperclipRequest` connects to `localhost:3100`. Verify the server is up:
   ```javascript
   const res = await fetch('http://localhost:3100/api/health');
   console.log(res.status, await res.text());
   ```

3. **Identifier not a UUID** — some endpoints require a UUID, not an identifier like `TIZA-123`. Resolve to UUID first:
   ```javascript
   const { response } = await paperclipRequest('/issues/TIZA-123');
   const issue = await response.json();
   console.log(issue.id); // use this UUID for subsequent calls
   ```

---

## Playbook D — Comment posted but not appearing / double-posted

**Symptoms:** `paperclipRequest` POST to `/issues/.../comments` returns 200 but the comment doesn't appear, or appears twice.

1. **Verify it was saved:**
   ```javascript
   const { response } = await paperclipRequest(`/issues/TIZA-123/comments`);
   const comments = await response.json();
   console.log(`Comment count: ${comments.length}`);
   ```

2. **If double-posted:** the request was retried after a timeout on a request that had already succeeded. Paperclip comments are not idempotent. Apologise in the issue and note which comment is the duplicate.

3. **If not appearing:** the `companyId` scope may be wrong — check you're posting to the correct company's issue.

---

## Quick-reference: stop conditions

Stop and ask for human help (post a blocked comment to the issue) when:

- You've retried the same request more than **twice** with the same error
- The server log shows an error you don't recognise from these playbooks
- The JWT is expired and you cannot mint a new one
- The server appears to be down (`paperclipRequest` times out or connection refused)

Continuing past these stop conditions burns tokens without making progress.
