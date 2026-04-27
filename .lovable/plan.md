## Diagnosis

I traced JOB-1038 in the database. The root cause isn't the weights — it's missing coordinates and a soft fallback rule that lets distant SPs slip through.

**What I found:**
- **JOB-1038**: Edmonton, AB · `job_lat = NULL`, `job_lng = NULL`
- **SP A**: Edmonton · `base_lat = NULL`, `base_lng = NULL`, radius 30 km
- **Robert Kim** (assigned, AutoAccept): Calgary · has coords, radius 45 km
- Offers were sent to 3 **Calgary** SPs (Robert Kim, Sarah Chen, Mike Thompson). **SP A was never offered the job.**

**Why SP A lost despite being in the same city:**

1. The Edmonton address has no lat/lng — `coord-autofill.ts` only knows Calgary metro cities (Calgary/Cochrane/Airdrie/Okotoks/Chestermere). Edmonton was never geocoded.
2. In `src/lib/allocation-engine.ts` the proximity helper returns `{distKm: null, score: 50, source: "fallback"}` whenever either side is missing coords.
3. The eligibility check (lines 255–262) only enforces the radius cap **when `distKm !== null`** — so with null distance, **every SP nationwide becomes "eligible"**, and proximity contributes a flat 50 to everyone.
4. With proximity neutralized, ranking falls to rating/reliability/job-history etc. SP A loses to high-rated Calgary SPs and never makes the Top-N. Robert Kim then auto-accepts.

So "SPs within job radius should override all other weights" can't even be evaluated today because the system has no idea where the job is.

## Fix Plan

### 1. Geocoding fallback (so distance can actually be computed)

- **Expand `src/lib/coord-autofill.ts`** with major AB cities at minimum: Edmonton, Red Deer, Lethbridge, Medicine Hat, St. Albert, Sherwood Park, Fort McMurray, Grande Prairie. (Same preset+jitter pattern.)
- **Auto-fill missing coords on Job save and SP save** in `src/pages/admin/JobForm.tsx` and `src/pages/admin/SPForm.tsx` if lat/lng are blank but city is recognised. (Pattern already exists — extend it.)
- **One-time backfill migration**: update existing `jobs.job_lat/lng` and `service_providers.base_lat/lng` rows where coords are NULL but the city matches a known preset. (Data update via insert tool, not schema migration.)

### 2. Make "within radius" a true hard override

In `src/lib/allocation-engine.ts → checkEligibility`:

- When `distKm === null` AND both job + SP have a city, fall back to a **same-city** check. If cities don't match (and postal-prefix doesn't match), exclude the SP. This mirrors what `sp_eligible_for_broadcast_job` already does in SQL but only applies it to the broadcast path.
- When `distKm === null` and there is no city to compare, **mark SP as Excluded with reason "Unknown distance"** rather than silently treating everyone as eligible.

In `src/lib/proximity.ts`:

- When falling back, give same-city pairs a high proximity score (e.g. 80) and different-city pairs 0, instead of a flat 50 for everyone. Document this in `PROXIMITY_TOOLTIP`.

### 3. Strong proximity preference among eligible SPs

The user's intent: "SPs within job radius should override other weights." Rather than rebalancing every weight slider, add a **proximity-first tie-break** in `runAllocation`:

- Among eligible candidates, sort by `distKm` ascending **first**, then by `finalScore` descending. SPs with NULL distance go last.
- This guarantees the closest in-radius SP always wins, while still using the weighted score to break ties between equidistant candidates.

(Alternative considered: bumping the proximity weight in the active policy. Rejected because it's a soft preference — a far-away SP with a great rating could still win. The tie-break rule is deterministic.)

### 4. Admin Job form warning

In `src/pages/admin/JobForm.tsx`, if the saved job has no coordinates after autofill, show a yellow warning banner: *"This job has no coordinates — allocation will fall back to city matching, which is less accurate."* Lets admins fix it before broadcasting.

## Files touched

- `src/lib/coord-autofill.ts` — add Alberta cities
- `src/lib/proximity.ts` — smarter fallback scoring
- `src/lib/allocation-engine.ts` — hard same-city eligibility + proximity-first sort
- `src/pages/admin/JobForm.tsx` — autofill on save + missing-coords banner
- `src/pages/admin/SPForm.tsx` — autofill on save
- One data backfill (insert tool) for existing NULL-coord rows
- Re-run allocation for JOB-1038 is **not** automatic — the user can re-broadcast after the fix to see SP A surface

## Out of scope

- Real geocoding API integration (Mapbox/Google) — keeping the city-preset approach consistent with the existing prototype pattern.
- Changing weight sliders or the policy schema.
- Modifying the SQL `sp_eligible_for_broadcast_job` function — it already has a city-match fallback; the gap is purely on the client-side allocation engine.
