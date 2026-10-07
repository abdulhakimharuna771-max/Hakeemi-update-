# Manual verification — items 1 to 15

Two layers of verification exist, and they cover different things.

**Automated — run these first.** `npm run verify:live` drives the real data plane
against your own Supabase project: real sign-ups, real draft saving, a real file
in the private bucket, real submission, and the cross-applicant isolation matrix.
It needs no browser and no clicking.

```bash
npm run check:config    # .env.local is valid; prints exactly what will render
npm run db:verify       # the schema is sound (158 checks, offline)
npm run verify:live     # the live project (auth, PostgREST, storage, RLS)
npm run check:routes    # every page answers correctly (server must be running)
npm run check:a11y      # labels, headings, landmarks
```

**Manual — this document.** The same ground, plus everything a script cannot
judge: whether the screens read well, whether the wizard feels right on a phone,
whether an error message actually helps. Work through it once before going live,
and keep the sign-off table at the end.

---

## Before you start

```bash
cp .env.example .env.local     # Supabase URL + publishable/anon key
npm install
npm run check:config           # expect: 10 configuration checks passed
npm run db:verify              # expect: 158/158 checks passed
npm run dev                    # leave this running
npm run check:routes           # expect: 21/21 route checks passed
npm run check:a11y             # expect: 7/7 routes passed
```

If your project is brand new, apply the schema first — see SETUP.md, or run the
three files in `supabase/apply-*.sql` in the SQL editor. `verify:live` detects a
missing schema and tells you.

Have two things open: the browser, and the Supabase dashboard for your project
(**Table Editor** and **Authentication → Users**). Keep a second email address
handy for step 12 — it must be a *different* account.

Record the outcome of each row. Anything that fails is a bug: note the step
number, what you expected and what happened.

---

## 1. Supabase connection

| # | Do this | Expect |
| --- | --- | --- |
| 1.1 | Visit `/` | The hero reads **“Turn Ideas Into Opportunities.”** and the page shows no “not configured” notice |
| 1.2 | Look at **Who can register** | Cards come from the `applicant_categories` table — Student, Business Owner, Farmer, Professional, Innovator |
| 1.3 | In the dashboard, open **Table Editor → applicant_categories** and set `is_active = false` on *Farmer* | Reloading `/` removes the Farmer card. Set it back and it returns |
| 1.4 | **Table Editor → support_needs**, set `is_active = false` on *Training* | The **What participants can access** list no longer mentions Training |
| 1.5 | Remove both env vars from `.env.local`, restart | Every page still renders and shows an explicit “Supabase is not configured yet” notice — no crash, no invented content. Put them back |

**Why 1.3 and 1.4 matter:** they prove the site is database-driven. New
categories added as rows appear without a code change.

---

## 2. Signup

| # | Do this | Expect |
| --- | --- | --- |
| 2.1 | Go to `/register`, submit with a real address and a password that meets the on-screen rules | The password checklist turns green as you type; submitting shows a “check your email” style confirmation, not an error |
| 2.2 | Supabase → **Authentication → Users** | Exactly one new user, **not yet confirmed** |
| 2.3 | **Table Editor → profiles** | A profile row exists with the same id, `role = applicant`, empty name/phone |
| 2.4 | Submit `/register` again with the same address | A clear “already registered” message — no second user, no stack trace |
| 2.5 | Submit `/register` with a weak password, then a mismatched confirmation, then a malformed email | Each shows a specific message against the right field |

---

## 3. Login, and what an unverified account can reach

| # | Do this | Expect |
| --- | --- | --- |
| 3.1 | Sign out, then `/login` with the account from step 2 | You land on `/verify-email`, not the dashboard — email confirmation is required |
| 3.2 | Type `/portal/dashboard` into the address bar anyway | Server-side, you are sent to `/verify-email` too. The portal is not reachable by URL |
| 3.3 | Sign in with a wrong password | “Email or password is incorrect” — the same message whether or not the address exists |
| 3.4 | Sign in with an address that has no account | Same message as 3.3 |

---

## 4. Email verification

| # | Do this | Expect |
| --- | --- | --- |
| 4.1 | Open the confirmation email and click the link | You land on `/portal/dashboard` (or `/verify-email` → continue) |
| 4.2 | Supabase → **Authentication → Users** | `email_confirmed_at` is now filled |
| 4.3 | Open the same link a second time | It does not sign you in again; you are sent to `/login` with an honest message |
| 4.4 | On `/verify-email`, press **Resend** twice in a row | A confirmation is sent, and the rate limit produces a clear message rather than a crash |
| 4.5 | Append `&next=https://example.com` to a confirmation link | The app refuses the external destination and stays on your own domain |

---

## 5. Password reset

