# IRONWORKS API SECURITY AUDIT - COMPREHENSIVE ROUTE INVENTORY

**Audit Date:** 2026-04-05
**Scope:** IronWorks production codebase (feature/goals-issues-badges branch)
**Total Route Files:** 56
**Total Active Routes:** ~420

---

## 1. COMPLETE ROUTE INVENTORY BY FILE

### Primary Service Routes (High-Traffic)

| File | Routes | Primary Functions |
|------|--------|------------------|
| agents.ts | 58 | Agent lifecycle, communication, permissions, team membership, role assignments |
| issues.ts | 37 | Issue CRUD, status management, file attachments, comments, labels |
| access.ts | 36 | API key generation, webhook probing, provider endpoint testing |
| executive.ts | 29 | Analytics, activity export (CSV), cost reporting, performance metrics |
| costs.ts | 24 | Cost tracking, budget management, cost allocation, alerts |
| plugins.ts | 26 | Plugin lifecycle, webhook reception, tool dispatch [**DISABLED for V1**] |
| companies.ts | 17 | Company admin, member management, permissions, company deletion |
| channels.ts | 16 | Channel management, messaging, permissions, member access |
| routines.ts | 12 | Routine triggers, execution, scheduling, public trigger endpoints |
| admin.ts | 11 | Instance admin dashboard, company/agent metrics, subscription analytics |
| projects.ts | 10 | Project CRUD, status tracking, milestones |
| company-skills.ts | 10 | Skill assignments, capability mapping |
| knowledge.ts | 10 | Knowledge base CRUD, content management, search |
| playbooks.ts | 10 | Playbook management, execution, step management |
| approvals.ts | 10 | Approval workflow, request processing |
| agent-memory.ts | 6 | Memory store access, retrieval, updates |
| library.ts | 6 | Library content management, categories |
| secrets.ts | 6 | Secret store access, credential management |
| support.ts | 5 | Support ticket submission (public), internal ticket management |
| activity.ts | 5 | Activity log queries, filtering |
| messaging.ts | 5 | Messaging operations + email webhook (1 public) |
| hiring.ts | 4 | Hiring pipeline management |
| billing.ts | 4 | Subscription data, checkout sessions, customer portal |
| instance-settings.ts | 4 | Instance-level configuration |
| role-templates.ts | 4 | Role template definitions |
| privacy.ts | 4 | Privacy controls, data retention, GDPR |
| llms.ts | 3 | LLM provider configuration, model selection |
| announcements.ts | 3 | Company announcements CRUD |
| assets.ts | 3 | Asset uploads, company logo management |
| bug-reports.ts | 3 | Bug report submission |
| execution-workspaces.ts | 3 | Execution workspace management |
| goal-stats.ts | 3 | Goal statistics, progress tracking |
| team-templates.ts | 3 | Team structure templates |
| dashboard.ts | 2 | Dashboard data aggregation |
| deliverables.ts | 2 | Deliverable tracking |
| expertise-map.ts | 2 | Agent expertise mapping |
| retrospectives.ts | 2 | Retrospective management |
| setup.ts | 2 | Self-serve signup, Polar checkout [**PUBLIC**] |
| client-reports.ts | 1 | Client reporting |
| flow-metrics.ts | 1 | Flow efficiency metrics |
| goals.ts | 9 | Goal CRUD, tracking, decomposition |
| health.ts | 1 | Health check [**PUBLIC**] |
| org-chart-svg.ts | 0 | SVG generation (no routes) |
| plugin-ui-static.ts | 0 | Plugin UI serving [**DISABLED**] |
| ai-generate.ts | 1 | AI content generation |
| ai-goal-breakdown.ts | 1 | Goal decomposition via AI |
| search.ts | 1 | Full-text search |
| sidebar-badges.ts | 1 | UI badge counts |
| slim.ts | 1 | Lightweight entity queries |
| sse.ts | 1 | Server-Sent Events (live activity) [**PROTECTED**] |
| authz.ts | 0 | Authorization utility functions (no routes) |
| index.ts | 0 | Route index (no routes) |
| issues-checkout-wakeup.ts | 0 | Background scheduler (no routes) |

