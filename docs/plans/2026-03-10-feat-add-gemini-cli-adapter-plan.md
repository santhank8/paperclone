---
title: feat: Add Gemini CLI Adapter for Paperclip
type: feat
status: active
date: 2026-03-10
---

# feat: Add Gemini CLI Adapter for Paperclip

## Enhancement Summary

**Deepened on:** 2026-03-10
**Sections enhanced:** Implementation Phases, Technical Considerations, External References

### Key Improvements

1. **Updated command invocation**: Based on research, the recommended command is `gemini` (standalone) or via `npx @google/gemini-cli`, not `gcloud` AI chat
2. **Added concrete JSON stream parsing patterns**: Based on Claude adapter patterns, implemented buffer-based parsing for NDJSON
3. **Session handling clarified**: Gemini CLI supports `--resume` flag similar to Claude for session resumption
4. **Authentication patterns**: Added OAuth (free tier) vs API key (paid) authentication options
5. **Token pricing**: Added model-specific pricing for cost calculation ($0.10/$0.40 per 1M tokens for Flash)

### New Considerations Discovered

- Gemini CLI is available via `npx @google/gemini-cli` for quick testing
- Session IDs can be resumed with `--resume` flag or `--resume <session-uuid>`
- Response format includes `usageMetadata` with `promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`
- Rate limiting: 60 req/min (free OAuth), 1,000 req/day

## Overview

Implement a new Gemini CLI adapter for Paperclip that enables running Google's Gemini model as a local agent through the Paperclip infrastructure. This addresses feature request #455 in the Paperclip repository.

The adapter will integrate with Google's Gemini CLI (via `gcloud` or standalone `gemini` command) to provide AI agent capabilities with full session management, token tracking, and model selection.

## Problem Statement / Motivation

Paperclip currently supports multiple LLM adapters (Claude, Cursor, CodeX, etc.) but lacks native Google Gemini support. Users who prefer or require Gemini for their agent workflows need a way to integrate it into the Paperclip ecosystem with:

- Consistent adapter interface matching other Paperclip adapters
- Session persistence across runs
- Token and cost tracking
- Model selection capabilities
- Environment validation
- UI configuration forms

## Proposed Solution

Create a new `@paperclipai/adapter-gemini-local` package following the existing Paperclip adapter patterns. The adapter will:

1. Execute `gcloud` or `gemini` CLI commands with appropriate flags
2. Stream JSON output using `--output-format stream-json` format
3. Parse responses into Paperclip's standard event format
4. Support session resumption via session codec
5. Validate environment (command availability, API keys)
6. Provide UI configuration and output display components

## Technical Considerations

### Architecture Impacts

- **Server integration**: Must be registered in `server/src/adapters/registry.ts`
- **UI integration**: Must be registered in `ui/src/adapters/registry.ts`
- **Shared types**: Uses `@paperclipai/adapter-utils` for type definitions
- **Session management**: Implements `AdapterSessionCodec` for state persistence

### Performance Implications

- JSON streaming via `--output-format stream-json` for efficient parsing
- Graceful timeout handling (20s default grace period)
- Log buffering with 4MB cap to prevent memory issues

### Security Considerations

- API key should be passed via environment variables (not command line)
- Sensitive env vars should be redacted in logs
- Command injection prevention through `ensureCommandResolvable`

### Research Insights

**Best Practices:**
- Use `npx @google/gemini-cli` for quick installation without system-wide install
- Always use `--output-format stream-json` for real-time parsing
- Support both OAuth (free tier, 60 req/min) and API key (paid) authentication
- Implement exponential backoff for rate limit (429) responses

**Implementation Details:**
```typescript
// Command invocation patterns
const buildGeminiArgs = (sessionId: string | null) => {
  const args = ["-p", prompt, "--output-format", "stream-json"];
  if (sessionId) args.push("--resume", sessionId);
  if (model) args.push("--model", model);
  if (extraArgs.length > 0) args.push(...extraArgs);
  return args;
};
```

**Edge Cases:**
- Incomplete JSON in stream: Buffer incomplete lines, wait for next chunk
- 429 Rate limit: Exponential backoff with jitter (0.5s base, 60s max)
- Empty response: Validate response structure, retry if needed
- Safety filter triggered: Check `finishReason` for "SAFETY"

**Pricing Reference (per 1M tokens):**
| Model | Input | Output |
|-------|-------|--------|
| gemini-2.5-flash | $0.10 | $0.40 |
| gemini-2.5-pro | $2.00 | $12.00 |

