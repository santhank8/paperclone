---
name: prompt-injection-scan
description: Detect prompt injection risks in agent instructions, user inputs, and data flows that reach LLM context
allowed-tools:
  - Read
  - Grep
  - Glob
---

# Prompt Injection Scan

Analyze a codebase for prompt injection vulnerabilities — places where untrusted input could manipulate AI agent behavior.

## Scan Methodology

### Step 1: Map prompt construction points

Find all places where prompts are built or agent instructions are assembled:
- Agent instruction templates and system prompts
- Skill injection code that inserts instructions at runtime
- Places where user-provided text is concatenated into prompts
- Template strings that include external data in agent context

### Step 2: Check direct injection vectors

Look for user inputs that flow directly into prompts without sanitization:
- Task descriptions created by users that agents will read
- Comments or messages that enter agent context
- File contents that agents process (could contain injection payloads)
- URL contents fetched and included in context

### Step 3: Check indirect injection vectors

Look for data from external sources that enters agent context:
- API responses included in prompts
- Database content rendered in agent instructions
- File contents from user-uploaded files
- Web page content from URLs the agent visits
- Git commit messages or PR descriptions

### Step 4: Check for system prompt leakage

Look for ways an attacker could extract system prompts:
- Error messages that include prompt contents
- Logging that captures full prompts
- API responses that echo back system instructions
- Debug modes that expose prompt construction

### Step 5: Verify defenses

Check for prompt injection mitigations:
- Input sanitization before prompt inclusion
- Output validation after agent responses
- Delimiter-based separation of instructions vs. data
- Role-based prompt structuring (system vs. user messages)
- Content filtering on agent inputs

## Red Flags

- String concatenation or template literals building prompts with user data
- `${userInput}` or `+ userInput` in prompt construction
- Agent instructions that say "follow the user's instructions" without boundaries
- Missing input validation on task/ticket descriptions
- Agent tools that can read arbitrary files (potential indirect injection via file content)

## Output Format

Report each finding as:

```
### [SEVERITY] Prompt Injection: Title

**File:** path/to/file.ts:123
**Vector:** Direct / Indirect / System Prompt Leakage
**Evidence:**
\`\`\`
<code snippet showing the injection point>
\`\`\`
**Attack scenario:** How an attacker could exploit this
**Fix:** Specific remediation steps
```
