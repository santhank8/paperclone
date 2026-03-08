# Plan: Pluggable Task Management Backend for Paperclip

**Objective:** Make Paperclip support multiple task management backends:
1. **Built-in** (existing Paperclip issues)
2. **Plane** (plane.so integration)

This is the **first objective** before any other integration work.

---

## Architecture: Task Backend Abstraction

### Interface Design

```typescript
// packages/shared/src/task-backend/types.ts

/**
 * Abstract interface for task management backends
 */
export interface TaskBackend {
  readonly type: 'paperclip' | 'plane';

  // Issue CRUD
  createIssue(data: CreateIssueInput): Promise<Issue>;
  getIssue(id: string): Promise<Issue | null>;
  updateIssue(id: string, data: UpdateIssueInput): Promise<Issue>;
  deleteIssue(id: string): Promise<void>;
  listIssues(query: IssueQuery): Promise<IssueList>;

  // Assignment & Checkout
  checkout(issueId: string, agentId: string): Promise<Issue>;
  release(issueId: string): Promise<Issue>;

  // Dependencies
  addDependency(issueId: string, blockedById: string): Promise<void>;
  removeDependency(issueId: string, blockedById: string): Promise<void>;
  getDependencies(issueId: string): Promise<DependencyInfo>;
  canProceed(issueId: string): Promise<{ canProceed: boolean; blockers: Issue[] }>;

  // Comments
  addComment(issueId: string, body: string): Promise<Comment>;
  listComments(issueId: string): Promise<Comment[]>;

  // Status Transitions
  transitionStatus(issueId: string, status: IssueStatus): Promise<Issue>;

  // Sync (for external backends)
  syncToExternal?(issue: Issue): Promise<void>;
  syncFromExternal?(externalId: string): Promise<Issue>;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeAgentId?: string;
  projectId?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeAgentId?: string | null;
  comment?: string;
}

export interface IssueQuery {
  status?: IssueStatus[];
  assigneeAgentId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface Issue {
  id: string;
  backendType: 'paperclip' | 'plane';
  externalId?: string; // For Plane: the Plane issue ID
  title: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeAgentId?: string;
  projectId?: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  dependencies?: DependencyInfo;
}

export interface DependencyInfo {
  blockedBy: Issue[];
  blocking: Issue[];
  allBlockersDone: boolean;
}

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';
```

---

### Backend Implementations

```
packages/
├── task-backend/
│   ├── src/
│   │   ├── index.ts              # Exports
│   │   ├── types.ts              # Interfaces
│   │   ├── paperclip-backend.ts  # Built-in implementation
│   │   └── plane-backend.ts      # Plane integration
│   └── package.json
│
└── db/
    └── src/schema/
        └── issues.ts              # Add backend_type column
```

---

### Configuration

```json
// .paperclip/config.json
{
  "taskBackend": {
    "type": "paperclip",  // or "plane"
    "plane": {
      "enabled": false,
      "apiUrl": "https://api.plane.so",
      "apiKey": "${PLANE_API_KEY}",
      "workspaceSlug": "jarvis-workspace",
      "defaultProjectId": "project-uuid",
      "syncEnabled": true,
      "webhookSecret": "${PLANE_WEBHOOK_SECRET}"
    }
  }
}
```

---

### Service Layer

```typescript
// server/src/services/task-backend.ts

import { TaskBackend, Issue } from '@paperclipai/task-backend';
import { PaperclipBackend } from './backends/paperclip-backend.js';
import { PlaneBackend } from './backends/plane-backend.js';

export function createTaskBackend(config: TaskBackendConfig): TaskBackend {
  switch (config.type) {
    case 'paperclip':
      return new PaperclipBackend(db);
    case 'plane':
      return new PlaneBackend(config.plane);
    default:
      throw new Error(`Unknown task backend: ${config.type}`);
  }
}

// Singleton instance
let backend: TaskBackend | null = null;

export function getTaskBackend(): TaskBackend {
  if (!backend) {
    const config = loadConfig().taskBackend;
    backend = createTaskBackend(config);
  }
  return backend;
}
```

---

### Usage in Routes

```typescript
// server/src/routes/issues.ts

import { getTaskBackend } from '../services/task-backend.js';

// Create issue
router.post('/companies/:companyId/issues', async (req, res) => {
  const backend = getTaskBackend();
  const issue = await backend.createIssue({
    title: req.body.title,
    description: req.body.description,
    assigneeAgentId: req.body.assigneeAgentId,
  });
  res.status(201).json(issue);
});

// Checkout issue
router.post('/issues/:id/checkout', async (req, res) => {
  const backend = getTaskBackend();

  // Check dependencies
  const { canProceed, blockers } = await backend.canProceed(req.params.id);
  if (!canProceed) {
    return res.status(423).json({
      error: 'Task blocked',
      blockers: blockers.map(b => ({ id: b.id, title: b.title }))
    });
  }

  const issue = await backend.checkout(req.params.id, req.body.agentId);
  res.json(issue);
});

// Add dependency
router.post('/issues/:id/dependencies', async (req, res) => {
  const backend = getTaskBackend();
  await backend.addDependency(req.params.id, req.body.blockedById);
  res.status(204).send();
});
```