**Route Distribution:** High-traffic endpoints concentrated in agents (58), issues (37), and access (36). Clear separation of concerns with each file handling a logical domain.

---

## 2. SPECIAL ENDPOINT TYPES

### FILE UPLOAD ENDPOINTS (2)

1. **POST /companies/:companyId/assets**
   - File: assets.ts
   - Mechanism: multer (memory storage)
   - Size Limit: 10 MB (configurable via `IRONWORKS_ATTACHMENT_MAX_BYTES`)
   - Allowed Types: Images by default; configurable via `IRONWORKS_ALLOWED_ATTACHMENT_TYPES`
   - Default Allowed: image/png, image/jpeg, image/jpg, image/webp, image/gif, application/pdf, text/markdown, text/plain, application/json, text/csv, text/html
   - SVG Sanitization: DOMPurify sanitization with event handler removal, href filtering
   - Auth: Protected (assertCompanyAccess)

2. **POST /companies/:companyId/issues/:issueId/attachments**
   - File: issues.ts
   - Mechanism: multer (memory storage)
   - Size Limit: 10 MB
   - Allowed Types: Same as assets
   - Auth: Protected (assertCompanyAccess)

### WEBHOOK ENDPOINTS (4)

1. **POST /api/webhooks/polar** (ACTIVE)
   - File: billing.ts
   - Purpose: Billing events from Polar payment processor
   - Auth: Signature verification (Standard Webhooks / Svix format)
   - Headers: webhook-id, webhook-timestamp, webhook-signature (supports svix-* legacy names)
   - Verification: verifyPolarWebhookSignature() - cryptographic HMAC-SHA256
   - Mounted: Public/unauthenticated (signature is auth mechanism)
   - Events Handled: subscription_created, subscription_updated, subscription_cancelled, etc.

2. **POST /api/webhooks/email** (ACTIVE)
   - File: messaging.ts
   - Purpose: Email ingestion from Mailgun/SendGrid
   - Auth: No signature verification (email provider verified caller)
   - Mounted: Public/unauthenticated
   - Notes: Matched via in-reply-to headers; creates activity log entries

3. **POST /api/plugins/:pluginId/webhooks/:endpointKey** (DISABLED)
   - File: plugins.ts
   - Purpose: Plugin webhook reception for external callers
   - Status: Disabled in app.ts (plugin system disabled for V1)
   - Auth: Signature verified per plugin manifest
   - Would receive: External webhook calls from configured endpoints

4. **POST /routine-triggers/public/:publicId/fire** (ACTIVE)
   - File: routines.ts
   - Purpose: Public routine trigger execution
   - Auth: No authentication (public access, publicId is the guard)
   - Rate Limit: None explicit (global rate limit applies)
   - Notes: Used for external automation, webhooks, integrations

### SERVER-SENT EVENTS (1)

1. **GET /companies/:companyId/events**
   - File: sse.ts
   - Purpose: Live activity streaming to clients
   - Auth: Protected (assertCompanyAccess)
   - Mechanism: HTTP long-polling with heartbeat every 30 seconds
   - Events: activity.logged, heartbeat.run.*, channel.message
   - Connection: Keep-alive, no proxy buffering

### WebSocket Endpoints

**None.** IronWorks uses Server-Sent Events (SSE) instead of WebSockets for real-time communication.

---

## 3. PUBLIC/UNAUTHENTICATED ROUTES (7 Total)

### Routes with No Auth Required

1. **POST /api/setup** (setup.ts)
   - Purpose: Self-serve signup after Polar checkout
   - Auth: None (rate-limited per IP: 5 req/hour)
   - Body: checkoutId, companyName, userName, email, password, tosAccepted
   - Security Controls:
     - DB-backed checkout deduplication (SEC-ADV-009)
     - Email verification against Polar checkout (SEC-ADV-012)
     - Password hashing (scrypt, 64-byte salt)
     - Session token generation and auto-login
   - Risk: Account creation endpoint; strong controls in place

2. **POST /api/checkout/create** (setup.ts)
   - Purpose: Landing page creates Polar checkout session
   - Auth: None
   - Body: tier (starter/growth/business), successUrl, cancelUrl
   - Security Controls:
     - Relative path validation for redirect URLs (no open redirect)
   - Notes: Unauthenticated user initiates payment flow

