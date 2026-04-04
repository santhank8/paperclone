# Consultant Protocol

> Phase 6 — Adaptive Workforce & Dynamic Teams

Governs the engagement of specialist agents brought in for a single sprint to address specific skill gaps.

---

## When to Use Consultants

| Trigger | Detected By | Example |
|---------|-------------|---------|
| Skill gap identified during research | Scout | "This feature requires OAuth2 PKCE flow expertise none of our agents have" |
| Specialized domain knowledge needed | Sprint Lead | "Performance profiling requires dedicated optimization expertise" |
| Emergency expertise | Judge | "Security vulnerability found — need immediate specialist review" |
| Compliance/audit requirement | Diplomat | "SOC2 compliance review requires certified assessment" |
| One-time specialized deliverable | Planner | "Database migration from Postgres to CockroachDB" |

### Decision Criteria

Use a consultant when ALL of these are true:
1. No existing agent scores ≥ 3 on the specialization matrix for the required task type
2. The need is temporary (1–2 sprints maximum)
3. Training an existing agent would take longer than the engagement
4. Budget allows for higher-tier model costs

---

## Consultant Types

### Security Expert

```yaml
slug: consultant-security
specialization: Security audits, vulnerability assessment, threat modeling
typical_tasks:
  - Dependency vulnerability scanning
  - Authentication/authorization review
  - OWASP compliance check
  - Penetration test planning
model: Sonnet (minimum) — security reasoning must not be compromised
engagement_length: 1 sprint
deliverables:
  - Security audit report
  - Remediation priority list
  - Updated threat model
```

### Performance Optimizer

```yaml
slug: consultant-performance
specialization: Profiling, optimization, scalability analysis
typical_tasks:
  - Database query optimization
  - API response time profiling
  - Memory leak detection
  - Load testing design
model: Sonnet
engagement_length: 1 sprint
deliverables:
  - Performance baseline report
  - Optimization recommendations (prioritized)
  - Benchmark suite
```

### Design Specialist

```yaml
slug: consultant-design
specialization: UI/UX design, accessibility, design systems
typical_tasks:
  - Design system creation/audit
  - Accessibility compliance (WCAG)
  - User flow optimization
  - Component library design
model: Opus (creative judgment required)
engagement_length: 1–2 sprints
deliverables:
  - Design specifications
  - Component guidelines
  - Accessibility audit report
```

### Data Engineer

```yaml
slug: consultant-data
specialization: Database design, migrations, data pipelines
typical_tasks:
  - Schema redesign
  - Data migration planning and execution
  - Query optimization
  - Backup/recovery strategy
model: Sonnet
engagement_length: 1 sprint
deliverables:
  - Migration plan with rollback strategy
  - Updated schema documentation
  - Data integrity verification report
```

### DevOps Specialist

```yaml
slug: consultant-devops
specialization: CI/CD, infrastructure, deployment automation
typical_tasks:
  - CI/CD pipeline design
  - Docker/container optimization
  - Monitoring and alerting setup
  - Infrastructure as code
model: Sonnet
engagement_length: 1 sprint
deliverables:
  - Pipeline configuration
  - Infrastructure documentation
  - Runbook for operations
```

---

## Engagement Protocol

### Phase 1: Scope Definition

```
1. Sprint Lead drafts engagement brief:
   - Problem statement (what skill gap exists)
   - Expected deliverables (specific, measurable)
   - Timeline (start/end dates within sprint)
   - Budget allocation (approved by Treasurer)
   - Success criteria (how we know the engagement worked)

2. Judge reviews and approves engagement:
   - Confirms skill gap cannot be filled internally
   - Validates budget allocation
   - Sets context boundaries (what the consultant can/cannot access)
```

### Phase 2: Context Limits

Consultants receive a **scoped context package** — not full company access:

```
Consultant receives:
  ✓ COMPANY.md (mission and values only)
  ✓ Relevant TEAM.md
  ✓ Task specifications for their engagement
  ✓ Codebase access scoped to relevant directories
  ✓ Architecture documentation relevant to their domain

Consultant does NOT receive:
  ✗ Full constitution (only governance rules that affect their work)
  ✗ Budget details or financial data
  ✗ Other agents' performance data
  ✗ Historical retrospectives (unless directly relevant)
  ✗ Strategic roadmap beyond current sprint
```

