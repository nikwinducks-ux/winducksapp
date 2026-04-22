

## Fix the Jobs-page broadcast toggle so it only succeeds when the job row is actually updated

### Root issue

The current broadcast flow is creating `offers` rows, but the matching `jobs` row is still coming back from the database as:

- `status = 'Created'`
- `is_broadcast = false`

That is why the Jobs-page switch snaps back to Off even though providers received broadcast offers.

The code in `useGenerateBroadcastOffers()` already attempts to update the job row, but it does not verify that the update actually succeeded. In this stack, a write can silently affect zero rows without throwing, so the UI can report success while the broadcast flags were never persisted.

### What to change

#### 1) Harden `useGenerateBroadcastOffers()` in `src/hooks/useOfferData.ts`

Replace the current unchecked job update with a verified update:

- update `jobs`
- request the updated row back with `.select(...)`
- use `.single()`
- throw if:
  - `error` exists
  - no row is returned
  - `is_broadcast` is not `true`
  - `status` is not `Offered`

Use the verified fields:
- `status: "Offered"`
- `is_broadcast: true`
- `broadcast_radius_km: job.broadcastRadiusKm ?? 100`
- `broadcast_note: job.broadcastNote ?? ""`

This makes the mutation fail loudly instead of falsely reporting success.

#### 2) Make the broadcast mutation transactional in behavior

Inside the same hook, if the job-row verification fails after offers were inserted:

- throw a descriptive error like:
  - “Broadcast offers were created, but the job broadcast status could not be saved.”
- do not show the success toast
- let the caller surface a destructive toast instead

This prevents the admin from thinking the toggle worked when it did not.

#### 3) Tighten the Jobs-page success path in `src/pages/admin/JobManagement.tsx`

Keep the current dialog/toggle UX, but adjust the success handling so the page only shows broadcast success after the mutation fully succeeds.

Also improve the failure toast to clarify the mismatch:
- offers may have been created
- but the job was not marked as broadcast
- the toggle will remain Off until the job row is successfully updated

#### 4) Add a defensive refresh after start/stop

After successful start or stop broadcast:
- keep invalidating `["jobs"]` and `["offers"]`
- optionally also close the dialog only after the mutation resolves successfully

This ensures the switch state always reflects fresh backend data.

### Why this is the right fix

- The current code already maps `is_broadcast`, `broadcast_radius_km`, and `broadcast_note` correctly in `dbToJob()`.
- The Jobs page already renders the switch from `job.isBroadcast`.
- The network/data evidence shows the real gap is persistence verification, not display mapping.
- No schema change is required.

### Files to update

- `src/hooks/useOfferData.ts`
  - verify the `jobs` update result inside `useGenerateBroadcastOffers()`
  - throw when the row was not actually updated
- `src/pages/admin/JobManagement.tsx`
  - improve error handling/message around `runBroadcast()`
  - keep dialog/toggle flow tied to actual mutation success

### Acceptance criteria

- Turning Broadcast on from `/admin/jobs` keeps the switch On after refetch.
- The row label changes to `On · Nkm`.
- Refreshing the page still shows the job as broadcast.
- If the job row cannot be updated, the admin sees a failure message and the UI does not pretend the toggle succeeded.
- Stop Broadcast continues to turn the switch Off and persist correctly.