3. **POST /api/webhooks/polar** (billing.ts)
   - Purpose: Polar webhook for billing events
   - Auth: Signature verification (Standard Webhooks format)
   - Headers: webhook-id, webhook-timestamp, webhook-signature
   - Security: Cryptographic signature validation before processing

4. **POST /api/webhooks/email** (messaging.ts)
   - Purpose: Email ingestion webhook
   - Auth: Caller (Mailgun/SendGrid) is externally verified
   - Security: Matched via in-reply-to headers; no request signature required

5. **GET /api/health** (health.ts)
   - Purpose: Health check endpoint
   - Auth: None
   - Returns: Service status, deployment info, auth readiness
   - Security: Minimal info exposure

6. **POST /api/support** (support.ts)
   - Purpose: Support ticket submission from landing page
   - Auth: None (rate-limited per IP: 1 req/5 sec globally, ~5 req/min from same IP during burst)
   - Body: email, name, subject, message
   - Security: Rate limit (FIND-001)

7. **POST /routine-triggers/public/:publicId/fire** (routines.ts)
   - Purpose: Public routine trigger execution
   - Auth: None (publicId is opaque identifier)
   - Body: {trigger data}
   - Risk: External callers can invoke routines; publicId must be random and unguessable

---

## 4. AUTHENTICATION ARCHITECTURE

### Actor Types

Three actor types are enforced throughout the codebase:

1. **type: "none"** (Unauthenticated)
   - No credentials provided
   - Default for public routes
   - Cannot access protected resources

2. **type: "board"** (Human User / Dashboard)
   - Session-based or API key-based
   - User account from Better Auth
   - Can access companies they're a member of
   - May have instance_admin role

3. **type: "agent"** (Service Agent)
   - JWT or API key-based
   - Belongs to a specific company
   - Limited to agent actions
   - Can invoke tools, manage jobs

### Authentication Methods (actorMiddleware, auth.ts)

| Method | Transport | Validation |
|--------|-----------|-----------|
| Session Cookie | HTTP Cookie (better-auth.session_token) | resolveSession callback |
| Board API Key | Authorization: Bearer {token} | SHA256 hash match in DB, active check |
| Agent JWT | Authorization: Bearer {token} | Local JWT verify, claims validation |
| Agent API Key | Authorization: Bearer {token} | SHA256 hash match in DB, agent status check |
| Local Implicit | Environment (dev only) | deploymentMode: "local_trusted" |

### Authorization Checks

- `assertCompanyAccess(req, companyId)` — User/agent must have access to company
- `assertBoard(req)` — Actor must be type "board"
- `assertInstanceAdmin(req)` — Actor must have instance_admin role
- `getActorInfo(req)` — Extract actor details for logging

---

## 5. MIDDLEWARE PIPELINE (app.ts)

Requests traverse this middleware stack in order:

