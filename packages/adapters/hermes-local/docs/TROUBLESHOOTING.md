# Troubleshooting

This document is written for both humans and autonomous repair agents.

## Fast triage checklist

1. run the adapter test suite
2. run the adapter environment test in the Paperclip host
3. verify Hermes CLI works directly
4. verify model detection from `~/.hermes/config.yaml`
5. verify the child environment contains `PAPERCLIP_API_KEY`
6. inspect whether the run was resumed against an invalid session
7. inspect whether the host passed wake context in `ctx.context`

## Symptom: Hermes starts but cannot call Paperclip API

Check:

- `ctx.authToken` exists in the host
- `buildExecutionEnv()` is actually being used
- the child env has `PAPERCLIP_API_KEY`
- the prompt examples include `Authorization: Bearer $PAPERCLIP_API_KEY`

## Symptom: agent ignores assigned task and behaves like heartbeat scan

Check:

- `taskId`, `taskTitle`, `taskBody`, `wakeCommentId`, `approvalId` exist in `ctx.context`
- the host is not incorrectly storing wake data in raw adapter config
- the prompt rendered by `buildPrompt()` includes the task block

## Symptom: resume causes repeated failure

Check:

- saved `sessionParams.cwd` versus current cwd
- Hermes session ID validity
- whether Hermes reported an unknown/missing session
- whether the adapter retried without `--resume`

The adapter intentionally retries once on stale sessions.

## Symptom: model list is empty in Paperclip UI

Check:

- `listHermesModels()` works when called directly
- the host registry actually wires `listModels`
- `~/.hermes/config.yaml` exists and contains `model.default` or configured model entries
- `HERMES_HOME` is not pointing at the wrong profile

## Symptom: bundled skills never appear in Hermes

Check:

- `syncHermesSkills()` was called by the host
- `HERMES_HOME` / resolved Hermes home is correct
- filesystem permissions for `~/.hermes/skills`
- bundled skill source files exist in the package under `skills/`

## Symptom: transcript rendering is noisy or raw

Check:

- the host uses `parseHermesStdoutLine()`
- quiet mode choice matches actual Hermes stdout behavior
- stderr is being reclassified rather than painted as fatal errors

## Repair procedure for autonomous agents

When debugging this adapter, preferred order:

1. run unit tests
2. inspect `createHermesExecutionPlan()` output
3. inspect rendered prompt
4. inspect generated child env
5. run Hermes manually with the same CLI args
6. compare raw stdout/stderr to parser expectations
7. only then change parser/runtime logic
