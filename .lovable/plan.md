## What you're seeing

You sign in successfully on Android, but the screen says **"Sign-in succeeded, but we couldn't load your account details."** Hitting Retry doesn't help.

## Root cause (different from last time)

I checked the database, the auth logs, and the live network requests:

- Database: your role IS correct (`sp`, active, sp_id linked). ✅
- Auth: login returns 200 OK in ~100ms. ✅
- Role lookup query: returns the correct row in 200–580ms. ✅

**So the data is fine. The bug is in how the Login page waits for the role.**

The Login page relies on a chain of React state updates flowing through `AuthContext`:

```text
Login submits → supabase signs in → onAuthStateChange fires in AuthContext
  → setTimeout(0) → fetchRole (200-600ms) → setUser → React re-render
  → AuthContext value propagates → Login useEffect sees `user` → navigate
```

On desktop this whole chain runs in well under a second. On a slower Android device, the network log shows the role fetch sometimes firing **6+ seconds after the sign-in returned**, because:

1. The `setTimeout(0)` defers the fetch behind any other queued work,
2. `onAuthStateChange` may fire multiple times (`SIGNED_IN`, then `TOKEN_REFRESHED`), each kicking off a fresh fetch,
3. Each context update triggers a re-render of the entire app tree, which is slow on Android.

By the time `user` finally arrives in the Login component, the 8s safety timer has already fired and shown the error screen — even though the role IS loading correctly.

This is fundamentally fragile. The Login page should not depend on the AuthContext propagation chain to know when sign-in is complete.

## Fix

Make the Login page **fetch the role directly** right after `signInWithPassword` returns, then navigate immediately. Stop waiting for AuthContext to catch up.

### 1. `src/pages/Login.tsx` — fetch role inline

In `handleSubmit`, after a successful `signIn()`:

- Get the freshly-signed-in user via `supabase.auth.getUser()`.
- Query `user_roles` directly with up to 3 retries (400ms / 800ms / 1500ms backoff).
- If a role is returned, navigate immediately using that role — do not wait for `user` from `useAuth()`.
- If after 3 tries no role is returned, then show the "couldn't load" screen.
- Remove the 8s timeout-based safety net entirely; replace with deterministic outcome from the inline fetch.

This makes the post-login behavior fully deterministic and unaffected by AuthContext re-render timing on slow devices.

### 2. `src/contexts/AuthContext.tsx` — keep as-is for app-wide use

AuthContext still needs to populate `user` for the rest of the app (route guards, dashboards). That part keeps working as it does today. We just stop *relying* on its timing for the login navigation decision.

### 3. `public/sw.js` — bump cache to `v4`

Force Android to fetch the new Login bundle on next visit so the fix actually takes effect (the previous `v3` bump may not have activated on your device yet).

## Why this works where the last fix didn't

Last fix increased the timeout and added retries to AuthContext. But the real problem isn't the fetch speed — it's that Login was waiting for context state to propagate through React renders on a slow device. By doing the role lookup directly inside `handleSubmit` and acting on its return value, we cut the entire propagation chain out of the critical path.

## After deploying

You'll need to **publish**, then on your Android phone:
1. Fully close the browser tab (not just background it).
2. Reopen `winducksapp.lovable.app`.
3. Sign in. Should navigate straight to the SP dashboard within ~1 second of pressing Sign In.

## Files to edit

- `src/pages/Login.tsx`
- `public/sw.js`

## Out of scope

- No DB changes (verified correct).
- No AuthContext logic changes (still needed for app-wide auth state).
