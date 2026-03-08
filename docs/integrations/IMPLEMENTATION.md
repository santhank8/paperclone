# Paperclip + OpenClaw Integration: Detailed Implementation Plan

**Created:** 2026-03-08
**Status:** Planning
**Related:** `~/repos/paperclip/`, `~/.openclaw-orchestration/`

---

## Executive Summary

Replace the current **OpenCode Agent Swarm** (custom bash scripts + ClawDeck) with **Paperclip** (open-source agent orchestration platform) while keeping OpenClaw as the agent runtime.

### Key Benefits

| Current (OpenCode Swarm) | With Paperclip |
|--------------------------|----------------|
| Custom bash scripts | Battle-tested orchestration platform |
| ClawDeck (local-only) | Paperclip UI (web dashboard, mobile-friendly) |
| Flat task list | Hierarchical goals (company → goal → project → task) |
| Manual PR review tracking | Built-in governance & approvals |
| Simple status sync | Full audit trail + activity log |
| No budget tracking | Per-agent budgets + cost monitoring |
| No org chart | Chain of command + escalation |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PAPERCLIP (Control Plane)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  React UI    │  │  REST API    │  │  Scheduler   │          │
│  │  Dashboard   │  │  /api/...    │  │  Heartbeats  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                           │                                     │
│                    PostgreSQL                                  │
│                    (issues, agents, runs)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP Webhook (adapter: openclaw)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     OPENCLAW (Execution Plane)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Jarvis      │  │  OpenCode    │  │  Other       │          │
│  │  (CEO)       │  │  Agents      │  │  Agents      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  Each agent:                                                    │
│  - Receives webhook with task context                           │
│  - Calls Paperclip API to checkout/update tasks                 │
│  - Returns result via webhook response                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Paperclip Setup (Day 1)

### 1.1 Install & Run Paperclip Locally

```bash
# Clone if not already
cd ~/repos/paperclip

# Install dependencies
pnpm install

# Run in dev mode (embedded PostgreSQL)
pnpm dev

# Paperclip will be available at:
# - API: http://localhost:3100/api
# - UI: http://localhost:3100
```

**Data locations:**
```
~/.paperclip/
├── instances/
│   └── default/
│       ├── config.json      # Instance config
│       ├── db/              # PostgreSQL data
│       └── logs/            # Server logs
```

### 1.2 Onboard Paperclip

```bash
# Run onboarding wizard
pnpm paperclipai onboard

# Choose:
# - Deployment mode: local_trusted (for dev)
# - Company name: Jarvis AI
# - Company goal: "Build and maintain autonomous AI systems"
```

### 1.3 Create Company Structure

```bash
# Via API or UI
curl -X POST http://localhost:3100/api/companies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jarvis AI",
    "goal": "Build and maintain autonomous AI systems that run businesses",
    "description": "AI agent orchestration company"
  }'
```

---

## Phase 2: Create Agent Org Chart (Day 1)

### 2.1 Agent Mapping: Current → Paperclip

| Current Role | Paperclip Agent | Adapter | Reports To |
|--------------|-----------------|---------|------------|
| Jarvis | CEO | `openclaw` | (none) |
| Coder | BackendEngineer | `opencode_local` | CTO |
| Sally | DesignEngineer | `opencode_local` | CTO |
| Mike | QAEngineer | `opencode_local` | CTO |
| Richard | ResearchEngineer | `opencode_local` | CTO |
| Nolan | DevOpsEngineer | `opencode_local` | CTO |
| Elsa | MarketingEngineer | `opencode_local` | CMO |

### 2.2 Create CEO (Jarvis) with OpenClaw Adapter

```bash
# Create Jarvis as CEO
curl -X POST http://localhost:3100/api/companies/{companyId}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jarvis",
    "role": "ceo",
    "title": "Chief Executive Officer",
    "capabilities": "Strategic planning, team coordination, executive decisions",
    "adapterType": "openclaw",
    "adapterConfig": {
      "url": "http://localhost:18789/api/webhook/jarvis",
      "method": "POST",
      "webhookAuthHeader": "Bearer YOUR_OPENCLAW_TOKEN",
      "timeoutSec": 300
    },
    "budgetMonthlyCents": 50000
  }'
```