| # | Do this | Expect |
| --- | --- | --- |
| 5.1 | Sign out, `/forgot-password`, enter your address | “If an account exists for that address, a reset link is on its way” — no confirmation either way that the address exists |
| 5.2 | Click the link in the email | `/reset-password` shows a form headed with your email address |
| 5.3 | Try `/reset-password` directly without using the link | “This reset link is no longer valid” and a button to request a new one |
| 5.4 | Set a new password from the link | You are signed in and land on the dashboard with a “password has been updated” notice |
| 5.5 | Sign out and sign in with the new password | Works. The old password does not |

---

## 6. Protected routes

| # | Do this | Expect |
| --- | --- | --- |
| 6.1 | While signed out, request `/portal/dashboard`, `/portal/application`, `/portal/documents`, `/portal/profile`, `/portal/notifications`, `/track` | Each one redirects to `/login?next=<the page you asked for>` |
| 6.2 | Sign in from that screen | You land on the page you originally asked for, not a generic dashboard |
| 6.3 | While signed in, request `/login` and `/register` | Both bounce you to the dashboard |
| 6.4 | In DevTools → Application → Cookies, delete the Supabase auth cookies, then load `/portal/dashboard` | You are signed out cleanly to `/login` — no half-broken page |
| 6.5 | In DevTools, edit the session cookie to a random string and reload | Still signed out. The session is validated against the Auth server, not trusted from the cookie |

---

## 7. Multi-step registration

| # | Do this | Expect |
| --- | --- | --- |
| 7.1 | On the dashboard, press **Start registration** | Step 01 of 07. Steps 01–07 are listed; on a phone they are a horizontal strip |
| 7.2 | Complete step 01 with a partial name, then an invalid phone, then a short address | Each is refused with a message on the field; focus moves to the first problem |
| 7.3 | Fill step 01 correctly and press **Continue** | “Progress saved”, the completion bar grows, and step 02 appears. The draft now exists in `applications` with `status = DRAFT` |
| 7.4 | Supabase → **Table Editor → applications** | One row for you, `application_number` **NULL**, `current_step` matching where you are |
| 7.5 | Choose **Student** at step 02, then continue | Step 04 asks about Institution, Department, Level of study and Final year project status |
| 7.6 | Go back to step 02 and choose **Farmer**, then return to step 04 | The questions change to farming-specific ones — no student fields are demanded. Then set it back to Student if you prefer |
| 7.7 | Step 03: pick a State, then a different State | The LGA list reloads; the ward clears. A state/LGA/ward combination that does not belong together cannot be submitted |
| 7.8 | Step 04: type a description of 20 characters | The counter shows the minimum and refuses to advance until it is long enough |
| 7.9 | Step 05: tick **Other** and try to continue | It asks you to describe the support you need under “Other” |
| 7.10 | Press **Save and finish later** in the middle of any step, then close the tab and open `/portal/application` again | You resume on the step you left, with every answer intact |
| 7.11 | Turn off your network (DevTools → Network → Offline) and press **Continue** | An error explains the save failed **and your answers are still on screen**. Turn the network back on, press Continue again — it saves |
| 7.12 | On a phone (or DevTools mobile view), work through steps 01–07 | No horizontal scrolling anywhere; the action bar stays reachable; tapping works with one hand |

---

## 8. Application submission

