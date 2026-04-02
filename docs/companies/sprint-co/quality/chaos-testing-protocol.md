# Chaos Testing Protocol

> Adversarial stress testing to answer not just "does it work?" but "can it break?"

**Owner:** Critic (initiator), QA Engineer (execution)  
**Cadence:** Every 3rd sprint  
**Philosophy:** Find failures before users do.  

---

## Purpose

Standard QA validates expected behavior. Chaos testing probes for unexpected failures:

- What happens under extreme load?
- What breaks when dependencies fail?
- How does the system handle malicious input?
- What's the blast radius of a partial deployment failure?

The Critic initiates chaos testing because adversarial thinking is the Critic's core strength. QA Engineer executes the tests and documents findings.

---

## Test Types

### 1. API Stress Testing

Hammer the system with volume and malformed input.

| Test | Description | Method |
|---|---|---|
| **High request volume** | Send 10× expected peak traffic | Load testing tool (k6, Artillery) |
| **Concurrent writes** | Multiple agents write to the same resource simultaneously | Parallel API calls to the same endpoint |
| **Malformed payloads** | Send invalid JSON, wrong types, oversized bodies | Fuzz testing with random payloads |
| **Timeout scenarios** | Slow-client simulation; requests that take longer than server timeout | Throttled client connections |
| **Missing required fields** | Omit required fields in various combinations | Systematic field removal |
| **Header manipulation** | Invalid auth headers, missing content-type, oversized headers | Manual request crafting |

**Pass criteria:** System rejects bad input gracefully (4xx, not 5xx); no crashes; no data corruption under load.

### 2. Error Path Testing

What happens when things outside our control fail?

| Test | Description | Expected Behavior |
|---|---|---|
| **Database unavailable** | Kill DB connection mid-operation | Graceful error; no partial writes; clear error message |
| **External API timeout** | Simulate adapter timeout (agent backend unreachable) | Timeout after configured limit; task marked as failed; retryable |
| **Disk full** | Fill disk to capacity | Writes fail gracefully; existing data intact |
| **Memory pressure** | Restrict available memory | Graceful degradation; no OOM-induced data loss |
| **DNS failure** | Block DNS resolution | Clear error message; retry logic activates |

**Pass criteria:** System fails gracefully. No silent data corruption. Error messages are actionable.

### 3. Data Edge Cases

Push data to the boundaries.

| Test | Description | Input |
|---|---|---|
| **Empty states** | All list endpoints with no data | New company, no tasks, no agents |
| **Max-length inputs** | Fields at maximum allowed length | 10,000-char description; 255-char names |
| **Special characters** | Unicode, emoji, RTL text, null bytes | `¯\_(ツ)_/¯`, `🔥`, `\u0000`, `<script>alert(1)</script>` |
| **Concurrent writes** | Two agents claim the same task simultaneously | Race condition in checkout |
| **Boundary numbers** | Zero, negative, MAX_INT, float precision | `budget: 0`, `budget: -1`, `budget: 9007199254740991` |
| **Null/undefined injection** | Explicit null values where not expected | `{"name": null, "status": null}` |

**Pass criteria:** System validates input correctly; no crashes on edge cases; data stored and displayed correctly.

### 4. Security Probing

Common attack vectors tested from the Critic's adversarial perspective.

| Test | Description | Payload |
|---|---|---|
| **SQL Injection** | Attempt SQL injection in all text inputs | `'; DROP TABLE tasks; --` |
| **XSS (Stored)** | Inject script tags in user-provided content | `<script>document.cookie</script>` |
| **XSS (Reflected)** | Inject via URL parameters | `?q=<img onerror=alert(1) src=x>` |
| **CSRF** | Forge cross-origin state-changing requests | Cross-origin POST without CSRF token |
| **Path traversal** | Access files outside intended directory | `../../etc/passwd` in file parameters |
| **Auth bypass** | Access protected resources with manipulated tokens | Modified JWT; expired tokens; tokens from other companies |
| **Privilege escalation** | Agent attempts operations beyond their scope | Agent A tries to access Company B data |

