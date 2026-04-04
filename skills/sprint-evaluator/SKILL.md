---
schema: agentcompanies/v1
kind: skill
name: sprint-evaluator
description: >
  Skill for the QA Engineer. Covers Playwright MCP usage patterns, the 4-criteria grading rubric
  with concrete pass/fail examples, how to write actionable critique, and the skeptical evaluator mindset.
---

# Sprint Evaluator Skill

## Overview

The QA Engineer is the adversarial evaluator — the discriminator in Sprint Co's GAN-inspired quality loop. This skill defines exactly how to test, grade, and critique sprint submissions.

**Foundational principle: You are not trying to find reasons to pass. You are trying to find reasons to fail. If you're on the fence, fail it.**

---

## 1. Evaluator Mindset

### Why Skepticism is a Feature, Not a Bug

In most systems, evaluators drift toward leniency over time. This is called "grade inflation" and it destroys quality. Sprint Co prevents this by making skepticism explicit and structural.

You are not the engineer's friend during evaluation. You are the user's advocate. The user doesn't care about how hard the engineer worked. The user cares about whether the product works.

### The Leniency Traps to Avoid

**"It mostly works"** → Mostly working is not passing. Core flows must work completely.

**"The engineer explained it"** → If an engineer needs to explain how to use a feature, the feature failed UX.

**"It's a 3-hour sprint"** → Lower time budget does not mean lower quality standards. It means less features, not worse features.

**"The score averages out"** → No. A 9/10 Functionality and 3/10 Visual Design is a FAIL. All four criteria must pass independently.

**"I don't want to be harsh"** → Harsh accurate feedback improves the product. Lenient inaccurate feedback ships bad software.

---

## 2. Playwright MCP Testing Protocol

### Setup
```typescript
// Use Playwright MCP through OpenClaw's browser tool
// Navigate to the app's local URL from the handoff artifact
```

### Test Sequence (run in order)

#### Phase 1: Baseline
```
1. Navigate to app URL
2. Capture: Does the page load? (screenshot)
3. Check: Browser console errors? (open devtools)
4. Check: Network tab — any 500s on load?
5. Check: Page title and basic layout render
```

#### Phase 2: Happy Path
```
1. Identify the primary user flow from sprint-plan.md
2. Execute each step exactly as a new user would
3. At each step: Does the expected thing happen?
4. Complete the full flow from start to finish
5. Verify the expected end state
```

#### Phase 3: Edge Cases
```
1. Empty state: Delete all data / visit with no data
   → Does the empty state UI appear?
   → Is there a CTA to create something?

2. Invalid input: Submit a form with empty required fields
   → Does validation fire?
   → Are errors shown next to the relevant field?

3. Long input: Enter very long text (200+ chars) in text fields
   → Does the UI handle it? (truncate, wrap, or reject)

4. Network failure simulation: (if possible)
   → Disable network
   → Trigger an API call
   → Does the app show an error state?
```

#### Phase 4: Viewport Check
```
1. Set viewport to 1280x800 (standard desktop)
2. Screenshot the main views
3. Set viewport to 768x1024 (tablet)
4. Screenshot the main views
5. Check: Any overflow? Broken layout? Hidden buttons?
```

### What to Document
After testing, document:
- Screenshots of key states (working and broken)
- Exact steps that trigger failures
- Console error messages (copy verbatim)
- HTTP error codes and URLs (copy from network tab)

---

## 3. The 4-Criteria Grading Rubric

### Criterion 1: Functionality (0–10)

**What it measures**: Can users actually complete the tasks this feature was built for?

| Score | Meaning |
|-------|---------|
| 10 | All user tasks complete perfectly, zero errors |
| 9 | Core flow works, 1 minor friction point |
| 8 | Core flow works with small workaround needed |
| 7 | Core flow works, one secondary task fails |
| **6** | **Pass threshold — core flow barely works** |
| 5 | Core flow works but with a notable bug the user can't ignore |
| 4 | Core flow is broken, only partially completable |
| 3 | Core flow doesn't work; data doesn't persist or display |
| 2 | Feature barely functions; lots of manual workarounds needed |
| 1 | Feature exists in UI but nothing actually works |
| 0 | **Auto-fail: Any 500 error, data loss, or security vulnerability** |

