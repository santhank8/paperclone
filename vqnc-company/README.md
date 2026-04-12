# VQNC — Autonomous AI Enterprise

VQNC is an autonomous AI company powered by [Paperclip](https://github.com/paperclipai/paperclip). It builds premium digital products under the **Abyssal Intelligence** brand, targeting $1M MRR.

## Org Chart

| Agent | Title | Reports To | Adapter | Budget |
|---|---|---|---|---|
| **CEO** | Chief Executive Officer | — (root) | OpenClaw Gateway | $200/mo |
| **CTO** | Chief Technology Officer | CEO | Codex | $100/mo |
| **CMO** | Chief Marketing Officer | CEO | OpenClaw Gateway | $75/mo |
| **Engineer** | Staff Engineer | CTO | Codex | $75/mo |
| **Marketing (Hermes)** | Hermes Outreach Specialist | CMO | OpenClaw Gateway | $50/mo |

Total company monthly budget: **$500**

## Workflow

**Hub-and-spoke + pipeline hybrid:**

1. **CEO** sets strategy and delegates to CTO and CMO.
2. **CTO** produces technical plans and delegates implementation to **Engineer**.
3. **CMO** produces campaign strategies and delegates execution to **Marketing (Hermes)**.
4. **Engineer** implements features and reports back to CTO for review.
5. **Marketing (Hermes)** executes outreach on Telegram and reports metrics to CMO.

## Getting Started

```sh
# Import into a running Paperclip instance
pnpm paperclipai company import ./vqnc-company --yes
```

## References

- [Agent Companies Specification](https://agentcompanies.io/specification)
- [Paperclip](https://github.com/paperclipai/paperclip)
