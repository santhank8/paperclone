# Rubber Duck Debugging Protocol

> Sprint Co Capability — Phase 11: Advanced Agent Capabilities

## Concept

The Rubber Duck is a dedicated debugging agent that helps other agents solve problems by **asking questions, never providing solutions**. The act of explaining a problem clearly and answering pointed questions often leads the stuck agent to discover the solution themselves.

The Rubber Duck uses a lightweight model (Haiku) and short exchanges, keeping cost minimal.

## When to Activate

| Trigger | Action |
|---------|--------|
| Engineer agent stuck on a bug for >15 minutes | Orchestrator assigns Rubber Duck |
| Agent explicitly requests debugging help | Rubber Duck session initiated |
| QA finds a bug that the engineer cannot reproduce | Rubber Duck helps QA explain to engineer |
| Task blocked with no clear next step | Rubber Duck helps clarify the problem |

The Orchestrator monitors agent progress. If no commit or artifact update occurs for 15+ minutes on an active task, the Orchestrator offers a Rubber Duck session.

## Protocol

```
1. Engineer explains the problem to Rubber Duck
   └─ "What are you trying to do? What's going wrong?"

2. Rubber Duck asks clarifying questions (from template below)
   └─ Never suggests fixes. Only asks questions.

3. Engineer answers each question
   └─ The process of articulating answers often reveals the issue.

4. If engineer finds the solution → session ends successfully
   If not after 10 questions → escalate to pair programming or senior agent

5. Session log saved as artifact
```

## Question Templates

The Rubber Duck draws from these 10 standard debugging questions, asked in order of relevance:

### The Standard 10

| # | Question | Purpose |
|---|----------|---------|
| 1 | **What did you expect to happen?** | Establish intended behavior |
| 2 | **What actually happened?** | Establish observed behavior |
| 3 | **What changed since it last worked?** | Narrow the delta |
| 4 | **Can you reproduce it consistently?** | Determine if it's deterministic |
| 5 | **What have you already tried?** | Avoid repeated dead ends |
| 6 | **What does the error message say, exactly?** | Force precise reading of errors |
| 7 | **Have you checked the input data?** | Validate assumptions about inputs |
| 8 | **Can you isolate the smallest failing case?** | Reduce problem scope |
| 9 | **What does the code do on the line before the failure?** | Trace execution path |
| 10 | **If you had to explain this code to someone new, what does each step do?** | Force walkthrough |

### Follow-up Probes

If the standard 10 don't resolve it:
- "What assumptions are you making that might be wrong?"
- "Is there a simpler version of this that works? What's different?"
- "Can you add logging at each step and tell me what you see?"
- "Have you checked the types/shapes of all variables at the failure point?"
- "Is this the same bug, or could there be two separate issues?"

## Session Format

```markdown
## DUCK-SESSION-INIT
- **Task:** <task-id>
- **Engineer:** <agent-name>
- **Bug Summary:** <one-line description>
- **Time Stuck:** <minutes>
- **Model:** haiku (low-cost)

---

### Q1: What did you expect to happen?
**Engineer:** <response>

### Q2: What actually happened?
**Engineer:** <response>

### Q3: What changed since it last worked?
**Engineer:** <response>

...

---

## DUCK-SESSION-RESULT
- **Resolved:** [yes/no]
- **Resolution:** <what the engineer discovered>
- **Questions Asked:** <count>
- **Escalated:** [no / pair-programming / senior-agent]
- **Duration:** <minutes>
- **Tokens Used:** <count>
```

## Cost Profile

| Metric | Value |
|--------|-------|
| Model | Haiku (cheapest available) |
| Avg tokens per session | ~2,000 |
| Avg session duration | 5–10 minutes |
| Avg questions before resolution | 4–6 |
| Cost per session | ~$0.005 |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Resolution rate without escalation | >60% | Sessions resolved / total sessions |
| Avg time to resolution | <10 min | From session start to resolution |
| Engineer satisfaction | Positive | Self-reported after session |
| Cost per resolution | <$0.01 | Model cost for resolved sessions |

## Integration

- Rubber Duck is always available — no scheduling required
- Orchestrator can auto-assign after detecting a stuck agent
- Session logs are saved alongside task artifacts for Historian records
- Rubber Duck never modifies code, files, or task status — it only asks questions
