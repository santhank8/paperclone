# Security Audit Protocol

> Security review executed on every deployment.

**Owner:** QA Engineer (execution), Enforcer (sign-off)  
**Trigger:** Every deployment to production  
**Blocking:** CRITICAL findings block deploy  

---

## OWASP Top 10 Checklist

### A01 — Broken Access Control

| Item | Details |
|---|---|
| **Risk** | Users act outside intended permissions; unauthorized data access |
| **What to Check** | Auth middleware on all protected routes; role-based access enforcement; company-scoping on all queries |
| **How to Check** | Attempt API calls without auth token; attempt cross-company data access; verify middleware chain in route definitions |
| **Result** | ☐ PASS / ☐ FAIL |

### A02 — Cryptographic Failures

| Item | Details |
|---|---|
| **Risk** | Sensitive data exposed due to weak or missing encryption |
| **What to Check** | API keys hashed at rest; HTTPS enforced; no secrets in client bundles; password hashing algorithm strength |
| **How to Check** | Inspect DB storage of `agent_api_keys`; check TLS config; grep client bundle for secret patterns |
| **Result** | ☐ PASS / ☐ FAIL |

### A03 — Injection

| Item | Details |
|---|---|
| **Risk** | SQL injection, XSS, command injection |
| **What to Check** | Parameterized queries (Drizzle ORM handles this); output encoding in UI; no `eval()` or template string injection; input sanitization |
| **How to Check** | Send SQL injection payloads to API inputs; test XSS payloads in text fields; review raw query usage |
| **Result** | ☐ PASS / ☐ FAIL |

### A04 — Insecure Design

| Item | Details |
|---|---|
| **Risk** | Flawed architecture allowing abuse |
| **What to Check** | Rate limiting on auth endpoints; business logic abuse scenarios; missing approval gates |
| **How to Check** | Review API design against threat model; verify Enforcer governance gates exist for sensitive operations |
| **Result** | ☐ PASS / ☐ FAIL |

### A05 — Security Misconfiguration

| Item | Details |
|---|---|
| **Risk** | Default configs, unnecessary features enabled, missing hardening |
| **What to Check** | No default credentials; error messages don't leak stack traces in production; CORS properly restricted; security headers set |
| **How to Check** | Trigger errors and inspect responses; check CORS config; verify `Helmet` or equivalent headers |
| **Result** | ☐ PASS / ☐ FAIL |

### A06 — Vulnerable and Outdated Components

| Item | Details |
|---|---|
| **Risk** | Known vulnerabilities in dependencies |
| **What to Check** | `pnpm audit` clean; no critical CVEs in dependency tree |
| **How to Check** | Run `pnpm audit --audit-level=critical`; check Dependabot/Renovate alerts |
| **Result** | ☐ PASS / ☐ FAIL |

### A07 — Identification and Authentication Failures

| Item | Details |
|---|---|
| **Risk** | Weak auth allowing credential stuffing, brute force |
| **What to Check** | API key validation; session management; rate limiting on auth endpoints; key rotation capability |
| **How to Check** | Test invalid tokens; test expired tokens; attempt rapid auth requests |
| **Result** | ☐ PASS / ☐ FAIL |

### A08 — Software and Data Integrity Failures

| Item | Details |
|---|---|
| **Risk** | Unsigned updates, compromised CI/CD pipeline, untrusted data deserialization |
| **What to Check** | CI pipeline integrity; lockfile consistency; no `postinstall` scripts from untrusted packages |
| **How to Check** | Review CI config; verify `pnpm-lock.yaml` integrity; audit lifecycle scripts |
| **Result** | ☐ PASS / ☐ FAIL |

### A09 — Security Logging and Monitoring Failures

| Item | Details |
|---|---|
| **Risk** | Attacks go undetected due to insufficient logging |
| **What to Check** | Auth failures logged; mutations logged in activity log; log format includes timestamp, actor, action |
| **How to Check** | Trigger auth failures and verify logs; review activity_log table entries for mutations |
| **Result** | ☐ PASS / ☐ FAIL |

### A10 — Server-Side Request Forgery (SSRF)

