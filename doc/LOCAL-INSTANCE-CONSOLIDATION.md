# Local Instance Consolidation

Date: 2026-03-10

This repo had two different local Paperclip homes in use:

- canonical repo-local home: `./.paperclip-local`
- legacy user-home installation: `~/.paperclip`

The consolidation rule is:

- use `./.paperclip-local` as the single source of truth for this repo
- point Docker quickstart at that same `./.paperclip-local`
- keep `~/.paperclip` untouched as a legacy backup/quarantine copy unless doing explicit recovery work

## Snapshot Before Cutover

Counts captured directly from each embedded PostgreSQL data directory before the cutover:

### Canonical repo-local state: `./.paperclip-local`

- companies: `1`
- projects: `11`
- goals: `14`
- agents: `14`
- issues: `50`
- approvals: `6`
- company budget: `20000`
- board approval for new agents: `true`

Representative projects:

- `Wong Digital Dentistry CR Migration to Next.js`
- `CalenBook Dental Vertical SaaS`
- `CalenBook Dental Frontend`

### Legacy backup state: `~/.paperclip`

- companies: `1`
- projects: `2`
- goals: `2`
- agents: `10`
- issues: `13`
- approvals: `6`
- company budget: `0`
- board approval for new agents: `true`

Representative projects:

- `Wong Digital Dentistry site migration`
- `Create Dental vertical Backend`

## Operational Notes

- `ops/local/run.sh` and `ops/local/dev.sh` already use `./.paperclip-local`.
- `bootstrap-docker.sh` should default Docker quickstart to `./.paperclip-local`.
- Docker quickstart should mount `./.paperclip-local` at the same absolute path inside the container (`PAPERCLIP_HOME_IN_CONTAINER`) so the repo-local config's absolute paths continue to resolve.
- Do not use `~/.paperclip` as active runtime state for this repo anymore.
- Do not switch between two different Paperclip homes on the same browser URL/port and expect stable state.

## Important Constraint

Docker quickstart binds the app to `0.0.0.0`, which means it does not cleanly match the loopback-only assumptions of `local_trusted`.
The important consolidation target in this step is the shared data dir, not perfect parity of every runtime flag between local dev and Docker.
