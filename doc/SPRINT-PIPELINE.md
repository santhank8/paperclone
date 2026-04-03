# Gstack Sprint Pipeline

## Overview

All new features must follow the gstack sprint pipeline. This is a structured workflow that ensures quality, architectural alignment, and proper review gates before code ships.

## Pipeline Stages

```
brainstorm → plan-ceo-review → plan-eng-review → BUILD → review → QA → ship
```

### 1. Brainstorm
- Initial concept ideation and requirements gathering
- Team discussion on approach and feasibility
- Output: Feature outline or spike plan

### 2. Plan (CEO Review)
- Architecture and design document prepared
- Business impact and scope defined
- CEO/product reviews for alignment with company goals
- Output: Approved design doc

### 3. Plan (Engineering Review)
- Technical design reviewed by engineering leads
- Implementation approach validated
- Tech debt and dependencies identified
- Output: Engineering approval and tech spec

### 4. BUILD
- Implementation phase
- Code written according to spec
- Unit tests included
- Output: Pull request(s) with working code

### 5. Review
- Code review by peers (Cursor BugBot, manual review)
- Architectural feedback from leads
- Test coverage verification
- Output: Approved PR

### 6. QA
- Integration testing
- Manual testing against acceptance criteria
- Performance/security checks
- Output: QA sign-off

### 7. Ship
- Merge to main
- Deploy to production
- Monitor for issues
- Output: Live feature

## Gates and Checkpoints

### Before BUILD:
- Design must be approved by CEO and Engineering
- Scope must be clear and bounded
- Success criteria defined

### Before Review:
- Code must compile and pass tests
- PR must reference design doc
- Must include test coverage

### Before QA:
- All PR comments resolved
- At least one approving review
- CI/CD passing

### Before Ship:
- QA approval obtained
- Release notes prepared
- Monitoring/alerts configured

## For Pull Requests

Every PR should:
1. Reference the related issue (e.g., "Fixes SHA-11")
2. Include a summary linking to the design/plan document
3. Describe testing done
4. Request review from at least one other engineer

## For Issues

When creating a feature issue:
1. Include clear acceptance criteria
2. Link to design document (when available)
3. Assign to an engineer with clear ownership
4. Set priority and target milestone

## Tools

- **Planning**: Paperclip issues, design docs in `doc/plans/`
- **Code**: GitHub branches and PRs
- **Reviews**: Cursor BugBot + manual review on all PRs
- **Testing**: Vitest, manual QA, staging environment

## Exemptions

Minor bugfixes and documentation updates may skip Planning stages if:
- The change is isolated and low-risk
- The issue clearly describes the fix
- Full test coverage is included

Use judgment. When in doubt, follow the full pipeline.
