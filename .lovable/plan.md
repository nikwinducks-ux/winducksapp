# Reuse My Jobs Detail in the SP Calendar Side Panel

## Goal

When a job is tapped in the SP Calendar (mobile + desktop), the existing side sheet should open with the **exact same content and styling** as the My Jobs full job detail page (`/sp/jobs/:id`) — same Job Details card, customer, address with Open in Maps, schedule, duration, payout, services, notes, crew, photos, and status update actions.

The current calendar sheet renders a custom simplified summary (single `text-sm` block listing Address/Service/Payout/When/Duration plus a few bespoke action cards). We will replace that body with the My Jobs detail body.

## Approach

Extract the body of `src/pages/sp/SPJobDetail.tsx` into a reusable presentational component, then render it inside the existing `<Sheet>` in `src/pages/sp/SPCalendar.tsx`. The page route continues to use the same component so the two stay perfectly in sync.

### 1. Create `src/components/sp/SPJobDetailContent.tsx`

A new component that renders everything currently between the page header and the bottom of `SPJobDetail` — i.e. the entire detail view minus the page-level chrome (back link, top-level `<h1>` page header, animate-fade-in wrapper, max-width, mobile sticky bottom bar).

Props:

- `job: Job` (or look it up internally via `dbId`)
- `variant?: "page" | "panel"` — controls a few small affordances:
  - `page`: keeps the mobile sticky bottom CTA + bottom spacer (current behavior)
  - `panel`: renders the status-update actions inline at the top of the body (so they're tappable inside the sheet) and omits the fixed bottom bar

What the component renders (identical markup to today's page):

- Header row: `{job.id}` as a heading + `<StatusBadge>` + `<UrgencyBadge>` (sized down slightly in `panel` mode so it fits the sheet header area, or rendered just below the `<SheetHeader>` title)
- "Job Details" `metric-card` with the 2-column grid: Customer, Address (with Open in Maps button via `openInMaps`), Schedule (`<ScheduleDisplay>`), Duration, Payout (with crew share line), Distance (when available, computed via `computeProximityResult`)
- Services `metric-card` using `<JobServicesDisplay services={job.services} categories={allCategories} />`
- Legacy single-service fallback card
- Notes `metric-card`
- Crew `metric-card` with `<CrewTeammates variant="card" showPhone />`
- `<JobPhotosCard jobId={job.dbId} />`
- Status update actions card (`Mark In Progress`, `Mark Completed`) — gated by `isMyJob` and current status, using `useUpdateJobStatus`
- "Job Completed" success banner when applicable

All hooks (`useJobs`, `useServiceProviders`, `useActiveServiceCategories`, `useServiceCategories`, `useUpdateJobStatus`, `useJobCrew`, `useAuth`) move into this component.

### 2. Refactor `src/pages/sp/SPJobDetail.tsx`

Becomes a thin wrapper:

- Reads `id` from the route, finds the job, handles loading / not-found / not-linked states (unchanged)
- Renders the page chrome: `animate-fade-in max-w-3xl`, the "Back to My Jobs" link, then `<SPJobDetailContent job={job} variant="page" />`

No visual change for `/sp/jobs/:id` users.

### 3. Update `src/pages/sp/SPCalendar.tsx` sheet body

In the existing `<Sheet open={!!selectedJob}>` block (lines ~378–515):

- Keep `<Sheet>`, `<SheetContent className="overflow-y-auto">`, and the existing open/close interaction (no animation changes)
- Replace the custom `<SheetHeader>` + the bespoke summary block (the `text-sm space-y-1` div, the inline status/offer cards, the address/service/payout list, the notes block, the contact actions, the crew block, and the "Open full job" link) with:

  ```tsx
  <SPJobDetailContent job={selectedJob} variant="panel" />
  ```

- Preserve the **offer response** affordance (Accept / Decline buttons + "Offer no longer available" / Auto-Accept hint) because that flow is calendar-specific and not present on the My Jobs page. Render it above `<SPJobDetailContent>` inside the sheet so accept/decline still work for pending offers tapped from the calendar.
- Keep an "Open full page" link at the bottom of the sheet (small, secondary) so users can still navigate to the dedicated route if desired.

### 4. AdminCalendar (out of scope)

The user is on the SP portal (current route `/sp/jobs/...`) and the issue specifically references "My Jobs". Admin calendar's sheet has different admin-only controls (assign SP, crew picker, etc.) and is not changed.

## Files to edit

- **New:** `src/components/sp/SPJobDetailContent.tsx` — extracted detail body
- **Edit:** `src/pages/sp/SPJobDetail.tsx` — becomes a thin page wrapper around the new component
- **Edit:** `src/pages/sp/SPCalendar.tsx` — replace sheet body with `<SPJobDetailContent variant="panel" />`, keep offer-response card + sheet open/close behavior

## Acceptance criteria

- Tapping a job in the SP Calendar opens the side sheet with the exact same cards, fields, icons, spacing, and badges as `/sp/jobs/:id`
- Address shows the "Open in Maps" button (currently missing from the calendar sheet)
- Payout is rendered as `$XX.XX` with the primary-colored large number and "your share" line for crews (currently it's a small inline `$payout`)
- Services render via `JobServicesDisplay` with category codes (currently a single `serviceCategory` string)
- Notes, crew teammates, and photos appear with the same `metric-card` styling
- Mark In Progress / Mark Completed actions work from inside the sheet
- For pending offers, Accept / Decline still appear and function
- The sheet still slides in from the right with the same animation; no layout regressions on `/sp/jobs/:id`
