# Testing strategy

This adapter is structured for test-driven maintenance.

## Why unit-first

Most historical Hermes adapter bugs were not deep Hermes bugs.
They were adapter integration bugs:

- wrong source for wake context
- wrong env propagation
- stale session handling
- missing model discovery wiring
- output parsing drift

Those fail fastest in small unit tests.

## Current test layers

### Detection / config tests
- `detect-model.test.js`
- `list-models.test.js`
- `build-config.test.js`
- `session-codec.test.js`

### Prompt / parsing tests
- `prompt.test.js`
- `parse.test.js`

### Runtime planning / execution tests
- `execute.test.js`

### Skills / lifecycle tests
- `skills.test.js`
- `hire-approved.test.js`

## Recommended future integration tests

Add host-level tests for:

1. host registry wiring of `listModels`
2. host registry wiring of `sessionManagement`
3. approval rejection / revision wakeup propagation
4. full Paperclip run with a fake Hermes binary fixture
5. round-trip persistence of `sessionParams`

## Running tests

```bash
npm test
```

## Debugging a single test file

```bash
node --test tests/execute.test.js
```
