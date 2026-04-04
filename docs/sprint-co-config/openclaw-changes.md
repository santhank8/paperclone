# OpenClaw Configuration Changes — Local Model Removal

## Summary
This document describes the complete overhaul of the OpenClaw configuration to **remove all local LM Studio models** and replace them with cloud-only providers. This ensures reliable fallbacks and simplifies the agent infrastructure.

---

## Changes Made

### 1. ✅ Removed `lmstudio-jcs` Provider Entirely

**What was removed:**
- The entire `models.providers.lmstudio-jcs` block (lines 90–177 in original config)
- All 4 local models:
  - `crow-9b-opus-4.6-distill-heretic_qwen3.5`
  - `qwen/qwen3.5-35b-a3b`
  - `qwen/qwen3.5-9b`
  - `nvidia/nemotron-3-nano-4b`

**Why:** These local models are not accessible via a remote connection and create unreliable fallback chains. Cloud providers are always available.

**New state:** `models.providers` is now an empty object `{}`.

---

### 2. ✅ Cleaned `agents.defaults.model.fallbacks`

**What was removed:**
- `lmstudio-jcs/crow-9b-opus-4.6-distill-heretic_qwen3.5`
- `lmstudio-jcs/qwen/qwen3.5-35b-a3b`
- `lmstudio-jcs/qwen/qwen3.5-9b`
- `lmstudio-jcs/nvidia/nemotron-3-nano-4b`
- `lmstudio/qwen/qwen3.5-35b-a3b`
- `lmstudio/crow-9b-opus-4.6-distill-heretic_qwen3.5`

**What remains (cloud only):**
- ✅ `anthropic/*` models (Claude Sonnet, Opus, Haiku)
- ✅ `github-copilot/*` models (GPT codex variants, Gemini variants)
- ✅ `openai-codex/*` models
- ✅ `openai/o4-mini-deep-research`

**New fallback chain:** 23 entries → 21 entries (all cloud).

---

### 3. ✅ Cleaned `agents.defaults.models`

**What was removed:**
- `lmstudio-jcs/crow-9b-opus-4.6-distill-heretic_qwen3.5` (with alias "crow")
- `lmstudio-jcs/qwen/qwen3.5-35b-a3b` (with alias "qwen")
- `lmstudio-jcs/qwen/qwen3.5-9b` (with alias "qwen9")
- `lmstudio-jcs/nvidia/nemotron-3-nano-4b` (with alias "nemotron")
- `lmstudio/qwen/qwen3.5-35b-a3b`
- `lmstudio/crow-9b-opus-4.6-distill-heretic_qwen3.5`

**What remains:** All Anthropic, GitHub Copilot, and OpenAI Codex models.

---

### 4. ✅ Removed 5 Local-Model Agent Entries from `agents.list`

**Deleted agents:**
- `lms-agent` — was a crow-9b research agent
- `crow-9b-opus` — dedicated crow model agent
- `qwen3-5-35b-a3b` — Qwen 35B agent
- `qwen-9b-q8` — Qwen 9B agent
- `nemotron-3-nano-4b` — NVIDIA Nemotron agent

**New agents in list:**
- ✅ `main` (Donna) — primary agent, now cloud-only fallbacks
- ✅ `jonathan-blow` — cleaned of local subagents
- ✅ `codex-agent` — cleaned of local subagents
- ✅ `haiku-sprint` — **NEW** cloud agent for Paperclip sprint work

**Remaining agents:** 4 total (down from 9).

---

### 5. ✅ Updated Main Agent's `subagents` Section

**What was removed:**
- `subagents.allowAgents`:
  - ~~crow-9b-opus~~
  - ~~qwen-9b-q8~~
  - ~~nemotron-3-nano-4b~~
- Entire `subagents.model` block (which pointed to lmstudio-jcs models)

**New state:**
```json
"subagents": {
  "allowAgents": [],
  "thinking": "minimal"
}
```

**Why:** Main agent no longer spawns local subagents. Future subagent spawning will use the agent's own model chain or explicit agent invocation via `sessions_spawn`.

---

### 6. ✅ Updated Secondary Agents' `subagents` Sections

**Agents affected:**
- `jonathan-blow`
- `codex-agent`

**Changes:**
- Removed all `allowAgents` entries (crow, qwen, nemotron)
- Removed entire `subagents.model` block

**New state:** Both now have minimal subagent config (allowAgents: [], thinking: "minimal").

---

### 7. ✅ Cleaned `tools.agentToAgent.allow`

**What was removed:**
- `qwen3-5-35b-a3b`
- `crow-9b-opus`
- `qwen-9b-q8`
- `nemotron-3-nano-4b`

**New state:**
```json
"agentToAgent": {
  "enabled": true,
  "allow": []
}
```

**Why:** These agents no longer exist. Agent-to-agent communication can still be enabled, but no agents are pre-allowed.

---

### 8. ✅ Added New Haiku Sprint Agent

