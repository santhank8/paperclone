# Local LLM Capability Benchmark

Benchmark harness for evaluating local LLMs (<=8 GB) on Paperclip tool-use tasks.

## Quick Start

```bash
pnpm llm:research    # runs bench + report
```

Individual steps:

```bash
pnpm llm:bench       # run benchmark -> docs/local-llm-capability/results.json
pnpm llm:report      # render report -> docs/local-llm-capability/report.md
```

## Files

| File | Description |
|---|---|
| `models.json` | Candidate model matrix (id, family, budget, backend) |
| `tasks.json` | Benchmark task definitions with required tool call counts |
| `results.json` | Generated benchmark results (gitignored) |
| `report.md` | Generated markdown report (gitignored) |

## Current Status: Stub Probe

The benchmark runner (`scripts/local-llm-capability/run-bench.mjs`) currently uses
a **stub probe** (`fakePaperclipProbe`) that returns hardcoded passing results for
every model. This means generated results do not reflect real model behavior.

### What the stub does

- Returns `toolCalls: 1` and a placeholder string for every model/task pair
- Every model appears to pass at 100% with 100ms latency
- The harness contract (scoring, aggregation, report generation) is stable and tested

### Required follow-up: Real Ollama integration

To produce real benchmark data, `fakePaperclipProbe` must be replaced with an
implementation that:

1. Calls the Ollama API (or Paperclip adapter bridge) with the model ID
2. Sends the task prompt with Paperclip tool definitions
3. Captures actual tool calls, final text output, and latency
4. Returns the same `{ modelId, taskId, toolCalls, finalText, latencyMs }` shape

The scoring logic (`scoreRun`) and report generator are ready to consume real data
with no changes.
