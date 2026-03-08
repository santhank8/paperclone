# Paperclip + OpenClaw: Quick Start Guide

**Goal:** Replace custom bash scripts with a proper agent orchestration platform.

---

## What You Get

### Before (Current System)
```
OpenCode Agent Swarm
├── spawn-agent.sh          # Create worktree, spawn tmux
├── check-agents.sh         # Monitor agents (cron every 10min)
├── auto-spawn-tasks.sh     # Auto-assign tasks (cron every 15min)
├── active-tasks.json       # Task registry (JSON file)
└── ClawDeck                # Task board (separate service)
```

**Pain Points:**
- Custom bash scripts = fragile
- ClawDeck is local-only (no mobile)
- No hierarchy (just flat task list)
- No governance/approvals
- No budget tracking
- No org chart visualization

### After (Paperclip + OpenClaw)
```
Paperclip (Control Plane)
├── React UI Dashboard      # Web + mobile-friendly
├── REST API                # /api/companies, /api/agents, /api/issues
├── PostgreSQL              # Persistent storage
├── Scheduler               # Heartbeat triggers
├── Governance              # Approvals, budgets
└── Org Chart               # Visual hierarchy
    │
    └── OpenClaw Adapter    # HTTP webhook
        │
        └── OpenClaw Agents # Execution (Jarvis, OpenCode, etc.)
```

**Benefits:**
- Battle-tested orchestration
- Web dashboard (access from anywhere)
- Hierarchical goals (company → goal → project → task)
- Built-in governance & approvals
- Per-agent budget tracking
- Visual org chart
- Activity audit trail
- Multiple adapter types (not just OpenCode)

---

## 5-Minute Test

### Step 1: Start Paperclip

```bash
cd ~/repos/paperclip
pnpm dev
```

Opens at: http://localhost:3100

### Step 2: Create a Test Agent

Via UI or API:

```bash
# Get company ID
curl http://localhost:3100/api/companies | jq '.[0].id'

# Create test agent
curl -X POST http://localhost:3100/api/companies/{companyId}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestAgent",
    "role": "engineer",
    "title": "Test Engineer",
    "capabilities": "Testing the webhook integration",
    "adapterType": "http",
    "adapterConfig": {
      "url": "http://httpbin.org/post",
      "method": "POST"
    }
  }'
```

### Step 3: Trigger a Heartbeat

```bash
# Via API
curl -X POST http://localhost:3100/api/agents/{agentId}/heartbeat/invoke

# Or via UI: click "Invoke" button on agent page
```

### Step 4: Check the Run

```bash
# View runs
curl http://localhost:3100/api/companies/{companyId}/heartbeat-runs

# Or in UI: Dashboard → Agents → TestAgent → Runs
```

---

## Migration Path

### Option A: Full Migration (Recommended)

Replace entire OpenCode Swarm with Paperclip.

**Pros:**
- Clean architecture
- All Paperclip features
- No maintenance of bash scripts

**Cons:**
- More work upfront
- Need to migrate ClawDeck tasks

**Timeline:** 5-7 days

### Option B: Hybrid

Keep OpenCode Swarm for execution, add Paperclip for governance.

**Pros:**
- Less disruptive
- Can use both systems

**Cons:**
- Two systems to maintain
- Data sync complexity

**Timeline:** 2-3 days

### Option C: Gradual

Start with one project/team in Paperclip, expand over time.

**Pros:**
- Low risk
- Learn as you go

**Cons:**
- Longest timeline
- Split focus

**Timeline:** 2-4 weeks

---

## Decision Matrix

| Factor | OpenCode Swarm | Paperclip |
|--------|----------------|-----------|
| **Setup Time** | Already done | 1-2 days |
| **Maintenance** | High (custom scripts) | Low (platform) |
| **Features** | Basic | Comprehensive |
| **Mobile Access** | No | Yes (web UI) |
| **Scalability** | Limited (10 agents) | High (unlimited) |
| **Governance** | None | Built-in |
| **Audit Trail** | Logs only | Full database |
| **Cost Tracking** | No | Yes |
| **Org Chart** | No | Yes |
| **Approvals** | No | Yes |

---

## Recommendation

**Go with Option A (Full Migration)** if:
- You want a proper platform (not scripts)
- You need mobile access
- You want governance/approvals
- You're building a real AI company

**Stick with current system** if:
- You're happy with bash scripts
- You don't need the extra features
- You want to minimize changes

---

## Next Steps

1. **Try the 5-minute test** above
2. **Review the full implementation plan:** `IMPLEMENTATION.md`
3. **Decide on migration option**
4. **Start Phase 1** when ready

---

## Questions?

- **Paperclip docs:** ~/repos/paperclip/docs/
- **Paperclip README:** ~/repos/paperclip/README.md
- **OpenClaw adapter:** ~/repos/paperclip/packages/adapters/openclaw/
- **Full plan:** ./IMPLEMENTATION.md
