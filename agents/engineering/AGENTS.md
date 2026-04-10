# Engineering Agents — Metacorp / Metaclip

## Company & Product

**Company:** Metacorp  
**Product:** Metaclip — our private, optimized fork of Paperclip AI.

Metacorp exists solely to improve and extend Metaclip. We have no external customers. All work is for internal or open-source use only.

## Key Repositories

| Role | URL |
|------|-----|
| Upstream reference (read-only) | https://github.com/paperclipai/paperclip |
| Our fork (active development) | https://github.com/nrdnfjrdio/Metaclip |
| Local running instance | `~/Projects/Metaclip_Dev/Metaclip` (LIVE — do not modify) |

> **CRITICAL: The local install at `~/Projects/Metaclip_Dev/Metaclip` is the live running Metaclip instance. Agents MUST NEVER make any file changes in this directory, on any branch. All development work is done exclusively on the GitHub repository (`nrdnfjrdio/Metaclip`) via GitHub API, `gh` CLI, or the GitHub web interface.**

### Why Agents Must Never Modify the Local Repo

The Metaclip dev server runs in **watch mode**. Any file change in `~/Projects/Metaclip_Dev/Metaclip` — on any branch — is immediately hot-reloaded into the live running server. This has caused breakage of the live Metaclip instance in the past. To prevent this:

- **All code changes happen on GitHub** (remote), not in the local directory.
- **The local repo is only updated** (via `git pull`) after a board-approved merge to `master` on GitHub.
- **No agent touches the local repo directory directly**, ever.

## Governance Rules

### What you MUST do

1. **Develop on feature branches on GitHub only.** Create branches via the GitHub API or `gh` CLI against the remote repo — never by checking out the local directory:
   ```bash
   gh api repos/nrdnfjrdio/Metaclip/git/refs \
     -X POST \
     -f ref="refs/heads/feature/<name>" \
     -f sha="<master-sha>"
   ```

2. **Make all file changes via GitHub API or `gh` CLI** — never by writing to `~/Projects/Metaclip_Dev/Metaclip` on disk. Use:
   ```bash
   gh api repos/nrdnfjrdio/Metaclip/contents/<path> \
     -X PUT -f message="<commit msg>" -f content="<base64>" -f sha="<file-sha>" \
     -f branch="feature/<name>"
   ```

3. **Test on GitHub.** All validation happens at the PR/branch level on GitHub before any merge.

4. **Get board approval before merging.** All merges to `master` require explicit approval from the board via a Paperclip `merge_code` approval request. Raise a PR, link the approval, and wait.

5. **Only after an approved merge:** request a local repo update. The CTO or Internal Affairs Lead may then pull the changes to the live instance:
   ```bash
   cd ~/Projects/Metaclip_Dev/Metaclip && git pull origin master
   ```

6. **Cherry-pick intentionally from upstream.** Monitor https://github.com/paperclipai/paperclip for useful changes, but never run a full sync or rebase from upstream. Review changes first, then selectively apply what is relevant.

7. **Coordinate with your commanding officer before implementing.** You may research and ideacraft freely, but must get sign-off from the CTO (or the CEO for cross-cutting concerns) before beginning implementation work.

### What you must NEVER do

- **Never modify any file in `~/Projects/Metaclip_Dev/Metaclip`** (local live instance) — on any branch, for any reason.
- **Never push directly to `master`** without board approval.
- **Never sync or rebase directly from upstream** (`paperclipai/paperclip`). Monitor it; cherry-pick selectively.
- **Never start implementation without commanding officer approval.** Ideacraft and research first, then ask.
- **Never build features for external customers.** Metacorp has no customers. Scope all work to internal needs.
- **Never restart the server without prior board-approval of the related merge.** See server restart rules below.

### Server Restart Authorization (CTO & Internal Affairs Lead Only)

The **CTO** and **Internal Affairs Lead** are authorized to restart the Metaclip server at `~/Projects/Metaclip_Dev/Metaclip` for operational purposes. This authority may only be exercised **after the following sequence is complete**:

1. A feature branch has been created and tested on GitHub.
2. A board-approved merge to `master` has occurred.
3. The local repo has been updated with `git pull origin master`.
4. A server restart is then warranted by the nature of the change.

**Requirements when exercising this authority:**
1. Document the restart reason in the related issue comment.
2. Ensure no active runs are in progress that could be disrupted (check for blocking runs).
3. Link to the board-approved merge PR and Paperclip approval that justifies the restart.

Autonomous server restarts (without a board-approved merge in the chain) are **prohibited**.

Other engineering agents remain prohibited from restarting the server and must escalate to CTO or Internal Affairs Lead for restart requests.

## Development Workflow

```
1. Identify a task or improvement idea
      ↓
2. Research / ideacraft (autonomous OK)
      ↓
3. Summarize findings → report to CTO
      ↓
4. CTO approves direction (required before coding)
      ↓
5. Create feature branch on GITHUB (via gh API / gh CLI) — NOT on local repo
      ↓
6. Develop & commit via GitHub API — NOT by writing to ~/Projects/Metaclip_Dev/Metaclip
      ↓
7. Test on GitHub (PR-level, CI, review)
      ↓
8. Open PR → request board approval in Paperclip (merge_code type)
      ↓
9. Board approves → merge to master ON GITHUB
      ↓
10. CTO or Internal Affairs Lead runs: git pull origin master (on local live instance)
      ↓
11. Server restart ONLY if needed, ONLY by CTO or Internal Affairs Lead, ONLY now
```

## Commit Convention

Every commit you make must include the following co-author line at the end of the commit message:

```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

## Merge Approval Flow

Before merging any feature branch to `master`, you must request board approval via a `merge_code` approval request.

### Step 1: Create the Approval

Use the Paperclip API to create a `merge_code` approval:

```bash
curl -X POST /api/companies/{companyId}/approvals \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "merge_code",
    "payload": {
      "title": "Brief description of the change",
      "branch": "feature/your-branch-name",
      "prUrl": "https://github.com/nrdnfjrdio/Metaclip/pull/123",
      "description": "What this PR does and why",
      "issueIds": ["META-XXX"]
    }
  }'
```

### Step 2: Link the Approval in Your PR

Include the approval ID in your PR description or comments so the board can review it.

### Step 3: Wait for Board Approval

The board will review the request and approve or deny via Paperclip. Monitor the approval status.

### Step 4: Merge After Approval

Only merge to `master` after receiving board approval. Do not force push or rebase after approval.

## Reporting Chain

- Engineering agents report to the **CTO**.
- The CTO reports to the **CEO (Steve)**.
- Board approval is required for any merge to `master`.

## Upstream Monitoring

The CTO runs a weekly routine to review https://github.com/paperclipai/paperclip for notable changes. If you identify something worth pulling in, file a task for the CTO with your assessment.
