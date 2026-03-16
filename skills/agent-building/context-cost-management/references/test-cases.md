# Test Cases: context-cost-management skill

## Trigger Tests (Should Fire)

### TC-01: Rate limit hit
**Prompt:** "I'm hitting rate limits on my Claude Code Max plan. I run out within 30 minutes."
**Expected trigger:** YES
**Assertion:** Should route to Rate Limit Mechanics section; explain Max plan rolling window limits; suggest /compact + model routing as first fixes

### TC-02: Context window full
**Prompt:** "My Claude Code context window keeps filling up. What can I do?"
**Expected trigger:** YES
**Assertion:** Should explain the token audit; cover /compact timing; mention MCP overhead

### TC-03: /compact guidance
**Prompt:** "When should I use /compact vs starting a fresh session?"
**Expected trigger:** YES
**Assertion:** Should give the compact vs. clear decision table; explain what's preserved vs. lost; post-compact checklist

### TC-04: MCP token overhead
**Prompt:** "My MCP tools are consuming too many tokens before I even start"
**Expected trigger:** YES
**Assertion:** Should cover MCP slimming; explain context mode; give project-scoped disable instructions

### TC-05: Cost reduction
**Prompt:** "My Claude Code bill is $300/month. How do I cut it?"
**Expected trigger:** YES
**Assertion:** Should explain model routing; give the 15x savings math; explain Haiku/Sonnet/Opus tier table

### TC-06: Session degradation
**Prompt:** "Claude Code is getting slower and forgetting things I told it earlier in the session"
**Expected trigger:** YES
**Assertion:** Should explain context collapse symptoms; recommend /compact at 60%; cover post-compact checklist

### TC-07: Session checkpointing
**Prompt:** "How do I save my session state and resume it later?"
**Expected trigger:** YES
**Assertion:** Should cover /checkpoint and /handoff; explain handoff template; give cold-start SLA

### TC-08: Regression diagnosis
**Prompt:** "Did Claude get worse recently or is it something wrong with my setup?"
**Expected trigger:** YES
**Assertion:** Should walk through the 3-way decision tree; explain clean session test; mention community trackers

### TC-09: Model routing
**Prompt:** "How do I use Haiku instead of Sonnet for file search in my agents?"
**Expected trigger:** YES
**Assertion:** Should show Agent tool model parameter syntax; give routing decision tree; explain JSON summary contract

### TC-10: Token audit
**Prompt:** "What's actually consuming my Claude Code context budget?"
**Expected trigger:** YES
**Assertion:** Should give the token cost table; explain MCP definition overhead; cover CLAUDE.md tokens

---

## No-Fire Tests (Should NOT Trigger)

### NC-01: MCP installation
**Prompt:** "How do I install the filesystem MCP server?"
**Expected trigger:** NO
**Reason:** MCP installation is out of scope (separate skill)

### NC-02: General Claude Code question
**Prompt:** "What is Claude Code and how does it work?"
**Expected trigger:** NO
**Reason:** General introduction, not context/cost management

### NC-03: Agent building
**Prompt:** "How do I build an autonomous agent in Claude Code?"
**Expected trigger:** NO
**Reason:** autonomous-agent skill handles this

### NC-04: API billing dashboards
**Prompt:** "How do I track my Claude costs in AWS Bedrock?"
**Expected trigger:** NO
**Reason:** Explicitly out of scope (Enterprise billing)

### NC-05: Prompt optimization
**Prompt:** "How do I write better prompts for Claude?"
**Expected trigger:** NO
**Reason:** Prompt engineering, not context/cost management

---

## Output Quality Assertions

For each trigger test, the output should:
- [ ] Route to the correct section via the Quick Entry table
- [ ] Provide a concrete, actionable step (not just explanation)
- [ ] Include relevant code/config examples where applicable
- [ ] Reference `references/` files for deeper details
- [ ] Not hallucinate specific token counts that contradict the documented values
- [ ] Not recommend third-party tools (claude-code-router, etc.) as primary solution
