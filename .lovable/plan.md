

## Mobile (PWA) version — install to home screen, optimized for SPs and Admins

You picked an **installable web app (PWA)** for **both SPs and admins**, prioritizing SP Calendar/Availability, SP My Jobs (status + photos), and Admin Jobs/dispatch/activity log. Push notifications, GPS, and camera were chosen — these *can* work in a PWA but with caveats (see "Native feature notes" below).

### 1. PWA infrastructure

- Add `vite-plugin-pwa` to `vite.config.ts` with `registerType: "autoUpdate"`, `devOptions: { enabled: false }`, and `navigateFallbackDenylist: [/^\/~oauth/, /^\/api/]`.
- Iframe/preview-host guard in `src/main.tsx`: unregister any service worker when running inside the Lovable preview iframe so it never breaks the editor.
- Web manifest (`name: "Winducks"`, `short_name: "Winducks"`, `display: "standalone"`, `theme_color: #0A84E0`, `background_color: #ffffff`, scope `/`, start_url `/`).
- Generate PWA icons in `public/icons/` (192, 512, maskable) from the existing `winducks-iconw.png`.
- Add iOS meta tags to `index.html` (`apple-mobile-web-app-capable`, `apple-touch-icon`, status bar style, viewport-fit=cover for safe areas).
- New `/install` page with platform-specific install instructions (Android = native prompt via `beforeinstallprompt`; iOS = Share → Add to Home Screen guide). Surface an "Install app" link in the sidebar footer.

### 2. Responsive shell

- `DashboardLayout`: convert the always-visible sidebar to a slide-in drawer on `<lg`. Add a top app bar (logo, title, hamburger, History button for admins, profile menu) visible only on mobile.
- Add a **bottom tab bar** on mobile for the priority screens:
  - SP: Dashboard · My Jobs · Calendar · Offers · Account
  - Admin: Dashboard · Jobs · Calendar · Customers · More
- Respect iOS safe areas (`env(safe-area-inset-bottom/top)`) on the bottom bar and top app bar.

### 3. Mobile-first screen passes

- **SP My Jobs** (`src/pages/sp/MyJobs.tsx`): card layout instead of dense rows, larger tap targets, sticky status action buttons, swipe-friendly photo upload trigger.
- **SP Job Detail** (`src/pages/sp/SPJobDetail.tsx`): full-width sticky "Mark In-Progress / Completed" footer button; collapsible sections; tap-to-call phone, tap-to-navigate address (opens Google/Apple Maps via `geo:` URL).
- **SP Calendar** (`src/pages/sp/SPCalendar.tsx` + `JobCalendar.tsx`): default to **Day view** on mobile, hide Week/Month behind a switcher; convert hourly grid to vertical scroll with larger row height; replace drag-to-create-time-off with a tap-then-form flow on touch devices (drag UX is unreliable on mobile).
- **SP Job Offers** (`src/pages/sp/JobOffers.tsx`): full-screen card per offer with prominent Accept/Decline buttons.
- **Admin Jobs list** (`src/pages/admin/JobManagement.tsx`): on mobile, swap the table for a card list with key fields (job#, customer, status, urgency, scheduled), bulk-select via long-press; filters move into a bottom Sheet.
- **Admin Calendar** (`src/pages/admin/AdminCalendar.tsx`): same Day-default + reduced controls as SP calendar.
- **Admin Dashboard** (`src/pages/admin/AdminDashboard.tsx`): KPI grid stacks 2-up on mobile; History button moves into the top app bar.
- **Job/Customer/SP Forms**: stacked single-column on mobile, sticky save bar at bottom.

### 4. Native-feature notes (PWA limits)

- **Push notifications**: already wired via VAPID + `save-push-subscription`. PWA push works on Android (Chrome/Edge/Firefox) and on iOS 16.4+ **only after the user installs the app to their home screen**. We'll surface a "Enable notifications" prompt on first SP login on mobile and document the iOS install requirement on `/install`.
- **Camera**: PWA can use `<input type="file" accept="image/*" capture="environment">` to open the device camera directly. We'll wire this into `JobPhotosUploader.tsx` so SPs can shoot photos in one tap. (No raw camera stream API needed.)
- **GPS**: use `navigator.geolocation.getCurrentPosition()` to (a) auto-fill SP "current location" when accepting/starting a job, (b) compute distance to the next job on the SP dashboard, (c) one-tap "Open in Maps" with the user's location as origin.
- **What PWAs cannot do** (heads-up): no background location tracking, no native push on iOS without install, no app-store presence. If any of those become must-haves later, we revisit Capacitor.

### 5. Files touched

- `vite.config.ts`, `index.html`, `src/main.tsx`, `package.json` (add `vite-plugin-pwa`)
- `public/manifest.webmanifest`, `public/icons/*` (new)
- `src/pages/Install.tsx` (new) + route in `src/App.tsx`
- `src/components/DashboardLayout.tsx` (drawer + top bar + bottom tab bar)
- `src/components/MobileBottomNav.tsx`, `src/components/MobileTopBar.tsx` (new)
- Mobile passes on: `src/pages/sp/{MyJobs,SPJobDetail,SPCalendar,JobOffers,JobOfferDetail,SPDashboard,AccountPage,AvailabilitySettings}.tsx`, `src/pages/admin/{AdminDashboard,JobManagement,AdminCalendar,CustomerManagement,JobForm,CustomerForm,SPForm,JobDetail,CustomerDetail,SPDetail}.tsx`
- `src/components/calendar/JobCalendar.tsx` (mobile day-default + tap-to-create time-off)
- `src/components/JobPhotosUploader.tsx` (camera capture attribute)
- `src/lib/geolocation.ts` (new helper)
- `src/index.css` / `tailwind.config.ts` (safe-area utilities)

### 6. Out of scope (call out for later)

- App store submission (would require Capacitor switch).
- Offline mode for write actions (status updates while offline). PWA cache will serve the shell + last-loaded data, but mutations need connectivity in v1.
- Background geolocation / route tracking.

### 7. Important caveat

PWA features (install prompt, service worker, push) **only work in the published/deployed app**, not in the Lovable editor preview iframe. Test by clicking **Publish** and opening the `.lovable.app` URL on your phone.

