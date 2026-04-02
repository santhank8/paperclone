# Circuit Breaker Protocol

> Sprint Co Resilience — Phase 12: Resilience & Recovery

## External Dependencies

Sprint Co agents rely on these external services:

| Dependency | Used By | Criticality | Failure Impact |
|-----------|---------|-------------|----------------|
| **GitHub API** | Engineers, DevOps, Historian | High | Can't create PRs, issues, or read repos |
| **Cloudflare API** | DevOps | Medium | Can't deploy to production |
| **Paperclip API** | All agents | High | Can't update tasks, read assignments |
| **Model Provider API** | All agents | Critical | Agents cannot function at all |

## Circuit Breaker States

```
    ┌──────────────────────────────────────────────┐
    │                                              │
    ▼                                              │
 ┌────────┐   failure threshold   ┌────────┐      │
 │ CLOSED │ ─────────────────────▶│  OPEN  │      │
 │(normal)│                       │(failed)│      │
 └────────┘                       └────┬───┘      │
    ▲                                  │           │
    │          reset timeout           ▼           │
    │                            ┌───────────┐     │
    │           success          │ HALF-OPEN │     │
    └────────────────────────────│ (testing) │─────┘
                                 └───────────┘
                                   failure
```

| State | Behavior |
|-------|----------|
| **CLOSED** | Normal operation. Requests pass through. Failures are counted. |
| **OPEN** | Dependency unavailable. All requests use fallback. No calls to dependency. |
| **HALF-OPEN** | Testing recovery. One probe request sent. If success → CLOSED. If failure → OPEN. |

## Fallback Strategies

### GitHub API Down

| Operation | Fallback | Limitations |
|-----------|----------|-------------|
| Create PR | Queue PR creation; continue with local branches | PR review delayed |
| Read repository | Use local git clone (already available) | None for read ops |
| Create/update issues | Log to local file; replay when API recovers | Issue tracking delayed |
| Read issues | Use cached/last-known issue state | May be stale |

**Agent behavior:** Engineers continue working locally. All GitHub operations are queued in a replay log. When GitHub recovers, DevOps replays the queue.

### Cloudflare API Down

| Operation | Fallback | Limitations |
|-----------|----------|-------------|
| Deploy | Save deployment artifact for later deploy | Production not updated |
| DNS/routing | No fallback — existing config remains | Can't change routing |
| Analytics | Skip — non-critical | No deploy metrics |

**Agent behavior:** DevOps marks deployment as "pending-infrastructure." Sprint continues; deployment executes when Cloudflare recovers.

### Paperclip API Down

| Operation | Fallback | Limitations |
|-----------|----------|-------------|
| Read task assignments | Work from last known state | May miss reassignments |
| Update task status | Log status changes locally; replay on recovery | Dashboard stale |
| Post comments | Queue comments; replay on recovery | Visibility delayed |
| Check budget | Use last known budget; apply conservative limits | May underestimate remaining budget |

**Agent behavior:** Agents continue working on their last known assignment. All Paperclip API calls are logged for replay. Orchestrator operates from cached state.

### Model Provider API Down

| Operation | Fallback | Limitations |
|-----------|----------|-------------|
| Agent inference | Queue task; wait for recovery | Work stops for affected agent |
| Alternative provider | Route to backup model provider if configured | May have different capabilities |
| Notification | Alert Orchestrator immediately | — |

**Agent behavior:** This is the most critical failure. If the primary model is down:
1. Try alternative model provider (if configured)
2. If no alternative: queue the task, mark agent as `waiting-for-model`
3. Orchestrator redistributes non-model-dependent work to agents that can still operate
4. If all model providers are down: sprint pauses, Board is notified

## Circuit Breaker Configuration Template

```yaml
# circuit-breaker-config.yaml

circuit_breakers:
  - dependency: "github-api"
    health_check:
      endpoint: "https://api.github.com/rate_limit"
      method: GET
      expected_status: 200
      interval_seconds: 30
    failure_threshold: 3          # consecutive failures to trip
    reset_timeout_seconds: 60     # time in OPEN before trying HALF-OPEN
    fallback_action: "queue-and-continue"
    replay_on_recovery: true

  - dependency: "cloudflare-api"
    health_check:
      endpoint: "https://api.cloudflare.com/client/v4/user/tokens/verify"
      method: GET
      expected_status: 200
      interval_seconds: 60
    failure_threshold: 3
    reset_timeout_seconds: 120
    fallback_action: "defer-deployment"
    replay_on_recovery: true

  - dependency: "paperclip-api"
    health_check:
      endpoint: "<paperclip-base-url>/api/health"
      method: GET
      expected_status: 200
      interval_seconds: 15
    failure_threshold: 2
    reset_timeout_seconds: 30
    fallback_action: "work-from-cache"
    replay_on_recovery: true

  - dependency: "model-provider"
    health_check:
      endpoint: "<provider-health-url>"
      method: GET
      expected_status: 200
      interval_seconds: 10
    failure_threshold: 2
    reset_timeout_seconds: 30
    fallback_action: "try-alternative-or-queue"
    replay_on_recovery: false
    alternative_providers:
      - name: "backup-provider"
        endpoint: "<backup-url>"
        model: "<backup-model>"
```

## Replay Queue

When operations are deferred due to a circuit breaker, they are stored in a replay queue:

```markdown
## Replay Queue Entry

- **ID:** <uuid>
- **Dependency:** <which service>
- **Operation:** <what was attempted>
- **Payload:** <serialized request>
- **Queued At:** <timestamp>
- **Agent:** <which agent queued this>
- **Priority:** [critical | normal | low]
- **Max Age:** <after this time, discard — operation is stale>
```

On recovery, the queue is replayed in priority order. Stale entries are discarded with a log entry.

## Monitoring Dashboard Integration

The Orchestrator maintains circuit breaker status visible to all agents:

```
CIRCUIT BREAKER STATUS:
  github-api:      CLOSED  ✓  (last check: 5s ago)
  cloudflare-api:  CLOSED  ✓  (last check: 12s ago)
  paperclip-api:   CLOSED  ✓  (last check: 3s ago)
  model-provider:  CLOSED  ✓  (last check: 2s ago)
```

When a breaker trips:
```
CIRCUIT BREAKER STATUS:
  github-api:      OPEN    ✗  (tripped: 2 min ago, retry in: 58s)
  cloudflare-api:  CLOSED  ✓  (last check: 12s ago)
  paperclip-api:   CLOSED  ✓  (last check: 3s ago)
  model-provider:  CLOSED  ✓  (last check: 2s ago)

  ACTIVE FALLBACKS:
    - github-api: queue-and-continue (3 operations queued)
```

## Alert Escalation

| Breaker State | Duration | Action |
|--------------|----------|--------|
| OPEN | <5 min | Orchestrator logs, agents use fallbacks |
| OPEN | 5–15 min | Orchestrator alerts Sprint Lead |
| OPEN | 15–30 min | Sprint Lead reassesses sprint plan |
| OPEN | >30 min | Board notified, sprint may pause |
