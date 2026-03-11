# Agent Templates

These files are template/source material for role definitions.

They are not the runtime-canonical instruction paths for active agents in this repo.

Runtime rule:

- active agents should point at `agents/<slug>/AGENTS.md`

Template rule:

- `ops/templates/agents/*.md` is where role drafts and higher-level role templates can live
- when you intentionally refresh a runtime agent profile, copy or sync the template into the matching `agents/<slug>/AGENTS.md`

Why this split exists:

- `agents/<slug>/AGENTS.md` matches the Paperclip portability/export model
- runtime configs stay consistent across local runs, Docker, and backups
- `ops/templates/agents` can evolve as templates without becoming another competing runtime path convention

Current template-to-runtime mappings in this repo:

- `ops/templates/agents/CEO_ASSISTANT.md` -> `agents/ceo/AGENTS.md`
- `ops/templates/agents/CFO_ASSISTANT.md` -> `agents/cfo/AGENTS.md`
- `ops/templates/agents/PRINCIPAL_ARCHITECT.md` -> `agents/principal-architect/AGENTS.md`
- `ops/templates/agents/PRINCIPAL_DEVELOPER.md` -> `agents/principal-developer/AGENTS.md`
- `ops/templates/agents/QA_ARCHITECT.md` -> `agents/qa-architect/AGENTS.md`
- `ops/templates/agents/QA_TESTER.md` -> `agents/qa-tester/AGENTS.md`
