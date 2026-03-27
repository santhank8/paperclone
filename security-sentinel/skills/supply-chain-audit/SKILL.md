---
name: supply-chain-audit
description: Dependency risk analysis, hardcoded secret detection, and supply chain security scanning
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Supply Chain Audit

Analyze project dependencies and source code for supply chain risks and credential hygiene issues.

## Scan Methodology

### Step 1: Dependency analysis

Read all `package.json` files in the monorepo and check for:
- Unpinned versions using `*`, `latest`, or overly broad ranges
- Known vulnerable packages (cross-reference with npm audit data)
- Deprecated packages
- Packages with suspicious names (typosquatting common packages)
- Post-install scripts that could execute arbitrary code

Run if available:
```bash
pnpm audit --json 2>/dev/null
```

### Step 2: Secret detection

Scan all source files for hardcoded credentials using these patterns:

| Pattern | What it detects |
|---------|----------------|
| `AKIA[0-9A-Z]{16}` | AWS access keys |
| `ghp_[a-zA-Z0-9]{36}` | GitHub personal tokens |
| `gho_[a-zA-Z0-9]{36}` | GitHub OAuth tokens |
| `sk-[a-zA-Z0-9]{48}` | OpenAI API keys |
| `xoxb-` or `xoxp-` | Slack tokens |
| `-----BEGIN (RSA\|EC\|DSA) PRIVATE KEY-----` | Private keys |
| `postgres://.*:.*@` | Database connection strings with passwords |
| `Bearer [a-zA-Z0-9._-]+` | Bearer tokens in source (not headers) |

Also check:
- `.env` files committed to git (should be gitignored)
- Docker files with embedded credentials
- Test fixtures with real API keys
- Comments containing passwords or tokens

### Step 3: Configuration review

- Verify `.gitignore` includes `.env`, `*.pem`, `*.key`
- Check that secret management uses the platform's secret store, not env files
- Verify Docker images don't copy secret files into layers

## Output Format

Report each finding as:

```
### [SEVERITY] Category: Title

**File:** path/to/file.ts:123
**Evidence:**
\`\`\`
<code snippet or pattern match>
\`\`\`
**Risk:** What could happen if exploited
**Fix:** Specific remediation steps
```
