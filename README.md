# ALEHA Teacher Portal

Replacement for the legacy Google Form + XLSX-based teacher registration flow.

**Public form** for applicants (no login) · **Admin panel** for staff with full audit trail on every manual edit · **Migration script** to import all 4,270 legacy records from `Teacher Registration Form (Responses).xlsx`.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend / API | Next.js 14 (App Router) on Vercel |
| Database | Supabase Postgres |
| Auth | Supabase Auth (email + password) |
| File storage | Supabase Storage (`photos` public, `id-proofs` private + signed URLs) |
| Migration | Node script using `xlsx` + `@supabase/supabase-js` |

---

## Project layout

```
.
├── README.md                          ← this file
├── Teacher Registration Form (Responses).xlsx   ← legacy source data
├── supabase/
│   └── schema.sql                     ← tables, RLS, storage buckets — apply in Supabase SQL editor
└── web/
    ├── app/
    │   ├── layout.tsx                 ← root layout + global CSS
    │   ├── page.tsx                   ← landing page
    │   ├── globals.css
    │   ├── apply/page.tsx             ← public registration form
    │   ├── admin/
    │   │   ├── login/page.tsx         ← staff login
    │   │   ├── applicants/
    │   │   │   ├── page.tsx           ← table view + search/filter/pagination
    │   │   │   ├── actions.ts         ← server action for staff edits (audit-trail)
    │   │   │   ├── SignOutButton.tsx
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx       ← detail page (server)
    │   │   │       └── ApplicantEditForm.tsx
    │   └── api/
    │       └── id-proof/[id]/route.ts ← signed-URL endpoint for ID proofs
    ├── lib/
    │   ├── supabase-browser.ts        ← anon client (browser)
    │   ├── supabase-server.ts         ← server client + service-role helper
    │   ├── types.ts                   ← TS types + editable-field whitelist
    │   └── constants.ts               ← form options + declaration text
    ├── scripts/
    │   └── import-xlsx.mjs            ← one-shot migration
    ├── package.json
    ├── next.config.mjs
    ├── tsconfig.json
    └── .env.example
```

---

## Setup — fresh project

### 1. Supabase

1. Create a project at https://supabase.com
2. **Project Settings → API** — copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`  (server-only, never expose)
3. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, click **Run**.
4. Verify: **Database → Tables** shows `applicants`, `staff_users`, `audit_log`.
5. Verify: **Storage** shows two buckets: `photos` (public) and `id-proofs` (private).

### 2. Seed the first staff user

In SQL editor:

```sql
-- Create the auth user (replace email + password)
-- Note: this is a one-time helper. For real onboarding, use Supabase Auth UI.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, role, aud)
values (
  gen_random_uuid(),
  'you@aleha teacher',
  crypt('your-strong-password', gen_salt('bf')),
  now(),
  'authenticated',
  'authenticated'
);

-- Then link to staff_users (use the same email)
insert into staff_users (id, email, full_name, role)
select id, email, 'Your Name', 'admin' from auth.users
where email = 'you@aleha teacher';
```

For additional staff later, use the Supabase dashboard **Authentication → Users → Add user**, then `insert into staff_users ...`.

### 3. Local dev

```bash
cd web
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL + keys
npm run dev
# → http://localhost:3000
```

### 4. Migrate legacy records

```bash
# From the web/ directory
npm run import:xlsx
# Reads ../Teacher Registration Form (Responses).xlsx
# Inserts into Supabase in batches of 200
# Idempotent: re-running skips existing codes
```

Expected output:
```
Reading …/Teacher Registration Form (Responses).xlsx
Total rows including header: 4270
Non-empty data rows: ~4268
Existing rows with codes: 0
Batch 1: inserted=200 skipped=0 failed=0
…
=== DONE ===
Inserted: ~4268
Skipped (duplicate / blank): 2
Failed: 0
```

### 5. Deploy to Vercel

```bash
# One-time: connect your GitHub repo
# https://vercel.com/new → import github.com/alehalearn/teacher-form
# Add env vars:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
# Deploy
```

Each git push auto-deploys.

---

## How the audit trail works

Every staff edit goes through `web/app/admin/applicants/actions.ts` (`patchApplicant` server action):

1. Receives `{ id, changes }` from the edit form
2. Filters `changes` against `EDITABLE_STAFF_FIELDS` whitelist (form-fed fields can never be edited from the staff UI)
3. Fetches the current row to compute the diff
4. Updates the row with `updated_at = now()`, `updated_by = auth.uid()`
5. Inserts one `audit_log` row per changed field, recording `staff_email`, `field_name`, `old_value`, `new_value`, `changed_at`

Form-fed fields (name, district, age, etc.) are intentionally **not** in the whitelist — once an applicant submits, those are immutable from the admin UI. If something needs correcting, staff should contact the applicant.

---

## How ID proofs work

- Uploaded by staff to the private `id-proofs` bucket
- Stored path is saved on the applicant row (`id_proof_path`)
- The applicant row's ID is never directly exposed in a public URL
- Staff clicks "View ID proof" → fetches `/api/id-proof/[id]` → server returns a **signed URL valid for 1 hour** → opens in new tab
- No public URL exists for ID proofs at any point

---

## Operational notes

- **Photo upload (public form)**: 1MB max enforced client-side. Bucket is public so old-school direct URL access works. Consider adding server-side size enforcement if abuse becomes a problem.
- **Spam protection**: The public form has no CAPTCHA. If you start getting bot submissions, add Cloudflare Turnstile or hCaptcha to the `/apply` page (5-line change).
- **Email notifications**: not implemented. The schema has room for this — add an `email_log` table and a Supabase trigger on `applicants` insert to send via Resend / Postmark.
- **ON GOING and DEMO tabs**: not in scope. These remain in the legacy Google Sheet.

---

## Acceptance criteria (from the build plan)

- [ ] Anyone with `/apply` URL can submit the form, no login
- [ ] Submitted form lands in `applicants` table within 2 seconds
- [ ] Public photo URL is fetchable without auth
- [ ] ID proof URL requires signed URL via authenticated route
- [ ] Staff can log in at `/admin/login`
- [ ] Staff can see all imported records + new submissions
- [ ] Staff can edit a record; `updated_at` and `updated_by` are stamped automatically
- [ ] Form-fed fields cannot be edited from the staff UI (whitelist enforces this)
- [ ] Every staff edit appears in `audit_log` with staff email, field, old value, new value, timestamp
- [ ] Legacy Sheet and new system coexist; no data loss

---

## License

Private — internal ALEHA TEACHER use only.