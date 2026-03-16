# Chrome Reply Workflow

Post replies to X/Twitter via Claude in Chrome. Requires `--chrome` flag when spawning the agent.

## Prerequisites

- Claude in Chrome extension active
- Logged into x.com as @marzeaned in Chrome
- Agent spawned with `--chrome` flag

## Reliable Sequence

### 1. Get tab context
```
mcp__claude-in-chrome__tabs_context_mcp(createIfEmpty: true)
```

### 2. Create a new tab
```
mcp__claude-in-chrome__tabs_create_mcp()
```

### 3. Navigate to tweet
```
mcp__claude-in-chrome__navigate(tabId, url: "https://x.com/.../status/...")
```

### 4. Wait for load
```
mcp__claude-in-chrome__computer(action: "wait", duration: 3, tabId)
```

### 5. Scroll to reply area
```
mcp__claude-in-chrome__computer(action: "scroll", coordinate: [640, 400], scroll_direction: "down", scroll_amount: 5, tabId)
```

### 6. Find the reply textbox
```
mcp__claude-in-chrome__read_page(tabId, filter: "interactive")
```
Look for: `textbox "Post text" [ref_XX]`

### 7. Click the textbox ref
```
mcp__claude-in-chrome__computer(action: "left_click", ref: "ref_XX", tabId)
```
NEVER click by coordinates. Always use the ref from read_page.

### 8. Type the reply
```
mcp__claude-in-chrome__computer(action: "type", text: "reply text here", tabId)
```
The `type` action types into the focused element. Do NOT pass a selector. Just text.

### 9. Find and click Reply button
```
mcp__claude-in-chrome__read_page(tabId, filter: "interactive")
```
Look for a button near the textbox. It may not be labeled "Reply" until text is entered. After typing, re-read interactive elements.
```
mcp__claude-in-chrome__computer(action: "left_click", ref: "ref_YY", tabId)
```

### 10. Verify
```
mcp__claude-in-chrome__computer(action: "wait", duration: 3, tabId)
mcp__claude-in-chrome__computer(action: "screenshot", tabId)
```
Confirm the reply appears in the thread with @marzeaned handle.

## Gotchas

| Issue | Cause | Fix |
|-------|-------|-----|
| Selector text appears in reply | Passed selector to `type` | `type` takes only text, no selector |
| Compose modal opens instead of inline reply | Clicked wrong area | Use `read_page` to find textbox ref, click ref |
| DM passcode screen | Clicked close button that navigated to /messages | Use back arrow or re-navigate to tweet URL |
| "Something went wrong" on submit | Headless browser bot detection | Use Claude in Chrome, not gstack browse |
| Reply text truncated | Typed before textbox was focused | Click textbox ref first, wait, then type |
| Reply button not visible | Need to scroll | Scroll down 5 ticks before read_page |

## Staggering

When posting multiple replies, wait 3-7 minutes between each:
```
mcp__claude-in-chrome__computer(action: "wait", duration: 30, tabId)
```
Note: max wait is 30 seconds per call. For longer waits, chain multiple wait calls or use delays between tool invocations.
