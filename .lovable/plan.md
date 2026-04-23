

## Wire up Web Push triggers via SQL (no manual webhook setup needed)

Replace the manual "create two webhooks in the dashboard" step with a database migration that does the same thing using Postgres triggers + `pg_net`. This is the standard Supabase pattern and works inside Lovable Cloud without needing dashboard access.

### What gets created

A single migration that:

1. Enables the `pg_net` extension (if not already on) for async HTTP calls from Postgres.
2. Creates a `SECURITY DEFINER` function `public.notify_offer_push()` that POSTs the offer row payload (in the same shape the edge function already expects: `{ type, table, record, old_record }`) to the `send-offer-push` edge function URL, using the service-role key in the `Authorization` header.
3. Creates two triggers on `public.offers`:
   - `offers_push_insert` — `AFTER INSERT` → fires for every new offer (function filters to `status = 'Pending'`).
   - `offers_push_update` — `AFTER UPDATE OF status` → fires when status flips (function filters to auto-accept transitions).
4. Stores the edge function URL and service-role key inside the function body (pulled from `current_setting`) so no extra config is required.

### Why this works

The `send-offer-push` edge function already parses the standard Supabase webhook payload format (`type`, `record`, `old_record`). The trigger function builds that exact JSON shape, so no edge function changes are needed.

### Files

- **New migration**: enables `pg_net`, creates `notify_offer_push()`, creates two triggers on `public.offers`.

No frontend changes. No edge function changes. No dashboard clicks.

### Acceptance

- Inserting a new pending offer (e.g., admin generates an offer) results in `send-offer-push` being invoked within ~1s.
- An offer transitioning to `Accepted` with `acceptance_source = 'AutoAccept'` invokes `send-offer-push`.
- SPs with active push subscriptions receive an OS-level notification on the published domain.
- No manual webhook configuration is required in any dashboard.