**New entry in `agents.list`:**
```json
{
  "id": "haiku-sprint",
  "name": "Haiku Sprint Agent",
  "workspace": "/Volumes/JS-DEV/paperclip-setup",
  "agentDir": "/Users/sarda/.openclaw/agents/haiku-sprint/agent",
  "model": {
    "primary": "anthropic/claude-haiku-4-5",
    "fallbacks": ["anthropic/claude-sonnet-4-6"]
  },
  "identity": {
    "name": "Sprint Agent",
    "theme": "autonomous sprint worker",
    "emoji": "⚡"
  }
}
```

**Purpose:** Dedicated cloud-only agent for Paperclip sprint work. Uses Haiku for speed + cost efficiency, with Sonnet fallback.

---

## Preserved Settings

✅ **Auth profiles** — All 4 remain intact:
- `anthropic:js-march-26`
- `anthropic:default` ← Claude Code API token
- `openai-codex:default`
- `github-copilot:github`

✅ **Main agent** — Kept as primary with cloud-only fallbacks

✅ **Tools configuration** — Profile, sessions, broadcast, commands all unchanged

✅ **Gateway settings** — Port 18789, auth token, Tailscale config unchanged

✅ **Telegram channel config** — Bot token, allowlist, policy unchanged

---

## How to Apply

### Option 1: Direct Replacement (Recommended if Safe)
```bash
cp /Volumes/JS-DEV/paperclip-setup/config/openclaw-new.json /Users/sarda/.openclaw/openclaw.json
```

Then restart OpenClaw:
```bash
openclaw gateway restart
```

### Option 2: Using OpenClaw Gateway Config Tool
If the gateway is running at port 18789:
```bash
# Verify gateway status
curl -H "Authorization: Bearer 5f323ad967a9067f82e284e9ebd9112f7b9a74b6c74869c2" \
  http://localhost:18789/api/status

# Apply config (exact endpoint depends on gateway implementation)
# Consider using: openclaw gateway config patch < patch-commands.json
```

### Option 3: Manual Merge
If you need to preserve custom edits beyond this patch:
1. Open `openclaw.json` in an editor
2. Use the detailed change list above to manually apply each section
3. Validate JSON syntax before saving

---

## Verification Checklist

After applying the changes, verify:

- [ ] `models.providers` is empty (no `lmstudio-jcs`)
- [ ] `agents.list` contains exactly 4 agents: `main`, `jonathan-blow`, `codex-agent`, `haiku-sprint`
- [ ] `haiku-sprint` agent exists and points to `/Volumes/JS-DEV/paperclip-setup`
- [ ] All `agents.*.subagents.allowAgents` are empty arrays
- [ ] All `agents.*.subagents.model` blocks are removed
- [ ] No `lmstudio-jcs/` or `lmstudio/` entries remain in fallback arrays
- [ ] `tools.agentToAgent.allow` is an empty array
- [ ] `auth.profiles` still contains `anthropic:default`, `github-copilot:github`, `openai-codex:default`
- [ ] Gateway auth token is unchanged
- [ ] Telegram bot token is unchanged

Run OpenClaw once to verify:
```bash
openclaw --version
# Should start successfully without lmstudio connection errors
```

---

## What to Watch For

### Breaking Changes

1. **Agents that were spawned as subagents:**
   - If your session code explicitly spawned `crow-9b-opus`, `qwen-9b-q8`, or `nemotron-3-nano-4b`, those calls will **fail** with "agent not found"
   - **Fix:** Replace with cloud agents or use `main` agent and let it choose fallbacks

2. **Hard-coded agent IDs:**
   - If any automation or scripts reference local agent IDs, they need updates:
     - ~~`lms-agent`~~ → Use `main` or spawn cloud agents
     - ~~`crow-9b-opus`~~ → Use `main` with fallbacks
     - ~~`qwen3-5-35b-a3b`~~ → Use `main` with fallbacks
     - ~~`qwen-9b-q8`~~ → Use `main` with fallbacks
     - ~~`nemotron-3-nano-4b`~~ → Use `main` with fallbacks

3. **Agent-to-agent communication:**
   - Previous calls to spawn local model agents won't work
   - The `allowAgents` list is now empty, so cross-agent spawning is disabled by default
   - To enable again, add specific cloud agent IDs to `allowAgents`

### Safe to Ignore

- No auth token changes needed
- No gateway restart required immediately (can be deferred)
- No workspace data loss
- No user settings affected
- Sports betting workspace (`/Users/sarda/.openclaw/workspace-sports-betting`) is unaffected

---

## Rollback

If you need to revert:
```bash
# Restore from backup
cp /Users/sarda/.openclaw/openclaw.json.backup /Users/sarda/.openclaw/openclaw.json

# Or keep the new.json and rename:
mv /Users/sarda/.openclaw/openclaw.json /Users/sarda/.openclaw/openclaw.json.no-local-models
cp /path/to/backup /Users/sarda/.openclaw/openclaw.json
```

---

## Questions or Issues?

- **Config won't parse:** Run `cat openclaw.json | jq .` to validate JSON
- **Agents won't start:** Check `agentDir` paths exist and are readable
- **Subagent spawn fails:** Verify agent `id` exists in `agents.list`
- **Auth issues:** Confirm `auth.profiles` are intact and tokens are set

---

Generated: 2026-03-30 18:15 PDT