### Phase 3: Execution

```
1. Consultant onboards (abbreviated training pipeline):
   - Context loading (scoped package only)
   - No example exposure phase (specialist is pre-qualified)
   - First task is supervised by Sprint Lead

2. Work execution:
   - All outputs reviewed by relevant team lead
   - Consultant trust level: 0 (all work requires approval)
   - Daily check-in with Sprint Lead on progress
   - Escalation path: Sprint Lead → Judge

3. Quality control:
   - QA Lead reviews all consultant deliverables
   - Evaluator scores against engagement success criteria
```

### Phase 4: Evaluation

```
At engagement end, Evaluator assesses:
  - Were all deliverables completed?        [ ] Yes  [ ] Partial  [ ] No
  - Did deliverables meet success criteria?  [ ] Yes  [ ] Partial  [ ] No
  - Was budget respected?                    [ ] Yes  [ ] Over by ____%
  - Were there integration issues?           [ ] None [ ] Minor    [ ] Major
  - Would we re-engage this consultant type? [ ] Yes  [ ] Maybe    [ ] No

Score: ___/5
```

---

## Cost Structure

Consultant agents may use higher-tier models to justify their specialist role:

| Consultant Type | Model | Est. Cost/Sprint | Justification |
|----------------|:-----:|:----------------:|---------------|
| Security Expert | Sonnet | $5.00–$10.00 | Security reasoning cannot be compromised |
| Performance Optimizer | Sonnet | $4.00–$8.00 | Profiling requires thorough analysis |
| Design Specialist | Opus | $8.00–$15.00 | Creative judgment demands highest capability |
| Data Engineer | Sonnet | $4.00–$8.00 | Migration planning needs reliable reasoning |
| DevOps Specialist | Sonnet | $4.00–$8.00 | Infrastructure decisions need precision |

### Budget Rules

- Consultant budget is allocated separately from team operating budget
- Treasurer must approve before engagement begins
- Hard stop at 120% of allocated budget (auto-pause)
- Unused consultant budget rolls back to company reserve

---

## Integration Protocol

How the consultant works with the existing team without disrupting flow:

### Communication

```
Consultant communicates through:
  - Sprint Lead (primary point of contact)
  - Direct collaboration with relevant engineer (Alpha/Beta) when pair-working

Consultant does NOT:
  - Attend governance meetings
  - Participate in retrospectives (but findings are reported)
  - Have direct access to Orchestrator task queue
  - Modify team workflows or processes
```

### Workflow Integration

```
1. Sprint Lead creates consultant-specific tasks in backlog
   Tag: "consultant" label for tracking

2. Consultant picks up tasks through Sprint Lead
   No self-assignment from general queue

3. Outputs flow through normal review pipeline:
   Consultant → Sprint Lead review → QA Lead review → Merge

4. If consultant needs input from team members:
   Request goes through Sprint Lead
   Sprint Lead schedules minimal-disruption collaboration window
```

### Conflict Resolution

If consultant recommendations conflict with existing team decisions:
1. Sprint Lead mediates first
2. If unresolved: Judge makes binding decision
3. Consultant's expertise is weighted heavily but team context matters too

---

## Knowledge Transfer

**Before departure, the consultant must complete knowledge transfer.** This is a hard requirement — engagement is not considered complete without it.

### Knowledge Transfer Checklist

```
[ ] 1. Deliverables documentation
       All outputs documented with:
       - What was done and why
       - How to maintain/extend the work
       - Known limitations or trade-offs

[ ] 2. Recommendations document
       Prioritized list of follow-up actions the team should take
       Each recommendation includes:
       - Priority (P0–P3)
       - Estimated effort
       - Risk if not addressed

[ ] 3. Runbook (if applicable)
       Step-by-step procedures for any new processes introduced

[ ] 4. Q&A session with relevant agent
       Consultant answers questions from the agent who will own the work going forward
       Sprint Lead facilitates

[ ] 5. Historian capture
       Historian records:
       - Engagement summary (scope, outcomes, cost)
       - Key decisions made and rationale
       - Lessons learned for future consultant engagements
       - Recommendations for building this capability in-house
```

### Departure Verification

Sprint Lead confirms all checklist items are complete before finalizing engagement. Incomplete knowledge transfer results in a reduced evaluation score and a flag against re-engagement of that consultant type.
