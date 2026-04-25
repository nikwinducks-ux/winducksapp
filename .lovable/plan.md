# Fix: "Signed in, but role not found" on mobile

## Root cause

The user's role IS correctly stored in the database (verified: `spa@winducks.com` → role `sp`, active, with valid `sp_id`). RLS allows them to read their own row. The login itself succeeds (auth logs confirm 200 OK in ~100ms).

The failure is purely **client-side**, on mobile only, caused by three compounding issues:

1. **Login.tsx has a 2-second safety timeout** that flips to "role not found" if the role hasn't loaded yet. On a slow/flaky mobile connection, the role fetch from `user_roles` can easily exceed 2s, especially after a cold start or with a stale service worker in play.
2. **AuthContext.fetchRole runs only once with no retry.** If the request stalls or returns an error, `user` stays `null` permanently and the Login timeout trips.
3. **Stale service worker.** The recent `CACHE_VERSION = 'v2'` bump may not have activated on the user's Android device, so the old SW could be serving cached assets/intercepting requests in unexpected ways.

## Changes

### 1. `src/contexts/AuthContext.tsx` — make role fetch resilient
- Add **one retry with backoff** to `fetchRole` (e.g. 2 attempts, 800ms apart) so a single transient mobile network hiccup doesn't strand the user.
- Log timing of the role fetch so future mobile issues are easier to diagnose.

### 2. `src/pages/Login.tsx` — relax the safety timeout
- Increase the role-resolution timeout from **2s to 8s** (mobile-realistic).
- Fix the stale-closure bug: read the latest `user` from a ref inside the timeout callback rather than the captured closure value, so the timeout doesn't false-trigger if `user` arrived just after the timer fired.
- Improve the timeout message to be actionable: tell the user to check connection and retry, instead of telling them to "contact admin" (since the role *does* exist in the DB).

### 3. `public/sw.js` — bump cache version to force SW update
- Bump `CACHE_VERSION` from `'v2'` to `'v3'` so returning Android users pick up the fixed bundle on next load. This is the same cache-busting pattern we set up previously.

## Why this fixes it

- The DB has the role, RLS permits the read, and the auth call succeeds — so the only thing left to fix is the client's tolerance for slow networks and the stale-SW problem. After these changes, a slow mobile connection will simply wait a bit longer (and retry once) instead of falsely declaring "role not found".

## Files edited
- `src/contexts/AuthContext.tsx`
- `src/pages/Login.tsx`
- `public/sw.js`

## Out of scope
- No DB / RLS changes (verified correct).
- No changes to the SP portal routing or `sp_id` linkage (already valid for this user).
