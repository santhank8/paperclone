# Accessibility Audit Protocol

> WCAG 2.1 AA compliance checking for all user-facing deliverables.

**Owner:** QA Engineer  
**Applies To:** Any sprint output with a UI component  
**Standard:** WCAG 2.1 Level AA  

---

## WCAG 2.1 AA Checklist

### Perceivable

| # | Criterion | What to Check | Method | Result |
|---|---|---|---|---|
| 1.1 | **Alt Text** | All meaningful images have descriptive `alt` attributes; decorative images use `alt=""` | Automated scan + manual review | ☐ PASS / ☐ FAIL |
| 1.2 | **Color Contrast** | Text meets 4.5:1 ratio (normal) or 3:1 (large text) against background | axe-core / Lighthouse | ☐ PASS / ☐ FAIL |
| 1.3 | **Heading Hierarchy** | Headings follow logical order (h1 → h2 → h3); no skipped levels | Manual DOM inspection | ☐ PASS / ☐ FAIL |
| 1.4 | **Text Resize** | Content readable and functional at 200% zoom; no horizontal scroll | Manual browser zoom test | ☐ PASS / ☐ FAIL |

### Operable

| # | Criterion | What to Check | Method | Result |
|---|---|---|---|---|
| 2.1 | **Keyboard Navigation** | All interactive elements reachable and operable via keyboard alone (Tab, Enter, Space, Escape, Arrow keys) | Manual keyboard-only testing | ☐ PASS / ☐ FAIL |
| 2.2 | **Focus Indicators** | Visible focus ring on all interactive elements; focus order matches visual layout | Manual keyboard navigation | ☐ PASS / ☐ FAIL |
| 2.3 | **Skip Links** | "Skip to main content" link available and functional | Manual check on page load | ☐ PASS / ☐ FAIL |
| 2.4 | **No Keyboard Traps** | User can navigate away from any component using keyboard | Manual keyboard testing | ☐ PASS / ☐ FAIL |

### Understandable

| # | Criterion | What to Check | Method | Result |
|---|---|---|---|---|
| 3.1 | **Form Labels** | All form inputs have associated `<label>` elements or `aria-label` / `aria-labelledby` | axe-core scan | ☐ PASS / ☐ FAIL |
| 3.2 | **Error Identification** | Form errors clearly described in text; error fields visually and programmatically indicated | Manual form submission testing | ☐ PASS / ☐ FAIL |
| 3.3 | **Consistent Navigation** | Navigation patterns consistent across pages | Manual review | ☐ PASS / ☐ FAIL |

### Robust

| # | Criterion | What to Check | Method | Result |
|---|---|---|---|---|
| 4.1 | **ARIA Labels** | Custom components use appropriate ARIA roles, states, and properties | axe-core + manual review | ☐ PASS / ☐ FAIL |
| 4.2 | **Valid HTML** | No duplicate IDs; proper nesting; valid landmark structure | HTML validator + axe-core | ☐ PASS / ☐ FAIL |

---

## Audit Process

### Phase 1 — Automated Scan

1. Run **axe-core** against all pages/routes.
2. Run **Lighthouse** accessibility audit.
3. Record all violations with severity, element, and suggested fix.

### Phase 2 — Manual Review

1. **Keyboard-only navigation** — Navigate entire app using only keyboard. Record any unreachable or trapped elements.
2. **Screen reader test** — Verify content reads in logical order; interactive elements announce their purpose.
3. **Zoom test** — Set browser to 200% zoom and verify usability.
4. **Color-only information** — Verify no information is conveyed by color alone.

---

## Tools

| Tool | Purpose | Integration |
|---|---|---|
| **axe-core** | Automated WCAG violation detection | `npm run a11y:scan` or browser extension |
| **Lighthouse** | Accessibility score (0–100) | Chrome DevTools or CI via `lighthouse-ci` |
| **WAVE** | Visual accessibility evaluation | Browser extension for manual review |
| **NVDA / VoiceOver** | Screen reader testing | Manual testing on Windows (NVDA) / macOS (VoiceOver) |

---

## Accessibility Score Calculation

**Score** = (criteria_passed / total_criteria) × 100

| Score Range | Rating | Action |
|---|---|---|
| 95–100 | Excellent | Ship |
| 85–94 | Good | Ship; file issues for gaps |
| 70–84 | Needs Work | Ship if no CRITICAL; remediation plan required |
| Below 70 | Poor | Block deploy for public-facing apps |

Additionally, the **Lighthouse Accessibility Score** is tracked as a standalone metric with a target of **≥ 90**.

---

## Report Template

```markdown
# Accessibility Audit Report

**Date:** YYYY-MM-DD
**Sprint:** S-XX
**Auditor:** QA Engineer
**Pages Audited:** [list of routes/pages]

## Automated Results

| Tool | Score | Violations | Details |
|---|---|---|---|
| axe-core | X violations | [count by severity] | [link to full report] |
| Lighthouse | XX/100 | — | [link to report] |

## Manual Review Results

| Criterion | Result | Notes |
|---|---|---|
| Alt Text | PASS/FAIL | |
| Color Contrast | PASS/FAIL | |
| Heading Hierarchy | PASS/FAIL | |
| Keyboard Navigation | PASS/FAIL | |
| Focus Indicators | PASS/FAIL | |
| Skip Links | PASS/FAIL | |
| Form Labels | PASS/FAIL | |
| ARIA Labels | PASS/FAIL | |
| Text Resize | PASS/FAIL | |

## Findings

### [PRIORITY] Finding Title
- **Criterion:** [WCAG reference]
- **Element:** [CSS selector or description]
- **Issue:** [What's wrong]
- **Impact:** [Who is affected and how]
- **Fix:** [Recommended remediation]

## Summary

- **Accessibility Score:** XX%
- **Lighthouse Score:** XX/100
- **CRITICAL issues:** X
- **WARNING issues:** X
- **Deploy Decision:** GO / NO-GO
```

---

## Remediation Priority

| Priority | Definition | Timeline | Deploy Impact |
|---|---|---|---|
| **CRITICAL** | Completely blocks access for assistive technology users | Fix before deploy | **Blocks deploy** for public-facing apps |
| **WARNING** | Degrades experience but workaround exists | Fix within 2 sprints | Does not block deploy |
| **ENHANCEMENT** | Improvement opportunity; current state is compliant | Backlog | Does not block deploy |

---

## Trend Tracking

Track accessibility health over time to catch regressions.

| Sprint | Lighthouse Score | axe Violations | Manual Score | CRITICAL | WARNING | Trend |
|---|---|---|---|---|---|---|
| S-01 | | | | | | |
| S-02 | | | | | | |
| S-03 | | | | | | |

**Review cadence:** Every 5 sprints, review trends. If scores decline for 3 consecutive sprints, escalate to Enforcer.
