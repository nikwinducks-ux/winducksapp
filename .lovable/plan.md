

## Fix: Broadcast toggle doesn't persist

### Root cause

When admin flips the **Broadcast** switch from Off → On in `JobManagement.tsx`, the dialog calls `useGenerateBroadcastOffers` which inserts offer rows and sets `jobs.status = 'Offered'` — but it **never sets `jobs.is_broadcast = true`**, nor persists the new `broadcast_radius_km` / `broadcast_note`. So:

- The optimistic UI looks like it flipped (briefly), then the next `["jobs"]` invalidation refetches `is_broadcast = false` from the DB and the switch snaps back to Off.
- Stop Broadcast already works correctly because the `stop_broadcast` RPC explicitly sets `is_broadcast = false`.

A second contributing issue: the broadcast dialog sends a job clone with `broadcastRadiusKm`/`broadcastNote` overrides only into the offer-eligibility math — these admin-entered overrides are never written back to the `jobs` row either.

### Fix

**Edit `src/hooks/useOfferData.ts` — `useGenerateBroadcastOffers`**

In the `mutationFn`, replace the single line:
```
await supabase.from("jobs").update({ status: "Offered" }).eq("id", job.dbId);
```
with an update that also persists the broadcast flags:
```
await supabase.from("jobs").update({
  status: "Offered",
  is_broadcast: true,
  broadcast_radius_km: job.broadcastRadiusKm ?? 100,
  broadcast_note: job.broadcastNote ?? "",
}).eq("id", job.dbId);
```

That single change makes the toggle persist — on next refetch the row comes back with `is_broadcast = true` and the switch stays On with the correct "On · Nkm" label. It also persists the radius/note the admin entered in the dialog so future Stop/Restart flows show the right values.

### Why no other changes are needed

- `dbToJob` already maps `is_broadcast → isBroadcast`, `broadcast_radius_km → broadcastRadiusKm`, `broadcast_note → broadcastNote`.
- `useGenerateBroadcastOffers.onSuccess` already invalidates `["jobs"]` and `["offers"]`.
- `useStopBroadcast` (Off path) is correct — the `stop_broadcast` RPC sets `is_broadcast = false` server-side.
- The Switch component, `openStartBroadcast`, `runBroadcast`, and audit logging all work — they just relied on a backend write that wasn't happening.

### Acceptance

- Flip Off → On, confirm radius dialog → switch stays On with "On · Nkm" label after the table refetches.
- Refresh the page → switch is still On.
- Flip On → Off, confirm → switch goes Off and stays Off.
- SP portal still receives broadcast offers as before (no behavior change there).

### Files

- **Edit** `src/hooks/useOfferData.ts` — extend the `jobs` update inside `useGenerateBroadcastOffers` (one statement).

No DB migration, no other UI edits.

