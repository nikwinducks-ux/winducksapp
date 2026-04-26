## Goal

Replace the static Compliance tab on the Service Provider admin page with a manageable list of compliance documents (insurance, certifications, licenses, etc.). Each document has a name, expiration date, and an attached file. Status is computed from the expiration date: **Valid** if in the future, **Expiring** if within 30 days, **Expired** if past.

## What gets built

### 1. Database (new table + storage bucket)

**Table: `sp_compliance_documents`**
- `id` (uuid, pk)
- `sp_id` (uuid, references service_providers)
- `name` (text) — e.g. "General Liability Insurance", "WCB Certificate"
- `document_type` (text, optional category label)
- `expires_on` (date, nullable — null = no expiry)
- `file_path` (text) — storage path
- `file_name` (text) — original filename for display
- `file_size` (int)
- `mime_type` (text)
- `notes` (text)
- `created_at`, `updated_at`, `created_by_user_id`

**RLS:**
- Admin/owner: full access
- SP: SELECT own documents (where `sp_id = get_user_sp_id(auth.uid())`)

**Storage bucket: `sp-compliance` (private)**
- Path convention: `{sp_id}/{document_id}/{filename}`
- RLS: Admin/owner full access; SP read-only on own folder.

**Optional:** A computed view or a small helper to auto-roll the SP's overall `compliance_status` to "Expired" if any required doc is expired (kept simple — overall status badge will reflect worst doc status client-side; we won't auto-mutate the existing column to avoid scope creep).

### 2. Admin UI changes (`src/pages/admin/SPDetail.tsx`)

- The header `Compliance` badge becomes a **button** that jumps to the Compliance tab.
- Compliance tab is rebuilt as a documents manager:
  - List of documents with: name, type, expiry date, computed status badge (Valid/Expiring/Expired/No expiry), file link (download), and actions (Edit, Delete).
  - "Add Document" button opens a dialog with: Name, Type, Expiration Date (date picker), File upload, Notes.
  - Edit dialog supports replacing the file or updating expiry.
  - Empty state: "No compliance documents yet".
- The badge color in the SP header is derived from the worst doc status across all docs.

### 3. SP portal (read-only)

- A "My Documents" section on the SP Account page lists their own compliance documents and statuses with download links, so SPs can see what's on file and what's expiring.

### 4. Status logic (shared util)

```ts
function complianceStatus(expiresOn: string | null): "valid" | "expiring" | "expired" | "none" {
  if (!expiresOn) return "none";
  const days = daysUntil(expiresOn);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}
```

## Files

**New**
- `supabase/migrations/<ts>_sp_compliance_documents.sql` — table, indexes, RLS, storage bucket + policies
- `src/components/admin/SPComplianceDocuments.tsx` — list + add/edit dialog
- `src/lib/compliance.ts` — status helper

**Edited**
- `src/pages/admin/SPDetail.tsx` — clickable header badge, replace Compliance tab content, derive overall status from docs
- `src/hooks/useSupabaseData.ts` — hooks: `useSPComplianceDocs(spId)`, `useUpsertSPComplianceDoc`, `useDeleteSPComplianceDoc` (handles file upload to storage)
- `src/pages/sp/AccountPage.tsx` — read-only "My Documents" section

## Out of scope

- Email/push reminders for expiring docs (can add later)
- Required vs optional document templates per category
- Automatic suspension when a doc expires