## System-Wide Impact

### Interaction Graph

When a Gemini adapter run is triggered:
1. Paperclip backend spawns adapter process with run ID and agent info
2. Adapter builds environment with `buildPaperclipEnv(agent)`
3. Gemini CLI executes, streaming JSON events to stdout
4. Adapter parses events and returns structured result
5. UI renders parsed transcript for user

### Error Propagation

- Process failures return exit codes and signals
- Timeouts handled via `runChildProcess` timeout parameter
- Parse errors should be captured in result with `error: true`

### API Surface Parity

The adapter must match these Paperclip interfaces:
- `ServerAdapterModule` (server-side execution)
- `UIAdapterModule` (UI configuration and display)
- `AdapterExecutionContext` (context passed to execute)
- `AdapterExecutionResult` (return value with usage, cost, sessionId)

## Acceptance Criteria

### Functional Requirements

- [ ] Create `@paperclipai/adapter-gemini-local` package with 4 entry points:
  - [ ] `.` - metadata (type, label, models, docs)
  - [ ] `./server` - server execution logic
  - [ ] `./ui` - UI configuration and parsing
  - [ ] `./cli` - CLI output formatting
- [ ] Implement `execute()` function that:
  - [ ] Builds Paperclip environment
  - [ ] Ensures cwd exists
  - [ ] Validates command resolvable
  - [ ] Spawns Gemini CLI process
  - [ ] Parses JSON stream output
  - [ ] Returns `AdapterExecutionResult`
- [ ] Implement `testEnvironment()` that:
  - [ ] Validates cwd validity
  - [ ] Checks command availability
  - [ ] Verifies API key or auth
  - [ ] Runs hello probe
  - [ ] Returns `AdapterEnvironmentTestResult`
- [ ] Implement `sessionCodec` for:
  - [ ] Deserializing session params
  - [ ] Serializing session params
  - [ ] Getting display ID
- [ ] Register adapter in `server/src/adapters/registry.ts`
- [ ] Register UI adapter in `ui/src/adapters/registry.ts`

### Non-Functional Requirements

- [ ] Follow Andrew Kane's Ruby gem style (clean, minimal, type-safe)
- [ ] Code must be reviewable by Kieran's TypeScript reviewer
- [ ] No memory leaks or unbounded buffers
- [ ] Proper error handling with user-friendly messages
- [ ] Logs must redact sensitive environment variables

### Quality Gates

- [ ] Unit tests for execute function
- [ ] Unit tests for parse function
- [ ] Integration test for adapter registry
- [ ] Environment test coverage
- [ ] Browser tests for UI components

## Success Metrics

- Adapter successfully registers and runs in Paperclip
- Environment test passes for valid Gemini CLI setup
- Session persistence works across runs
- Token counts and costs are accurately extracted
- UI properly displays Gemini CLI output
- No breaking changes to existing adapters

## Dependencies & Prerequisites

### External Dependencies

- **Google Cloud SDK** (`gcloud`) or **Gemini CLI** (`gemini`) must be installed
- **Google API Key** for authentication (if using API-based access)
- Node.js 18+ and pnpm for build tools

### Internal Dependencies

- `@paperclipai/adapter-utils` - core types and utilities
- `@paperclipai/shared` - shared types across packages
- Paperclip server and UI infrastructure

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini CLI output format differs | Adapter won't parse correctly | Implement flexible JSON parsing with fallback handling |
| No session support in Gemini CLI | Session resumption fails | Implement stateless fallback if codec unavailable |
| API key security concerns | Credentials exposed in logs | Use `redactEnvForLogs` for all sensitive vars |
| Command injection vulnerability | Security breach | Use `ensureCommandResolvable` validation |
| Missing model discovery | Users can't select models | Implement `listModels()` if Gemini supports it |

## Documentation Plan

### Required Documentation

- **adapter-gemini-local**: `agentConfigurationDoc` explaining:
  - Command options (`gcloud` vs `gemini`)
  - Environment variables (`GOOGLE_API_KEY`)
  - Extra args format
  - Model selection syntax
- **README**: Update main Paperclip README with Gemini adapter availability
- **UI Help Text**: Explain each config field in UI

### Example Configuration

```typescript
{
  type: "gemini_local",
  label: "Google Gemini",
  cwd: "/workspace/project",
  model: "gemini-2.0-flash",
  command: "gcloud",
  args: ["ai", "chat", "--model", "gemini-2.0-flash", "--output-format", "stream-json"],
  env: {
    GOOGLE_API_KEY: "your-api-key"
  },
  timeoutSec: 0,
  graceSec: 20
}
```

