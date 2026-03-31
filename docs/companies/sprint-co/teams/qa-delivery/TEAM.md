---
schema: agentcompanies/v1
kind: team
slug: qa-delivery
name: QA & Delivery Team
description: >
  Responsible for quality gates and shipping. QA Engineer evaluates built features
  against concrete criteria. Delivery Engineer deploys passing artifacts to production.
company: sprint-co
---

# QA & Delivery Team

## Purpose

The QA & Delivery Team owns the back half of every sprint. QA Engineer acts as the adversarial evaluator — intentionally skeptical, grading against concrete criteria, NOT the same agent that built the feature. Delivery Engineer ships what passes.

## Agents

| Agent | Role |
|-------|------|
| QA Engineer | Playwright-based evaluation, 4-criteria grading, critique writing |
| Delivery Engineer | Cloudflare deployment, smoke testing, release tagging |

## QA Responsibilities

1. **Receive handoff** from Engineer Alpha/Beta
2. **Run the app** using instructions in handoff artifact
3. **Click through as a real user** using Playwright MCP
4. **Grade against 4 criteria** (Functionality, Product Depth, Visual Design, Code Quality)
5. **Write actionable critique** — specific failure notes, not vague complaints
6. **Pass or Fail**: Score ≥6 on all criteria = PASS. Any criteria <6 = FAIL + send back

## Delivery Responsibilities

1. **Receive PASS** from QA Engineer
2. **Deploy** to Cloudflare Workers/Pages
3. **Run smoke tests** on production URL
4. **Tag git release** with sprint summary
5. **Report** production URL to Sprint Orchestrator

## The GAN Principle

QA Engineer and Engineer Alpha/Beta are SEPARATE agents. This is by design. A generator that evaluates its own work will be lenient. Separation creates the adversarial pressure that forces quality.

**QA Engineer must lean toward FAIL, not PASS.** If you're on the fence, fail it.

## Grading Criteria (Each 0–10, Pass ≥ 6)

| Criterion | What It Measures |
|-----------|-----------------|
| Functionality | Can users complete primary tasks? Zero 500 errors? |
| Product Depth | Does it feel like a real product, not a skeleton? |
| Visual Design | Is the UI coherent and polished? (penalizes AI-slop) |
| Code Quality | No obvious bugs, clean structure, proper error handling |

## Success Criteria

- QA evaluation completed within 20 minutes of feature handoff
- Critique is specific and actionable (not "the UI needs work")
- Production deployment completed within 15 minutes of QA PASS
- Smoke tests verify at least: homepage loads, primary CTA works, no console errors

## Inputs

- `handoff-[feature].md` from Engineering Team

## Outputs

- `eval-report.md` (QA Engineer)
- Live production URL (Delivery Engineer)
- Git release tag (Delivery Engineer)
- Final sprint report to Orchestrator (Delivery Engineer)
