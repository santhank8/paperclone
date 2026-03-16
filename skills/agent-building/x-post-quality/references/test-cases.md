# Test Cases: x-post-quality

## Should Trigger

1. "Review this tweet before I post it"
2. "Does this sound human or AI-generated?"
3. "Check my X post for quality"
4. "Fix this draft for Twitter"
5. "Marketing review on these posts"
6. "Is this tweet engaging enough?"
7. "Post quality check"
8. "Review my Notion marketing queue drafts"
9. "Does this tweet have em dashes?"
10. "Make this sound less like AI"

## Should NOT Trigger

1. "Write a tweet about our new skill" (this is creation, not review)
2. "Schedule these posts for tomorrow" (scheduling, not quality)
3. "Set up X API credentials" (configuration)
4. "How does the X algorithm work?" (general question)
5. "Post this tweet" (posting, not reviewing)

## Output Quality Tests

### Test O1: Em dash detection
Input: "SessionStart hooks — fires on every launch — no config needed"
Expected: FAIL, suggest colon/period replacement

### Test O2: AI voice detection
Input: "I'd be happy to share that we've leveraged our robust skill system to streamline developer workflows!"
Expected: FAIL, flag opener + buzzwords, provide rewrite

### Test O3: Clean pass
Input: "PostToolUse hooks for self-correction. Wire one that checks every Edit for unused imports. Claude fixes them inline."
Expected: PASS

### Test O4: Over-promotion
Input: "Check out our amazing skill library at aiskillslab.dev! 13 production-grade skills for Claude Code!"
Expected: FAIL, flag promotion-first framing

### Test O5: Character count
Input: [301 character post]
Expected: FAIL, suggest cuts

### Test O6: Good reply format
Input: "Solid point. The native approach works too. MEMORY.md + a SessionStart hook that loads it. No plugins, no MCP overhead."
Expected: PASS

### Test O7: Weak hook
Input: "Claude Code has some interesting features for managing context across sessions."
Expected: NEEDS EDIT, flag weak opener, suggest stronger hook
