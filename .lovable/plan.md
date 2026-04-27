## Goal

Add a sort option on the Admin Jobs page (`/admin/jobs`) so newly created jobs appear at the top.

## Changes

**1. `src/data/mockData.ts`** — add optional `createdAt?: string` to the `Job` interface.

**2. `src/hooks/useSupabaseData.ts`** — in `dbToJob`, map `createdAt: row.created_at ?? undefined`. The `jobs` table already returns `created_at` via `select("*")`, so no query change needed.

**3. `src/pages/admin/JobManagement.tsx`** — extend the existing Sort dropdown:
- Add a new option **"Recently created"** (value `"recent"`).
- Make it the **default** sort so newest jobs appear at top automatically (change initial `sortBy` state from `"default"` to `"recent"`, and rename the existing `"default"` label to keep current ordering accessible if needed — or simply replace it).
- Sort logic: `[...filtered].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))` (descending).

The existing Urgency and Scheduled sort options remain unchanged. Applies to both the Active and Past tabs.

## Out of scope

No DB migration, no changes to SP-side views, no new filter pills — this is purely a sort option addition wired into the existing Sort `<Select>`.