1. **Global Rate Limiting** (app.ts:115)
   - 200 requests per minute per IP
   - In-memory sliding window
   - Targets: /api/* only; OPTIONS requests exempt
   - Prunes stale buckets automatically

2. **Security Headers** (app.ts:138)
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - Referrer-Policy: strict-origin-when-cross-origin
   - Strict-Transport-Security: max-age=31536000; includeSubDomains
   - Content-Security-Policy: restrictive except for LLM/image APIs
   - X-Powered-By: disabled

3. **HTTP Compression** (app.ts:152)
   - gzip/deflate for JSON responses > 1KB
   - Skips SSE and tiny responses

4. **ETag Support** (app.ts:194)
   - Conditional GET requests

5. **JSON Parser** (app.ts:196)
   - 10 MB limit for company import/export
   - Raw body capture for webhook signature verification

6. **HTTP Logging** (app.ts:203)
   - Request/response logging

7. **Private Hostname Guard** (app.ts:210)
   - Enforces hostname whitelist in private deployments

8. **Actor Middleware** (app.ts:217) - **AUTHENTICATION**
   - Extracts and validates auth credentials
   - Sets req.actor for all downstream routes
   - Order: session → board key → agent JWT → agent key → none

9. **LLM Routes** (app.ts:243)
   - Special handling for LLM provider endpoints

10. **Board Mutation Guard** (app.ts:247)
    - Protects against concurrent board mutations

11. **Tier Enforcement** (app.ts:271-275)
    - POST /companies/:companyId/projects (enforceProjectLimit)
    - POST /companies/:companyId/playbooks/:playbookId/run (enforcePlaybookRunLimit)
    - POST /companies/:companyId/assets* (enforceStorageLimit)

### Route Organization

- **Public routes** (app.ts:334-338): Mounted BEFORE auth middleware
  - /api/setup (signup)
  - /api/checkout/create (checkout)
  - /api/webhooks/polar (Polar webhook)
  - /api/webhooks/email (Email webhook)
  - /api/support (Support tickets)

- **Protected routes** (app.ts:339): Mounted AFTER auth middleware
  - All other API routes require req.actor.type !== "none"
  - Specific routes check companyId access, admin role, etc.

---

## 6. SENSITIVE ENDPOINTS & SECURITY CONTROLS

### Company Deletion (HIGH IMPACT)

- **Route:** DELETE /companies/:companyId (companies.ts:355)
- **Auth:** assertBoard + assertCompanyAccess
- **Control:** Enabled/disabled at deployment time via `companyDeletionEnabled` flag
- **Action:** Marks company as "deleted" (soft delete)
- **Risk:** Irreversible data removal

### API Key Management (ACCESS CONTROL)

- **Route:** POST /companies/:companyId/agents/:agentId/api-keys (access.ts)
- **Purpose:** Generate new agent API key
- **Auth:** Agent must have canGenerateApiKey capability
- **Output:** Plain text key (only shown once); DB stores SHA256 hash
- **Tracking:** lastUsedAt timestamp in DB

### Webhook Endpoint Probing (EXTERNAL INTEGRATION)

- **Routes:** POST /api/access/check-webhook-endpoint (access.ts)
- **Purpose:** Test external webhook endpoints (Slack, Discord, etc.)
- **Auth:** Agent must have canProbeExternalEndpoints capability
- **Risk:** Can probe arbitrary external URLs; timeout/response info leaks
- **Security:** HEAD + POST verification; timeout limit 10s

### Instance Admin Dashboard (METRICS EXPOSURE)

- **Route:** GET /api/admin/dashboard (admin.ts:57)
- **Auth:** assertInstanceAdmin
- **Exposes:** Total companies, agents, users, runs, subscriptions, budgets, errors
- **Risk:** Sensitive metrics on instance health
- **Control:** Instance admin role only

### Cost Management (BUDGET ENFORCEMENT)

- **Routes:** /companies/:companyId/costs/* (costs.ts)
- **Auth:** assertCompanyAccess
- **Controls:** Monthly budgets, per-agent quotas, alerts
- **Risk:** Over-budget conditions could force service suspension

---

## 7. CRITICAL SECURITY FINDINGS

### Strengths

✓ **Rate Limiting** (SEC-ADV-013): Global 200 req/min + per-endpoint limits
✓ **Webhook Verification** (SEC-ADV-011): Polar webhooks use Standard Webhooks (Svix) signature verification
✓ **Checkout Deduplication** (SEC-ADV-009): DB-backed unique index prevents replay
✓ **Email Verification** (SEC-ADV-012): Polar checkout email must match signup email
✓ **SVG Sanitization**: DOMPurify with event handler removal, href filtering
✓ **File Type Validation**: Configurable whitelist (default: images + PDF + text)
✓ **Auth Middleware**: Centralized actorMiddleware; consistent across all protected routes
✓ **Tier Enforcement** (SEC-ADV-001): Billing limits on mutations
✓ **API Key Hashing**: SHA256 hashes in DB, never plaintext
✓ **HSTS**: Strict-Transport-Security enforced

### Gaps / Areas of Concern

⚠️ **Public Routine Triggers**: POST /routine-triggers/public/:publicId/fire has no auth
   - Relies on publicId randomness as sole guard
   - Recommendation: Add HMAC signature or bearer token option

⚠️ **Plugin System Disabled but Present**: 26 routes in plugins.ts are disabled in app.ts
   - Dead code increases attack surface
   - Recommendation: Delete plugins.ts once V1 ships stable

⚠️ **No CORS Configuration Visible**: Cross-origin requests not explicitly restricted
   - Default Express behavior allows all origins in CORS headers
   - Recommendation: Add explicit CORS middleware with whitelist

⚠️ **Email Webhook Signature Missing**: POST /api/webhooks/email has no signature verification
   - Relies on Mailgun/SendGrid as external gatekeeper
   - Recommendation: Add HMAC verification if possible with provider

⚠️ **Actor Middleware Bypass in Local Mode**: deploymentMode: "local_trusted" skips all auth
   - Dev convenience vs. accidental production use
   - Recommendation: Ensure "local_trusted" never reaches production

⚠️ **Session + Board Key Auth State Uncertainty**: Mixed session/token auth
   - No documentation on fallback/precedence order
   - Recommendation: Clarify in auth.ts comments

### No Critical Vulns Found

- No hardcoded credentials
- No SQL injection (Drizzle ORM used)
- No obvious path traversal
- No unchecked redirects (checkout URLs validated)
- No unvalidated deserialization

---

## 8. DEPLOYMENT-SPECIFIC BEHAVIOR

### Local Trusted Mode (Development)

```
deploymentMode: "local_trusted"
```
- actorMiddleware sets: `{ type: "board", userId: "local-board", isInstanceAdmin: true }`
- All endpoints accessible without credentials
- **MUST NOT** be used in production

### Authenticated Mode (Production)

```
deploymentMode: "authenticated"
```
- Better Auth required
- Session cookies or board API keys
- resolveSession callback validates credentials
- All routes enforce auth

### Private Hostname Guard

- Enabled when: deploymentMode === "authenticated" && deploymentExposure === "private"
- Whitelist: allowedHostnames parameter
- Scope: Host header validation before routing

---

## 9. ROUTE COUNT SUMMARY

| Category | Count |
|----------|-------|
| Total Route Files | 56 |
| Files with Routes | 53 |
| Empty/Index Files | 3 |
| Active Routes | ~420 |
| Disabled Routes (plugins) | 26 |
| Public Routes | 7 |
| File Upload Endpoints | 2 |
| Webhook Endpoints | 4 (3 active, 1 disabled) |
| WebSocket Endpoints | 0 |
| SSE Endpoints | 1 |

---

## 10. RECOMMENDATIONS

### Priority 1 (Immediate)

1. Add CORS whitelist middleware to prevent unexpected origin access
2. Document public routine trigger security model (publicId randomness guarantee)
3. Add signature verification to email webhook if Mailgun/SendGrid supports it
4. Audit plugins.ts usage; delete if truly disabled for V1

### Priority 2 (Next Sprint)

1. Add request ID tracing to all routes for debugging
2. Implement API endpoint documentation (OpenAPI/Swagger)
3. Add audit logging for sensitive operations (API key generation, company deletion)
4. Test rate limiter under production-like load

### Priority 3 (Longer Term)

1. Migrate away from in-memory rate limiting to distributed cache (Redis) for multi-instance deployments
2. Implement endpoint-specific rate limits (signup slower than normal routes)
3. Add GraphQL API as alternative to REST (if scalability requires)
4. Implement API versioning strategy

---

## 11. AUDIT SCOPE & METHODOLOGY

**Files Analyzed:**
- server/src/app.ts (main app factory, middleware pipeline)
- server/src/middleware/auth.ts (authentication logic)
- server/src/middleware/*.ts (all middleware)
- server/src/routes/*.ts (all 56 route files)
- server/src/attachment-types.ts (file upload validation)
- server/src/services/billing.js (webhook verification)

**Not in Scope:**
- Frontend code (ui/)
- Database schema (would require separate audit)
- CI/CD pipeline (.github/workflows/)
- Infrastructure config (Dockerfile, deployment)
- Third-party SDK integration details

**Date:** 2026-04-05
**Auditor:** Claude Code Agent
**Branch:** feature/goals-issues-badges
