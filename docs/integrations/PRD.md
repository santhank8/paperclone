# PRD: Paperclip + OpenClaw Integration

**Project ID:** `paperclip-openclaw-integration`
**Status:** Planning
**Created:** 2026-03-08
**Updated:** 2026-03-08
**Feature Branch:** `feat/openclaw-integration`
**Repository:** `~/repos/paperclip/`
**GitHub:** https://github.com/montelai/paperclip/tree/feat/openclaw-integration

---

## Overview

Integrate Paperclip as the **control plane** for Jarvis Workspace (mimo app), enabling multi-channel user interaction (Telegram, web, etc.) while keeping mimo as the primary user interface.

---

## Architecture: Multi-Channel User Interaction

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION LAYER                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Mimo App   │  │  Telegram   │  │   Discord   │  │   Web UI    │   │
│  │  (Primary)  │  │  (Channel)  │  │  (Channel)  │  │  (Channel)  │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │           │
│         └────────────────┴────────────────┴────────────────┘           │
│                                   │                                     │
│                          OpenClaw Gateway                                │
│                        (Message Router)                                  │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PAPERCLIP (Control Plane)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Agents     │  │  Issues     │  │  Scheduler  │  │  Governance │   │
│  │  (org chart)│  │  (tasks)    │  │ (heartbeats)│  │ (approvals) │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
│  Single source of truth: PostgreSQL                                    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    │ Webhook / API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        OPENCLAW (Execution Plane)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Jarvis     │  │  Coder      │  │  Sally      │  │  Mike       │   │
│  │  (CEO)      │  │  (Backend)  │  │  (Frontend) │  │  (QA)       │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
│  Skills: MEMORY.md, tools, proactive-agent, etc.                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## User Interaction Flow

### Scenario 1: User Sends Telegram Message

```
User ──Telegram──► OpenClaw Gateway ──► Route to Agent ──► Paperclip API
                         │                      │
                         │                      │ 1. Get/Create Issue
                         │                      │ 2. Checkout Task
                         │                      │ 3. Execute Work
                         │                      │ 4. Update Status
                         │                      │
                         │◄───── Response ◄─────┘
                         │
                         ▼
                 Telegram Reply
```

### Scenario 2: User Uses Mimo App

```
User ──Mimo App──► OpenClaw Gateway ──► Direct Agent Session
                         │                      │
                         │                      │ Execute with full context
                         │                      │
                         │◄───── Response ◄─────┘
                         │
                         ▼
                    Mimo App UI
```

### Scenario 3: Scheduled Heartbeat (No User)

```
Paperclip Scheduler ──► Webhook ──► OpenClaw Agent
         │                               │
         │                               │ 1. Check assignments
         │                               │ 2. Do work if task exists
         │                               │ 3. Report result
         │                               │
         │◄───── Cost/Status ◄───────────┘
```

---

## Goals

### Primary Goals
1. **Multi-channel support** - Users can interact via Telegram, Mimo app, web UI
2. **Unified task management** - All channels route through Paperclip
3. **Eliminate redundancy** - Remove ClawDeck, AGENTS.md, bash scripts
4. **Keep mimo as primary UI** - Mimo app remains the main interface

### Non-Goals
- Replacing mimo app with Paperclip UI
- Changing OpenClaw's channel integrations
- Modifying Telegram bot behavior

---

## Branching Strategy

### Long-Running Feature Branch

```
main (upstream paperclipai/paperclip)
  │
  └──► feat/openclaw-integration (OUR BASE)
         │
         ├──► feat/pc-1-setup-paperclip
         ├──► feat/pc-2-create-agents
         ├──► feat/pc-3-webhook-integration
         ├──► feat/pc-4-channel-routing
         ├──► feat/pc-5-agent-skills
         ├──► feat/pc-6-migrate-tasks
         ├──► feat/pc-7-scheduling
         ├──► feat/pc-8-governance
         ├──► feat/pc-9-monitoring
         └──► feat/pc-10-cleanup
```

### Rules

1. **Feature branch is base** - All PRs target `feat/openclaw-integration`, NOT `main`
2. **Worktrees for isolation** - Each phase gets its own worktree
3. **Squash merge** - Keep history clean on feature branch
4. **Final merge to main** - After all phases complete and tested

### Creating Worktrees

```bash
cd ~/repos/paperclip
git worktree add ~/worktrees/pc-4-channel-routing -b feat/pc-4-channel-routing feat/openclaw-integration
```

### Creating PRs

```bash
gh pr create --base feat/openclaw-integration --head feat/pc-4-channel-routing
```

---

## Phase 4 (NEW): Channel Routing

### Overview
Implement multi-channel message routing through Paperclip.

### Tasks
- [ ] Design channel routing schema
- [ ] Map Telegram topics → Paperclip issues
- [ ] Map Mimo sessions → Paperclip sessions
- [ ] Implement channel-aware agent dispatch
- [ ] Test cross-channel task continuity

### Channel Mapping

| Channel | Identifier | Maps To |
|---------|------------|---------|
| Telegram Topic 2520 | `telegram:-1003893288797:2520` | Paperclip Issue |
| Telegram DM | `telegram:261069981` | Paperclip Issue |
| Mimo App Session | `mimo:session-abc123` | Paperclip Session |
| Web UI | `web:user-xyz` | Paperclip Issue |

### Routing Logic

