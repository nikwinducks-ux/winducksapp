

## Extend crew assignment to Job Form and Calendar

The crew model already exists on the Job Detail page. This plan extends the same multi-SP assignment to two more entry points: the **Create/Edit Job** form and the **Calendar job sheet** (admin calendar's side panel).

### Behavior

**1. Job Create/Edit page (`/admin/jobs/new`, `/admin/jobs/:id/edit`)**
- New "Crew Assignment" section appears below the Customer/Payout block, above Location.
- Multi-select checklist of active SPs (name + city + radius), with a star to mark the Lead. Same UI pattern as Job Detail.
- Live helper line shows the equal-split payout: "Each SP will be paid $X.XX (= $payout ÷ N)".
- **On Create**: after the job row is inserted, the selected SP ids are written to `job_crew_members` (lead first). The existing `sync_job_lead_on_crew_change` trigger sets `assigned_sp_id` and flips status to `Assigned`.
- **On Edit**: shows the current crew pre-selected. Saving diffs the selection: inserts new members, deletes removed ones, and updates `is_lead` if the lead changed. Edits are blocked when the job is `Completed` / `Cancelled` (matches Job Detail rule).
- If the admin clears the selection on edit, the job reverts to `Created` (trigger handles it).
- Existing pending offers are cancelled when crew is set from the form (mirrors current direct-assign behavior on Job Detail).

**2. Admin Calendar job sheet (`/admin/calendar`)**
- The "Reassign" select in `AdminCalendar.tsx`'s side `Sheet` becomes a multi-select checklist with a Lead star — identical to the Job Detail picker, scaled to fit the sheet width.
- A small "Crew (n)" pill appears next to the status badge in the sheet header when the job has 2+ members.
- A new "Per-SP payout" helper line appears under the picker showing the live split.
- "Save assignment" applies the diff via the same `useAssignCrew` flow used by Job Detail and Job Form.
- "Unschedule" and "Save schedule" are unchanged.

**3. Consistency**
- All three entry points (Job Detail, Job Form, Calendar sheet) use the same shared `<CrewPicker />` component so behavior, validation, and the "$/SP" helper stay identical.

### Technical design

**New shared component**
- `src/components/admin/CrewPicker.tsx` — controlled component:
  - Props: `providers: ServiceProvider[]`, `value: { spId: string; isLead: boolean }[]`, `onChange(next)`, `payout: number`, `disabled?: boolean`.
  - Renders a scrollable checklist with name, city, radius, a `★` lead toggle (auto-promotes first selected if no lead), and the live "$X.XX per SP" helper.
  - Extracted from the inline picker currently in `JobDetail.tsx` so all three pages share one source of truth.

**New hook**
- `useAssignCrew()` in `src/hooks/useSupabaseData.ts`:
  - Input: `{ jobId, members: { spId; isLead }[], userId }`.
  - Reads existing `job_crew_members` for the job, computes insert/delete/lead-update diff, applies in a single batch.
  - Cancels pending offers when first members are added (matches existing Job Detail logic).
  - Invalidates `["jobs"]` and `["job_crew", jobId]`.
- `JobDetail.tsx` is refactored to call `useAssignCrew` instead of the current per-row mutations (one save, one cache invalidation).

**Job Form changes (`src/pages/admin/JobForm.tsx`)**
- New form state: `crewMembers: { spId; isLead }[]`.
- On edit-load: prefill from `useJobCrew(id)`.
- After insert/update of the job row, call `useAssignCrew({ jobId, members: crewMembers, userId })`.
- Render `<CrewPicker />` in a new section.

**Calendar sheet changes (`src/pages/admin/AdminCalendar.tsx`)**
- Replace the single-SP `<Select>` reassign control with `<CrewPicker />` driven by local `sheetCrew` state, prefilled from `selectedJob.crew`.
- "Save assignment" → `useAssignCrew(...)`.
- Add the "Crew (n)" pill in the `SheetHeader`.

**Files touched**
- New: `src/components/admin/CrewPicker.tsx`.
- `src/hooks/useSupabaseData.ts` — add `useAssignCrew`.
- `src/pages/admin/JobForm.tsx` — add crew picker + save flow.
- `src/pages/admin/JobDetail.tsx` — swap inline picker for shared component, route saves through `useAssignCrew`.
- `src/pages/admin/AdminCalendar.tsx` — swap reassign control for `CrewPicker`, add crew pill.

No DB schema changes — `job_crew_members`, `sync_job_lead_on_crew_change`, RLS, and `accept_offer` are already in place from the prior crew rollout.

### Acceptance

- Admin can pick 2+ SPs while creating a brand-new job; on save, the job is `Assigned`, all selected SPs appear in the Crew card, and each sees it on My Jobs / their calendar with the equal split.
- Editing an existing job lets the admin add/remove crew members and re-assign Lead from the Job Form; the changes persist and reflect on Job Detail without a refresh.
- From the admin calendar, opening a job's sheet lets the admin reassign multiple SPs in one action; the calendar block updates color (lead's color) and shows the `+N` chip.
- Clearing the crew on edit reverts the job to `Created` and removes it from every SP's My Jobs.
- Single-SP assignment still works exactly as today through any of the three entry points.

