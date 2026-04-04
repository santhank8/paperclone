# High-Throughput Quality Loop Spec

## Goal

Support a target of at least 10 published articles per day without dropping the quality floor.

The governing rule is:

- do not publish more by weakening standards
- publish more by running a fast rewrite loop until the article passes strict gates

## Why The Previous Model Changes

The previous low-volume model optimized for:

- a small number of selected high-value candidates
- deep review on only a few articles
- tight publish windows

That model is good for quality, but it will not reliably reach 10 publishes per day.

This model changes the optimization target to:

- many topic-passed candidates
- fail-fast quality detection
- rewrite-until-pass
- queue-based publish throughput

## Core Model

Every article goes through a bounded loop:

1. `topic pass`
2. `write`
3. `verify`
4. if fail:
   - create improvement guidance from reason codes plus one specialist summary
   - rewrite
5. repeat until strict pass or max attempts reached
6. strict pass -> `publish queue`
7. publish queue processes sequentially
8. public verify
9. close or escalate

## Attempt Limit

- maximum `3` attempts per article

Interpretation:

- attempt 1: first draft
- attempt 2: first guided rewrite
- attempt 3: second guided rewrite

If the article still fails after attempt 3:

- send it to `human review backlog`
- do not immediately create a fresh job for the same topic

## Topic Gate

Only topic-passed candidates enter the article loop.

Topic pass should require:

- RSS scout viability
- grounding viability
- topic/source alignment confidence above threshold

This stage is still cheap and should reject weak topics before the write loop starts.

## Verification Rule

Verification is strict.

The article must pass:

- research grounding
- topic alignment
- explainer quality
- reader experience
- visual quality

No publish queue entry without strict pass.

## Improvement Guidance Rule

When an article fails:

- use `reason codes` as the primary machine-readable diagnosis
- request one short specialist improvement memo from the owning lane

Specialist mapping:

- `research_grounding` or source/topic issues -> `Research Lead`
- `explainer_quality` -> `Explainer Editor`
- `reader_experience` -> `Reader Experience Editor`
- `visual_quality` -> `Visual Editor`
- multi-lane ambiguity -> `Editor-in-Chief`

### Specialist Cost Rule

- call the specialist from the first failure
- for the same article and same lane, do not call the same specialist more than once

This preserves direction quality while avoiding repeated token waste.

## Rewrite Rule

The rewrite step must use:

- current draft
- failed gate reasons
- specialist guidance
- previous attempt history

The rewrite step should also update learning state for the writer so repeated failure patterns become less likely.

## Publish Queue Rule

Strict-pass articles do not publish immediately.

They enter a `publish queue`.

The queue:

- processes sequentially
- applies publish boundary safely
- attaches receipts and post ids
- runs public verify after publish

This preserves throughput without letting side effects fan out chaotically.

## Human Review Backlog Rule

If an article fails after 3 attempts:

- move it to `human review backlog`
- preserve all attempts, reasons, and guidance artifacts
- do not silently drop the learning history

This backlog exists for:

- repeated ambiguity
- prompt/system weaknesses
- topics that need a human editorial call

## Lane Model

### Always-On Cheap Layer

- topic scout
- Grok trend/title sidecars
- NotebookLM grounding
- draft generation
- deterministic prechecks

### Conditional Specialist Layer

- specialist improvement guidance
- bounded rewrite loop

### Queue Layer

- publish boundary
- public verify

## Throughput Strategy

To reach 10 publishes/day, optimize for:

- fast cheap rejection
- low-cost rewrite loops
- no unnecessary deep-review bottlenecks
- sequential but steady publish queue

Do not optimize for:

- maximum depth per article
- repeated full editorial passes on every attempt
- selected-candidate scarcity

## Ownership

- `Research Lead`: factual and source correction
- `Explainer Editor`: clarity correction
- `Reader Experience Editor`: readability / scan correction
- `Visual Editor`: visual and editing-density correction
- `Editor-in-Chief`: ambiguity resolution and final editorial disputes
- `Validation Engineer`: keep gates strict and stable
- `Publisher`: safe queue execution
- `Verifier`: real output confirmation

## Success Criteria

The model succeeds when:

- daily publish count can reach 10+
- strict quality gates remain intact
- failed articles are repaired quickly or routed cleanly
- expensive specialist tokens are bounded
- publish remains deterministic and observable
