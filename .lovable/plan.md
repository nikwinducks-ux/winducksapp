

## Polish the customer review page with job context + validation

The `/review/:token` page already exists and works (loads via `get_review_by_token`, submits via `submit_review`, blocks resubmission). Today it shows only the SP name and job number — customers don't see what work was done, when, or where. This update enriches that page with job details and tightens the validation feedback before submit.

### What changes

**1. Backend — extend `get_review_by_token` RPC**

Return more job context so the page can render details without a second round-trip:
- `service_summary` — comma-joined list of `job_services.service_category` (or fallback to `jobs.service_category`)
- `scheduled_date`, `scheduled_time`
- `job_address_city`, `job_address_region`
- `customer_name`
- `completed_at`

No schema change. Pure RPC update; the function is already SECURITY DEFINER and token-gated, so no new RLS surface.

**2. Frontend — `src/pages/ReviewSubmit.tsx`**

Restructure the "ready" state into three sections:

- **Header**: "Rate your experience with {spName}"
- **Job summary card** (new): job number, service list, completed date, location (city, region), greeting line ("Hi {customerName},")
- **Rating form**: the existing 3 star inputs + comment, unchanged in behavior but with clearer per-question helper text:
  - On-time arrival — "Did they arrive when expected?"
  - Quality of work — "Were you happy with the result?"
  - Communication — "Were they clear and responsive?"
- **Inline validation**:
  - Show a small red helper under any unrated question once the user clicks Submit (e.g., "Please rate this")
  - Comment max 1000 chars with a live counter; submit disabled if over
  - Submit button stays disabled until all three stars are set (existing behavior preserved)
  - On submit failure, show the error inline above the button instead of replacing the whole page

**3. Types**

Update the local `LoadState["ready"]` shape and the `submit_review` / `get_review_by_token` result types in the page to include the new fields. No edits to `src/integrations/supabase/types.ts` (auto-generated).

### Files touched

- `supabase/migrations/<new>.sql` — replace `get_review_by_token` with the enriched version
- `src/pages/ReviewSubmit.tsx` — new layout, validation, inline error handling

### Acceptance

- Opening a valid review link shows the SP name, job number, services performed, scheduled date/time, city, and a personalized greeting before the rating form
- Clicking Submit without rating all three categories shows red helper text under each missing question and keeps the form mounted
- Comment field shows "{n}/1000" counter; submit is disabled if exceeded
- Submission errors (e.g., already-submitted, network) appear inline; the form is not replaced by a full-page error
- Successful submission still shows the existing thank-you state
- Already-submitted and invalid-token cases continue to render their existing dedicated states unchanged