| Item | Details |
|---|---|
| **Risk** | Server tricked into making requests to internal resources |
| **What to Check** | No user-controlled URLs passed to server-side fetch without validation; webhook URLs validated |
| **How to Check** | Submit internal IP addresses / localhost URLs where URLs are accepted; review fetch/request calls |
| **Result** | ☐ PASS / ☐ FAIL |

---

## Additional Security Checks

| Check | Method | Tool / Command |
|---|---|---|
| Dependency vulnerabilities | Automated scan | `pnpm audit` |
| Secrets in code | Grep for patterns | `git secrets --scan` or `trufflehog` |
| CORS configuration | Manual review | Inspect Express CORS middleware config |
| Rate limiting | Manual test | Send 100 rapid requests to auth endpoints |
| Input validation | Automated + manual | Send malformed payloads; review Zod schemas at API boundary |
| Environment variable exposure | Automated scan | Verify `.env` in `.gitignore`; check client bundle |

---

## Severity Classification

| Severity | Definition | Action | Deploy Impact |
|---|---|---|---|
| **CRITICAL** | Actively exploitable; data breach risk | Fix immediately | **Blocks deploy** |
| **HIGH** | Exploitable with effort; significant impact | Fix within current sprint | Blocks deploy if no mitigation |
| **MEDIUM** | Limited exploitability or impact | Add to tech debt backlog | Does not block deploy |
| **LOW** | Theoretical risk; minimal impact | Note for future improvement | Does not block deploy |

---

## Security Audit Report Template

```markdown
# Security Audit Report

**Date:** YYYY-MM-DD
**Sprint:** S-XX
**Auditor:** QA Engineer
**Deployment:** [environment / version]

## OWASP Top 10 Results

| # | Category | Result | Notes |
|---|---|---|---|
| A01 | Broken Access Control | PASS/FAIL | |
| A02 | Cryptographic Failures | PASS/FAIL | |
| A03 | Injection | PASS/FAIL | |
| A04 | Insecure Design | PASS/FAIL | |
| A05 | Security Misconfiguration | PASS/FAIL | |
| A06 | Vulnerable Components | PASS/FAIL | |
| A07 | Auth Failures | PASS/FAIL | |
| A08 | Integrity Failures | PASS/FAIL | |
| A09 | Logging Failures | PASS/FAIL | |
| A10 | SSRF | PASS/FAIL | |

## Additional Checks

| Check | Result | Notes |
|---|---|---|
| Dependency scan | PASS/FAIL | |
| Secrets detection | PASS/FAIL | |
| CORS config | PASS/FAIL | |
| Rate limiting | PASS/FAIL | |
| Input validation | PASS/FAIL | |

## Findings

### [SEVERITY] Finding Title
- **Category:** [OWASP # or additional check]
- **Description:** [What was found]
- **Impact:** [What could happen if exploited]
- **Reproduction:** [Steps to reproduce]
- **Remediation:** [How to fix]
- **Status:** OPEN / FIXED / ACCEPTED_RISK

## Summary

- **CRITICAL:** X findings
- **HIGH:** X findings
- **MEDIUM:** X findings
- **LOW:** X findings
- **Deploy Decision:** GO / NO-GO
- **Sign-off:** Enforcer [name] — [date]
```

---

## Automated vs Manual Checks

| Check Type | Automated | Manual | Notes |
|---|---|---|---|
| Dependency vulnerabilities | ✅ `pnpm audit` | | Run in CI |
| Secrets in code | ✅ `trufflehog` / `git-secrets` | | Run in CI |
| OWASP A01–A03 | Partial (lint rules) | ✅ | Manual review of auth flow |
| OWASP A04–A10 | Partial | ✅ | Architecture-level review |
| CORS / Headers | | ✅ | Inspect config files |
| Rate limiting | | ✅ | Load test auth endpoints |

---

## Security Trend Tracking

Track findings over time to identify systemic weaknesses.

| Sprint | CRITICAL | HIGH | MEDIUM | LOW | Total | Top Category |
|---|---|---|---|---|---|---|
| S-01 | | | | | | |
| S-02 | | | | | | |
| S-03 | | | | | | |

**Review cadence:** Every 5 sprints, review trend data and adjust audit focus areas accordingly.
