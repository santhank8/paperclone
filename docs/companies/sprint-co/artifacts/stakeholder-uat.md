<!-- TEMPLATE: Stakeholder Post-Deployment UAT Report
     Agent: Stakeholder (governance)
     When: After each sprint's deployment, before the sprint is marked complete
     Fill in all [bracketed] placeholders with actual content.
     Delete this comment block when producing a real report. -->

# Stakeholder Post-Deployment UAT Report

## Meta

| Field                 | Value                              |
|-----------------------|------------------------------------|
| **Sprint ID**         | [sprint-NNN]                       |
| **Sprint Title**      | [human-readable sprint name]       |
| **UAT Date**          | [YYYY-MM-DD]                       |
| **Reviewer**          | Stakeholder Agent                  |
| **Deployment URL**    | [URL where the deployment can be accessed, or "local" if dev-only] |
| **Deployment Method** | [e.g., Docker, Vercel, local dev server] |
| **Build Commit**      | [short SHA or tag]                 |
| **UAT Status**        | [PASS / CONDITIONAL PASS / FAIL]   |

---

## Feature-by-Feature UAT

Evaluate each feature that was planned for this sprint. Compare what was promised against what was delivered.

### Feature 1: [Feature Name]

| Aspect             | Detail                                                      |
|---------------------|-------------------------------------------------------------|
| **Promised**        | [1–2 sentences: what the sprint plan said this feature would do] |
| **Delivered**       | [1–2 sentences: what actually shipped — be precise]         |
| **Verdict**         | [DELIVERED AS PROMISED / PARTIALLY DELIVERED / NOT DELIVERED / EXCEEDED EXPECTATIONS] |

- **User Experience Assessment:** [2–3 sentences. Walk through the feature as a user. Is it intuitive? Does it do what you'd expect?]
- **Friction Points:** [Bullet list of rough edges, confusing flows, missing feedback, or broken states. Write "None observed" if clean.]
  - [e.g., "Button label says 'Submit' but nothing visually confirms submission."]
  - [e.g., "Loading state is missing — page appears frozen for 2 seconds."]
- **Delight Moments:** [Bullet list of things that exceeded expectations or felt genuinely good. Write "None observed" if unremarkable.]
  - [e.g., "Inline validation on the form gives immediate, clear feedback."]
  - [e.g., "Default values are smart — most users won't need to change anything."]

### Feature 2: [Feature Name]

| Aspect             | Detail                                                      |
|---------------------|-------------------------------------------------------------|
| **Promised**        | [What was planned]                                          |
| **Delivered**       | [What shipped]                                              |
| **Verdict**         | [DELIVERED AS PROMISED / PARTIALLY DELIVERED / NOT DELIVERED / EXCEEDED EXPECTATIONS] |

- **User Experience Assessment:** [2–3 sentences.]
- **Friction Points:**
  - [List or "None observed"]
- **Delight Moments:**
  - [List or "None observed"]

### Feature 3: [Feature Name]

| Aspect             | Detail                                                      |
|---------------------|-------------------------------------------------------------|
| **Promised**        | [What was planned]                                          |
| **Delivered**       | [What shipped]                                              |
| **Verdict**         | [DELIVERED AS PROMISED / PARTIALLY DELIVERED / NOT DELIVERED / EXCEEDED EXPECTATIONS] |

- **User Experience Assessment:** [2–3 sentences.]
- **Friction Points:**
  - [List or "None observed"]
- **Delight Moments:**
  - [List or "None observed"]

<!-- Copy the feature block above for each additional feature in the sprint. -->

---

## Unplanned Changes

List anything that shipped but was NOT in the original sprint plan.

| Change                    | Description                        | Customer Impact           |
|---------------------------|------------------------------------|---------------------------|
| [Change name or area]     | [What changed]                     | [Positive / Neutral / Negative — why] |
| [Add rows as needed]      |                                    |                           |

If none, write: "No unplanned changes detected."

---

## Overall Customer Satisfaction Score

**Score: [1–5] / 5**

| Score | Meaning                                                           |
|-------|-------------------------------------------------------------------|
| 5     | Exceptional — customers would be thrilled; exceeds expectations   |
| 4     | Good — solid delivery; customers would be satisfied               |
| 3     | Acceptable — delivers value but has notable gaps or rough edges   |
| 2     | Below expectations — key features are missing or poorly executed  |
| 1     | Unacceptable — would damage customer trust; do not release        |

**Rationale:** [2–3 sentences explaining the score. Reference specific features and their state.]

---

## Persona Walkthroughs

Simulate each persona actually using the deployed product. This is not a plan review — it's a hands-on experience simulation.

### Persona 1: Startup Founder (Sam)

- **Task attempted:** [What would Sam try to do? e.g., "Set up a new company and assign an agent to an issue."]
- **Experience:** [3–5 sentences narrating Sam's journey through the product. What went smoothly? Where did Sam get stuck? Would Sam come back tomorrow?]
- **Satisfaction:** [1–5 with one-line explanation]
- **Quote (simulated):** ["Exactly what Sam might say — e.g., 'This is almost there but I had to refresh twice to see my changes.'"]

### Persona 2: Enterprise Admin (Dana)

- **Task attempted:** [What would Dana try to do? e.g., "Review agent activity logs and check API key permissions."]
- **Experience:** [3–5 sentences.]
- **Satisfaction:** [1–5 with one-line explanation]
- **Quote (simulated):** ["What Dana might say."]

### Persona 3: Casual User (Alex)

- **Task attempted:** [What would Alex try to do? e.g., "Open the dashboard and understand what Paperclip does."]
- **Experience:** [3–5 sentences.]
- **Satisfaction:** [1–5 with one-line explanation]
- **Quote (simulated):** ["What Alex might say."]

---

## Action Items for Next Sprint

Concrete, prioritized actions based on this UAT. These feed directly into the next sprint's planning.

| #  | Action Item                                   | Priority       | Assigned To       |
|----|-----------------------------------------------|----------------|-------------------|
| 1  | [e.g., "Add loading indicators to Feature X"] | [P1-high]      | [agent or "TBD"]  |
| 2  | [e.g., "Fix submission feedback on Feature Y"]| [P2-medium]    | [agent or "TBD"]  |
| 3  | [e.g., "Write user-facing docs for Feature Z"]| [P2-medium]    | [agent or "TBD"]  |
| 4  | [Add more as needed]                          |                |                   |

---

## Appendix

- **Sprint plan reviewed:** [link or path to the original sprint plan]
- **Pre-sprint stakeholder review:** [link or path to the stakeholder-review.md for this sprint]
- **Deployment logs:** [link or path, if available]
- **Notes:** [Additional observations, edge cases tested, or context.]