**Pass criteria:** All attacks blocked. No data leaked. No unauthorized state changes.

### 5. Deployment Chaos

What if the deploy process itself fails?

| Test | Description | Expected Behavior |
|---|---|---|
| **Deploy fails halfway** | Kill deploy process mid-migration | Rollback to previous version; no partial state |
| **DNS propagation delay** | Simulate 5-minute DNS update | Health check handles stale routing; no errors for in-flight requests |
| **Config missing** | Start with missing environment variable | Clear startup error; process does not start in broken state |
| **Port conflict** | Attempt to start on occupied port | Clear error message; no silent failure |
| **Rollback test** | Manually trigger rollback after successful deploy | Previous version restored cleanly; no data loss |

**Pass criteria:** Deployment failures are detectable, recoverable, and don't corrupt state.

---

## Test Schedule

| Sprint | Chaos Tests Run | Focus Area |
|---|---|---|
| S-03 (every 3rd) | Full suite | Rotate primary focus each cycle |
| Off-cycle | Targeted | Only if prior findings unresolved |

### Focus Rotation

| Cycle | Primary Focus | Secondary |
|---|---|---|
| 1 | API Stress + Data Edge Cases | Security Probing |
| 2 | Error Paths + Deployment Chaos | Data Edge Cases |
| 3 | Security Probing + API Stress | Error Paths |
| 4+ | Repeat cycle | |

---

## Report Template

```markdown
# Chaos Test Report

**Date:** YYYY-MM-DD
**Sprint:** S-XX
**Initiated By:** Critic
**Executed By:** QA Engineer
**Focus Area:** [Primary focus for this cycle]

## Tests Executed

| Category | Tests Run | Passed | Failed | Skipped |
|---|---|---|---|---|
| API Stress | | | | |
| Error Paths | | | | |
| Data Edge Cases | | | | |
| Security Probing | | | | |
| Deployment Chaos | | | | |
| **Total** | | | | |

## Findings

### [SEVERITY] Finding Title
- **Category:** [Test type]
- **Test:** [Specific test that found it]
- **Description:** [What happened]
- **Expected:** [What should have happened]
- **Actual:** [What actually happened]
- **Reproduction Steps:** [How to reproduce]
- **Impact:** [What's the real-world risk]
- **Recommended Fix:** [How to address]

## Positive Observations

[Things that held up well under stress — recognize resilience]

## Summary

- **CRITICAL findings:** X
- **HIGH findings:** X
- **MEDIUM findings:** X
- **LOW findings:** X
- **System Resilience Rating:** [Strong / Adequate / Weak]
```

---

## Finding Severity

| Severity | Definition | Action |
|---|---|---|
| **CRITICAL** | Data loss, security breach, or complete system failure | Fix immediately; blocks next deploy |
| **HIGH** | Significant degradation under realistic stress; exploitable weakness | Fix within current sprint |
| **MEDIUM** | Ungraceful failure under extreme conditions; minor security concern | Add to backlog; fix within 3 sprints |
| **LOW** | Cosmetic issues under stress; theoretical concern | Note for future improvement |

---

## Remediation Tracking

Track chaos test findings through to resolution.

| Sprint Found | ID | Severity | Finding | Owner | Status | Sprint Fixed |
|---|---|---|---|---|---|---|
| | CT-001 | | | | OPEN / IN_PROGRESS / FIXED / ACCEPTED_RISK | |
| | CT-002 | | | | | |

### Remediation SLAs

| Severity | Fix Deadline |
|---|---|
| CRITICAL | Before next deploy |
| HIGH | Within current sprint |
| MEDIUM | Within 3 sprints |
| LOW | Best effort |

### Retest Policy

All CRITICAL and HIGH findings must be **retested** in the next chaos testing cycle to confirm the fix holds under stress.
