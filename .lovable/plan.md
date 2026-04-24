## Goal

Make it easy for SPs to start/end jobs from the Calendar, and add a dedicated "Past Jobs" page (completed jobs) for both the SP "My Jobs" area and the Admin "Jobs" area.

---

## 1. SP Calendar — Start/End jobs from the calendar

`src/pages/sp/SPCalendar.tsx` already opens a side sheet when an SP taps a job, with "Mark In Progress" and "Mark Completed" buttons. They are functional but cramped. Improvements:

- Promote the action buttons into a clearly labeled **"Update Status"** section at the top of the sheet (above details), so they're the first thing visible.
- Replace the small `size="sm"` buttons with full-width `size="lg"` buttons, mirroring the pattern in `SPJobDetail.tsx`.
- Show a clear **"Start Job"** label (instead of "Mark In Progress") and **"End Job"** label (instead of "Mark Completed") for clarity, but keep underlying status transitions (`Assigned/Accepted → InProgress → Completed`) unchanged.
- After starting a job, keep the sheet open and immediately swap the button to **"End Job"** so the SP can complete in one flow.
- On `Completed`, show a success confirmation block in the sheet and auto-close after 1.5s.
- Toast confirmation on each transition (already wired through `useUpdateJobStatus`).

No backend changes — `enforce_sp_job_update` already allows `Assigned/Accepted → InProgress → Completed` transitions for the assigned SP / crew members.

---

## 2. SP Portal — "Past Jobs" sub-page under My Jobs

Currently `src/pages/sp/MyJobs.tsx` shows both "Active Jobs" and a small "Past Jobs" section on one page. Split this into two tab views:

- Add a tabbed UI at the top of `MyJobs.tsx`: **Active** and **Past**.
  - Active = jobs not in `Completed` / `Cancelled`
  - Past = jobs in `Completed` (and Cancelled, optionally — see open question below; default: only `Completed` per the user request).
- Keep on a single route `/my-jobs` with `?tab=active|past` query param so deep links work.
- Use the existing card layouts (active = full card, past = compact row).
- Add count badges on each tab (e.g., "Active (3)", "Past (12)").
- Empty state per tab.
- Works on both mobile and desktop (Tabs component is already responsive).

No new route is needed; the bottom nav and side nav still link to `/my-jobs`.

---

## 3. Admin Jobs — "Past Jobs" view

`src/pages/admin/JobManagement.tsx` currently filters out `Cancelled` and shows everything else (including completed). Restructure into two tabs at the top of the page:

- **Active Jobs** (default): all statuses **except** `Completed` and `Cancelled`.
- **Past Jobs**: all `Completed` jobs (Cancelled stays excluded to match current behavior).
- Sync via `?tab=active|past` query param.
- Both tabs reuse the same table component, search bar, sort, and existing row actions. The status filter dropdown stays available within each tab (in Past, it effectively only contains Completed).
- Bulk actions that don't make sense for Completed jobs (Broadcast, Assign, Schedule) are hidden in the Past tab; Delete remains.
- Tab labels include counts.

---

## Technical details

**Files edited**
- `src/pages/sp/SPCalendar.tsx` — restructure sheet content; rename actions to Start / End Job; full-width buttons; success state.
- `src/pages/sp/MyJobs.tsx` — wrap content in `<Tabs>` (Active / Past) with URL sync via `useSearchParams`.
- `src/pages/admin/JobManagement.tsx` — add Active/Past tabs above the filter row; partition `filtered` based on tab; hide irrelevant bulk actions in Past tab.

**No new files, no routes, no schema changes.** All status data already lives on `jobs.status`.

**State-machine note**: Status transitions remain governed by `enforce_sp_job_update` (DB trigger). The SP can only move `Assigned/Accepted → InProgress → Completed`. Admin can do anything. No DB migration required.

---

## Open question

Should the SP "Past Jobs" tab include **Cancelled** jobs too, or only **Completed**? Current plan: only Completed (matches user's wording: "All completed jobs"). Cancelled jobs will continue to be hidden from the SP's My Jobs view entirely. Let me know if you want Cancelled there as well.