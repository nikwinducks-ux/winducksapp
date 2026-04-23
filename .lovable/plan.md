

## Add editable "Job Instructions" to the Calendar sheets

The `jobs.notes` column (mapped to `Job.notes` in code) already exists and is editable on the Job Create/Edit form. This change exposes it under a clearer name — **Job Instructions** — and makes it visible in two more places: the Admin Calendar's job sheet (editable) and the SP Calendar's job sheet (read-only).

### Behavior

**1. Job Create/Edit page (`/admin/jobs/new` and `/admin/jobs/:id/edit`)**
- Rename the existing "Notes" section to **"Job Instructions"**.
- Update the placeholder to read: *"Add instructions for the crew — access codes, gate locations, parking, special requirements, etc."*
- No data changes; still saves to `jobs.notes`.

**2. Admin Calendar job sheet (`/admin/calendar`)**
- Add a new collapsible section **"Job Instructions"** between the "Reschedule" and "Crew Assignment" blocks in the existing Sheet.
- Renders a `Textarea` (4 rows) prefilled with the job's current instructions.
- A **Save instructions** button writes the change via `useUpdateJob` (re-using the same `updateJob.mutateAsync(...)` pattern already used by `saveSchedule`/`unschedule`, just passing the new `notes` value while keeping every other field unchanged). Saving stays on the sheet (does not close it) and shows a toast.
- If empty, displays a muted hint: *"No instructions yet — add any access notes, gate codes, or special requirements."*

**3. SP Calendar job sheet (`/sp/calendar`)**
- Add a read-only **"Job Instructions"** section in the existing Sheet, between the job summary block and the action buttons.
- Renders the instructions text in a bordered, soft-bg panel with `whitespace-pre-wrap` so multi-line instructions render correctly.
- If empty, the section is hidden entirely (don't show an empty box to SPs).
- For pending offers, the same panel is shown so SPs can read instructions before accepting.

**4. Wherever the Job Detail page already shows notes**, no change — that surface continues to work and reads the same field.

### Technical design

- **No DB changes.** `jobs.notes` already exists, is included in `dbToJob` as `notes`, and is passed through `useUpdateJob`.
- **No new hooks.** The Admin Calendar sheet's save reuses `updateJob.mutateAsync` with the existing payload shape (the same call already happens in `saveSchedule()` — we'll factor a small local `saveInstructions()` that mirrors `saveSchedule()` but with `scheduledDate`/`scheduledTime` left as the job's current values and `notes` set from local state).
- **Local state in `AdminCalendar.tsx`**: add `editInstructions: string` alongside `editDate` / `editTime`, seeded in `openJob()` from `job.notes ?? ""`.
- **Local state in `SPCalendar.tsx`**: none needed — read directly from `selectedJob.notes`.
- **Files touched**:
  - `src/pages/admin/JobForm.tsx` — rename section heading + update placeholder copy.
  - `src/pages/admin/AdminCalendar.tsx` — new state, new sheet section with `Textarea` + Save button, new `saveInstructions()` function.
  - `src/pages/sp/SPCalendar.tsx` — new read-only instructions panel inside the existing `Sheet`.

### Acceptance

- Admin can write/edit instructions on the Create/Edit Job page (now labeled "Job Instructions") and they persist.
- Admin can open any job from the calendar, edit instructions in the sheet, click **Save instructions**, see a toast, and the new text persists after closing/reopening.
- SPs assigned to a job see the same instructions text (read-only, multi-line preserved) when they open the job from their SP Calendar sheet.
- SPs viewing a pending offer from their calendar also see the instructions before accepting.
- Jobs without instructions show no panel on the SP side, and a friendly empty-state hint on the admin side.

