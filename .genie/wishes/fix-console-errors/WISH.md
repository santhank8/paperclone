# Wish: Fix All Browser Console Errors and Warnings

**Status:** SHIPPED
**Slug:** `fix-console-errors`
**Created:** 2026-03-14

---

## Summary

The Paperclip UI at `felipe.genie.namastex.io` produces console errors: Vite HMR WebSocket connects to `wss://0.0.0.0:13100` (unreachable from remote browser), live-events WebSocket fails because Vite's dev middleware intercepts the upgrade before the app's WS handler, and a deprecated `apple-mobile-web-app-capable` meta tag. The 401/403 errors are transient session issues after server restart (not a code bug).

---

## Scope

### IN
- Fix Vite HMR WebSocket to use the actual hostname and port 443 when behind Caddy reverse proxy
- Fix live-events WebSocket — Vite dev middleware likely intercepts WS upgrades before `server.on("upgrade")` runs
- Replace deprecated `apple-mobile-web-app-capable` meta tag

### OUT
- React DevTools suggestion (browser extension, not an error)
- Caddy configuration changes (Caddy v2 handles WS upgrades automatically)
- Auth session issues (transient — re-login fixes)
- Production build chunk size warnings

---

## Decisions

- **DEC-1:** Vite HMR uses `hmr.host = opts.bindHost` (which is `0.0.0.0`) and `hmr.clientPort = hmrPort` (13100). Behind Caddy TLS, the browser needs `hmr.host` set to the actual hostname from `allowedHostnames[0]` and `hmr.clientPort` set to `443` (since Caddy terminates TLS on 443). For local dev without Caddy, keep the defaults.
- **DEC-2:** Caddy v2 auto-handles WS upgrades. Vite in `middlewareMode: true` does NOT intercept HTTP `upgrade` events — it only attaches Express middleware, not `server.on("upgrade")` listeners. The live-events WS failure cascades from the 401 auth issue (stale session after server restart). After fixing Group A (HMR), verify in-browser whether live-events WS works when properly authenticated. If it still fails, the root cause is session cookie handling on WS upgrade, not Vite middleware.
- **DEC-3:** The meta tag fix is a one-line change in `ui/index.html`.

---

## Success Criteria

- [ ] No `WebSocket connection to 'wss://0.0.0.0:13100' failed` in console
- [ ] No `WebSocket connection to 'wss://felipe.genie.namastex.io/api/companies/.../events/ws' failed` when authenticated
- [ ] No deprecated `apple-mobile-web-app-capable` warning
- [ ] `pnpm -r typecheck && pnpm test:run && pnpm build` all pass

---

## Assumptions

- **ASM-1:** Server runs in Vite dev middleware mode (`PAPERCLIP_UI_DEV_MIDDLEWARE=true`) behind Caddy v2 reverse proxy terminating TLS on port 443
- **ASM-2:** Caddy automatically forwards WS upgrades — the problem is in the Node.js server, not the proxy
- **ASM-3:** `allowedHostnames` in config contains the actual hostname (`felipe.genie.namastex.io`)

## Risks

- **RISK-1:** Changing `hmr.host` may break local dev without Caddy — Mitigation: only set hostname when `allowedHostnames` is configured and not localhost
- **RISK-2:** Vite's middleware may need explicit WS path exclusion — Mitigation: check if Vite's `server.middlewareMode` can be configured to skip `/api/*` WS upgrades

---

## Execution Groups

### Group A: Fix Vite HMR WebSocket for Reverse Proxy

**Depends on:** None (independent)

**Goal:** Make Vite HMR WebSocket connect using the actual hostname and HTTPS port when behind a reverse proxy.

**Deliverables:**
- In `server/src/app.ts` lines 173-179, detect when running behind a reverse proxy using the existing `privateHostnameGateEnabled` flag (already computed at line 59-60 as `deploymentMode === "authenticated" && deploymentExposure === "private"`) and set:
  - `hmr.host` → first allowed hostname (e.g., `felipe.genie.namastex.io`)
  - `hmr.clientPort` → `443` (HTTPS port)
  - `hmr.protocol` → `wss` (since Caddy terminates TLS)
- When no reverse proxy detected (local dev), keep current behavior

**Acceptance Criteria:**
- [ ] HMR connects to `wss://felipe.genie.namastex.io:443/...` instead of `wss://0.0.0.0:13100`
- [ ] HMR still works on localhost for local dev

**Validation:** `pnpm -r typecheck && pnpm test:run && pnpm build`

---

### Group B: Fix Live-Events WebSocket Upgrade

**Depends on:** Group A (HMR fix may resolve cascading auth issues)

**Goal:** Verify live-events WebSocket works after HMR fix and fresh login. If it still fails, diagnose session cookie handling on WS upgrade.

**Deliverables:**
- After Group A is deployed, sign in fresh and verify live-events WS connects
- If still failing: check if Better Auth session cookie is sent on WS upgrade (inspect `authorizeUpgrade` in `live-events-ws.ts`)
- If cookie issue: ensure `SameSite=Lax` cookie is sent on same-origin WS connections

**Acceptance Criteria:**
- [ ] `wss://felipe.genie.namastex.io/api/companies/:id/events/ws` connects when authenticated (verified in-browser)
- [ ] No repeated reconnection errors in console (verified in-browser)

Note: This group requires browser verification — `pnpm test:run` cannot validate WS connectivity.

**Validation:** Browser console check after fresh login — zero WS errors

---

### Group C: Fix Deprecated Meta Tag

**Depends on:** None (independent)

**Goal:** Replace deprecated HTML meta tag.

**Deliverables:**
- In `ui/index.html` line 7, replace `apple-mobile-web-app-capable` with `mobile-web-app-capable`

**Acceptance Criteria:**
- [ ] No deprecation warning in browser console

**Validation:** `pnpm -r typecheck && pnpm build`

---

## Review Results

_Populated by `/review` after execution completes._

---

## Files to Create/Modify

```
# Group A
server/src/app.ts — fix hmr config (host, clientPort, protocol) for reverse proxy

# Group B
server/src/app.ts or server/src/index.ts — ensure WS upgrade handler order vs Vite middleware
server/src/realtime/live-events-ws.ts — verify upgrade path matching

# Group C
ui/index.html — replace deprecated meta tag
```
