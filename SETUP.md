# Setup — GIZMO DAN KAITA OFFICE PLUS

**Final Year Project & Innovation Development Program — Registration & Applicant Portal (Phase 1)**

This document takes a fresh machine from an empty Supabase project to a working
applicant portal. Everything in Phase 1 is database-driven: nothing on the site is
sample content, so a correctly configured project shows real, empty states until
real applicants register.

---

## 1. What you need

| Requirement | Notes |
| --- | --- |
| Node.js 20.9+ | developed on Node 22 |
| A Supabase project | hosted (supabase.com) or self-hosted |
| The Supabase CLI *(optional)* | only if you prefer CLI migrations over the SQL editor |

Install dependencies:

```bash
npm install
```

---

## 2. Create the database

All schema, Row Level Security, functions and the private storage bucket live in
`supabase/migrations/`. Reference data (categories, support needs, document
types, the programme row) and Nigerian geography live in `supabase/seed/`.

### Option A — Supabase SQL editor (no CLI, fastest)

Three ready-to-paste files are generated from the migrations and seeds. Open the
SQL editor in your project, create a new query, and run each file **in order**:

```
supabase/apply-1-schema.sql      schema, functions, Row Level Security, storage
supabase/apply-2-reference.sql   categories, support needs, document types, the programme
supabase/apply-3-locations.sql   Nigerian geography (37 states · 774 LGAs · 8,809 wards)
```

Every statement is idempotent, so re-running any of them is safe. Regenerate the
files after changing anything under `supabase/`:

```bash
npm run db:bundle
```

### Option B — Supabase CLI### Option B — Supabase CLI

```bash
supabase link --project-ref <your-project-ref>
supabase db push                      # applies supabase/migrations/*
psql "$DATABASE_URL" -f supabase/seed/001_reference_data.sql
psql "$DATABASE_URL" -f supabase/seed/002_locations_nigeria.sql
```

### Verify the database

The repository ships an executable proof of the database layer. It applies every
migration and seed to an in-process Postgres, then exercises the RPCs, the
Row Level Security policies, the application-number generator and the storage
policies:

```bash
node scripts/verify-database.mjs
```

Expected output ends with `158/158 checks passed`. It needs no project
credentials and writes nothing anywhere.

---

## 3. Configure the environment

```bash
cp .env.example .env.local
```

Set, at minimum:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → anon / publishable key |

Both are safe to expose in the browser — Row Level Security is what protects
applicant data. **A service-role key must never be added to this application.**
There is no code path that reads one, and no server action can escalate beyond the
signed-in applicant's own rows.

Optional values are documented in `.env.example`, and `npm run check:config`
prints exactly what the site will render. Two groups matter:

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | origin used in the email links Supabase Auth sends |
| `NEXT_PUBLIC_CONTACT_EMAIL` | shown in the contact section and footer, linked as `mailto:` |
| `NEXT_PUBLIC_CONTACT_PHONES` | comma-separated; each is shown as a `tel:` link |
| `NEXT_PUBLIC_CONTACT_ADDRESS` | pipe-separated lines; blank means the address block is hidden |
| `NEXT_PUBLIC_CONTACT_HOURS` | a single line, e.g. office hours |
| `NEXT_PUBLIC_CONTACT_WHATSAPP` | builds the `wa.me` link; defaults to the first phone number |
| `NEXT_PUBLIC_SOCIAL_HANDLE` | shown as text — never turned into a guessed profile URL |
| `NEXT_PUBLIC_SOCIAL_LINKS` | `Name=URL` pairs that publish real, clickable links |

Any channel left blank is simply not rendered: the site never invents a phone
number, address, email address or social account.

---

## 4. Configure authentication

Supabase dashboard → **Authentication**:

1. **Providers → Email**: enable Email. Keep *Confirm email* **on** — applicants
   must verify their address before the portal opens, which is what
   `/verify-email` enforces.
2. **URL Configuration**:
   * **Site URL** — your production origin, e.g. `https://portal.example.org`
   * **Redirect URLs** — add the confirmation endpoint for every environment:
     ```
     http://localhost:3000/auth/confirm
     https://portal.example.org/auth/confirm
     ```
3. **Email templates** — the app accepts both Supabase link styles:

   *Default templates* redirect to `/auth/confirm?code=…`, which the app exchanges
   for a session. This works out of the box.

   *Recommended* (works even if the link is opened on a different device from the
   one that signed up): replace each template's link with the token-hash form.

   Confirm signup:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/portal/dashboard">
     Confirm your email address
   </a>
   ```

   Reset password:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
     Choose a new password
   </a>
   ```

   The `next` parameter is validated server-side to be an internal path.

4. **Rate limits**: the defaults are fine. Sign-up confirmation email is the only
   message Phase 1 sends.

---

## 5. Run it

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
npm run lint
npx tsc --noEmit
```

Open `http://localhost:3000` for the public programme page, `/register` to create
an account and `/portal/dashboard` for the applicant portal.

---

## 6. Phase 1 acceptance checklist

Use this to confirm the delivered scope. Items 1–15 are the requirements from the
programme brief.

