# How to Apply the OpenClaw Config Patch

## Quick Start

You have two files ready to apply:

1. **`openclaw-new.json`** — Complete new configuration (all changes applied)
2. **`openclaw-changes.md`** — Detailed documentation of every change

---

## Fastest Path (Recommended)

### Step 1: Backup Current Config
```bash
cp /Users/sarda/.openclaw/openclaw.json /Users/sarda/.openclaw/openclaw.json.backup-local-models
```

### Step 2: Apply New Config
```bash
cp /Volumes/JS-DEV/paperclip-setup/config/openclaw-new.json /Users/sarda/.openclaw/openclaw.json
```

### Step 3: Validate JSON
```bash
cat /Users/sarda/.openclaw/openclaw.json | jq . > /dev/null && echo "✅ Valid JSON"
```

### Step 4: Restart OpenClaw Gateway
```bash
openclaw gateway restart
```

### Step 5: Verify
```bash
openclaw agents list
```

You should see exactly **4 agents**:
- `main` (Donna)
- `jonathan-blow`
- `codex-agent`
- `haiku-sprint` ← NEW

---

## Manual Verification (Optional)

Before applying, review key changes:

### Check 1: No lmstudio-jcs Provider
```bash
cat /Volumes/JS-DEV/paperclip-setup/config/openclaw-new.json | \
  jq '.models.providers | keys' | grep -i lmstudio
# Should return nothing (no output)
```

### Check 2: New haiku-sprint Agent
```bash
cat /Volumes/JS-DEV/paperclip-setup/config/openclaw-new.json | \
  jq '.agents.list[] | select(.id=="haiku-sprint")'
# Should show the new agent config
```

### Check 3: No Local Agents
```bash
cat /Volumes/JS-DEV/paperclip-setup/config/openclaw-new.json | \
  jq '.agents.list | map(.id)'
# Should output: ["main", "jonathan-blow", "codex-agent", "haiku-sprint"]
```

### Check 4: Clean Fallbacks
```bash
cat /Volumes/JS-DEV/paperclip-setup/config/openclaw-new.json | \
  jq '.agents.defaults.model.fallbacks[]' | grep lmstudio
# Should return nothing (no output)
```

---

## Manual Application (If You Need to Customize)

If you want to preserve custom settings beyond this patch, use the detailed change log in `openclaw-changes.md`:

1. Open your current `/Users/sarda/.openclaw/openclaw.json` in an editor
2. Follow the section-by-section guide in `openclaw-changes.md`
3. Apply each change manually
4. Validate JSON and restart

---

## If Something Goes Wrong

### Config won't parse?
```bash
cat /Users/sarda/.openclaw/openclaw.json | jq . 2>&1 | head -20
# Shows you the JSON error location
```

### Restore backup:
```bash
cp /Users/sarda/.openclaw/openclaw.json.backup-local-models /Users/sarda/.openclaw/openclaw.json
openclaw gateway restart
```

### Can't restart gateway?
```bash
# Kill any running OpenClaw processes
pkill -f openclaw

# Wait 2 seconds, then start fresh
sleep 2
openclaw gateway start
```

---

## Testing After Apply

### Test 1: Gateway is running
```bash
curl -s http://localhost:18789/api/status | jq .status
# Should output: "ok"
```

### Test 2: Config is loaded
```bash
openclaw --config /Users/sarda/.openclaw/openclaw.json status
# Should show agent list with 4 agents
```

### Test 3: Spawn main agent (via telegram or CLI)
```bash
# Via telegram (as the allowed user):
# Type: /agents or query main agent

# Via CLI:
openclaw sessions spawn --agent main --prompt "hello"
```

---

## Expected Outcomes

### ✅ Should Work
- Main agent (Donna) spawning and running
- Main agent with Anthropic/GitHub Copilot fallbacks
- Codex-agent and jonathan-blow agents starting
- New haiku-sprint agent ready for Paperclip work
- Telegram commands functioning normally
- Gateway listening on port 18789

### ❌ Will No Longer Work
- Spawning `crow-9b-opus`, `qwen-9b-q8`, `nemotron-3-nano-4b` agents
- Spawning `lms-agent`
- Using `lmstudio-jcs/...` or `lmstudio/...` model identifiers
- Any script that explicitly references local model agents

---

## Timeline

- **Backup:** Instant
- **Copy new config:** <1 second
- **Gateway restart:** 2–5 seconds
- **First agent spawn:** 3–10 seconds (depends on cloud API latency)

Total downtime: **~10 seconds**

---

## Contact / Troubleshooting

For issues:
1. Check the **Verification Checklist** in `openclaw-changes.md`
2. Review **What to Watch For** section in `openclaw-changes.md`
3. Check gateway logs: `openclaw gateway status --verbose`
4. Restore backup and try again

---

**Ready to apply?** Run:
```bash
cp /Users/sarda/.openclaw/openclaw.json /Users/sarda/.openclaw/openclaw.json.backup-local-models && \
cp /Volumes/JS-DEV/paperclip-setup/config/openclaw-new.json /Users/sarda/.openclaw/openclaw.json && \
cat /Users/sarda/.openclaw/openclaw.json | jq . > /dev/null && echo "✅ Config valid" || echo "❌ Invalid JSON" && \
openclaw gateway restart
```