### 2.3 Create CTO (Reports to CEO)

```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CTO",
    "role": "manager",
    "title": "Chief Technology Officer",
    "capabilities": "Technical architecture, code review, engineering leadership",
    "reportsTo": "{jarvis-agent-id}",
    "adapterType": "opencode_local",
    "adapterConfig": {
      "cwd": "/home/montelai/.openclaw/workspace/repos",
      "model": "zai-coding-plan/glm-5",
      "instructionsFilePath": "/home/montelai/.openclaw/workspaces/jarvis-leader/AGENTS.md"
    },
    "budgetMonthlyCents": 30000
  }'
```

### 2.4 Create Engineering Team

```bash
# Backend Engineer (Coder)
curl -X POST http://localhost:3100/api/companies/{companyId}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BackendEngineer",
    "role": "engineer",
    "title": "Senior Backend Engineer",
    "capabilities": "Node.js, TypeScript, PostgreSQL, API design",
    "reportsTo": "{cto-agent-id}",
    "adapterType": "opencode_local",
    "adapterConfig": {
      "cwd": "/home/montelai/worktrees",
      "model": "zai-coding-plan/glm-5"
    },
    "budgetMonthlyCents": 20000
  }'
```

---

## Phase 3: OpenClaw Webhook Handler (Day 2)

### 3.1 Create Webhook Endpoint in OpenClaw

The OpenClaw adapter sends POST requests to the configured URL. We need to create a webhook handler that:

1. Receives heartbeat trigger from Paperclip
2. Wakes up the appropriate OpenClaw agent
3. Returns result to Paperclip

**Option A: Use OpenClaw's built-in cron/webhook system**

```bash
# Check if OpenClaw has webhook receiver
curl http://localhost:18789/api/webhook
```

**Option B: Create custom endpoint**

Create a simple Express/Fastify server that:
- Receives POST from Paperclip
- Invokes OpenClaw agent via API
- Returns result

### 3.2 Webhook Payload Structure

Paperclip sends:
```json
{
  "runId": "run-abc123",
  "agentId": "agent-42",
  "companyId": "company-1",
  "taskId": "issue-100",
  "issueId": "issue-100",
  "wakeReason": "assignment",
  "paperclip": {
    "context": {
      "taskId": "issue-100",
      "issueId": "issue-100",
      "wakeReason": "assignment"
    }
  }
}
```

### 3.3 Expected Response

```json
{
  "status": "success",
  "summary": "Task completed",
  "actions": [
    "Checked out task issue-100",
    "Implemented feature X",
    "Created PR #123"
  ]
}
```

---

## Phase 4: OpenClaw Agent Updates (Day 2-3)

### 4.1 Add Paperclip Skill to OpenClaw Agents

Each OpenClaw agent needs the `paperclip` skill to:
- Check assignments via Paperclip API
- Checkout tasks
- Update task status
- Post comments

**Update agent workspace:**

```bash
# Copy paperclip skill to agent workspace
cp -r ~/repos/paperclip/skills/paperclip \
  ~/.openclaw/workspaces/jarvis-leader/skills/
```

### 4.2 Environment Variables for Agents

When Paperclip invokes an agent, it injects:
```bash
PAPERCLIP_AGENT_ID=agent-42
PAPERCLIP_COMPANY_ID=company-1
PAPERCLIP_API_URL=http://localhost:3100/api
PAPERCLIP_RUN_ID=run-abc123
PAPERCLIP_API_KEY=<short-lived-jwt>
PAPERCLIP_TASK_ID=issue-100
PAPERCLIP_WAKE_REASON=assignment
```

### 4.3 Agent Heartbeat Procedure

Each OpenClaw agent follows this heartbeat protocol:

```
1. GET /api/agents/me → Get identity
2. GET /api/companies/{companyId}/issues?assigneeAgentId={id}&status=todo,in_progress,blocked → Get assignments
3. POST /api/issues/{issueId}/checkout → Claim task
4. [Do the work using tools]
5. PATCH /api/issues/{issueId} → Update status + comment
6. [Exit heartbeat]
```

