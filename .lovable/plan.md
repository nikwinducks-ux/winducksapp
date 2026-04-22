

## Push notifications when an SP gets a new offer or auto-accept fires

Two complementary layers so SPs are notified whether or not the app is open.

### Layer 1 — In-app real-time notifications (works immediately, no install)

Trigger when:
- A new `offers` row appears for the signed-in SP (`status = 'Pending'`).
- One of their offers flips to `status = 'Accepted'` with `acceptance_source = 'AutoAccept'`.

How:
- Subscribe to Supabase Realtime on `public.offers` filtered by `sp_id = me`, mounted globally inside `DashboardLayout` (so it runs on every SP page).
- On each event, show a `sonner` toast with job summary + "View" button that routes to `/jobs/:id?offer=:offerId` (offer) or `/jobs/:id` (auto-accept).
- Play a short notification sound (small base64 chime, no asset).
- Invalidate `["offers"]` and `["jobs"]` React Query caches so badges/lists update instantly.

Requires: enabling realtime on `public.offers` (`ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;`) and `REPLICA IDENTITY FULL` so the filter on `sp_id` works on UPDATE payloads.

### Layer 2 — Browser Push Notifications (works when the app is closed)

Standards-based Web Push using the browser's Push API + a service worker. Works on desktop Chrome/Edge/Firefox and iOS 16.4+ / Android Chrome (after the user "Adds to Home Screen" on iOS).

**Frontend**
- New file `public/sw.js` — minimal service worker that handles `push` events and shows a `Notification` with a deep link.
- New file `src/lib/push.ts` — helpers: `registerServiceWorker()`, `subscribeToPush()`, `unsubscribeFromPush()`, base64 VAPID conversion.
- New component `src/components/NotificationsBanner.tsx` — small in-app prompt on the SP dashboard / Job Offers page asking permission, with Enable / Not now. Stores subscription via the edge function below.
- New row in SP Account page: "Push notifications" toggle (uses the same helpers).
- Service worker NOT registered in Lovable preview/iframe (per project rules) — guarded by hostname check, so the prompt only appears on the published domain.

**Backend (Supabase)**
- New table `push_subscriptions` (one row per device per SP):
  - `id uuid pk`, `user_id uuid`, `sp_id uuid`, `endpoint text unique`, `p256dh text`, `auth text`, `user_agent text`, `created_at`, `last_used_at`.
  - RLS: SP can insert/select/delete only their own rows; admin/owner full access.
- New edge function `save-push-subscription` (verify_jwt = true) — upserts a subscription for the authenticated SP.
- New edge function `delete-push-subscription` (verify_jwt = true) — removes by endpoint.
- New edge function `send-offer-push` (verify_jwt = false) — triggered by Supabase Database Webhooks on `public.offers`:
  - On INSERT where `status = 'Pending'` → notify the offered SP ("New job offer").
  - On UPDATE where `status` changed to `Accepted` AND `acceptance_source = 'AutoAccept'` → notify the same SP ("Auto-accepted job").
  - Looks up all `push_subscriptions` for that `sp_id`, signs a VAPID JWT, POSTs the encrypted payload to each `endpoint` using Web Push protocol (Deno-compatible — uses `jose` for VAPID JWT and standard Web Crypto for AES-GCM encryption, no Node-only libraries).
  - Cleans up subscriptions that return 404/410 (expired).
- Two webhooks (configured in Supabase dashboard via SQL or UI) calling `send-offer-push`:
  - `INSERT` on `public.offers`
  - `UPDATE` on `public.offers`

**Secrets needed**
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (I'll generate the pair and ask the user to add them as secrets; the public key is also exposed to the frontend as a `VITE_` env var).
- `VAPID_SUBJECT` (e.g. `mailto:owner@winducks.com`).

### Files

**New**
- `public/sw.js`
- `src/lib/push.ts`
- `src/components/NotificationsBanner.tsx`
- `src/hooks/useOfferRealtime.ts` (Layer 1 subscription hook)
- `supabase/functions/save-push-subscription/index.ts`
- `supabase/functions/delete-push-subscription/index.ts`
- `supabase/functions/send-offer-push/index.ts`

**Edited**
- `src/components/DashboardLayout.tsx` — mount `useOfferRealtime` and the banner for SP role.
- `src/pages/sp/AccountPage.tsx` — add push toggle row.
- `supabase/config.toml` — add the three new function blocks.

**Migration**
- Create `push_subscriptions` table + RLS.
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;` + `ALTER TABLE public.offers REPLICA IDENTITY FULL;`

### Important caveats (please confirm)

1. **iOS browsers** require the SP to add the site to Home Screen first; otherwise web push is unavailable. Desktop and Android work with just permission grant.
2. For **true native push** (works without opening the browser, App Store distribution), the app would need to be wrapped with **Capacitor** and use FCM/APNs — that's a much bigger change. The plan above does *not* include Capacitor; let me know if you want that route instead.
3. Layer 1 (in-app realtime toasts) works everywhere and ships with the same change — even if a user never grants push permission, they'll still see live toasts whenever the app is open.

### Acceptance

- When admin generates an offer, the targeted SP sees an in-app toast within ~1s if any tab is open.
- If the SP previously enabled push, they receive an OS notification (with deep link) even when the tab is closed.
- When auto-accept fires for an SP, that SP receives both an in-app toast and a push notification labeled "Auto-accepted".
- Tapping the notification opens `/jobs/:id` with the offer drawer open.
- Disabling push from the Account page removes the subscription server-side; no further pushes arrive on that device.

