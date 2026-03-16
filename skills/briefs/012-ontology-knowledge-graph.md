# Skill Brief: Ontology & Knowledge Graph for Claude Code

## Demand Signal

- ClawHub "ontology" is **#2 skill by downloads with 110K** — 288 stars, 370 active installs as of March 2026
- **300x the nearest competitor** in structured memory — all other structured-memory skills sit below 300 downloads
- ClawHub top 25 (March 2026): ontology is the only non-agent skill in the top 6, sandwiched between self-improving variants with 233K and 76K downloads
- GitHub issues on claude-code repo show repeated requests for structured cross-session state that goes beyond flat markdown files
- The dominant skill (oswalpalash/ontology) requires Python + YAML schema — no TypeScript-native alternative exists at meaningful download counts

## Target Audience

Developers who:
- Build multi-step workflows where Claude needs to track entities (people, tasks, projects, decisions) across sessions
- Run multiple Claude Code agents and need a shared structured state layer
- Have outgrown flat MEMORY.md files and want typed, queryable, relational data
- Build skills that could benefit other skills if they could share entity state

They know JSON. They don't want to install Python or manage a separate schema language.

## Core Thesis

Give Claude Code a typed, queryable entity graph stored in plain JSON Lines files — so any skill can read and write structured state without external databases, Python scripts, or MCP overhead.

The skill teaches three things:
1. The entity-graph data model (types, relations, constraints — all in TypeScript interfaces)
2. CRUD + query operations Claude can perform natively
3. The **cross-skill composability protocol**: how to declare that your skill reads/writes the graph so other skills can interoperate

## Skill Scope

### In Scope
- Entity type definitions (Person, Task, Project, Goal, Decision, etc.) as TypeScript interfaces
- Append-only JSONL storage in `memory/ontology/graph.jsonl`
- Schema file (`memory/ontology/schema.json`) for type registry, cardinality, and enum constraints
- CRUD operations: create entity, add relation, update fields, soft-delete
- Query patterns: by type, by relation, by field value, traversal
- Schema validation (required fields, enum values, relation cardinality)
- Cross-skill composability: `ontology:` header in SKILL.md declaring reads/writes
- A working example: tracking a software project with People, Tasks, Decisions, and Dependencies

### Out of Scope
- Visual graph UI or graph database backends (Neo4j, etc.)
- Vector/semantic search over entities
- Real-time sync between multiple Claude instances
- Migration tools for existing markdown memory files

## Sections

1. **Why Flat Files Aren't Enough** — When MEMORY.md breaks down: duplicate entries, no type safety, can't query "all open tasks assigned to Alice." The entity graph solves this with 3 primitives: entities, relations, schema.

2. **The Data Model** — TypeScript interfaces for entity records and relation records. The JSONL format (one JSON object per line, append-only). Why append-only: safe concurrent writes, full audit history, easy compaction.

3. **Schema Definition** — `schema.json` structure: entity types (fields, required, enums), relation types (source type, target type, cardinality). Walk through a real schema for a software project.

4. **Quick Setup (5 Minutes)** — Create the two files, initialize the schema, add the composability header to CLAUDE.md. No installs, no dependencies.

5. **CRUD Operations** — How Claude reads/writes the graph: create entity, add relation, update fields, soft-delete. Exact JSON patterns for each operation. Why to never delete lines (append-only invariant).

6. **Querying the Graph** — Read the JSONL, filter by type/field/relation. Traversal: find all Tasks related to a Project. Reverse lookups. Aggregation patterns.

7. **Cross-Skill Composability Protocol** — The `ontology:` header convention. Example: a TDD-workflow skill that writes Test entities when red-green-refactor completes. How orchestrator skills declare reads. How to avoid write conflicts (entity ownership).

8. **Anti-Patterns** — Storing blobs (use files, store path in entity), reinventing relations as fields, skipping the schema (silent type drift), writing non-append updates (breaks audit trail).

## Success Criteria

After installing this skill, a developer should be able to:
- [ ] Create a schema with at least 3 entity types and 2 relation types
- [ ] Write entities and relations to `memory/ontology/graph.jsonl`
- [ ] Query entities by type and filter by field value
- [ ] Traverse a relation to find connected entities
- [ ] Add the `ontology:` composability header to an existing skill
- [ ] Understand why the append-only invariant matters and how to compact when needed

## Keywords

ontology, knowledge graph, entity graph, structured memory, jsonl, typed memory, claude code memory, cross-skill state, composability protocol, graph schema, entity relations

## Competitive Positioning

| Their Approach (oswalpalash/ontology) | Our Approach |
|---|---|
| Python CLI (`python ontology.py add-entity`) | Claude reads/writes JSONL directly — no subprocess |
| YAML schema (`schema.yaml`) | TypeScript-compatible `schema.json` — same language as your codebase |
| 110K downloads but Python dependency required | Zero dependencies beyond standard JSON |
| Proprietary composability convention | Documented open protocol — any skill can adopt it |
| Single-author skill with no ecosystem | Designed to be the shared state layer for ALL skills |

## Estimated Complexity

**Medium.** No external dependencies. All I/O is plain JSON file reads/writes. The hardest part is teaching the composability protocol clearly — the data model itself is straightforward. Reference files needed: schema-format.md, crud-operations.md, query-patterns.md, composability-protocol.md, anti-patterns.md.