```typescript
// In OpenClaw Gateway
async function routeMessage(channel: string, sender: string, message: string) {
  // 1. Identify or create Paperclip issue
  const issue = await findOrCreateIssue(channel, sender, message);
  
  // 2. Determine which agent should handle
  const agent = await assignAgent(issue);
  
  // 3. Trigger heartbeat or direct invocation
  if (agent.status === 'idle') {
    await triggerHeartbeat(agent.id, { issueId: issue.id, channel });
  } else {
    await invokeDirect(agent.id, { issueId: issue.id, message, channel });
  }
  
  // 4. Return response channel
  return { channel, agent: agent.name };
}
```

---

## Technical Architecture

### OpenClaw Gateway (Message Router)

```typescript
// New component: routes messages from channels to agents
class MessageRouter {
  channels = {
    telegram: new TelegramHandler(),
    mimo: new MimoHandler(),
    discord: new DiscordHandler(),
    web: new WebHandler(),
  };
  
  async route(incoming: IncomingMessage) {
    // 1. Identify channel
    const handler = this.channels[incoming.channel];
    
    // 2. Parse message
    const parsed = await handler.parse(incoming);
    
    // 3. Check Paperclip for task context
    const context = await paperclip.getContext(parsed.sessionKey);
    
    // 4. Route to appropriate agent
    const agent = await paperclip.assignAgent(context);
    
    // 5. Execute
    const response = await agent.execute(parsed.message, context);
    
    // 6. Report to Paperclip
    await paperclip.reportCost(agent.id, response.usage);
    
    // 7. Send response via same channel
    return handler.send(incoming.channelId, response);
  }
}
```

### Paperclip Integration Points

```typescript
// Paperclip API calls from OpenClaw

// 1. Get or create issue for channel conversation
POST /api/companies/{id}/issues
{
  "title": "Telegram: User request from @montelai",
  "description": "User message...",
  "metadata": {
    "channel": "telegram",
    "channelId": "-1003893288797:2520",
    "senderId": "261069981"
  }
}

// 2. Assign agent
POST /api/issues/{id}/checkout
{
  "agentId": "jarvis-id",
  "expectedStatuses": ["todo", "in_progress"]
}

// 3. Report cost after response
POST /api/companies/{id}/cost-events
{
  "agentId": "jarvis-id",
  "issueId": "issue-id",
  "provider": "zai",
  "model": "glm-5",
  "inputTokens": 1500,
  "outputTokens": 800,
  "costCents": 12,
  "occurredAt": "2026-03-08T04:00:00Z"
}
```

---

## Channel-Specific Behavior

### Telegram (Existing)
- **Trigger:** Incoming message → OpenClaw
- **Context:** Topic ID maps to project
- **Response:** Reply in same topic
- **Cost:** Reported after each message

### Mimo App (Primary)
- **Trigger:** User action in app
- **Context:** Full session context
- **Response:** Stream to app UI
- **Cost:** Batch reported

### Discord (Future)
- **Trigger:** Bot mention or DM
- **Context:** Channel → Project mapping
- **Response:** Reply in channel
- **Cost:** Reported per interaction

### Web UI (Future)
- **Trigger:** Direct agent invocation
- **Context:** User session
- **Response:** WebSocket stream
- **Cost:** Real-time display

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Channels supported | 1 (Telegram) | 3+ |
| Task continuity | Manual | Automatic |
| Cost tracking | None | Per-channel |
| User context | Per-session | Cross-channel |

---

## Dependencies

### Required
- [x] Paperclip running locally
- [x] OpenClaw gateway running
- [x] Telegram integration working
- [ ] Channel routing module (new)

### Optional
- [ ] Discord bot token
- [ ] Web UI for direct invocation

---

## Timeline

| Day | Phase | Focus |
|-----|-------|-------|
| 1 | Setup | Install Paperclip, create org |
| **1.5** | **Dependencies** | **Add blocking tasks feature** |
| 2 | Agents | Create agent org chart |
| 3 | Webhook | Test Paperclip ↔ OpenClaw |
| 4 | Channel Routing | Implement multi-channel |
| 5 | Skills | Add Paperclip skill to agents |
| 6 | Migration | Migrate tasks from ClawDeck |
| 7 | Scheduling | Configure heartbeats |
| 8 | Governance | Set up approvals |
| 9 | Monitoring | Dashboard + alerts |
| 10 | Cleanup | Archive old system |

**⚠️ Phase 1.5 is a BLOCKER** - Current system relies on task dependencies (`blockedBy` in `active-tasks.json`). Paperclip must support this before migration.

---

## Acceptance Criteria

- [ ] Telegram messages route through Paperclip
- [ ] Mimo app sessions route through Paperclip
- [ ] Cross-channel task continuity works
- [ ] Cost tracking per channel
- [ ] Single source of truth (PostgreSQL)
- [ ] Old system retired

---

## Related Documents

- `IMPLEMENTATION.md` - Detailed 7-day plan
- `OVERLAP-ANALYSIS.md` - Redundancy analysis
- `COMPARISON.md` - Architecture diagrams
- `QUICKSTART.md` - 5-minute test guide
- `CONSOLIDATION-SUMMARY.md` - Visual summary
- `DEPENDENCIES.md` - **Blocking tasks feature design**

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-08 | Initial PRD created |
| 2026-03-08 | Added branching strategy |
| 2026-03-08 | Added multi-channel architecture |
| 2026-03-08 | Added Phase 4: Channel Routing |
| 2026-03-08 | **Added Phase 1.5: Dependencies (BLOCKER)** |