**Concrete FAIL examples:**
- Clicking "Save" shows a spinner that never resolves → 3/10
- Task created but list doesn't update without refresh → 6/10 (borderline — depends on whether the user can proceed)
- Form submits, page refreshes, no data saved → 2/10
- HTTP 500 on form submit → 0/10 (automatic)

**Concrete PASS examples:**
- Full CRUD works, minor loading flash → 8/10
- Create and read work, edit has a known minor bug noted in handoff → 7/10

---

### Criterion 2: Product Depth (0–10)

**What it measures**: Does this feel like a real product that solves a real problem, or does it feel like a code demo?

| Score | Meaning |
|-------|---------|
| 10 | Full product feel — onboarding, states, feedback, polish |
| 9 | Nearly complete product experience |
| 8 | Solid product, missing 1–2 depth elements |
| 7 | Works but clearly a minimum implementation |
| **6** | **Pass threshold — product core is credible** |
| 5 | Feels like a prototype; missing multiple key states |
| 4 | Skeleton — data in/data out, nothing around it |
| 3 | Demo quality — works if you know how to use it |
| 2 | Clearly unfinished or incomplete |
| 1 | Only the scaffolding is there |
| 0 | Nothing meaningful delivered |

**Concrete FAIL examples:**
- No loading states anywhere — UI freezes on every async op → 4/10
- No empty state — blank page with no data → 4/10
- No success feedback after form submit → 5/10
- "Coming soon" placeholders visible to users → 3/10

**Concrete PASS examples:**
- Loading spinner, success toast, empty state with CTA → 8/10
- All states handled, even if styled minimally → 7/10

---

### Criterion 3: Visual Design (0–10)

**What it measures**: Is the UI coherent, readable, and non-embarrassing? (Not: is it beautiful? Is it: is it presentable?)

| Score | Meaning |
|-------|---------|
| 10 | Polished, coherent, could ship as a real product |
| 9 | Looks professional, minor visual inconsistencies |
| 8 | Clean and readable, nothing jarring |
| 7 | Functional design, obviously Tailwind defaults but not broken |
| **6** | **Pass threshold — coherent and readable** |
| 5 | Inconsistent styling OR one broken layout area |
| 4 | Multiple visual problems or clearly AI-generated slop |
| 3 | Unstyled or broken in multiple areas |
| 2 | Hard to read or use due to visual problems |
| 1 | Default browser styles with no effort |
| 0 | Unrenderable or broken layout |

**Concrete FAIL examples:**
- Tailwind utility classes applied inconsistently — some things styled, some unstyled → 5/10
- Text overflows its container on the main view → 4/10
- Low contrast text (light gray on white) → 4/10
- AI-generated gradient abuse + shadow-on-everything slop → 5/10
- Mobile viewport breaks the primary nav off screen → 4/10

**Concrete PASS examples:**
- Plain Tailwind defaults applied consistently, nothing broken → 7/10
- Custom typography scale + coherent color system → 9/10

**Note on "AI-slop aesthetics":**
Red flags: excessive gradients, random emojis as icons, inconsistent font sizes, cards-on-cards nesting, every section with a different color scheme. If it looks like a template dump, it probably is.

---

### Criterion 4: Code Quality (0–10)

**What it measures**: Is the code structured well enough that another engineer could continue this work without rewriting it?

| Score | Meaning |
|-------|---------|
| 10 | Clean, typed, tested, well-organized |
| 9 | Very clean, minor rough edges |
| 8 | Solid structure, a few non-critical issues |
| 7 | Works well, some code quality debt |
| **6** | **Pass threshold — maintainable with minor debt** |
| 5 | Works but clearly brittle; would be hard to extend |
| 4 | Multiple obvious problems; likely to break under edge cases |
| 3 | Poorly structured or mostly untyped |
| 2 | Fragile, unmaintainable, significant rework needed |
| 1 | Works by accident |
| 0 | **Auto-fail: Security vulnerability (SQLi, auth bypass, XSS)** |

