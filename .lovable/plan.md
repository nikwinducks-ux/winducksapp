# Replace Availability tab with gear icon

## Change
In `src/pages/sp/SPCalendar.tsx`, swap the text label of the "Availability" tab in the Day / Week / Month / Availability switcher for a `Settings` gear icon from `lucide-react`.

## Edits

1. **Add `Settings` to the lucide-react import** (line 8):
   ```ts
   import { ChevronLeft, ChevronRight, ExternalLink, Settings } from "lucide-react";
   ```

2. **Replace the availability `TabsTrigger`** (lines 275–278):
   ```tsx
   <TabsTrigger
     value="availability"
     aria-label="Availability settings"
     title="Availability"
   >
     <Settings className="h-4 w-4" />
   </TabsTrigger>
   ```
   - Removes both text spans ("Avail." / "Availability").
   - Adds `aria-label` for screen readers and `title` for hover tooltip.

## Result
- The fourth tab becomes a compact gear icon on all viewport sizes.
- Click behavior unchanged — selecting it still loads `AvailabilitySettings`.
- No layout, other-tab, or availability-page changes.

## Files
- `src/pages/sp/SPCalendar.tsx` (1 import + ~7 lines in the TabsTrigger)
