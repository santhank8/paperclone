---
name: vuln-scan
description: Static analysis skill for detecting OWASP Top 10 vulnerabilities, XSS, SQL injection, command injection, path traversal, and other code-level security issues
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Vulnerability Scan

Perform static security analysis on a codebase to detect vulnerabilities.

## Scan Methodology

### Step 1: Map the attack surface

Identify all entry points where external input enters the system:
- HTTP route handlers and API endpoints
- WebSocket message handlers
- File upload handlers
- CLI argument parsers
- Environment variable readers

### Step 2: Trace data flows

For each entry point, trace how user input flows through the application:
- Does it reach a database query? (SQL injection risk)
- Does it reach a shell command? (Command injection risk)
- Does it reach HTML output? (XSS risk)
- Does it reach a file path? (Path traversal risk)
- Does it reach a URL fetch? (SSRF risk)

### Step 3: Check security controls

Verify that appropriate defenses are in place:
- Input validation and sanitization
- Parameterized queries (not string concatenation)
- Output encoding
- Authentication and authorization checks
- Rate limiting
- CSRF protection

### Step 4: Pattern scan

Search for known dangerous patterns:

```
# Command injection
grep -r "exec\(|spawn\(|execSync\(|spawnSync\(" --include="*.ts" --include="*.js"

# SQL injection
grep -r "query\(.*\+\|query\(.*\$\{" --include="*.ts" --include="*.js"

# XSS
grep -r "innerHTML|dangerouslySetInnerHTML|document\.write" --include="*.ts" --include="*.tsx"

# Path traversal
grep -r "\.\./" --include="*.ts" --include="*.js"

# Insecure randomness
grep -r "Math\.random" --include="*.ts" --include="*.js"

# Hardcoded secrets
grep -ri "password\s*=\s*[\"']|api.key\s*=\s*[\"']|secret\s*=\s*[\"']" --include="*.ts" --include="*.js"
```

## Output Format

Report each finding as:

```
### [SEVERITY] Category: Title

**File:** path/to/file.ts:123
**Evidence:**
\`\`\`
<code snippet>
\`\`\`
**Risk:** Description of what could go wrong
**Fix:** Specific remediation steps
```
