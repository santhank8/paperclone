---
name: memory
description: >
  Persistent memory system for Paperclip agents. Use this skill to save and
  recall knowledge across heartbeat runs. Save patterns, decisions, preferences,
  and context that should persist beyond the current session.
---

# Agent Memory

Persist knowledge across heartbeat runs using the Paperclip Memory API. Memories survive session restarts and are available across different tasks.

## When to Save Memories

Save a memory when you:
- Discover a codebase convention or pattern
- Learn a user/team preference
- Make an architectural decision with reasoning
- Solve a tricky problem (save the fix)
- Notice something important about the project

## Categories

| Category | Use for |
|----------|---------|
| `pattern` | Code patterns, conventions, architectural styles |
| `preference` | User/team preferences, communication style |
| `decision` | Architectural decisions with rationale |
| `learning` | Lessons learned, fixes for recurring problems |
| `context` | Project context, environment details |
| `general` | Anything that doesn't fit above |

## API Reference

All requests require `Authorization: Bearer $PAPERCLIP_API_KEY` header.

### Save a Memory (upsert)

```bash
curl -s -X POST "$PAPERCLIP_API_URL/api/agents/$PAPERCLIP_AGENT_ID/memories" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "pattern",
    "key": "coding-style",
    "content": "This project uses 2-space indentation and single quotes",
    "importance": 8
  }'
```

- `category`: One of the categories above (default: `general`)
- `key`: Unique identifier within the category. Upserting with the same category+key updates the existing memory.
- `content`: The knowledge to persist (free-form text)
- `importance`: 1-10 scale (default: 5). Higher = more likely to be recalled.

### Recall Memories

```bash
curl -s "$PAPERCLIP_API_URL/api/agents/$PAPERCLIP_AGENT_ID/memories" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

Filter by category:
```bash
curl -s "$PAPERCLIP_API_URL/api/agents/$PAPERCLIP_AGENT_ID/memories?category=pattern" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

### Update a Memory

```bash
curl -s -X PATCH "$PAPERCLIP_API_URL/api/memories/MEMORY_ID" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated knowledge", "importance": 9}'
```

### Delete a Memory

```bash
curl -s -X DELETE "$PAPERCLIP_API_URL/api/memories/MEMORY_ID" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

## Importance Guide

| Score | When to use |
|-------|-------------|
| 9-10 | Critical conventions, breaking-change patterns |
| 7-8 | Important preferences, key architectural decisions |
| 5-6 | Useful context, general patterns |
| 3-4 | Nice-to-know, minor preferences |
| 1-2 | Temporary notes, low-confidence observations |

## Best Practices

- Use descriptive keys: `deploy-requires-env-DATABASE_URL` not `deploy-1`
- Keep content concise but complete
- Update existing memories rather than creating duplicates
- Set `importance` thoughtfully -- your top memories are injected into future prompts
- Use `expiresAt` for temporary memories (e.g., sprint-specific context)
