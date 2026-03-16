# Why TDD Fails Without a Loop

## The One-Shot Problem

When most developers use Claude Code for testing, they write a prompt like:

> "Write tests for the UserService class."

Claude writes the tests. They pass. Done? Not done.

The problem: tests written after implementation verify the implementation, not the behavior. They're tautological. If your `getUserById` function returns `null` instead of throwing, the test will test for `null` — not for the error the spec required.

The real TDD value is in the **red phase**: writing a test that fails because the behavior doesn't exist yet. That failure is a specification. It proves the test can detect what you haven't built.

## What Breaks Without the Loop

One-shot test generation is step 1 of TDD. Without the loop, you miss:

1. **Red verification** — you never confirm the test can fail. A test that can't fail catches nothing.
2. **Failure diagnosis** — Claude never reads the stack trace and identifies the root cause.
3. **Minimal fix discipline** — without re-running after each change, you don't know what fixed it.
4. **Regression catching** — future edits don't automatically re-run the tests.

## The Manual Shepherd Problem

The Reddit thread that sparked this skill (1,200 upvotes, March 2026) says it best:

> "It generates tests fine but as soon as one fails, I have to babysit the whole fix loop manually."

Manual shepherding looks like:
1. Ask Claude to write a test
2. Run the test yourself in a different terminal
3. Copy the failure output back into the conversation
4. Ask Claude to fix it
5. Edit the file yourself or ask Claude to edit
6. Repeat 20 times for a non-trivial feature

The TDD workflow eliminates steps 2-6. Claude runs the tests, reads the output, diagnoses, fixes, and re-runs — without you re-entering the loop.

## Mental Model: Loop, Not Command

```
One-shot:  [write test] → done

TDD loop:  [write test] → [run] → [read output] → [diagnose] → [fix] → [run] → repeat until green → [refactor] → [commit]
```

The loop runs inside a single Claude Code conversation. Every step is a tool call: Bash for running, Read for code inspection, Edit for fixes. You provide the entry condition (a failing test) and the exit condition (green + clean). Claude does the cycle.