---

## Phase 5: Migration from ClawDeck (Day 3-4)

### 5.1 Export Current Tasks from ClawDeck

```bash
# Get all tasks from ClawDeck
curl -s -H "Authorization: Bearer $CLAWDECK_TOKEN" \
  "http://localhost:3335/api/v1/tasks" | jq '.data' > clawdeck-tasks.json
```

### 5.2 Transform to Paperclip Issues

```python
# Script to convert ClawDeck tasks to Paperclip issues
import json

with open('clawdeck-tasks.json') as f:
    tasks = json.load(f)

for task in tasks:
    paperclip_issue = {
        "title": task["name"],
        "description": task.get("description", ""),
        "status": map_status(task["status"]),
        "priority": map_priority(task.get("priority")),
        "assigneeAgentId": map_agent(task.get("assignee")),
        # ... other fields
    }
    # POST to Paperclip
```

### 5.3 Status Mapping

| ClawDeck | Paperclip |
|----------|-----------|
| inbox | backlog |
| up_next | todo |
| in_progress | in_progress |
| in_review | in_review |
| done | done |

---

## Phase 6: Heartbeat Scheduling (Day 4)

### 6.1 Configure Agent Schedules

Each agent can have different heartbeat intervals:

```bash
# Set CEO to wake every 2 hours
PATCH /api/agents/{jarvis-id}
{
  "heartbeatConfig": {
    "intervalMinutes": 120,
    "enabled": true
  }
}

# Set engineers to wake every 30 minutes
PATCH /api/agents/{engineer-id}
{
  "heartbeatConfig": {
    "intervalMinutes": 30,
    "enabled": true
  }
}
```

### 6.2 Event-Driven Heartbeats

Paperclip triggers heartbeats on:
- **Assignment** - New task assigned to agent
- **Mention** - @AgentName in comment
- **Approval** - Approval request resolved
- **Manual** - Human clicks "Invoke" in UI

---

## Phase 7: Governance & Approvals (Day 5)

### 7.1 Approval Rules

Configure which actions require board approval:

```json
{
  "approvalRules": {
    "hiring": true,           // Agents hiring subordinates
    "budgetIncrease": true,   // Budget changes > 20%
    "strategy": true,         // CEO strategic decisions
    "termination": true       // Firing agents
  }
}
```

### 7.2 Board Notifications

Integrate with Telegram for approval requests:

```bash
# When approval needed, send to Telegram
curl -X POST "https://api.telegram.org/bot{token}/sendMessage" \
  -d "chat_id=-1003893288797" \
  -d "text=📋 Approval Required: {description}"
```

---

## Phase 8: Monitoring Dashboard (Day 5-6)

### 8.1 Paperclip Dashboard Features

- **Agent Status Grid** - All agents at a glance
- **Activity Feed** - Real-time actions
- **Cost Tracking** - Per-agent spending
- **Task Board** - Kanban view
- **Org Chart** - Visual hierarchy

### 8.2 Custom Metrics

Add custom metrics for OpenClaw-specific tracking:

```typescript
// Custom dashboard widget
{
  "type": "metric",
  "title": "OpenCode Agents",
  "query": "SELECT COUNT(*) FROM agents WHERE adapterType = 'opencode_local'",
  "refresh": 60000
}
```

---

## Phase 9: Tear Down Old System (Day 6-7)

### 9.1 Disable OpenCode Swarm Crontabs

```bash
# Disable monitoring cron
crontab -e
# Comment out:
# */10 * * * * ~/.openclaw-orchestration/check-agents.sh

# Disable auto-spawn cron
# */15 * * * * ~/.openclaw-orchestration/auto-spawn-tasks.sh
```

### 9.2 Archive Old Scripts

```bash
# Move to archive
mkdir -p ~/.openclaw-orchestration/_archived_2026-03-08
mv ~/.openclaw-orchestration/*.sh ~/.openclaw-orchestration/_archived_2026-03-08/
mv ~/.openclaw-orchestration/*.json ~/.openclaw-orchestration/_archived_2026-03-08/
```

### 9.3 Stop ClawDeck

