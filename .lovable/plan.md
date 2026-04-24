

## Merge four allocation pages into one tabbed Allocation page

Combine **Allocation Control**, **Fairness Controls**, **Simulation**, and **Allocation QA** into a single page at `/admin/allocation` with four tabs. The existing page components are reused as-is — only the wrapper, route, and sidebar change.

### What you'll see

- One sidebar entry: **Allocation** (replaces the four separate entries).
- Page at `/admin/allocation` shows a tab bar:
  1. **Control** — scoring weights & policy versions (current `AllocationControl`)
  2. **Fairness** — rolling window, share caps, etc. (current `FairnessControls`)
  3. **Simulation** — quick "what-if" scoring (current `SimulationTool`)
  4. **QA** — full allocation run + offer monitor + policy diff (current `AllocationQA`)
- Active tab is reflected in the URL via `?tab=control|fairness|simulation|qa` so links and refreshes preserve the tab.
- Old URLs (`/admin/fairness`, `/admin/simulation`, `/admin/qa`) redirect to the new page with the matching tab.

### Implementation

**New file** `src/pages/admin/AllocationHub.tsx`:
- Renders a page header "Allocation" + shadcn `Tabs` with the four tab triggers.
- Reads/writes `tab` query param via `useSearchParams` (default `control`).
- Each `TabsContent` renders the existing page component unchanged: `<AllocationControl />`, `<FairnessControls />`, `<SimulationTool />`, `<AllocationQA />`. Their internal `<h1 className="page-header">` is kept (acts as a section header under the tab).

**`src/App.tsx`**:
- Replace the four separate routes with a single `/admin/allocation` → `AllocationHub`.
- Add redirect routes for `/admin/fairness` → `/admin/allocation?tab=fairness`, `/admin/simulation` → `?tab=simulation`, `/admin/qa` → `?tab=qa` (using `<Navigate replace>`).
- Drop the now-unused imports? Keep them — they're still rendered inside `AllocationHub`.

**`src/components/DashboardLayout.tsx`**:
- Remove the four entries (`/admin/allocation` Control, `/admin/fairness`, `/admin/simulation`, `/admin/qa`).
- Add one entry: `{ to: "/admin/allocation", icon: Sliders, label: "Allocation" }`.

### Files touched

- **New**: `src/pages/admin/AllocationHub.tsx`
- **Edited**: `src/App.tsx` (routes + redirects), `src/components/DashboardLayout.tsx` (sidebar)
- **Untouched**: `AllocationControl.tsx`, `FairnessControls.tsx`, `SimulationTool.tsx`, `AllocationQA.tsx` (reused as tab bodies)

No schema, hook, or business-logic changes.

