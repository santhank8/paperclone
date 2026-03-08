# Overlap Analysis: Jarvis Workspace vs Paperclip

**Created:** 2026-03-08
**Purpose:** Identify redundancy and consolidation opportunities

---

## Feature-by-Feature Comparison

### 1. Agent Management

| Feature | Jarvis Workspace | Paperclip | Overlap? |
|---------|-----------------|-----------|----------|
| Agent definitions | `AGENTS.md` (static) | `agents` table (dynamic) | ✅ **DUPLICATE** |
| Agent roles | Hardcoded in markdown | DB-backed with roles | ✅ **DUPLICATE** |
| Agent hierarchy | Flat (no org chart) | Tree (reportsTo) | ❌ Paperclip better |
| Agent status | Manual tracking | Auto (running/paused/etc) | ❌ Paperclip better |
| Agent budget | None | Per-agent budgets | ❌ Paperclip only |

**Recommendation:** Remove `AGENTS.md`, use Paperclip DB as source of truth.

---

### 2. Task/Issue Management

| Feature | Jarvis Workspace | Paperclip | Overlap? |
|---------|-----------------|-----------|----------|
| Task storage | ClawDeck (SQLite) | Paperclip (PostgreSQL) | ✅ **DUPLICATE** |
| Task hierarchy | Flat | Hierarchical (parent/child) | ❌ Paperclip better |
| Task status | 5 states | 7 states + checkout | ❌ Paperclip better |
| Task assignment | Manual | Atomic checkout | ❌ Paperclip better |
| Task tracking | ClawDeck API | Paperclip API | ✅ **DUPLICATE** |
| Task UI | ClawDeck web | Paperclip React UI | ✅ **DUPLICATE** |

**Recommendation:** Migrate ClawDeck tasks to Paperclip, decommission ClawDeck.

---

### 3. Heartbeat/Scheduling

| Feature | Jarvis Workspace | Paperclip | Overlap? |
|---------|-----------------|-----------|----------|
| Cron scheduler | Linux crontab | Paperclip scheduler | ✅ **DUPLICATE** |
| Heartbeat triggers | `check-agents.sh` (every 10m) | Configurable per agent | ❌ Paperclip better |
| Event triggers | None | Assignment, mention, approval | ❌ Paperclip only |
| Wake mechanisms | Manual only | Multiple sources | ❌ Paperclip better |

**Recommendation:** Remove Linux crontabs, use Paperclip scheduler.

---

### 4. Monitoring

| Feature | Jarvis Workspace | Paperclip | Overlap? |
|---------|-----------------|-----------|----------|
| Agent monitoring | `check-agents.sh` | Real-time dashboard | ✅ **DUPLICATE** |
| PR tracking | Script-based | Built-in (via adapter) | ✅ **DUPLICATE** |
| Status sync | `active-tasks.json` | PostgreSQL | ✅ **DUPLICATE** |
| Activity log | Log files | Activity table | ❌ Paperclip better |
| Cost tracking | None | Built-in | ❌ Paperclip only |

**Recommendation:** Remove monitoring scripts, use Paperclip dashboard.

---

### 5. Governance

| Feature | Jarvis Workspace | Paperclip | Overlap? |
|---------|-----------------|-----------|----------|
| Approvals | None | Built-in | ❌ Paperclip only |
| Budget enforcement | None | Auto-pause at limit | ❌ Paperclip only |
| Audit trail | Log files | Activity log table | ❌ Paperclip better |
| Escalation | None | Chain of command | ❌ Paperclip only |

**Recommendation:** Adopt Paperclip governance model.

---

### 6. Documentation

| Feature | Jarvis Workspace | Paperclip | Overlap? |
|---------|-----------------|-----------|----------|
| Memory | `MEMORY.md` | None (external) | ⚠️ Keep both |
| Protocols | `AGENTS.md`, `TOOLS.md` | Agent instructions path | ✅ **DUPLICATE** |
| Standups | `standups/*.md` | Activity log | ⚠️ Different purpose |
| Team discussions | `discussions/*.md` | Issue comments | ✅ **DUPLICATE** |

**Recommendation:**
- Keep `MEMORY.md` for long-term memory
- Move agent protocols to Paperclip agent instructions
- Migrate team discussions to Paperclip issue comments

