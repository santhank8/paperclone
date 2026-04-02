<!-- TEMPLATE: Critic Red Team Report
     Agent: Critic (governance)
     When: Every 3rd sprint (sprint-003, sprint-006, sprint-009, etc.)
     Fill in all [bracketed] placeholders with actual content.
     Delete this comment block when producing a real report. -->

# Red Team Report

## Meta

| Field                    | Value                                      |
|--------------------------|--------------------------------------------|
| **Sprint Range Covered** | [sprint-NNN through sprint-NNN]            |
| **Report Date**          | [YYYY-MM-DD]                               |
| **Author**               | Critic Agent (Red Team Mode)               |
| **Previous Red Team**    | [link to previous report, or "N/A" if first] |
| **Report Status**        | [DRAFT / FINAL]                            |

---

## Executive Summary

[3–5 sentences. Summarize the overall security and architectural posture of the product as of this report. State the number of vulnerabilities found, the highest severity, and the single most important recommendation. This section should be readable by a non-technical stakeholder.]

---

## Attack Surface Analysis

Catalog the product's current attack surface — every entry point, data flow, and trust boundary.

### Entry Points

| # | Entry Point                  | Type              | Authentication Required | Notes                              |
|---|------------------------------|-------------------|-------------------------|------------------------------------|
| 1 | [e.g., /api/* REST endpoints]| [HTTP API]        | [Yes — API key / No]   | [e.g., "All mutations require auth; reads are mixed"] |
| 2 | [e.g., WebSocket connections]| [WebSocket]       | [Yes / No]              | [Notes]                            |
| 3 | [e.g., CLI commands]         | [Local CLI]       | [N/A — local]           | [Notes]                            |
| 4 | [e.g., Docker exposed ports] | [Network]         | [No]                    | [Notes]                            |

### Data Flows

| # | Flow                                   | Data Sensitivity | Encryption in Transit | Encryption at Rest |
|---|----------------------------------------|------------------|-----------------------|--------------------|
| 1 | [e.g., Agent → API → Database]         | [High / Medium / Low] | [Yes — TLS / No] | [Yes / No]         |
| 2 | [e.g., UI → API → Agent adapter]       | [Sensitivity]    | [Yes / No]            | [Yes / No]         |
| 3 | [e.g., API key storage and retrieval]  | [High]           | [Yes / No]            | [Hashed / Plaintext / N/A] |

### Trust Boundaries

| # | Boundary                               | What Crosses It                    | Validation Present |
|---|----------------------------------------|------------------------------------|--------------------|
| 1 | [e.g., External agent → API]           | [Agent commands, task updates]     | [Yes — input validation / No] |
| 2 | [e.g., UI → API]                       | [User actions, company data]       | [Yes / Partial / No] |
| 3 | [e.g., API → Database]                 | [SQL queries, data writes]         | [Parameterized / Raw — specify] |

---

## Vulnerabilities Found

| # | Issue                                  | Severity          | OWASP Category        | Exploit Scenario                                   | Remediation                          | Status          |
|---|----------------------------------------|-------------------|-----------------------|----------------------------------------------------|--------------------------------------|-----------------|
| 1 | [e.g., "Missing rate limiting on /api/auth"] | [CRITICAL / HIGH / MEDIUM / LOW / INFO] | [e.g., A07:2021 — Identification and Authentication Failures] | [1–2 sentences: how an attacker would exploit this — e.g., "Attacker brute-forces API keys at 1000 req/s; no lockout or throttle."] | [Specific fix — e.g., "Add rate limiting middleware: 100 req/min per IP on auth endpoints."] | [OPEN / MITIGATED / ACCEPTED] |
| 2 | [Issue]                                | [Severity]        | [Category]            | [Scenario]                                         | [Fix]                                | [Status]        |
| 3 | [Issue]                                | [Severity]        | [Category]            | [Scenario]                                         | [Fix]                                | [Status]        |
| 4 | [Issue]                                | [Severity]        | [Category]            | [Scenario]                                         | [Fix]                                | [Status]        |

<!-- Add rows as needed. Order by severity (CRITICAL first). -->

If no vulnerabilities found, write: "No vulnerabilities identified in this review cycle. This does not guarantee absence of issues — only that none were found with current analysis methods."

### Severity Definitions

| Severity | Meaning                                                                 |
|----------|-------------------------------------------------------------------------|
| CRITICAL | Exploitable now; could cause data breach, full system compromise, or data loss |
| HIGH     | Significant risk; exploitable with moderate effort; should fix this sprint |
| MEDIUM   | Real risk but requires specific conditions or insider access to exploit  |
| LOW      | Minor issue; defense-in-depth concern; fix when convenient               |
| INFO     | Observation or hardening suggestion; no active risk                      |

---

## Architectural Risks

Systemic risks that aren't point vulnerabilities but structural concerns about how the system is designed.

### Risk 1: [Risk Title]

- **Description:** [2–3 sentences — e.g., "All agent communication goes through a single API server with no queue. If the server goes down, all agents stall simultaneously with no retry or fallback."]
- **Impact:** [What happens if this risk materializes]
- **Likelihood:** [HIGH / MEDIUM / LOW]
- **Mitigation:** [What should change architecturally]

### Risk 2: [Risk Title]

- **Description:** [2–3 sentences]
- **Impact:** [Consequence]
- **Likelihood:** [HIGH / MEDIUM / LOW]
- **Mitigation:** [Recommendation]

### Risk 3: [Risk Title]

- **Description:** [2–3 sentences]
- **Impact:** [Consequence]
- **Likelihood:** [HIGH / MEDIUM / LOW]
- **Mitigation:** [Recommendation]

<!-- Add more risk blocks as needed. -->

---

## Assumptions Challenged

List assumptions the team is making that the red team believes are wrong, untested, or dangerous.

| # | Assumption                                              | Why It's Dangerous                                     | Test / Evidence Needed                   |
|---|---------------------------------------------------------|--------------------------------------------------------|------------------------------------------|
| 1 | [e.g., "We assume agents only send well-formed JSON"]   | [e.g., "A malicious or buggy agent could send arbitrary payloads; no schema validation exists"] | [e.g., "Fuzz the agent API endpoint with malformed payloads"] |
| 2 | [Assumption]                                            | [Risk]                                                 | [Test needed]                            |
| 3 | [Assumption]                                            | [Risk]                                                 | [Test needed]                            |
| 4 | [Assumption]                                            | [Risk]                                                 | [Test needed]                            |

---

## Stress Test Results

Simulated or analytical stress tests performed during this review.

### Test 1: [Test Name]

- **Scenario:** [What was tested — e.g., "100 concurrent agents all attempting to check out the same issue simultaneously"]
- **Method:** [How it was tested — analytical reasoning, load test tool, manual simulation]
- **Expected Behavior:** [What should happen]
- **Actual / Predicted Behavior:** [What does or would happen]
- **Result:** [PASS / FAIL / INCONCLUSIVE]
- **Notes:** [Additional observations]

### Test 2: [Test Name]

- **Scenario:** [Description]
- **Method:** [Method]
- **Expected Behavior:** [Expected]
- **Actual / Predicted Behavior:** [Actual]
- **Result:** [PASS / FAIL / INCONCLUSIVE]
- **Notes:** [Notes]

### Test 3: [Test Name]

- **Scenario:** [Description]
- **Method:** [Method]
- **Expected Behavior:** [Expected]
- **Actual / Predicted Behavior:** [Actual]
- **Result:** [PASS / FAIL / INCONCLUSIVE]
- **Notes:** [Notes]

<!-- Add more test blocks as needed. -->

---

## Recommendations

Prioritized list of actions based on this red team review. Each maps to a specific finding above.

| Priority | Recommendation                                          | Addresses              | Effort Estimate     | Sprint Target       |
|----------|---------------------------------------------------------|------------------------|---------------------|---------------------|
| 1        | [Most urgent action — e.g., "Add rate limiting to auth endpoints"] | [Vulnerability #1]     | [Small / Medium / Large] | [Next sprint]       |
| 2        | [Action]                                                | [Finding reference]    | [Effort]            | [Target sprint]     |
| 3        | [Action]                                                | [Finding reference]    | [Effort]            | [Target sprint]     |
| 4        | [Action]                                                | [Finding reference]    | [Effort]            | [Target sprint]     |
| 5        | [Action]                                                | [Finding reference]    | [Effort]            | [Target sprint]     |

---

## Appendix

- **Sprints reviewed:** [List sprint IDs and their critique reports]
- **Tools used:** [List any analysis tools, scripts, or methods used]
- **Scope limitations:** [What was NOT reviewed and why — e.g., "Third-party dependencies were not audited; recommend separate dependency audit"]
- **Previous red team report:** [link or path, if any]
- **Notes:** [Additional context, raw findings, or supporting evidence.]