## Implementation Phases

### Phase 1: Foundation (Core Package)

**Tasks:**
- Create package structure with `package.json` and `tsconfig.json`
- Implement `src/index.ts` (metadata exports) - see `packages/adapters/claude-local/src/index.ts:1`
- Implement `src/server/index.ts` (server entry point + sessionCodec) - see `packages/adapters/claude-local/src/server/index.ts:1`
- Implement `src/server/execute.ts` (main execution logic) - see `packages/adapters/claude-local/src/server/execute.ts:268`
- Implement `src/server/test.ts` (environment validation) - see `packages/adapters/claude-local/src/server/test.ts:52`
- Implement `src/server/parse.ts` (JSON stream parsing) - see `packages/adapters/claude-local/src/server/parse.ts:7`

**Deliverables:**
- Package builds successfully
- Server exports are valid
- Basic execute function works

**Key Implementation Pattern (from claude-local):**

```typescript
// parse.ts - JSON stream parsing with buffering
export function parseGeminiStreamJson(stdout: string) {
  let sessionId: string | null = null;
  let model = "";
  let finalResult: Record<string, unknown> | null = null;
  const assistantTexts: string[] = [];

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = parseJson(line);
    if (!event) continue;
    // Extract sessionId, model, content from event types
    // ...
  }

  // Extract usage from usageMetadata
  const usage = {
    inputTokens: usageObj.promptTokenCount || 0,
    outputTokens: usageObj.candidatesTokenCount || 0,
  };

  return { sessionId, model, costUsd, usage, summary, resultJson };
}
```

**Reference Files:**
- `packages/adapters/claude-local/src/server/parse.ts:7` - JSON stream parser
- `packages/adapters/claude-local/src/server/execute.ts:268` - execute function
- `packages/adapters/claude-local/src/server/test.ts:52` - environment test

### Phase 2: UI & CLI

**Tasks:**
- Implement `src/ui/index.ts` (UI entry point)
- Implement `src/ui/build-config.ts` (config builder)
- Implement `src/ui/parse-stdout.ts` (UI stdout parsing)
- Implement `src/cli/index.ts` (CLI entry point)
- Implement `src/cli/format-event.ts` (event formatting)

**Deliverables:**
- UI config form renders correctly
- CLI output formats with colors
- Parse functions return correct types

### Phase 3: Registration

**Tasks:**
- Add adapter to `server/src/adapters/registry.ts`
- Create `ui/src/adapters/gemini-local/` folder
- Add UI adapter to `ui/src/adapters/registry.ts`

**Deliverables:**
- Adapter registers without errors
- Server and UI can import adapter
- No type errors in build

### Phase 4: Testing

**Tasks:**
- Create `server/src/__tests__/gemini-local-adapter.test.ts`
- Create `server/src/__tests__/gemini-local-adapter-environment.test.ts`
- Test execute with mock Gemini output
- Test parse with sample events
- Test environment validation

**Deliverables:**
- All tests pass
- Coverage > 80%
- No linting errors

### Phase 5: Integration

**Tasks:**
- Run `pnpm build` to verify workspace build
- Test adapter registration in dev server
- Verify UI components render
- Browser test adapter in Paperclip UI

**Deliverables:**
- Full workspace builds
- Adapter works end-to-end
- No regressions in existing adapters

## Sources & References

### Internal References

- **Claude Local Adapter**: `packages/adapters/claude-local/` - Full implementation example
- **Cursor Local Adapter**: `packages/adapters/cursor-local/` - Simpler implementation
- **OpenCode Local**: `packages/adapters/opencode-local/` - Multi-provider example
- **Adapter Utils**: `packages/adapter-utils/src/types.ts` - Type definitions
- **Server Utils**: `packages/adapter-utils/src/server-utils.ts` - Helper functions

### External References

- **Gemini CLI Repository**: https://github.com/google-gemini/gemini-cli
- **Gemini CLI Installation**: `npm install -g @google/gemini-cli` or `npx @google/gemini-cli`
- **Token Pricing**: https://cloud.google.com/vertex-ai/generative-ai/pricing
- **Paperclip Repo**: https://github.com/paperclipai/paperclip
- **Issue #455**: https://github.com/paperclipai/paperclip/issues/455

### Related Work

- Similar adapter pattern: `@paperclipai/adapter-claude-local`
- JSON streaming: `--output-format stream-json` flag
- Environment validation: See `cursor-local/src/server/test.ts`