| # | Requirement | How to confirm |
| --- | --- | --- |
| 1 | Supabase connection | Any page with data (e.g. `/`) renders categories from `applicant_categories`; with no env vars set the site shows an explicit "Supabase is not configured yet" notice instead of failing |
| 2 | Signup | `/register` → a row appears in `auth.users` and `profiles`, and a confirmation email is sent |
| 3 | Login | `/login` signs in; unverified accounts are held at `/verify-email` |
| 4 | Email verification | The confirmation link lands on `/auth/confirm`; `auth.users.email_confirmed_at` is set |
| 5 | Password reset | `/forgot-password` sends the link; `/reset-password` sets a new password and signs the applicant in |
| 6 | Protected routes | Request `/portal/dashboard` while signed out — you are redirected to `/login?next=…`; the redirect is re-checked server-side in `requireVerifiedUser()` |
| 7 | Multi-step registration | `/portal/application` walks 01 Personal → 02 Category → 03 Location → 04 Idea → 05 Support → 06 Documents → 07 Review, saving each step |
| 8 | Application submission | Step 07 requires the declaration; `submit_application()` refuses an incomplete application and names the outstanding fields |
| 9 | Application ID generation | On submission a `GKO-2026-XXXXXX`-style id appears on the dashboard — see note below |
| 10 | Document upload | Step 06 accepts PDF/Word/JPG/PNG/WebP up to 5 MB; the object lands in the private `applicant-documents` bucket under the applicant's own folder |
| 11 | Row Level Security | `select * from profiles;` in the SQL editor as an applicant returns only their own row; `node scripts/verify-database.mjs` proves the policies |
| 12 | No cross-applicant access | A crafted request for another applicant's application id returns `application_not_found`; the document signer only issues URLs for the caller's own files |
| 13 | Mobile responsiveness | Every layout is mobile-first with no horizontal overflow; the portal uses a bottom tab bar and sticky step actions on small screens |
| 13b | Accessibility | `npm run check:a11y` (with the dev server running) checks labels, headings, landmark structure and accessible names on every public route |
| 13c | Production build | `npm run build` compiles every route and confirms which ones are request-time (`ƒ`) rather than prerendered |
| 14 | Empty / error / loading states | Empty database ⇒ `EmptyState` panels; failed saves keep the entered values and offer retry; `loading.tsx` and `error.tsx` cover the portal |
| 15 | No fake or demo data | `supabase/seed/` contains reference data only — no applicants, applications, statistics or testimonials |

**Note on application numbers.** The brief's example is `GKO-2026-XXXXXX`, where
the year is the intake year. The generator uses the year the application is
submitted (`GKO-<submission year>-<6 characters>`), so an intake that opens in
December 2025 and is submitted in January 2026 reads `GKO-2026-…`. The six
characters come from exactly 32 symbols (`023456789ABCDEFGHJKMNPQRSTUVWXYZ` —
1, I, L and O are never generated, so a reference is hard to mis-transcribe)
drawn from `gen_random_uuid()`, giving 32⁶ = 1,073,741,824 combinations with no
modulo bias and no sequential ordering. A collision is retried internally, and
`generate_application_number()` refuses to run if a future edit changes the
alphabet away from 32 unique characters.

**Note on resubmission.** When an application comes back through
*More Information Required*, the applicant can edit it again and resubmit — and
it keeps the same application number, so the reference they were given stays
valid.

### Automated checks

```bash
npm run check:config    # validates .env.local, offline and instant
npm run verify:live     # the real end-to-end run against your Supabase project
```

`npm run verify:live` exercises the live data plane with nothing but the
publishable key and genuine sign-ups: it creates two disposable applicants, saves
a draft step by step, uploads a real PDF into the private bucket, submits,
allocates an application number, and then proves applicant B can reach none of
applicant A's data. It needs the three SQL bundles applied first, and it stops
with instructions if email confirmation has to be completed by hand.

With the dev server running:

```bash
npm run check:routes    # every route answers correctly (21 checks)
npm run check:a11y      # labels, headings, landmarks on the public routes
```

Both accept `BASE_URL=https://…` so they can be pointed at a deployment.

The manual, step-by-step acceptance run — for when you want to see each screen
yourself — is in **[VERIFICATION.md](./VERIFICATION.md)**.

---

## 7. Where things live

```
src/
  app/
    page.tsx                  public programme page (landing)
    (auth)/                   register · login · verify-email · forgot-password · reset-password
    auth/actions.ts           server actions for every auth mutation
    auth/confirm/route.ts     the endpoint Supabase email links point at
    portal/
      layout.tsx              applicant shell (requires a verified session)
      dashboard/              status, progress, notifications, profile summary
      application/            7-step registration wizard
      documents/              private document uploads
      notifications/          full notification feed
      profile/                applicant profile
    track/                    authenticated application tracking
  components/                 ui/ primitives, layout/, landing/, auth/, portal/
  lib/
    supabase/                 config · browser · server clients
    data/                     typed read layer (reference + applicant)
    validation/               zod schemas shared by client and server
    auth.ts constants.ts types.ts utils.ts site-config.ts
  proxy.ts                    session refresh + optimistic route gating
supabase/
  migrations/                 schema, functions, RLS, storage
  seed/                       reference data + Nigerian geography
scripts/
  build-location-seed.mjs     regenerates the geography seed
  verify-database.mjs         executable proof of the database layer
```

---

## 8. Phase 2 and 3

The database is already shaped for the later phases — the same tables, policies
and RPCs serve them with no redesign:

* **Phase 2 (main website)** reads `programs`, `applicant_categories`,
  `support_needs` and `contact_messages`.
* **Phase 3 (Patron/Admin Dashboard)** runs as a signed-in user whose
  `profiles.role` is `admin` or `super_admin`. `is_admin()` already gates the
  review-side policies and RPCs, status changes are recorded in
  `application_status_history`, and `notifications` are created for the applicant
  automatically.