| # | Do this | Expect |
| --- | --- | --- |
| 8.1 | Reach step 07 with a field still empty (leave step 04's *Problem* short by using Save and finish later) | The review step lists exactly which items are outstanding, each linking back to its step |
| 8.2 | Press **Submit application** anyway | It refuses, naming the missing fields, and takes you to the earliest one |
| 8.3 | Complete everything, return to step 07, tick both declarations and submit | Success. You are taken to the dashboard with your application ID |
| 8.4 | Supabase → **Table Editor → applications** | `status = SUBMITTED`, `application_number` filled, `submitted_at` set, `completion_percent = 100` |
| 8.5 | **Table Editor → application_status_history** | One row: `from_status = DRAFT`, `to_status = SUBMITTED`, `visible_to_applicant = true` |
| 8.6 | **Table Editor → notifications** | One row for you, type `APPLICATION_SUBMITTED` |
| 8.7 | Try to submit again from a stale tab | “This application has already been submitted” — and the database still holds exactly one number |
| 8.8 | Reload `/portal/application` | The wizard is read-only and says so; editing is refused everywhere |
| 8.9 | Click **Track this application** | `/track` shows the status, the stage list and the dated history entry |

---

## 9. Application ID generation

| # | Do this | Expect |
| --- | --- | --- |
| 9.1 | Look at your application ID | `GKO-<year>-XXXXXX` — six characters, no `1`, `I`, `L` or `O` anywhere in the code |
| 9.2 | Register a second account (a colleague's address) and take it all the way through | A **different** ID. There is no way to guess the next one |
| 9.3 | In the SQL editor: `select public.generate_application_number() from generate_series(1, 500);` | 500 distinct values, all matching the format, none sequential |
| 9.4 | In the SQL editor: `select count(*) from public.applications where application_number is distinct from null and user_id is null;` | `0` — a number only ever exists on a real application |

---

## 10. Document upload

| # | Do this | Expect |
| --- | --- | --- |
| 10.1 | Start a fresh registration, fill steps 01–05, reach step 06 | Document tiles for your category, each marked *Optional* with the accepted types and size |
| 10.2 | Try to upload a `.txt` or a 10 MB PDF | Refused client-side with a specific reason, before anything is sent |
| 10.3 | Upload a small PDF | Progress, then “Saving the record…”, then the file in the list with its size and time |
| 10.4 | Supabase → **Storage → applicant-documents** | The object sits under `<your-user-id>/<application-id>/<TYPE>/…` |
| 10.5 | Supabase → **Storage**, and open the bucket's settings | The bucket is **not public** |
| 10.6 | Press **View** on the file | It opens from a `…/storage/v1/object/sign/…` URL. Copy that URL, wait 6 minutes, reload — it has expired |
| 10.7 | Copy the signed URL, sign out, and open it | Expired or refused. A signed URL never outlives its five minutes |
| 10.8 | Press **Remove** on a draft document | It disappears from the list and from Storage |
| 10.9 | Go offline, then upload | “Unable to upload document. Please try again.” with a **Retry** button that re-sends the same file without re-selecting it |
| 10.10 | Submit the application, then open `/portal/documents` | Documents are read-only, with an explanation |

---

## 11. Row Level Security

Run these in the SQL editor as an **applicant**. The SQL editor runs as
`postgres` and bypasses RLS, so "as an applicant" here means: use the app while
signed in as your test applicant, or — better — use the API with their token.

The practical checks:

| # | Do this | Expect |
| --- | --- | --- |
| 11.1 | Supabase → **Authentication → Policies** (or **Table Editor → profiles → RLS**) | RLS is enabled on `profiles`, `applications`, `application_documents`, `application_support_needs`, `application_status_history`, `notifications` |
| 11.2 | In the SQL editor: `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname;` | `relrowsecurity = true` for every table holding applicant data |
| 11.3 | In the SQL editor: `select policyname, cmd, roles from pg_policies where schemaname = 'public' order by tablename, policyname;` | Policies exist for the applicant's own rows, plus the public read-only reference tables, plus admin policies |
| 11.4 | As a signed-in applicant, open `/portal/notifications` | Only your notifications — never another applicant's |
| 11.5 | In the SQL editor as `postgres`, `select count(*) from public.applications;` | Two applications (yours and your colleague's). As an applicant in the app you can only ever see your own |

---

## 12. Applicant B cannot reach applicant A's data

This is the most important check in the document. Use two accounts and two
browser profiles (or one normal window and one private window) so both sessions
stay alive.

The API checks below use `curl` with applicant B's own access token, which is
exactly what a malicious applicant would have. Fill in the four variables once:

```bash
URL="https://<your-project-ref>.supabase.co"     # Project Settings → Data API
ANON="<your anon / publishable key>"             # Project Settings → API Keys
EMAIL_B="b@example.com"                          # applicant B's account
PASS_B="B's password"

TOKEN_B=$(curl -s "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASS_B\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

echo "token length: ${#TOKEN_B}"                 # expect 800+

APP_A="<applicant A's application id>"           # Table Editor → applications
APP_B="<applicant B's application id>"
```

| # | Do this | Expect |
| --- | --- | --- |
| 12.1 | As **A**, note your application id from the dashboard URL, or read it in **Table Editor → applications** | A uuid |
| 12.2 | `curl -s "$URL/rest/v1/applications?id=eq.$APP_A" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_B"` | `[]` — an empty array. Not A's row, and no error that confirms the id exists |
| 12.3 | Same request with no `Authorization` header (anon only) | `[]` — never A's data |
| 12.4 | `curl -s "$URL/rest/v1/application_documents?application_id=eq.$APP_A" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_B"` | `[]` |
| 12.5 | `curl -s "$URL/rest/v1/rpc/get_application_checklist" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" -d "{\"p_application_id\":\"$APP_A\"}"` | `{"code":"P0001","message":"application_not_found"}` — the same answer a made-up id gives, so the id space leaks nothing |
| 12.6 | `curl -s -X PATCH "$URL/rest/v1/applications?id=eq.$APP_A" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"full_name":"Tampered"}'` | `[]` — no rows updated. Confirm A's record is unchanged in the Table Editor |
| 12.7 | `curl -s -X PATCH "$URL/rest/v1/applications?id=eq.$APP_B" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" -d '{"status":"APPROVED"}'` | `status_change_not_permitted`. An applicant can never move their own status |
| 12.8 | The same PATCH against B's own *profile* with `{"role":"admin"}` | `role_change_not_permitted` |
| 12.9 | A PATCH on B's own draft with `{"application_number":"GKO-2026-AAAAAA"}` | `application_number_not_permitted` |
| 12.10 | `curl -s "$URL/rest/v1/notifications?select=id,title" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_B"` | Only B's notifications |
| 12.11 | `curl -s -X POST "$URL/storage/v1/object/sign/applicant-documents/<A's user id>/<A's application id>/IDENTIFICATION/file.pdf" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" -d '{"expiresIn":300}'` | Refused — B cannot sign a URL for A's object |
| 12.12 | In the app as **B**, visit `/portal/application`, `/portal/documents`, `/track` | Only B's own application, documents and history appear |

`npm run db:verify` already proves 12.2–12.11 against a real Postgres schema, so
if any of these behave differently on your project, something differs between
your database and `supabase/migrations/`.

---

## 13. Mobile responsiveness

| # | Do this | Expect |
| --- | --- | --- |
| 13.1 | DevTools → iPhone SE (375 × 667). Visit `/` | No horizontal scrollbar at any point; the menu opens and closes; both hero buttons are full-width and tappable |
| 13.2 | `/register`, `/login`, `/verify-email` | The form fits; the keyboard does not hide the submit button; inputs are large enough to tap |
| 13.3 | `/portal/dashboard` | Cards stack; the bottom tab bar is reachable with a thumb and shows the unread badge |
| 13.4 | `/portal/application` | The step strip scrolls horizontally **within itself** (the page does not); the action bar stays visible above the tab bar |
| 13.5 | Rotate to landscape | Nothing is cut off; the action bar is still reachable |
| 13.6 | Turn on 200% text zoom | Layout still works; no text overlaps or is clipped |
| 13.7 | Use only the keyboard: Tab from the top of `/` | A “Skip to main content” link appears first; every interactive element is reachable and shows a visible focus ring |
| 13.8 | On the wizard, Tab into step 04's skill input and press Enter | The typed skill becomes a removable chip |

---

## 14. Empty, error and loading states

| # | Do this | Expect |
| --- | --- | --- |
| 14.1 | Sign up a brand-new account and confirm it | The dashboard shows an empty state inviting you to start registration — no fake statistics, no placeholder application |
| 14.2 | Open `/portal/notifications` with nothing ever received | A professional empty state, not a blank page |
| 14.3 | Throttle the network in DevTools (Slow 3G) and load `/portal/dashboard` | A skeleton placeholder appears while loading |
| 14.4 | In `src/lib/data/applicant.ts`, temporarily change a table name to something invalid, then load the dashboard | The portal error screen appears — with a “Try again” button and a reference code, no raw stack trace. Revert the change |
| 14.5 | Visit a URL that does not exist, e.g. `/portal/nope` | A designed 404 page with a way back |
| 14.6 | On the landing page, submit the contact form with a 5-character message | Refused with a specific reason |

---

## 15. No fake or demo data

| # | Do this | Expect |
| --- | --- | --- |
| 15.1 | Grep the repository for invented content: `grep -rniE "lorem|john doe|jane doe|@example\\.com|testimonial|trusted by|20[0-9]{2} applicants|\\b[0-9,]{3,} (applicants|participants)" src/ supabase/seed/` | No results in `src/`. The only matches are within `supabase/seed/`, which contains reference data (categories, support needs, document types, geography) and the single programme row |
| 15.2 | Supabase → **Table Editor → applications** | Only applications created by your own tests. There is no seed file for applicants — by design |
| 15.3 | Supabase → **Table Editor → programs** | One row: the programme record, with `status = OPEN`. Set it to `CLOSED` and reload the dashboard |
| 15.4 | Set the programme to `CLOSED`, then reload `/portal/dashboard` | Registration stops and says so plainly; nothing pretends the window is open. Set it back to `OPEN` |
| 15.5 | Read the Contact section of `/` | Either your real contact details (from `.env.local`) or an honest “contact channels are being published” line — never an invented phone number or address |
| 15.6 | Check the footer | No invented partner logos, accreditation claims or statistics |

---

## Sign-off

| Item | Result | Notes |
| --- | --- | --- |
| 1 Supabase connection | | |
| 2 Signup | | |
| 3 Login | | |
| 4 Email verification | | |
| 5 Password reset | | |
| 6 Protected routes | | |
| 7 Multi-step registration | | |
| 8 Application submission | | |
| 9 Application ID generation | | |
| 10 Document upload | | |
| 11 Row Level Security | | |
| 12 No cross-applicant access | | |
| 13 Mobile responsiveness | | |
| 14 Empty/error/loading states | | |
| 15 No fake or demo data | | |
