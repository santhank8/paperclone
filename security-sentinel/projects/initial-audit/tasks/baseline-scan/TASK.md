---
name: Baseline Security Scan
assignee: security-lead
project: initial-audit
---

Run the first full security scan of the entire Paperclip codebase. This is a one-time comprehensive scan that covers every file and dependency.

## Scope

Scan the entire repository including:
- All server-side TypeScript code
- All frontend React components
- All shared packages
- All agent adapters
- All database schemas and migrations
- All configuration files
- All dependencies across all workspaces
- All agent instruction files (AGENTS.md, SKILL.md)
- Docker and deployment configurations

## Deliverable

A complete baseline security report documenting all current findings, categorized by severity and type. This report becomes the reference point for all future daily scans.
