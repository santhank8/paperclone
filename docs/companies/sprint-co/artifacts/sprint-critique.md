<!-- TEMPLATE: Critic Post-Sprint Critique Report
     Agent: Critic (governance)
     When: After each sprint is complete and deployed, alongside the Stakeholder UAT
     Fill in all [bracketed] placeholders with actual content.
     Delete this comment block when producing a real critique. -->

# Sprint Critique Report

## Meta

| Field                  | Value                              |
|------------------------|------------------------------------|
| **Sprint ID**          | [sprint-NNN]                       |
| **Sprint Title**       | [human-readable sprint name]       |
| **Critique Date**      | [YYYY-MM-DD]                       |
| **Reviewer**           | Critic Agent                       |
| **Previous Sprint ID** | [sprint-NNN-1, or "N/A" if first]  |
| **Report Status**      | [DRAFT / FINAL]                    |

---

## Overall Grade

# [A / B / C / D / F]

**One-line summary:** [Single sentence capturing the essence of this sprint — e.g., "Solid infrastructure work that needed more user-facing polish."]

| Grade | Meaning                                                        |
|-------|----------------------------------------------------------------|
| A     | Exceptional — high ambition, well-executed, cohesive result    |
| B     | Good — meaningful progress with minor issues                   |
| C     | Adequate — delivered something but quality or scope concerns   |
| D     | Below par — significant problems in execution or direction     |
| F     | Failure — sprint did not produce usable or coherent output     |

---

## Scoring Dimensions

### 1. Product Coherence — Does it hang together?

**Sub-Grade: [A–F]**

[3–5 sentences. Evaluate whether the features shipped in this sprint form a coherent whole. Do they tell a story? Would a user understand why these things were built together? Or does it feel like a grab-bag of unrelated changes? Consider navigation flow, terminology consistency, and whether the product makes more sense after this sprint than before.]

### 2. Ambition — Did we push boundaries?

**Sub-Grade: [A–F]**

[3–5 sentences. Evaluate the difficulty and novelty of what was attempted. Did the team tackle hard problems or stick to safe, incremental work? Was there any technical or product innovation? A sprint of only bug fixes might score low here even if well-executed. Consider: could a junior developer have done this?]

### 3. Polish — Is it refined?

**Sub-Grade: [A–F]**

[3–5 sentences. Evaluate the fit-and-finish of what shipped. Look at error handling, edge cases, loading states, empty states, copy quality, visual consistency, and responsive behavior. A feature that works but feels rough scores low. A feature with thoughtful micro-interactions and clear feedback scores high.]

### 4. AI-Smell — Does it feel AI-generated?

**Sub-Grade: [A–F]** (Higher is better — A means "no AI smell")

[3–5 sentences. Evaluate whether the output has telltale signs of AI generation: generic variable names, boilerplate comments, unnecessary abstractions, over-engineering, repetitive patterns, lack of personality, or suspiciously uniform code style. Good AI-assisted work should be indistinguishable from thoughtful human work. Call out specific examples.]

---

## Dimension Summary

| Dimension          | Grade | One-Line Note                                      |
|--------------------|-------|----------------------------------------------------|
| Product Coherence  | [A–F] | [brief note]                                       |
| Ambition           | [A–F] | [brief note]                                       |
| Polish             | [A–F] | [brief note]                                       |
| AI-Smell           | [A–F] | [brief note]                                       |
| **Overall**        | [A–F] | [brief note]                                       |

---

## Strengths

What was done well this sprint. Be specific — name features, code patterns, or decisions.

1. [e.g., "The new task assignment flow is genuinely intuitive — zero documentation needed."]
2. [e.g., "Error handling in the API layer is consistent and uses proper HTTP status codes."]
3. [e.g., "The decision to use server-sent events instead of polling was the right architectural call."]
4. [Add more as needed.]

---

## Weaknesses

What fell short. Be direct but constructive — explain the problem and hint at the fix.

1. [e.g., "The settings page has no loading state — it renders empty then pops in, which feels broken."]
2. [e.g., "Three different naming conventions for similar concepts (task/issue/ticket) — settle on one."]
3. [e.g., "Test coverage for the new endpoints is zero; this is a regression risk."]
4. [Add more as needed.]

---

## Red Flags

Patterns or trends that aren't failures yet but will become problems if they continue. These are early warnings.

1. **[Pattern name]:** [Description — e.g., "Scope creep: each sprint adds 20% more features than the previous one. This is unsustainable and will lead to a quality collapse."]
2. **[Pattern name]:** [Description — e.g., "Documentation debt: three sprints in a row with zero doc updates. The product is outrunning its own docs."]
3. **[Pattern name]:** [Description — e.g., "Single-agent bottleneck: the Architect agent is on the critical path for everything. If it fails, the whole sprint stalls."]
4. [Add more as needed, or remove this section if no red flags.]

---

## Comparison to Previous Sprint

| Metric              | Previous Sprint ([sprint-NNN-1]) | This Sprint ([sprint-NNN]) | Trend       |
|---------------------|----------------------------------|----------------------------|-------------|
| Overall Grade       | [grade]                          | [grade]                    | [↑ / → / ↓] |
| Product Coherence   | [grade]                          | [grade]                    | [↑ / → / ↓] |
| Ambition            | [grade]                          | [grade]                    | [↑ / → / ↓] |
| Polish              | [grade]                          | [grade]                    | [↑ / → / ↓] |
| AI-Smell            | [grade]                          | [grade]                    | [↑ / → / ↓] |
| Features Planned    | [N]                              | [N]                        | [↑ / → / ↓] |
| Features Delivered  | [N]                              | [N]                        | [↑ / → / ↓] |

**Trend Analysis:** [2–3 sentences. Is the product getting better, worse, or plateauing? Are improvements in one area masking decline in another?]

If this is the first sprint, write: "No previous sprint to compare. This serves as the baseline."

---

## Specific Recommendations

Actionable recommendations for the next sprint. Each should be concrete enough to become a task.

1. **[Recommendation title]:** [What to do and why — e.g., "Establish a naming glossary: create a shared document defining task/issue/ticket terminology and enforce it across code and UI."]
2. **[Recommendation title]:** [What to do and why — e.g., "Add a polish pass as a sprint phase: dedicate the last 10% of sprint time to loading states, error messages, and edge cases."]
3. **[Recommendation title]:** [What to do and why — e.g., "Introduce integration tests for the core happy path before the next sprint ships."]
4. [Add more as needed.]

---

## Appendix

- **Sprint plan:** [link or path]
- **Stakeholder UAT:** [link or path to the stakeholder-uat.md for this sprint]
- **Code diff/PR:** [link or reference to the sprint's code changes]
- **Previous critique:** [link or path to the previous sprint-critique.md, if any]
- **Notes:** [Additional context, raw observations, or evidence.]
