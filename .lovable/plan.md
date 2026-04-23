

## Automated SP scoring via post-job customer reviews

When a job is marked **Completed**, email the customer a short rating form. Their responses feed a rolling calculation that updates the SP's `rating`, `on_time_rate`, `reliability_score`, and `completion_rate` automatically — replacing today's static seeded values with real data.

### Recommended approach

A 3-question review (matches your existing scoring factors), one email per completed job, public token-based form (no customer login), and a database trigger that recomputes SP metrics whenever a new review lands.

### What gets built

**1. New table: `job_reviews`**
- `id`, `job_id`, `sp_id`, `customer_id`, `review_token` (unique, used in email link), `submitted_at`
- Three 1–5 star scores: `on_time_score`, `quality_score`, `communication_score`
- `overall_rating` (computed average of the three), optional `comment` (text)
- One review per job (`UNIQUE(job_id)`)
- RLS: admins read all; public can read/update only the row matching their token (via SECURITY DEFINER RPCs `get_review_by_token` and `submit_review`)

**2. Trigger on `jobs`: when status flips to `Completed`**
- Inserts a `job_reviews` row with a fresh token (status `pending`)
- Calls `pg_net` to invoke a new edge function `send-review-request-email` (same pattern as `notify_offer_push`)

**3. New edge function: `send-review-request-email`**
- Uses Lovable's built-in email infrastructure (no third-party signup needed)
- Sends the customer a branded email with a link: `https://winducksapp.lovable.app/review/{token}`
- Subject: "How did {SP name} do? — {Job #}"

**4. New public page: `/review/:token`**
- No auth required — token is the credential
- Three star-rating inputs (On-time arrival, Quality of work, Communication), optional comment
- Submits via `submit_review` RPC; shows a thank-you state on success
- Handles already-submitted / invalid token gracefully

**5. Trigger on `job_reviews`: recompute SP scores on insert**
- Pulls the SP's last 30 completed-and-reviewed jobs and updates `service_providers`:
  - `rating` = avg(`overall_rating`)
  - `on_time_rate` = avg(`on_time_score`) × 20 (1–5 → 0–100)
  - `reliability_score` = weighted blend: 50% on-time + 30% quality + 20% communication, scaled to 0–100
  - `completion_rate` = % of assigned jobs in window that ended in `Completed` (not `Cancelled`)

**6. Admin visibility**
- New "Reviews" tab on the SP detail page (`/admin/providers/:id`) listing recent reviews with stars + comments
- Small "Review pending" / "Reviewed ⭐4.8" badge on the admin Job Detail page
- New `MetricCard` on the Admin Dashboard: "Avg customer rating (30d)"

### Email setup

Lovable's built-in email system needs a verified sender domain before the first email can be sent. The setup is a one-time, guided flow — after that, all review emails send automatically with no further action.

### Why this design

- **Matches your existing factors**: the three review questions map directly to `on_time_rate`, `rating` (quality), and the reliability formula already used by the allocation engine
- **No customer accounts needed**: token links keep friction near zero, which is critical for response rate
- **Self-healing scores**: any new review immediately recomputes the SP's metrics — no cron job, no manual admin action
- **Extends, doesn't replace**: `cancellation_rate`, `acceptance_rate`, and `avg_response_time` continue to come from offer/job-status events as they do today

### Acceptance

- Marking a job Completed sends a review email to that job's customer within ~30s
- Customer opens the link, submits 3 stars + optional comment, sees a thank-you page
- The SP's `rating`, `on_time_rate`, and `reliability_score` on `/admin/providers/:id` update within a second of submission
- Admins can see all reviews (with comments) on the SP's new Reviews tab
- A second submission attempt with the same token shows "already submitted"
- Jobs without a customer email are skipped silently (no broken sends)

### Open question before building

Should the review email be sent **immediately** when status flips to Completed, or **delayed by a few hours** (so the customer has time to inspect the work)? Common choice is 2–4 hours later via a scheduled job; immediate is simpler. Let me know your preference and I'll build accordingly.

