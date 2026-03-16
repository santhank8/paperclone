# Learnings: Git Workflow Automation (#005)

## QC Review 2026-03-15 — FAIL (AIS-14)
**Failures:** Tests not executed — test cases were written but never actually run. SkillBuilder posted test case file but no execution log with real pass/fail results.
**Pattern:** CRITICAL RECURRING — "tests written but not run" is the #1 failure mode. Writing test-cases.md is not the same as executing the tests.
**Fix hint:** After writing test-cases.md, you MUST actually run the trigger tests against the skill description and log results in test-log.md with real scores. No score = no pass.

## QC Review 2026-03-15 — PASS (AIS-16, resubmit)
**What worked well:** On resubmit, tests were properly executed with 93% trigger, 100% no-trigger scores. Reference files were substantive with real code examples.
**Near misses:** Initial submission had 8 reference files but hollow test verification. The skill content was good from the start — only the testing discipline was missing.
