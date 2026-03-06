# Remote & Sync Setup

## Remotes

| Remote | URL | Purpose |
|---|---|---|
| `origin` | `https://github.com/notacryptodad/thecompany.git` | Private repo — default push target |
| `upstream` | `https://github.com/paperclipai/paperclip` | Public source repo — pull only |

## Daily Workflow

```bash
# Push your work (goes to private repo)
git push

# Sync from public source
git fetch upstream
git merge upstream/master
```

## Contributing Back (PR to public repo)

Since GitHub can't pull from a private repo into a public one, use a public fork for PRs:

```bash
# 1. Create a public fork of paperclipai/paperclip on GitHub (one-time)
# 2. Add it as a remote
git remote add public-fork https://github.com/notacryptodad/paperclip.git

# 3. Push only the PR branch to the public fork
git push public-fork feat/my-feature

# 4. Open PR from the public fork to upstream
gh pr create --repo paperclipai/paperclip --head notacryptodad:feat/my-feature
```

## Setup History

```bash
# Original clone was from the public repo (origin = paperclipai/paperclip)
# Remotes were swapped to make the private repo the default:
git remote rename origin upstream
git remote rename thecompany origin
git push origin --all
git branch --set-upstream-to=origin/master master
```
