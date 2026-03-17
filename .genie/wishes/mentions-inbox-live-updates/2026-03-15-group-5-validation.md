# Group 5 Manual Validation

Open DevTools `Console` and `Network`, then filter Network to `WS`.

1. Remount/noise check
   Load any board page, then hard-refresh it.
   Expected evidence: after the page settles there is exactly one live socket at `/api/companies/<selected-company-id>/events/ws`, and the console does not show `WebSocket is closed before the connection is established`.

2. Company switch reconnect
   Switch from company A to company B from the company rail.
   Expected evidence: the company A websocket closes once, a new `101 Switching Protocols` websocket appears for company B, and live toasts/events now reflect only company B.

3. Sign-out teardown
   Click `Sign Out`.
   Expected evidence: the current websocket closes, `/auth` is shown, and no new websocket attempts appear while signed out.

4. Same-user session rotation
   Sign back in as the same user and run this in the console:
   ```js
   await fetch("/api/auth/get-session", { credentials: "include" }).then(async (r) =>
     r.status === 401 ? null : (await r.json()).session.id,
   );
   ```
   Save the value, then sign out, sign back in as the same user again, and run the snippet again.
   Expected evidence: the second `session.id` differs from the first one, the old websocket does not survive the sign-out, and a fresh websocket opens only after the new session settles.

5. Different-user reauthorization
   Sign out, then sign in as a different user.
   Expected evidence: no websocket reconnects happen for the signed-out user, and after the new user's company selection settles there is exactly one `101 Switching Protocols` websocket for that user's selected company.
