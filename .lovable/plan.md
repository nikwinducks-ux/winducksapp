

# Fix Authentication End-to-End

## Problem Summary

The login flow has three issues causing it to appear broken:
1. After a successful sign-in, there is no visual feedback or navigation -- the Login form just sits there while `AuthContext` asynchronously loads the user role in the background.
2. No error messages are shown for failed logins.
3. Multiple rapid sign-in attempts can occur because there's no loading state feedback during the role-resolution gap.

## Changes

### 1. Improve Login Page (`src/pages/Login.tsx`)

- Add a **post-login waiting state**: After `signIn` succeeds (no error), show a "Loading your dashboard..." spinner instead of the login form. This covers the gap while `AuthContext` resolves the role.
- Add a **2-second safety fallback**: If the role doesn't load within 2 seconds after successful sign-in, display: "Signed in, but role not found. Please contact admin." with a "Retry" button.
- Add **console.log** statements for debugging: "Submitting login", "Login result: success/error", "Role loaded".
- Keep the existing error display (`{error && <p>...`}) -- it already works, just needs the flow to reach it properly.

### 2. Add Post-Login Navigation (`src/pages/Login.tsx`)

- Add a `useEffect` that watches `useAuth().user`:
  - When `user` becomes non-null, navigate based on role:
    - `admin` -> `/admin`
    - `sp` -> `/`
  - This handles the redirect after `AuthContext` resolves the role.

### 3. Clean Up AuthContext (`src/contexts/AuthContext.tsx`)

- The current implementation is already correct (uses `setTimeout` to avoid deadlock, separates initial load from listener).
- Add minimal debug logging: log when role is fetched and what it resolved to.
- No structural changes needed -- the 5-second timeout hack is already removed.

### 4. Fix Signup Race Condition (`src/pages/Signup.tsx`)

- Already fixed in previous iteration (role insert before sign-in). No changes needed.

## Technical Details

### Login.tsx Changes

```
- After signIn returns success, set a `signedInWaiting` state = true
- Render a "Loading dashboard..." view when signedInWaiting is true
- useEffect: if signedInWaiting && user is loaded, navigate by role
- useEffect: if signedInWaiting, start 2-second timer; if user still null, show error with retry button
- Retry button: re-calls fetchRole or signs out and resets
```

### Files Modified

| File | Change |
|---|---|
| `src/pages/Login.tsx` | Add post-login waiting state, role-based navigation, retry fallback, debug logs |
| `src/contexts/AuthContext.tsx` | Add minimal debug console.logs around role fetching |

### No Database or Edge Function Changes

The auth tables, RLS policies, and edge functions are all working correctly. The fix is purely in the frontend login flow.

