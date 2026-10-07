# GIZMO DAN KAITA OFFICE PLUS

## Final Year Project & Innovation Development Program — Registration & Applicant Portal

Phase 1 of the programme platform: a real, database-driven registration and
applicant portal. Applicants register, complete a seven-step application, upload
supporting documents to private storage, receive an application ID, and track
their application through the review process.

**This is not a demo.** There are no sample applicants, applications, statistics,
testimonials or metrics anywhere in the repository. With an empty database the
site shows professional empty states rather than invented content.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, React 19) |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4, self-hosted Inter + Source Serif 4 |
| Database & auth | Supabase (Postgres) with Row Level Security |
| Validation | Zod schemas shared by browser and server |
| Icons | lucide-react (inline SVG, no external asset requests) |

---

## Quick start

```bash
npm install
cp .env.example .env.local     # add your Supabase URL + anon key
npm run dev
```

The database has to exist first — see **[SETUP.md](./SETUP.md)** for the full
walkthrough (migrations, seeds, auth email templates, and the Phase 1 acceptance
checklist).

Without environment variables the site still runs: it renders every page with an
explicit "not configured yet" notice instead of crashing or faking data.

---

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | development server on `http://localhost:3000` |
| `npm run build` / `npm start` | production build and server |
| `npm run lint` | ESLint (Next.js config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:verify` | applies every migration and seed to an in-process Postgres and proves the RPCs, RLS policies, ID generator and storage rules — 146 checks, no credentials needed |
| `npm run db:seed:locations` | regenerates the Nigerian geography seed |

---

## What Phase 1 delivers

**Public**

* Programme landing page — hero, about, who can register, what participants can
  access, how it works, innovation & entrepreneurship, youth development,
  community development, FAQ, contact and footer.
* Registration (`/register`), login, email verification, password reset.
* Authenticated application tracking (`/track`).

**Applicant portal** (requires a verified session)

* Dashboard — application status, completion, notifications, profile summary.
* Seven-step registration: 01 Personal · 02 Category · 03 Location · 04 Idea ·
  05 Support · 06 Documents · 07 Review, with save-and-continue-later at every
  step. Step 4 adapts its questions to the selected category, using the
  `detail_schema` stored on `applicant_categories`.
* Documents — uploaded straight to a private bucket, viewed only through
  short-lived signed URLs.
* Notifications and profile management.

**Database**

`profiles`, `applications`, `applicant_categories`, `document_types`, `locations`
(37 states · 774 LGAs · 8,809 wards), `support_needs`,
`application_support_needs`, `application_documents`, `application_status_history`,
`notifications`, `programs`, `contact_messages` — all with Row Level Security, and
`applications.user_id` as the single owner column every policy resolves through.

---

## Security model

* **No service-role key anywhere.** Every query runs as the signed-in user, so a
  mistake in application code cannot widen access — the database refuses.
* **Authorisation is server-side.** `src/proxy.ts` refreshes the session and
  performs an optimistic redirect; the real gate is `src/lib/auth.ts`, called by
  every protected page and every server action, backed by RLS.
* **Applicants cannot write protected columns.** Status, application number,
  review notes and `submitted_at` are guarded by database triggers; drafts are
  written through `save_application_draft()`, which accepts a whitelist of keys.
* **Application IDs are unpredictable.** `GKO-<year>-<6 characters>` drawn from a
  32-symbol alphabet, no modulo bias, never sequential, unique-constrained with
  automatic retry.
* **Documents are private.** The bucket is not public; storage policies restrict
  each applicant to their own folder, and viewing uses 5-minute signed URLs.
* **No cross-applicant access.** Reading someone else's application id returns the
  same `application_not_found` as a non-existent one.

---

## Project layout

```
src/app/          routes — public page, (auth) group, auth/confirm, portal, track
src/components/   ui primitives, layout, landing, auth, portal
src/lib/          supabase clients, data reads, zod validation, types, config
supabase/         migrations (schema, functions, RLS, storage) and seeds
scripts/          database verifier and geography seed generator
```

See [SETUP.md § 7](./SETUP.md#7-where-things-live) for a file-by-file map.

---

## Roadmap

* **Phase 2 — main website.** Public programme site reading `programs`,
  `applicant_categories` and `support_needs` from the same database.
* **Phase 3 — Patron/Admin Dashboard.** Review queue, status transitions, reviewer
  notes and document review, using the roles and `is_admin()` policies already in
  place. No redesign is needed: the applicant portal and the future dashboard
  consume the same tables, RPCs and history tables.