---

## Redundancy Summary

| Component | Jarvis Workspace | Paperclip | Action |
|-----------|-----------------|-----------|--------|
| **ClawDeck** | Task management | Issue management | ❌ **DELETE** |
| **AGENTS.md** | Agent definitions | agents table | ❌ **DELETE** |
| **check-agents.sh** | Monitoring | Dashboard | ❌ **DELETE** |
| **auto-spawn-tasks.sh** | Auto-assignment | Scheduler | ❌ **DELETE** |
| **active-tasks.json** | Task registry | PostgreSQL | ❌ **DELETE** |
| **spawn-agent.sh** | Agent spawning | Adapter execution | ⚠️ **REPLACE** with adapter |
| **MEMORY.md** | Long-term memory | N/A | ✅ **KEEP** |
| **HEARTBEAT.md** | Heartbeat protocol | Paperclip heartbeat | ⚠️ **MERGE** |
| **TOOLS.md** | Tool documentation | N/A | ✅ **KEEP** (OpenClaw-specific) |
| **standups/** | Standup logs | Activity log | ⚠️ **KEEP** (different purpose) |

---

## Consolidation Strategy

### Option A: Full Migration (Recommended)

**Replace everything with Paperclip:**

```
BEFORE:
├── Jarvis Workspace
│   ├── AGENTS.md              (agent definitions)
│   ├── MEMORY.md              (long-term memory)
│   ├── TOOLS.md               (tool docs)
│   ├── HEARTBEAT.md           (heartbeat protocol)
│   ├── ClawDeck               (task management)
│   └── OpenCode Swarm         (execution)
│       ├── spawn-agent.sh
│       ├── check-agents.sh
│       └── active-tasks.json

AFTER:
├── Jarvis Workspace (simplified)
│   ├── MEMORY.md              (long-term memory - KEEP)
│   ├── TOOLS.md               (OpenClaw tools - KEEP)
│   └── skills/                (agent skills - KEEP)
│
├── Paperclip (control plane)
│   ├── agents table           (was AGENTS.md)
│   ├── issues table           (was ClawDeck)
│   ├── activity_log           (was check-agents.sh logs)
│   └── scheduler              (was crontab)
│
└── OpenClaw (execution plane)
    └── Agent sessions         (same as before)
```

**Benefits:**
- Single source of truth (PostgreSQL)
- No custom bash scripts to maintain
- Full governance/approvals
- Mobile-friendly UI

**Migration effort:** 5-7 days

---

### Option B: Hybrid (Keep Both)

**Run Paperclip alongside Jarvis Workspace:**

```
├── Jarvis Workspace
│   ├── AGENTS.md              (keep as fallback)
│   ├── MEMORY.md              (keep)
│   └── TOOLS.md               (keep)
│
├── Paperclip
│   ├── For governance/approvals
│   ├── For cost tracking
│   └── For org chart
│
└── ClawDeck + OpenCode Swarm
    └── For task execution (unchanged)
```

**Benefits:**
- Less disruptive
- Gradual migration

**Drawbacks:**
- Two systems to maintain
- Data sync complexity
- Doesn't solve redundancy

**Not recommended.**

---

### Option C: Paperclip as Governance Layer Only

**Keep Jarvis Workspace for execution, add Paperclip for oversight:**

```
├── Paperclip (governance layer)
│   ├── Approvals
│   ├── Budget tracking
│   └── Org chart
│
├── Jarvis Workspace (execution layer)
│   ├── AGENTS.md
│   ├── ClawDeck
│   └── OpenCode Swarm
```

**Benefits:**
- Minimal changes
- Get governance features

**Drawbacks:**
- Still have redundancy
- Two task systems
- Complex sync

**Not recommended.**

---

## Recommended Path: Full Migration (Option A)

### Phase 1: Setup Paperclip (Day 1-2)
- Install and run Paperclip
- Create company structure
- Create agents (from AGENTS.md)

### Phase 2: Migrate Tasks (Day 2-3)
- Export ClawDeck tasks
- Import to Paperclip issues
- Verify data integrity

### Phase 3: Update Agents (Day 3-4)
- Add Paperclip skill to agents
- Update heartbeat protocol
- Test webhook integration

### Phase 4: Switch Over (Day 4-5)
- Disable ClawDeck
- Disable crontabs
- Archive bash scripts

### Phase 5: Cleanup (Day 5-7)
- Remove AGENTS.md
- Update documentation
- Verify everything works

---

## Files to Delete (After Migration)

```
~/.openclaw-orchestration/
├── spawn-agent.sh           ❌ DELETE (use Paperclip adapter)
├── check-agents.sh          ❌ DELETE (use Paperclip dashboard)
├── auto-spawn-tasks.sh      ❌ DELETE (use Paperclip scheduler)
├── cleanup-orphans.sh       ❌ DELETE (not needed)
├── respawn-agent.sh         ❌ DELETE (use Paperclip retry)
├── active-tasks.json        ❌ DELETE (use Paperclip DB)
└── config.json              ❌ DELETE (use Paperclip config)

~/.openclaw/workspaces/jarvis-leader/
├── AGENTS.md                ❌ DELETE (use Paperclip agents table)
├── HEARTBEAT.md             ⚠️ MERGE into Paperclip protocol
└── docs/
    └── clawdeck-*.md        ❌ DELETE (ClawDeck deprecated)

ClawDeck service              ❌ DELETE entire service
```

## Files to Keep

```
~/.openclaw/workspaces/jarvis-leader/
├── MEMORY.md                ✅ KEEP (long-term memory)
├── TOOLS.md                 ✅ KEEP (OpenClaw-specific tools)
├── SOUL.md                  ✅ KEEP (agent persona)
├── IDENTITY.md              ✅ KEEP (agent identity)
├── USER.md                  ✅ KEEP (user preferences)
├── DEV-PREFERENCES.md       ✅ KEEP (development preferences)
├── LESSONS.md               ✅ KEEP (lessons learned)
├── PROJECT-PROTOCOL.md      ✅ KEEP (project workflow)
├── skills/                  ✅ KEEP (agent skills)
└── work/                    ✅ KEEP (working directory)
```

---

## Cost-Benefit Analysis

### Current State (Jarvis Workspace)
- **Maintenance:** High (custom bash scripts)
- **Features:** Basic
- **Reliability:** Moderate (manual sync)
- **Scalability:** Limited
- **Governance:** None
- **Mobile access:** No

### Future State (Paperclip)
- **Maintenance:** Low (platform)
- **Features:** Comprehensive
- **Reliability:** High (PostgreSQL ACID)
- **Scalability:** High
- **Governance:** Built-in
- **Mobile access:** Yes

### Migration Cost
- **Time:** 5-7 days
- **Risk:** Moderate (data migration)
- **Complexity:** Medium (webhook setup)

### ROI
- **Immediate:** Better visibility, mobile access
- **1 month:** Less maintenance, fewer bugs
- **3 months:** Full governance, cost tracking
- **6 months:** Proven platform, community support

---

## Decision Matrix

| Factor | Keep Current | Migrate to Paperclip |
|--------|--------------|---------------------|
| Setup effort | ✅ Already done | ⏳ 5-7 days |
| Maintenance | ❌ High | ✅ Low |
| Features | ❌ Basic | ✅ Comprehensive |
| Redundancy | ❌ High | ✅ Eliminated |
| Governance | ❌ None | ✅ Built-in |
| Mobile access | ❌ No | ✅ Yes |
| Future-proofing | ❌ Custom scripts | ✅ Platform |

**Recommendation: Migrate to Paperclip (Option A)**

---

## Next Steps

1. **Review this analysis** with team
2. **Decide on migration option**
3. **If Option A:** Start Phase 1 (install Paperclip)
4. **If Option B/C:** Define sync strategy

---

## Open Questions

1. **What about ClawDeck API extensions?**
   - Currently ClawDeck has custom API endpoints
   - Need to replicate in Paperclip or migrate consumers

2. **What about existing worktrees?**
   - Keep existing worktrees
   - New tasks create via Paperclip adapter

3. **What about Telegram bot?**
   - Keep as-is (channel for messages)
   - Agent triggered via Paperclip webhook

4. **What about OpenClaw skills?**
   - Keep in Jarvis workspace
   - Paperclip agent points to them via `instructionsFilePath`
