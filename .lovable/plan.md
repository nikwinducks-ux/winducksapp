

## Show assigned SP teammates (name + click-to-call phone) wherever a job appears in the SP portal

When two or more SPs are working a job together, each SP needs to see who else is on the crew and tap their phone number to coordinate.

### What you'll see (SP portal)

A new **"Working with"** section appears on every SP-side surface that shows a job, listing the other crew members (excluding "you"):

- **Avatar** (initials) + **name** + "Lead" star if lead
- **Phone number** rendered as a `tel:` link — one tap opens the dialer on mobile
- "—" placeholder if a teammate has no phone on file

Surfaces updated:

1. **`/sp/calendar` job sheet** (the side `Sheet` that opens when you click a job block) — adds a compact "Working with (N)" block above the action buttons.
2. **`/sp/jobs/:id`** (SPJobDetail) — the existing **Crew** card already lists names; add the phone as a clickable `tel:` link beside each member's name and an avatar.
3. **`/my-jobs`** list — when a job has 2+ crew, show a small inline strip of teammate names under the customer/services line (names only, no phone — the row already links to the detail page where phones live).
4. **`/jobs/:id`** (JobOfferDetail, pending offer view) — add a **"Crew on this job"** card below "Services" (mirrors SPJobDetail), so SPs can see who they'd be working with **before** accepting.
5. **`/sp/dashboard`** "Today's Assigned Jobs" list — append a tiny `+N teammates` chip when crew > 1 (no phones here; tap-through to detail).

### Backend / RLS changes (required — currently blocked)

Today, two policies prevent SPs from seeing teammates:

- `job_crew_members.SP select own crew rows` only returns the SP's own row → other crew members are invisible.
- `service_providers.SP select own` only returns the SP's own profile → can't read teammates' name/phone.

Add two new RLS SELECT policies (least-privilege, scoped to "jobs I'm on"):

```sql
-- See all crew rows for any job I'm on
CREATE POLICY "SP select crew for jobs I am on"
ON public.job_crew_members FOR SELECT TO authenticated
USING (
  sp_on_job_crew(get_user_sp_id(auth.uid()), job_id)
  OR EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_crew_members.job_id
      AND j.assigned_sp_id = get_user_sp_id(auth.uid())
  )
);

-- See teammate SP profiles (name, phone, avatar fields) for jobs I'm on
CREATE POLICY "SP select teammates on shared jobs"
ON public.service_providers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM job_crew_members me
    JOIN job_crew_members mate ON mate.job_id = me.job_id
    WHERE me.sp_id = get_user_sp_id(auth.uid())
      AND mate.sp_id = service_providers.id
  )
);
```

These are additive — admin/owner full access and "SP select own" remain. The new `service_providers` policy only exposes SP rows that share at least one crew assignment with the requester. Phone, name, and the existing public-ish profile columns become readable; sensitive admin fields (compliance, fairness, internal notes) are still on the same row but are not surfaced in any SP-portal UI.

### Frontend changes

- **New small component** `src/components/sp/CrewTeammates.tsx` (reused everywhere):
  - Props: `jobId: string`, `excludeSpId?: string`, `variant?: "card" | "inline"`, `showPhone?: boolean`
  - Internally calls existing `useJobCrew(jobId)` + `useServiceProviders()` and renders the list. When `showPhone` is true, the phone is wrapped in `<a href="tel:+1...">` with a `Phone` icon button (uses existing `Button variant="link"` styling).
  - Phone normalized to `tel:` by stripping spaces/dashes/parens.
- **Edits**:
  - `src/pages/sp/SPCalendar.tsx` — render `<CrewTeammates jobId={selectedJob.dbId} excludeSpId={spId} variant="card" showPhone />` inside the job sheet.
  - `src/pages/sp/SPJobDetail.tsx` — replace the existing crew rendering's plain name with `<CrewTeammates ... showPhone />` (keeps the lead star + "you" tag).
  - `src/pages/sp/JobOfferDetail.tsx` — add a "Crew on this job" `metric-card` using `<CrewTeammates jobId={job.dbId} excludeSpId={user.spId} showPhone />`.
  - `src/pages/sp/MyJobs.tsx` — add an inline `<CrewTeammates jobId={job.dbId} excludeSpId={user.spId} variant="inline" />` under the row when `job.crew?.length > 1`.
  - `src/pages/sp/SPDashboard.tsx` — `+N teammates` chip on Today's Assigned Jobs when `job.crew?.length > 1`.

### Files touched

- **New migration** (RLS): two `CREATE POLICY` statements above.
- **New**: `src/components/sp/CrewTeammates.tsx`.
- **Edited**: `src/pages/sp/SPCalendar.tsx`, `src/pages/sp/SPJobDetail.tsx`, `src/pages/sp/JobOfferDetail.tsx`, `src/pages/sp/MyJobs.tsx`, `src/pages/sp/SPDashboard.tsx`.
- **Untouched**: admin pages (admins already see everything), data hooks (`useJobCrew` and `useServiceProviders` are reused as-is — they'll start returning more rows once the new policies are live).

No schema changes, no new tables, no business-logic changes.

