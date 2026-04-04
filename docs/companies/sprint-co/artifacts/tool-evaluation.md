# Tool Evaluation Report

**Tool Name:** [tool-name]
**Category:** [LLM / DevTool / Infra / Testing / CI / Monitoring / Other]
**Date:** [YYYY-MM-DD]
**Evaluator:** Scout
**Evaluation Trigger:** [Tech Radar TRIAL entry / CEO request / Agent suggestion / Industry signal]
**Status:** [DRAFT / COMPLETE]

---

## What It Does

[2-3 sentences describing the tool's purpose, how it works, and what problems it solves. Be specific — avoid marketing language.]

## How Sprint Co Would Use It

[Specific integration scenario. Which agent would use it? At which phase of the sprint? What would the workflow look like before and after adoption?]

**Primary integration point:** [Agent name or workflow step]
**Secondary uses:** [Other potential uses, if any]

---

## Cost / Benefit Analysis

| Factor | Current Approach | With This Tool | Delta |
|---|---|---|---|
| **Speed** | [e.g. 45 min per sprint cycle] | [e.g. 30 min per sprint cycle] | [e.g. -33% cycle time] |
| **Cost** | [e.g. $0.12/sprint in tokens] | [e.g. $0.18/sprint in tokens + API] | [e.g. +$0.06/sprint] |
| **Quality** | [e.g. 2 bugs per sprint avg] | [e.g. estimate 1 bug per sprint] | [e.g. -50% defect rate] |
| **DX** | [e.g. manual config required] | [e.g. auto-configured] | [e.g. reduced setup friction] |

**Net assessment:** [One sentence — is the trade-off worth it?]

---

## Integration Effort

**Level:** [LOW / MED / HIGH]

**Explanation:** [What's involved in integrating this tool. Include: config changes, new dependencies, adapter work, agent prompt changes, testing requirements.]

| Step | Effort | Owner |
|---|---|---|
| [e.g. Install and configure] | [e.g. 1 hour] | [agent or role] |
| [e.g. Update agent prompts] | [e.g. 30 min] | [agent or role] |
| [e.g. Integration testing] | [e.g. 2 hours] | [agent or role] |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| [e.g. API rate limits during peak] | [LOW / MED / HIGH] | [LOW / MED / HIGH] | [e.g. Implement backoff + fallback to current approach] |
| [e.g. Vendor lock-in] | [LOW / MED / HIGH] | [LOW / MED / HIGH] | [e.g. Abstract behind adapter interface] |
| [e.g. Breaking changes in updates] | [LOW / MED / HIGH] | [LOW / MED / HIGH] | [e.g. Pin version, test before upgrading] |

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| [e.g. Node.js >= 20] | Runtime | [MET / UNMET] |
| [e.g. API key provisioning] | Config | [MET / UNMET] |
| [e.g. Adapter package update] | Code | [MET / UNMET] |

---

## Verdict

**Decision:** [ADOPT / TRIAL / HOLD]

**Rationale:** [2-3 sentences explaining the decision. Reference the cost/benefit analysis and risk assessment.]

---

## Timeline to Adopt

*Include only if verdict is ADOPT or TRIAL.*

| Phase | Target Date | Milestone |
|---|---|---|
| [e.g. Proof of concept] | [YYYY-MM-DD] | [What success looks like] |
| [e.g. Integration] | [YYYY-MM-DD] | [Working in staging] |
| [e.g. Production rollout] | [YYYY-MM-DD] | [Full adoption confirmed] |

**Rollback plan:** [How we revert if adoption fails]

---

*Filed to Tech Radar: [YYYY-WNN quadrant entry reference]*