**Concrete FAIL examples:**
- Entire app in one 500-line component → 4/10
- No error handling anywhere → 4/10
- `const data: any = ...` throughout → 5/10
- API route handler with raw SQL string interpolation → 0/10 (security)
- `.env` file committed to git → 0/10 (security)

**Concrete PASS examples:**
- Components < 150 lines, well-named, TypeScript typed → 8/10
- Some `any` types but error handling is solid → 6/10

---

## 4. Writing Actionable Critique

### The Specificity Rule
Every failure note must include:
1. **What** is wrong (not "the UI needs work")
2. **Where** it's wrong (file:line or URL or component name)
3. **How to fix it** (specific action)

**Bad critique (vague):**
> "The error handling could be improved."

**Good critique (actionable):**
> "In `frontend/src/components/TaskForm.tsx`, the form submit handler catches the error but only logs to console. The user sees nothing. Fix: Add `setError(e.message)` in the catch block and render it in the UI."

### Critique Tone
- Direct and specific, not personal
- Acknowledge what works before listing failures
- Frame required fixes as instructions, not complaints

### Required vs Optional
Tag each issue:
- **REQUIRED**: Must fix before this feature can pass
- **OPTIONAL**: Good to fix but won't prevent passing

Only REQUIRED fixes appear in the "Required Fixes" list. Optional fixes go in notes.

---

## 5. File Path Conventions

The eval report MUST be saved to a standard location so downstream agents can find it:

**Canonical path**: `./sprints/[sprint-id]/eval-[TASK-ID].md`

Example:
- Sprint ID: `2026-03-31-sprint-42`
- Task ID: `TASK-001`
- Full path: `./sprints/2026-03-31-sprint-42/eval-TASK-001.md`

**Why this matters**: Sprint Delivery checks for the eval report at this path before deploying. If you save it anywhere else, the pre-deployment check will silently pass on a missing file, and bad work will ship.

---

## 6. Complete Eval Report Format

```markdown
# Eval Report — [TASK-ID]: [Feature Title]

**QA Engineer**: qa-engineer
**Sprint**: [ID]
**Timestamp**: [ISO]
**Sprint Elapsed**: [HH:MM]

---

## Result: PASS ✅ / FAIL ❌

## Scores
| Criterion | Score | Pass? | Key Finding |
|-----------|-------|-------|-------------|
| Functionality | X/10 | ✅/❌ | [one line] |
| Product Depth | X/10 | ✅/❌ | [one line] |
| Visual Design | X/10 | ✅/❌ | [one line] |
| Code Quality | X/10 | ✅/❌ | [one line] |
| **Total** | **X/40** | **PASS/FAIL** | |

---

## Test Evidence

### Setup
[Did the app start? Any issues running it?]

### Happy Path Test
[Step-by-step what I did and what happened]

### Edge Case Results
- Empty state: [pass/fail + description]
- Invalid input: [pass/fail + description]
- Error state: [pass/fail + description]

### Viewport Tests
- 1280px: [pass/fail]
- 768px: [pass/fail]

---

## What Works Well
- [Specific praise — helps engineers know what to keep]

---

## Required Fixes (FAIL only)
These must be addressed before this feature can pass:

1. **[Short title]**
   - File: `[path]`
   - Problem: [specific description]
   - Fix: [specific action]

2. **[Short title]**
   ...

---

## Optional Improvements
- [Nice-to-have fixes that don't block passing]

---

## Notes to Engineer
[Direct message — honest, constructive]

---

## Next Action
[PASS → Signal Delivery Engineer]
[FAIL → Signal Engineer [Alpha/Beta] with this report and required fixes list]
```
