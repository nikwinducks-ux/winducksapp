

## Calendar Pages for Admin & SP

Two new calendar pages — one for admins, one for SPs — to schedule, view, and manage **Scheduled** jobs (urgency = "Scheduled" with a `scheduled_date`). Day / Week / Month views, drag-friendly job blocks, and inline accept/reject/progress actions for SPs.

### Scope

- Only jobs where `urgency = 'Scheduled'` AND `scheduled_date IS NOT NULL` appear.
- ASAP / Anytime soon jobs are excluded (they have no calendar slot by design).
- Admin sees all scheduled jobs across all SPs (and unassigned).
- SP sees only their own offered + assigned scheduled jobs.

---

### 1. Admin Calendar — `/admin/calendar`

**File:** `src/pages/admin/AdminCalendar.tsx` (new)
**Sidebar:** add entry in `DashboardLayout.tsx` admin links (icon `CalendarDays`, label "Calendar", between Jobs and Service Categories).
**Route:** add to `App.tsx` admin routes.

**Features:**
- View toggle: **Day / Week / Month** (Tabs), default = Week.
- Date navigator: ◀ Today ▶ + visible date range label.
- SP filter dropdown (All SPs / specific SP / Unassigned).
- Status filter chips: Pending Acceptance, Accepted, In Progress, Completed.
- Each job block shows:
  - Job number (e.g. JOB-1024)
  - Customer name
  - Service category summary
  - **Payout amount** (`$XXX`)
  - **Status badge** (Pending / Accepted / In Progress / Completed)
  - Assigned SP name (or "Unassigned")
- **Visual states (per request):**
  - `Offered` (waiting SP acceptance) → 50% opacity, dashed border, theme primary tint
  - `Assigned` / `Accepted` → solid theme primary
  - `InProgress` → solid theme accent (orange)
  - `Completed` → solid muted green
  - `Cancelled` → struck-through, muted
- Click a job block → opens a side sheet (existing `Sheet` component) with full job details + quick actions:
  - **Schedule / Reschedule**: date + time pickers (15-min increments) → updates `scheduled_date`, `scheduled_time`.
  - **Unschedule**: clears `scheduled_date` and `scheduled_time` (job remains, just leaves the calendar).
  - **Reassign SP**: select dropdown → updates `assigned_sp_id`.
  - Link "Open full job" → `/admin/jobs/:id`.
- Empty day cells include a "+ Schedule job" affordance that opens a picker of unscheduled jobs.

**Day view:** 24h hour rail (or 6am–10pm condensed), jobs positioned by `scheduled_time`, height by `estimated_duration` minutes.
**Week view:** 7 columns (Sun–Sat or Mon–Sun depending on locale; default Mon–Sun), same hour rail.
**Month view:** classic 6-row grid; each cell shows up to 3 job pills + "+N more" overflow.

---

### 2. SP Calendar — `/calendar`

**File:** `src/pages/sp/SPCalendar.tsx` (new)
**Sidebar:** add entry in `DashboardLayout.tsx` sp links (icon `CalendarDays`, label "Calendar", between My Jobs and Job Offers).
**Route:** add to `App.tsx` SP routes.

**Features:**
- Same Day / Week / Month toggle and navigation.
- Read-only schedule (SPs cannot move jobs; only admins reschedule).
- Shows the SP's own scheduled jobs from two sources:
  - Pending offers (status `Offered`, a Pending offer to this SP) → **transparent / dashed**.
  - Assigned/Accepted/InProgress/Completed jobs (`assigned_sp_id = me`) → **solid theme color**.
- Job block shows: time, customer name, service summary, payout, status badge.
- Click block → side sheet with details + actions based on status:
  - **Offered (pending acceptance)** → `Accept` (calls `accept_offer` RPC) and `Reject` (calls `decline_offer` RPC). On reject the job disappears from the SP's calendar.
  - **Assigned / Accepted** → `Mark In Progress` button (existing `useUpdateJobStatus`).
  - **InProgress** → `Mark Completed` button.
  - **Completed / Cancelled** → read-only.
- Link "Open full job" → `/sp/jobs/:id`.

---

### 3. Shared calendar component

**File:** `src/components/calendar/JobCalendar.tsx` (new)

A reusable view-aware component receiving:
- `jobs: Job[]` (already filtered to `Scheduled` + has `scheduled_date`)
- `view: "day" | "week" | "month"`
- `currentDate: Date`
- `onJobClick: (job) => void`
- `mode: "admin" | "sp"` (controls click affordances)
- `getJobAppearance: (job) => { variant, opacity, dashed }` — keeps theme rules in one place.

Renders the appropriate sub-grid (`DayGrid`, `WeekGrid`, `MonthGrid`) — internal helpers in the same file. No external calendar library needed; built with Tailwind + grid utilities to match the existing clean-SaaS aesthetic.

**File:** `src/components/calendar/JobBlock.tsx` (new)
Renders the colored block with payout, customer, status, SP name. Applies opacity + dashed border for `Offered`, solid theme color for accepted states. Uses existing `StatusBadge` and theme tokens (`primary`, `accent`, semantic green for `Completed`).

---

### 4. Data wiring

Reuses existing hooks — no schema or RPC changes needed:
- `useJobs()` — already returns scheduled fields and joined services.
- `useServiceProviders()` — for SP filter and SP-name lookup.
- `useOffers()` (already exists in `useOfferData.ts`) — to identify SP's pending offers for the calendar.
- `useUpdateJob()` — admin reschedule / unschedule (sets `scheduled_date`, `scheduled_time`, or nulls them).
- `useAssignJob()` — admin reassign SP.
- `accept_offer` / `decline_offer` RPCs — SP accept/reject.
- `useUpdateJobStatus()` — SP InProgress / Completed transitions.

The existing `enforce_sp_job_update` trigger already permits the SP `Assigned → InProgress → Completed` transitions and gives admin/owner full control, so reschedule writes from admins will pass.

Filtering rule applied in both pages:
```
job.urgency === "Scheduled" && job.scheduledDate
```

---

### 5. Files touched

**New**
- `src/pages/admin/AdminCalendar.tsx`
- `src/pages/sp/SPCalendar.tsx`
- `src/components/calendar/JobCalendar.tsx`
- `src/components/calendar/JobBlock.tsx`

**Edited**
- `src/App.tsx` — add `/admin/calendar` (admin) and `/calendar` (sp) routes.
- `src/components/DashboardLayout.tsx` — add Calendar nav entry to both `adminLinks` and `spLinks`.

No DB migration. No new dependencies (uses `date-fns` already in project + Tailwind grid).

---

### Acceptance

- Admin opens `/admin/calendar`, sees all scheduled jobs across Day/Week/Month, can filter by SP and status, can click a job to reschedule/unschedule/reassign, and changes persist.
- Each job block on the admin calendar shows payout, status badge, and customer.
- Pending-acceptance jobs render visibly more transparent (dashed/50% opacity); accepted+ jobs render solid in the theme primary.
- SP opens `/calendar`, sees only their own scheduled jobs and pending offers; can accept/reject offers inline (rejected jobs disappear); can move accepted jobs to In Progress and then Completed.
- Only `Scheduled` urgency jobs with a date appear; ASAP and Anytime-soon jobs do not show.

