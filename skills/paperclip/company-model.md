---
title: Company Model
description: Company is the first-order entity — all business objects are company-scoped with complete data isolation
type: mechanism
links: [org-structure, goal-hierarchy, cost-budget, deployment-modes]
---

# Company Model

Company is the fundamental unit of organization in Paperclip. Every business entity — agents, goals, issues, costs, approvals, activity — belongs to exactly one company. One Paperclip deployment can run multiple companies with complete data isolation.

## Schema

The `companies` table is simple:

```
id          uuid pk
name        text not null
description text null
status      enum: active | paused | archived
```

Every other table has a `company_id` foreign key. This invariant is enforced at the route/service layer — all queries are company-scoped, and cross-company access is blocked.

## Multi-Company Isolation

A single deployment can run dozens of companies. Each has its own [[org-structure]], [[goal-hierarchy]], agents, issues, and audit trails. The board operator sees all companies via a global company selector in the UI.

This makes Paperclip a portfolio management tool — you can run multiple autonomous businesses from one control plane.

## Company Lifecycle

Companies move through `active → paused → archived`. Archiving is soft — data persists but the company is hidden from active views. The board creates companies directly; agents cannot create companies.

## Company as Context Cascade Root

Every piece of work traces back to the company. The [[goal-hierarchy]] starts from a company-level mission. [[cost-budget]] enforcement operates at the company level (monthly budget). The [[deployment-modes]] configuration determines how companies are accessed and secured.

## Portability

V1 supports company import/export via portable packages. Export strips environment-specific paths and secrets. Import supports collision strategies (`rename`, `skip`, `replace`) and preview before apply. The manifest format is `paperclip.manifest.json` with markdown files for agent configs.