---

## Database Changes

### Add Backend Type to Issues

```sql
-- Migration: add_backend_type.sql
ALTER TABLE issues ADD COLUMN backend_type TEXT NOT NULL DEFAULT 'paperclip';
ALTER TABLE issues ADD COLUMN external_id TEXT;
ALTER TABLE issues ADD COLUMN external_metadata JSONB;

CREATE INDEX issues_backend_type_idx ON issues(backend_type);
CREATE INDEX issues_external_id_idx ON issues(external_id);
```

### Schema Update

```typescript
// packages/db/src/schema/issues.ts

export const issues = pgTable(
  "issues",
  {
    // ... existing fields ...

    // NEW: Backend type
    backendType: text("backend_type").notNull().default("paperclip"),
    externalId: text("external_id"), // Plane issue ID
    externalMetadata: jsonb("external_metadata").$type<Record<string, unknown>>(),
  },
  (table) => ({
    // ... existing indexes ...
    backendTypeIdx: index("issues_backend_type_idx").on(table.backendType),
    externalIdIdx: index("issues_external_id_idx").on(table.externalId),
  }),
);
```

---

## Implementation Plan

### Phase 1: Abstraction Layer (Day 1)

**Branch:** `feat/task-backend-abstraction`

**Tasks:**
- [ ] Create `@paperclipai/task-backend` package
- [ ] Define `TaskBackend` interface
- [ ] Create types (`Issue`, `CreateIssueInput`, etc.)
- [ ] Add `backend_type`, `external_id` columns to issues table
- [ ] Create migration

**Deliverable:** Package structure ready

---

### Phase 2: Paperclip Backend (Day 1-2)

**Branch:** `feat/paperclip-backend`

**Tasks:**
- [ ] Implement `PaperclipBackend` class
- [ ] Map existing DB operations to interface
- [ ] Add dependency support (from DEPENDENCIES.md)
- [ ] Write tests

**Deliverable:** Built-in backend working via interface

---

### Phase 3: Plane Backend (Day 2-3)

**Branch:** `feat/plane-backend`

**Tasks:**
- [ ] Implement `PlaneBackend` class
- [ ] Add Plane API client
- [ ] Map Plane issues to Paperclip issues
- [ ] Implement dependency checking via Plane API
- [ ] Add sync logic (bidirectional)
- [ ] Add webhook handler for Plane events
- [ ] Write tests

**Deliverable:** Plane backend fully functional

---

### Phase 4: Configuration & Switching (Day 3)

**Branch:** `feat/task-backend-config`

**Tasks:**
- [ ] Add `taskBackend` config section
- [ ] Implement backend factory
- [ ] Update all routes to use `getTaskBackend()`
- [ ] Add CLI command to switch backends
- [ ] Test switching backends

**Deliverable:** Can switch between backends via config

---

### Phase 5: Migration & Testing (Day 4)

**Branch:** `feat/task-backend-migration`

**Tasks:**
- [ ] Add migration script: Paperclip → Plane
- [ ] Add migration script: Plane → Paperclip
- [ ] End-to-end tests with both backends
- [ ] Update documentation

**Deliverable:** Migration tools ready

---

### Phase 6: UI Updates (Day 4-5)

**Branch:** `feat/task-backend-ui`

**Tasks:**
- [ ] Add backend selector in settings
- [ ] Show backend type in issue cards
- [ ] Add Plane-specific features (timeline link, cycles)
- [ ] Update dashboard to show backend status

**Deliverable:** UI reflects backend choice

---

## File Structure

```
paperclip/
├── packages/
│   ├── task-backend/           # NEW PACKAGE
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── paperclip-backend.ts
│   │   │   └── plane-backend.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── db/
│       └── src/schema/
│           └── issues.ts        # UPDATED: add backend_type
│
├── server/
│   └── src/
│       ├── services/
│       │   ├── task-backend.ts  # NEW: factory
│       │   └── issues.ts        # UPDATED: use backend
│       │
│       └── routes/
│           └── issues.ts        # UPDATED: use backend
│
├── docs/
│   └── integrations/
│       └── TASK-BACKEND-PLAN.md # THIS FILE
│
└── .paperclip/
    └── config.json              # UPDATED: add taskBackend section
```

---

## Testing Strategy

### Unit Tests

