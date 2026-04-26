# Clean Up SP Mobile Calendar Header

## Changes

### 1. Hide "My Calendar" title + description on mobile
In `src/pages/sp/SPCalendar.tsx`, wrap the header `<div>` containing the `<h1>My Calendar</h1>` and the `<p>` description in a `hidden sm:block` wrapper so it only shows on tablet/desktop. The view tabs (Day / Week / Month / Availability) remain visible on mobile and become the top of the hero section, reclaiming vertical space.

Desktop view is unchanged.

### 2. Remove SP Visibility Diagnostics
Yes — safe to remove. It's a debug-only helper:
- Collapsed by default and dismissible
- Only used in one place (`SPCalendar.tsx`)
- Not referenced by tests, business logic, or other pages
- Has no side effects

Steps:
- Remove the `<SPVisibilityDiagnostics ... />` usage and its import from `src/pages/sp/SPCalendar.tsx`
- Delete the file `src/components/sp/SPVisibilityDiagnostics.tsx`
- Drop the now-unused `status` and `error` destructured fields from the `useJobs()` call

## Files Changed
- `src/pages/sp/SPCalendar.tsx` — hide header on mobile, remove diagnostics usage
- `src/components/sp/SPVisibilityDiagnostics.tsx` — deleted
