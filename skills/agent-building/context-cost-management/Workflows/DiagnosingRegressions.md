# Diagnosing Regressions

## When to Use

- "Did the model regress or did my config break?"
- Session suddenly producing worse answers than before
- Claude making repeated mistakes or forgetting context
- "Is this Claude getting worse?"

## Steps

**The 3-way decision tree:**
```
Session degraded (bad answers, forgotten context, repeated mistakes)
│
├─ Did I just do a lot of file reads or run many tool calls?
│  → Context collapse
│  Fix: /compact + re-read key files + re-state current goal
│
├─ Did I recently update CLAUDE.md or add MCP tools?
│  → Config drift
│  Fix: Review recent CLAUDE.md changes; test with a clean session
│
└─ Is this happening in a clean session too?
   → Possible model regression
   Fix: Test with --version flag; check community regression trackers
```

**Quick test:** Start fresh. Give Claude the same task with explicit context. If it works → context collapse. If it still fails → model regression or config drift.

## Verification

- You've identified which of the 3 causes applies
- You've applied the corresponding fix and verified improvement

## Reference

See `../references/diagnose.md` for: full decision tree, CLAUDE.md audit procedure, regression tracker links.