```typescript
// packages/task-backend/src/__tests__/backend.test.ts

describe('TaskBackend', () => {
  describe('PaperclipBackend', () => {
    it('should create issue', async () => {
      const backend = new PaperclipBackend(mockDb);
      const issue = await backend.createIssue({
        title: 'Test issue',
        description: 'Test'
      });
      expect(issue.title).toBe('Test issue');
    });

    it('should block checkout if dependencies not met', async () => {
      const backend = new PaperclipBackend(mockDb);

      // Create dependency chain
      const blocker = await backend.createIssue({ title: 'Blocker' });
      const blocked = await backend.createIssue({ title: 'Blocked' });
      await backend.addDependency(blocked.id, blocker.id);

      // Check can proceed
      const { canProceed, blockers } = await backend.canProceed(blocked.id);
      expect(canProceed).toBe(false);
      expect(blockers).toHaveLength(1);
    });
  });

  describe('PlaneBackend', () => {
    it('should sync issue to Plane', async () => {
      const backend = new PlaneBackend(mockPlaneApi);
      const issue = await backend.createIssue({
        title: 'Test issue'
      });
      expect(issue.externalId).toBeDefined();
    });

    it('should fetch dependencies from Plane', async () => {
      const backend = new PlaneBackend(mockPlaneApi);
      const { canProceed } = await backend.canProceed('issue-with-blockers');
      expect(canProceed).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
// server/src/routes/__tests__/issues.test.ts

describe('Issues API with different backends', () => {
  it('should work with Paperclip backend', async () => {
    setConfig({ taskBackend: { type: 'paperclip' } });
    const res = await request(app).post('/api/issues').send({ title: 'Test' });
    expect(res.status).toBe(201);
    expect(res.body.backendType).toBe('paperclip');
  });

  it('should work with Plane backend', async () => {
    setConfig({ taskBackend: { type: 'plane', plane: { ... } } });
    const res = await request(app).post('/api/issues').send({ title: 'Test' });
    expect(res.status).toBe(201);
    expect(res.body.backendType).toBe('plane');
    expect(res.body.externalId).toBeDefined();
  });
});
```

---

## Migration Path

### From Paperclip to Plane

```bash
# CLI command
paperclip task-backend migrate --to plane --workspace jarvis-workspace --project project-uuid

# What it does:
# 1. Creates all issues in Plane
# 2. Stores external_id mapping
# 3. Sets backend_type = 'plane'
# 4. Updates config to use plane backend
```

### From Plane to Paperclip

```bash
paperclip task-backend migrate --to paperclip

# What it does:
# 1. Fetches all issues from Plane
# 2. Creates in Paperclip DB
# 3. Sets backend_type = 'paperclip'
# 4. Updates config
```

---

## Configuration Example

### Using Built-in (Default)

```json
{
  "taskBackend": {
    "type": "paperclip"
  }
}
```

### Using Plane Cloud

```json
{
  "taskBackend": {
    "type": "plane",
    "plane": {
      "apiUrl": "https://api.plane.so",
      "apiKey": "${PLANE_API_KEY}",
      "workspaceSlug": "jarvis-workspace",
      "defaultProjectId": "proj_abc123",
      "syncEnabled": true
    }
  }
}
```

### Using Self-Hosted Plane

```json
{
  "taskBackend": {
    "type": "plane",
    "plane": {
      "apiUrl": "http://localhost:3000/api",
      "apiKey": "${PLANE_API_KEY}",
      "workspaceSlug": "jarvis-workspace",
      "defaultProjectId": "proj_abc123",
      "syncEnabled": true,
      "webhookSecret": "${PLANE_WEBHOOK_SECRET}"
    }
  }
}
```

---

## CLI Commands

```bash
# Check current backend
paperclip task-backend status

# Switch to Plane
paperclip task-backend use plane --workspace jarvis-workspace

# Switch to built-in
paperclip task-backend use paperclip

# Migrate data
paperclip task-backend migrate --to plane

# Sync (bidirectional)
paperclip task-backend sync

# Test connection
paperclip task-backend test
```

---

## Success Criteria

- [ ] `@paperclipai/task-backend` package created
- [ ] `TaskBackend` interface defined
- [ ] `PaperclipBackend` implements interface
- [ ] `PlaneBackend` implements interface
- [ ] Database migration adds `backend_type`
- [ ] All routes use `getTaskBackend()`
- [ ] Configuration supports backend selection
- [ ] Migration scripts work both directions
- [ ] Tests pass for both backends
- [ ] Documentation updated

---

## Timeline

| Day | Phase | Focus |
|-----|-------|-------|
| 1 | Abstraction + Paperclip Backend | Interface + built-in impl |
| 2 | Plane Backend | Plane integration |
| 3 | Config + Switching | Backend factory |
| 4 | Migration + UI | Tools + dashboard |
| 5 | Testing + Docs | E2E tests + docs |

---

## Next Steps

**Awaiting your approval to begin:**

1. Create branch: `feat/task-backend-abstraction`
2. Start Phase 1: Create abstraction package
3. Implement PaperclipBackend (Phase 2)
4. Implement PlaneBackend (Phase 3)

**Estimated completion:** 4-5 days

Ready to proceed?