```bash
# If ClawDeck is running as a service
pm2 stop clawdeck
# or
systemctl stop clawdeck
```

---

## Implementation Checklist

### Phase 1: Setup
- [ ] Install Paperclip (`pnpm install`)
- [ ] Run Paperclip dev server (`pnpm dev`)
- [ ] Complete onboarding wizard
- [ ] Create company

### Phase 2: Org Chart
- [ ] Create CEO (Jarvis) with openclaw adapter
- [ ] Create CTO
- [ ] Create engineering team (6 agents)
- [ ] Configure reporting relationships
- [ ] Set budgets

### Phase 3: Webhook
- [ ] Create webhook endpoint in OpenClaw
- [ ] Test Paperclip → OpenClaw connection
- [ ] Verify heartbeat delivery

### Phase 4: Agent Skills
- [ ] Add paperclip skill to agent workspaces
- [ ] Update agent prompts for heartbeat protocol
- [ ] Test checkout/update cycle

### Phase 5: Migration
- [ ] Export ClawDeck tasks
- [ ] Transform to Paperclip issues
- [ ] Import to Paperclip
- [ ] Verify task assignments

### Phase 6: Scheduling
- [ ] Configure heartbeat intervals
- [ ] Test event-driven heartbeats
- [ ] Verify assignment triggers

### Phase 7: Governance
- [ ] Configure approval rules
- [ ] Set up Telegram notifications
- [ ] Test approval workflow

### Phase 8: Monitoring
- [ ] Review Paperclip dashboard
- [ ] Add custom metrics
- [ ] Set up alerts

### Phase 9: Cleanup
- [ ] Disable old crontabs
- [ ] Archive old scripts
- [ ] Stop ClawDeck
- [ ] Update documentation

---

## Key Files to Create/Modify

### New Files

```
~/.openclaw/workspaces/jarvis-leader/
├── work/
│   └── paperclip-openclaw-integration/
│       ├── IMPLEMENTATION.md      (this file)
│       ├── WEBHOOK-HANDLER.ts     (OpenClaw webhook receiver)
│       ├── MIGRATION-SCRIPT.ts    (ClawDeck → Paperclip)
│       └── AGENT-CONFIG.json      (Agent definitions)
```

### Modified Files

```
~/repos/paperclip/
├── .paperclip/
│   └── config.json                (Paperclip instance config)

~/.openclaw/workspaces/jarvis-leader/
├── MEMORY.md                      (Update references)
├── HEARTBEAT.md                   (Update heartbeat protocol)
└── skills/
    └── paperclip/                 (Copy from paperclip repo)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Paperclip bugs | Keep old scripts archived, not deleted |
| Webhook failures | Add retry logic, fall back to polling |
| Agent confusion | Clear documentation, test thoroughly |
| Data loss | Export ClawDeck before migration |

---

## Success Criteria

1. **All agents migrated** - 7 agents running in Paperclip
2. **Heartbeats working** - Agents wake on schedule/events
3. **Task sync** - Issues created/updated in Paperclip
4. **Governance active** - Approvals flow through board
5. **Dashboard live** - Real-time visibility in Paperclip UI
6. **Old system retired** - No more bash scripts, ClawDeck stopped

---

## Timeline

| Day | Focus | Deliverable |
|-----|-------|-------------|
| 1 | Setup + Org | Paperclip running, agents created |
| 2 | Webhook | OpenClaw receiving heartbeats |
| 3 | Migration | Tasks moved from ClawDeck |
| 4 | Scheduling | Heartbeats on schedule |
| 5 | Governance | Approvals working |
| 6 | Monitoring | Dashboard complete |
| 7 | Cleanup | Old system retired |

---

## Next Steps

1. **Start Phase 1** - Install and run Paperclip
2. **Create test agent** - Verify webhook delivery
3. **Migrate one task** - End-to-end test
4. **Iterate** - Fix issues, repeat

---

**Questions to resolve:**
- [ ] Does OpenClaw have built-in webhook receiver? (Check docs)
- [ ] Can OpenClaw agents call external APIs? (Yes, via tools)
- [ ] What's the Paperclip API auth flow for agents? (JWT via PAPERCLIP_API_KEY)
