# Paperclip Development Guide

## gstack — AI-Powered Development Workflow

gstack is installed at `~/.claude/skills/gstack` and provides a full software factory workflow.

**IMPORTANT:** Use the `/browse` skill from gstack for ALL web browsing. Never use `mcp__claude-in-chrome__*` tools.

### Available Skills

| Phase | Skill | Purpose |
|-------|-------|---------|
| **Think** | `/office-hours` | Challenge assumptions before coding |
| **Plan** | `/plan-ceo-review` | CEO-level scope & vision validation |
| | `/plan-eng-review` | Engineering architecture review |
| | `/plan-design-review` | Design system review |
| | `/autoplan` | Automated planning workflow |
| **Design** | `/design-consultation` | Design system consultation |
| | `/design-shotgun` | Rapid design iteration |
| | `/design-review` | Design audit |
| **Build & Browse** | `/browse` | Headless browser for testing & dogfooding |
| | `/connect-chrome` | Connect to running Chrome instance |
| | `/setup-browser-cookies` | Configure browser cookie access |
| **Review** | `/review` | Staff-engineer-level code review with auto-fix |
| | `/investigate` | Deep code investigation |
| | `/codex` | Cross-model second opinion (OpenAI) |
| | `/cso` | Security audit (OWASP + STRIDE) |
| **Test** | `/qa` | Full QA: browser testing + bug discovery |
| | `/qa-only` | QA without planning phase |
| | `/benchmark` | Performance measurement |
| **Ship** | `/ship` | Automated deployment with verification |
| | `/land-and-deploy` | Land PR and deploy |
| | `/canary` | Canary deployment monitoring |
| | `/setup-deploy` | Configure deployment pipeline |
| **Reflect** | `/retro` | Shipping velocity & test health analysis |
| | `/document-release` | Automated release documentation |
| **Safety** | `/careful` | Enable extra caution mode |
| | `/freeze` | Freeze destructive operations |
| | `/guard` | Guard against risky changes |
| | `/unfreeze` | Remove freeze protection |
| **Maintenance** | `/gstack-upgrade` | Upgrade gstack installation |
