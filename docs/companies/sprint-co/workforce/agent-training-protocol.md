# Agent Training Protocol

> Phase 6 — Adaptive Workforce & Dynamic Teams

Defines how to train new agents, onboard model upgrades, and ensure consistent quality across the workforce.

---

## Training Pipeline

Every new agent (or existing agent receiving a model upgrade) goes through a 5-step pipeline:

```
┌──────────────┐    ┌───────────────────┐    ┌─────────────────┐
│ 1. Context   │───→│ 2. Example        │───→│ 3. Supervised   │
│    Loading   │    │    Exposure       │    │    Task         │
└──────────────┘    └───────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │ 4. Evaluation   │
                                             └─────────────────┘
                                                      │
                                              Pass ≥80%?
                                              │       │
                                             Yes      No
                                              │       │
                                              ▼       ▼
                                      ┌───────────┐  Repeat from
                                      │5. Graduate│  Step 3
                                      └───────────┘
```

---

## Step 1: Context Loading

Every new agent must read and internalize these documents before any task execution.

### Context Loading Checklist

```
Required reading (in order):

[ ] 1. COMPANY.md
       Company mission, values, operating principles

[ ] 2. Agent's own AGENTS.md
       Role definition, responsibilities, authorities

[ ] 3. Agent's TEAM.md
       Team mission, members, workflows, interfaces

[ ] 4. constitution.md
       Governance rules, decision-making framework, boundaries

[ ] 5. Last 3 retrospectives
       Recent team learnings, recurring issues, process changes

[ ] 6. lessons-learned.md
       Accumulated institutional knowledge, failure patterns, best practices

[ ] 7. Current sprint brief (if mid-sprint onboarding)
       Active goals, in-progress work, blockers

[ ] 8. Style and conventions guide
       Code style, commit conventions, PR format, naming patterns
```

### Verification

After context loading, Sprint Lead asks 5 verification questions:
1. What is this company's primary mission?
2. What are your specific responsibilities?
3. Who do you escalate to and when?
4. Name one lesson from recent retrospectives.
5. What governance constraints apply to your role?

**Pass threshold**: 4/5 correct. Failure → re-read flagged documents.

---

## Step 2: Example Exposure

The agent receives 3 past task examples matched to their role.

### Example Package Format

```yaml
example_set:
  - task_id: "ENG-042"
    input:
      description: "Implement pagination for /api/tasks endpoint"
      acceptance_criteria:
        - "Supports limit/offset query params"
        - "Returns total count in response"
        - "Default limit is 50"
    expected_output:
      summary: "Added pagination to tasks route with tests"
      files_changed: ["server/routes/tasks.ts", "server/routes/__tests__/tasks.test.ts"]
      quality_score: 4.5
    notes: "Note the test coverage pattern — all new endpoints require tests"

  - task_id: "ENG-058"
    input: ...
    expected_output: ...

  - task_id: "ENG-071"
    input: ...
    expected_output: ...
```

### Process

1. Agent reviews all 3 examples (input → expected output)
2. Agent produces its own output for each example (without seeing expected output first)
3. Evaluator scores agent outputs against expected outputs

### Scoring Rubric

| Dimension | Weight | Criteria |
|-----------|:------:|----------|
| Correctness | 30% | Output achieves the acceptance criteria |
| Completeness | 25% | All required elements present, no gaps |
| Style conformance | 20% | Follows conventions from context documents |
| Efficiency | 15% | Solution is appropriately scoped, not over-engineered |
| Communication | 10% | Clear commit messages, PR descriptions, comments |

---

## Step 3: Supervised Task

Agent executes a real task from the current sprint under supervision.

### Supervision Protocol

```
1. Sprint Lead assigns a real task appropriate to agent's role
   - Complexity: medium (not trivial, not highest-stakes)
   - Clear acceptance criteria

2. Agent executes task independently

3. Sprint Lead reviews output BEFORE it is merged/applied:
   - Correctness check
   - Style conformance check
   - Identifies any concerning patterns

4. If revisions needed:
   - Sprint Lead provides specific feedback
   - Agent revises (up to 2 revision rounds)
   - If still failing after 2 rounds: flag for additional training

5. Record outcome:
   - Task quality score
   - Number of revisions required
   - Time to completion
   - Any escalations or blockers encountered
```

---

## Step 4: Evaluation

Evaluator assesses the agent's readiness based on accumulated evidence.

### Evaluation Scorecard

```
Context Verification:        ___/5    (from Step 1)
Example Task 1 Score:        ___/5    (from Step 2)
Example Task 2 Score:        ___/5    (from Step 2)
Example Task 3 Score:        ___/5    (from Step 2)
Supervised Task Score:       ___/5    (from Step 3)
Revision Count:              ___      (lower is better)
                             ─────────────────────
Weighted Average:            ___/5
Pass Threshold:              4.0/5 (80%)
```

### Decision Matrix

| Weighted Average | Decision |
|:----------------:|----------|
| ≥ 4.0 | **Graduate** — proceed to Step 5 |
| 3.5–3.9 | **Conditional** — one more supervised task, must score ≥ 4.0 |
| 3.0–3.4 | **Repeat** — return to Step 2 with new examples |
| < 3.0 | **Fail** — agent configuration needs review (model, context, role fit) |

---

## Step 5: Graduation

### Graduation Criteria

The agent must demonstrate:

1. **Consistency**: Score ≥ 80% of incumbent agent's average on **3 consecutive tasks**
2. **Independence**: Complete at least 1 task with no revisions required
3. **Context awareness**: Correctly reference company conventions without prompting

### Graduation Actions

```
[ ] Evaluator signs off on graduation scorecard
[ ] Sprint Lead confirms operational readiness
[ ] Agent trust level set to 1 (supervised execution complete)
[ ] Agent added to active roster in company manifest
[ ] Historian records training outcomes and baseline metrics
[ ] First unsupervised task assigned (still monitored for 1 sprint)
```

---

## Model Upgrade Protocol

When upgrading an existing agent to a new model version (e.g., Sonnet 3.5 → Sonnet 4):

### Comparison Test

```
1. Select 5 representative past tasks the agent completed successfully

2. Re-run each task with the new model version
   - Same inputs and context
   - No prior output visible

3. Evaluator scores new outputs against original outputs:
   - Quality score (1-5)
   - Correctness (pass/fail)
   - Token usage (cost comparison)
   - Latency

4. Historian records side-by-side comparison
```

### Upgrade Decision Matrix

| New Model Score vs. Incumbent | Token Cost Change | Decision |
|:-----------------------------:|:-----------------:|----------|
| ≥ 95% quality, any cost | Any | **Upgrade** if cost ≤ 120% of current |
| ≥ 110% quality | ≤ 150% cost | **Upgrade** (quality justifies cost) |
| 80–95% quality | ≤ 50% cost | **Consider** (significant savings, acceptable quality) |
| < 80% quality | Any | **Reject** |
| Any | > 200% cost | **Reject** unless quality gain is exceptional |

### Rollback Criteria

Rollback to previous model version if, within 3 sprints of upgrade:

- Task failure rate increases by >15 percentage points
- Average quality score drops below 3.5/5
- Escalation rate doubles
- Agent consistently requires more revision cycles than before

### Rollback Process

```
1. Sprint Lead files rollback request with evidence
2. Evaluator verifies performance degradation data
3. Judge approves rollback
4. Model reverted to previous version
5. Historian documents the upgrade attempt and outcome
6. Re-evaluation scheduled for next model release
```
