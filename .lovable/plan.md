

## Restructure SP navigation: merge Auto-Accept into Availability, and Availability into Calendar

Consolidate three SP pages into a single tabbed Calendar hub so scheduling, weekly availability, and auto-accept rules live together.

### Final SP sidebar

```text
Dashboard
My Jobs
Calendar          ← now hosts Day | Week | Month | Availability tabs
Job Offers
Auto-Accept       ← REMOVED from sidebar (moved into Availability page body)
Availability      ← REMOVED from sidebar (moved into Calendar as a tab)
Performance
Account
```

### Calendar page (`src/pages/sp/SPCalendar.tsx`)

- Replace the existing `Day | Week | Month` view switcher with a `Tabs` of four values: `day`, `week`, `month`, `availability`.
- For `day` / `week` / `month`: render the existing calendar UI exactly as today (navigation arrows, off-range chips, sheet, unavailable dialog, diagnostics).
- For `availability`: render the existing `<AvailabilitySettings />` page body (weekly hours, capacity, blackout dates, time-off section, **and** the merged auto-accept block — see below). Hide the date-navigation row + diagnostics when this tab is active.
- Keep the page heading "My Calendar"; the subtitle adapts per tab.

### Availability page (`src/pages/sp/AvailabilitySettings.tsx`)

- Keep the existing weekly schedule + time-off editor (`SPAvailabilityEditor`).
- Append the full Auto-Accept settings UI **inline below the availability editor** (toggle, criteria card, allowed categories, fairness override, Save). Reuse the existing logic verbatim by extracting `AutoAcceptSettings` markup into a self-contained section component, or simply rendering `<AutoAcceptSettings />` underneath with its own page header trimmed to a section title ("Auto-Accept").
- Net result: visiting `/availability` shows Availability + Auto-Accept stacked. Since `/availability` is no longer in the sidebar, this page is reached only via the Calendar tab (which mounts the same component).

### Sidebar (`src/components/DashboardLayout.tsx`)

- Remove the `Availability` and `Auto-Accept` entries from `spLinks`. Keep their routes registered in `App.tsx` so deep links and the Calendar tab still work.

### Routes (`src/App.tsx`)

- No changes. `/availability` and `/auto-accept` remain valid routes; the Calendar tab simply renders the Availability+Auto-Accept content in place rather than navigating away.

### Files touched

- `src/pages/sp/SPCalendar.tsx` — extend Tabs with an `Availability` value; render the merged availability/auto-accept content when active; suppress calendar chrome on that tab.
- `src/pages/sp/AvailabilitySettings.tsx` — append Auto-Accept section below the existing availability editor.
- `src/pages/sp/AutoAcceptSettings.tsx` — extract its content into an exportable `AutoAcceptSection` (no page header) consumed by `AvailabilitySettings`; keep default export rendering a wrapper with the page header so the standalone `/auto-accept` route still works.
- `src/components/DashboardLayout.tsx` — remove `Availability` and `Auto-Accept` from `spLinks`.

No backend, schema, or data-fetching changes.

