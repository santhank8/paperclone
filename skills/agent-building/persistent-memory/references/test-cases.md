# Test Cases: persistent-memory

## Trigger Tests (should fire the skill)

| # | Prompt | Expected |
|---|--------|----------|
| T1 | "My claude code agent keeps forgetting things between sessions" | TRIGGER |
| T2 | "How do I set up persistent memory in claude code?" | TRIGGER |
| T3 | "What is MEMORY.md and how does it work?" | TRIGGER |
| T4 | "I want to save session learnings across context compaction" | TRIGGER |
| T5 | "How do I write a SessionStart hook to load memory?" | TRIGGER |
| T6 | "Agent memory gets wiped after context compaction" | TRIGGER |
| T7 | "How do I capture decisions across sessions?" | TRIGGER |
| T8 | "cross-session memory claude code" | TRIGGER |
| T9 | "How do I make claude code remember things?" | TRIGGER |
| T10 | "Stop hook for saving session memory" | TRIGGER |

## No-Fire Tests (should NOT trigger this skill)

| # | Prompt | Expected |
|---|--------|----------|
| N1 | "How do I use a Redis cache for my app?" | NO FIRE |
| N2 | "What is context window size in claude?" | NO FIRE |
| N3 | "How do I use useState in React?" | NO FIRE |
| N4 | "Set up a PostgreSQL database for my web app" | NO FIRE |
| N5 | "How do I add a memory feature to my user profile page?" | NO FIRE |
| N6 | "What is vector search?" | NO FIRE |

## Output Tests (quality assertions for triggered skill)

| # | Test Case | Expected Output |
|---|-----------|----------------|
| O1 | User has no memory setup, asks how to start | Quick Setup section: 3 steps with MEMORY.md creation + SessionStart hook code |
| O2 | User asks about MEMORY.md format | Index structure explained + 200-line limit + link-only rule |
| O3 | User asks what to save vs. skip | Threshold test ("annoyed re-deriving?") + What NOT to Save table |
| O4 | User asks about hook configuration | Copy-pasteable JSON for SessionStart + Stop hooks in settings.json |
| O5 | User asks about memory types | Four types (user, feedback, project, reference) with examples |
| O6 | User asks how to handle stale memory | Correction protocol + decay management from anti-patterns.md |
| O7 | User wants to see a real example | Walkthrough reference (Session 1 gotcha → Session 2 recovery) |

## Boundary Cases

| # | Prompt | Expected | Reason |
|---|--------|----------|--------|
| B1 | "How do I use the ontology skill?" | NO FIRE | Adjacent (ClawHub skill), not this pattern |
| B2 | "How do I set up hooks in claude code?" | MAY FIRE | Hooks overlap with autonomous-agent skill — either is correct |
| B3 | "How do I save context before clearing?" | TRIGGER | Context saving = memory pattern |
| B4 | "recall MCP setup" | NO FIRE | Recall MCP is out of scope for this skill |
