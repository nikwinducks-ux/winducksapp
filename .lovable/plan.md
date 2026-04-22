

## Add Photo Attachments to Job Notes

Enable admins to attach photos when creating/editing a job, and display those photos to Service Providers on the job offer and job detail pages.

### What gets built

**Storage**
- New public storage bucket `job-photos` for job-related images
- RLS policies: admins can upload/delete; SPs can read photos for jobs assigned to them or for broadcast jobs they're eligible for; public read on the bucket for simplicity (since URLs are non-guessable UUIDs)

**Database**
- New table `job_photos`:
  - `id` (uuid, pk)
  - `job_id` (uuid, references jobs)
  - `storage_path` (text — path inside `job-photos` bucket)
  - `caption` (text, optional)
  - `uploaded_by_user_id` (uuid)
  - `created_at` (timestamptz)
- RLS:
  - Admin/owner: full access
  - SP: select where `job_id` is one of their assigned jobs or eligible broadcast jobs (mirrors existing `job_services` policies)

**Admin UI — Job Form (`src/pages/admin/JobForm.tsx`)**
- New "Photos" section under the Notes field
- Multi-file image picker (accepts jpg/png/webp, max ~5MB each)
- Thumbnail grid of existing + newly added photos with delete (X) button per photo
- Optional caption field per photo
- On submit: upload new files to `job-photos/{jobId}/{uuid}.{ext}`, insert rows into `job_photos`, delete removed ones

**Admin UI — Job Detail (`src/pages/admin/JobDetail.tsx`)**
- New "Photos" card showing thumbnails; click to open lightbox (Dialog) at full size

**SP UI — Job Offer Detail (`src/pages/sp/JobOfferDetail.tsx`) & SP Job Detail (`src/pages/sp/SPJobDetail.tsx`)**
- New "Photos" card (read-only) below the Notes section
- Same thumbnail grid + click-to-enlarge lightbox

**Shared component**
- `src/components/JobPhotosGallery.tsx` — read-only grid + lightbox, used by all three viewer pages
- `src/components/JobPhotosUploader.tsx` — admin uploader (grid + add/remove + caption)

**Data hook**
- `useJobPhotos(jobId)` and `useSaveJobPhotos()` in `src/hooks/useSupabaseData.ts` (mirrors `useJobServices`/`useSaveJobServices` pattern)

### Technical notes

- Files stored at `job-photos/{job_id}/{uuid}.{ext}` so deleting a job's photos is a simple prefix operation
- Public bucket → use `supabase.storage.from('job-photos').getPublicUrl(path)` for display (no signed URL overhead)
- Client-side validation: file type must start with `image/`, size ≤ 5MB; show toast on rejection
- Uploads happen after the job row is saved (need `jobId`); for new-job flow, save job first, then upload, then insert `job_photos` rows — same sequencing already used by `saveJobServices`
- Reuse existing `Dialog` component for the lightbox
- No changes to the canonical job status flow or allocation logic

### Acceptance criteria

- Admin can attach 1+ photos when creating or editing a job; thumbnails appear in the form
- Photos persist across reloads and are visible on the admin Job Detail page
- An SP viewing an offered or assigned job sees the same photos (read-only) with click-to-enlarge
- Removing a photo in the admin form deletes it from storage and DB on save
- SPs cannot see photos for jobs they aren't assigned to or eligible for

