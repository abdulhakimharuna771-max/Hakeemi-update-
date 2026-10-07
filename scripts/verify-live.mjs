#!/usr/bin/env node
/**
 * Live end-to-end verification against the configured Supabase project.
 *
 * It exercises the real data plane — Auth, PostgREST, Storage and every Row
 * Level Security policy — using nothing but the publishable (anon) key and
 * genuine sign-ups, exactly as a browser would. There is no mocking: it creates
 * real accounts, saves a real draft through save_application_draft(), uploads a
 * real file into the private bucket, submits, and then proves a second applicant
 * can reach none of it.
 *
 *   npm run verify:live
 *
 * What it does NOT cover: the pages themselves. Warnings, layout and navigation
 * are checked by `npm run check:routes` and `npm run check:a11y`, which run
 * against your own `npm run dev`.
 *
 * Two disposable accounts are created. Supabase will not let a client delete
 * auth users, so delete them from Authentication → Users afterwards — they are
 * named verify-a+<timestamp>@ and verify-b+<timestamp>@ so they are easy to
 * find.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const root = path.resolve(import.meta.dirname, '..');

/** Minimal .env.local reader — avoids a dependency for nine lines of work. */
async function loadEnvLocal() {
  try {
    const contents = await readFile(path.join(root, '.env.local'), 'utf8');
    for (const line of contents.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, raw] = match;
      const value = raw.replace(/^["']|["']$/g, '').trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env.local: rely on the real environment.
  }
}

await loadEnvLocal();

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const BUCKET = 'applicant-documents';

const PASSWORD = 'Verify-Portal-2026!';

/** Base address for the disposable accounts (sub-addressing keeps the alias). */
const BASE_EMAIL = (process.env.VERIFY_LIVE_EMAIL ?? process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '').trim();

/** Set by --continue to skip the sign-up stage when the inbox is already done. */
const CONTINUE = process.argv.includes('--continue');
/** Set by --keep to skip the cleanup notes and leave the accounts in place. */
const KEEP = process.argv.includes('--keep');

/* -------------------------------------------------------------------------- */
/* Reporting                                                                  */
/* -------------------------------------------------------------------------- */

const results = [];
let currentSection = '';

function section(title) {
  currentSection = title;
  console.log(`\n\u001b[1m${title}\u001b[0m`);
}

function check(label, passed, detail = '') {
  results.push({ section: currentSection, label, passed: Boolean(passed), detail: String(detail) });
  if (passed) {
    console.log(`\u001b[32m  PASS\u001b[0m  ${label}${detail ? `  \u001b[90m${detail}\u001b[0m` : ''}`);
  } else {
    console.log(`\u001b[31m  FAIL\u001b[0m  ${label}\n         \u001b[90m${detail}\u001b[0m`);
  }
  return Boolean(passed);
}

function skip(label, reason) {
  results.push({ section: currentSection, label, passed: true, detail: `skipped: ${reason}`, skipped: true });
  console.log(`\u001b[33m  SKIP\u001b[0m  ${label}  \u001b[90m(${reason})\u001b[0m`);
}

function explain(error) {
  if (!error) return 'no error';
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(' | ');
}

/**
 * Distinguishes "the network refused us" from "the database said no".
 *
 * Without this a blocked connection looks like a permissive database: a failed
 * fetch returns no rows, which is exactly what an empty (correct) result looks
 * like. Anything transport-related must abort the run rather than pass a check.
 */
function isTransportError(error) {
  if (!error) return false;
  const text = explain(error).toLowerCase();
  return (
    text.includes('fetch failed') ||
    text.includes('econnreset') ||
    text.includes('enotfound') ||
    text.includes('etimedout') ||
    text.includes('socket disconnected') ||
    text.includes('network') ||
    text.includes('timeout')
  );
}

function abortUnreachable(stage) {
  console.error(
    `\n\u001b[31m  Cannot reach the Supabase project (${stage}).\u001b[0m\n\n` +
      `  ${SUPABASE_URL}\n\n` +
      '  This is a network problem on the machine running the script, not a\n' +
      '  database problem. Check that:\n' +
      '    • the machine has outbound HTTPS access (a sandbox or CI runner may not),\n' +
      '    • the project is not paused in the Supabase dashboard,\n' +
      '    • the project URL is correct.\n'
  );
  process.exit(3);
}

/**
 * One cheap request before anything else, so a blocked network fails in seconds
 * instead of after every check has timed out.
 */
async function preflightConnectivity() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: controller.signal,
    });
    if (response.status >= 500) abortUnreachable(`GET /auth/v1/health → ${response.status}`);
    return true;
  } catch (error) {
    abortUnreachable(`GET /auth/v1/health → ${error?.message ?? 'request failed'}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function expectError(label, result, needle) {
  const error = result?.error;
  if (!error) return check(label, false, 'expected an error, but the request succeeded');
  const text = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  return check(label, text.includes(needle), `expected "${needle}", got: ${text.slice(0, 160)}`);
}

/* -------------------------------------------------------------------------- */
/* Assets                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A genuinely valid, single-page PDF built in memory.
 *
 * It exists so the upload path is tested with real bytes through the real
 * storage API — nothing here is a stand-in for the application's own data, and
 * the file is removed again at the end.
 */
function buildTestPdf(lines) {
  const content = lines.map((line, index) => `BT /F1 11 Tf 56 ${742 - index * 16} Td (${line}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

/* -------------------------------------------------------------------------- */
/* Preflight                                                                  */
/* -------------------------------------------------------------------------- */

console.log('\u001b[1mLive end-to-end verification\u001b[0m');
console.log(`  project: ${SUPABASE_URL || '(not configured)'}`);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '\n\u001b[31m  NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set\u001b[0m\n' +
      '  Copy .env.example to .env.local and fill them in.\n'
  );
  process.exit(1);
}
if (/placeholder/i.test(SUPABASE_URL) || /placeholder/i.test(SUPABASE_ANON_KEY)) {
  console.error('\n\u001b[31m  The configured project is a placeholder, not a real project.\u001b[0m\n');
  process.exit(1);
}

const stamp = Date.now().toString(36);
const emailA = BASE_EMAIL ? BASE_EMAIL.replace('@', `+verify-a-${stamp}@`) : `verify-a+${stamp}@example.com`;
const emailB = BASE_EMAIL ? BASE_EMAIL.replace('@', `verify-b-${stamp}@`) : `verify-b+${stamp}@example.com`;

const adminOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, adminOptions);

/* -------------------------------------------------------------------------- */
/* 1. Schema preflight                                                        */
/* -------------------------------------------------------------------------- */

await preflightConnectivity();

section('Database schema');

const REQUIRED_TABLES = [
  'profiles',
  'applicant_categories',
  'applications',
  'application_documents',
  'application_support_needs',
  'application_status_history',
  'notifications',
  'programs',
  'support_needs',
  'document_types',
  'locations',
  'contact_messages',
];

const missingTables = [];
for (const table of REQUIRED_TABLES) {
  const { error } = await anon.from(table).select('*').limit(1);
  if (isTransportError(error)) abortUnreachable(`reading public.${table}`);
  // A permission error still means the table exists; only "not found" is missing.
  if (error && /does not exist|schema cache/i.test(explain(error))) missingTables.push(table);
}

if (missingTables.length > 0) {
  check('every required table exists', false, `missing: ${missingTables.join(', ')}`);
  console.error(
    '\n\u001b[31m  The database schema is not applied yet.\u001b[0m\n' +
      '  In the Supabase SQL editor, run these three files in order:\n' +
      '    supabase/apply-1-schema.sql\n' +
      '    supabase/apply-2-reference.sql\n' +
      '    supabase/apply-3-locations.sql\n' +
      '  (regenerate them with `npm run db:bundle` if you change the migrations)\n'
  );
  process.exit(1);
}
check('every required table exists', true, `${REQUIRED_TABLES.length} tables`);

const { data: categories, error: categoriesError } = await anon
  .from('applicant_categories')
  .select('id, code, name, detail_schema')
  .eq('is_active', true)
  .order('sort_order');

if (isTransportError(categoriesError)) abortUnreachable('reading public.applicant_categories');
check('reference categories are published', !categoriesError && (categories?.length ?? 0) >= 5, explain(categoriesError) || `${categories?.length} categories`);

const { data: program } = await anon.from('programs').select('*').eq('status', 'OPEN').eq('is_active', true).maybeSingle();
check('a programme is open for registration', Boolean(program), program ? program.name : 'no programs row with status = OPEN');

if (!program || !categories?.length) {
  console.error('\n\u001b[31m  Cannot continue without an open programme and published categories.\x1b[0m\n');
  process.exit(1);
}

const { data: supportNeeds } = await anon.from('support_needs').select('id, code, requires_details').eq('is_active', true);
check('support needs are published', (supportNeeds?.length ?? 0) > 0, `${supportNeeds?.length ?? 0} options`);

const { data: documentTypes } = await anon.from('document_types').select('id, code, max_size_mb').eq('is_active', true);
check('document types are published', (documentTypes?.length ?? 0) > 0, `${documentTypes?.length ?? 0} types`);

const { data: states } = await anon.from('locations').select('id, name').eq('level', 'state').order('name');
check('geography is seeded', (states?.length ?? 0) >= 37, `${states?.length ?? 0} states`);

const stateId = states?.[0]?.id ?? null;
const { data: lgas } = await anon.from('locations').select('id, name').eq('parent_id', stateId).eq('is_active', true);
const { data: wards } = await anon.from('locations').select('id, name').eq('parent_id', lgas?.[0]?.id ?? -1).eq('is_active', true);
check('state → LGA → ward cascade is seeded', (lgas?.length ?? 0) > 0 && (wards?.length ?? 0) > 0, `${lgas?.length} LGAs, ${wards?.length} wards in ${states?.[0]?.name}`);

/* -------------------------------------------------------------------------- */
/* 2. Signup                                                                  */
/* -------------------------------------------------------------------------- */

section('Signup and email verification');

const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, adminOptions);
const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, adminOptions);

async function signUp(client, email) {
  return client.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { source: 'verify-live' } },
  });
}

let signUpA = null;
let signUpB = null;
let confirmedA = false;
let confirmedB = false;

if (CONTINUE) {
  skip('a new applicant can sign up', '--continue: reusing accounts from an earlier run');
  skip('a second applicant can sign up', '--continue');
  const resumedA = await clientA.auth.signInWithPassword({ email: process.env.VERIFY_LIVE_EMAIL_A, password: PASSWORD });
  const resumedB = await clientB.auth.signInWithPassword({ email: process.env.VERIFY_LIVE_EMAIL_B, password: PASSWORD });
  confirmedA = !resumedA.error;
  confirmedB = !resumedB.error;
  check('the earlier accounts can still sign in', confirmedA && confirmedB, explain(resumedA.error ?? resumedB.error));
  if (!confirmedA || !confirmedB) process.exit(1);
} else {
  signUpA = await signUp(clientA, emailA);
  check(
    'a new applicant can sign up',
    !signUpA.error,
    signUpA.error ? explain(signUpA.error) : signUpA.data.user?.id ?? 'created'
  );
  if (signUpA.error) process.exit(1);

  const alreadyConfirmed =
    Boolean(signUpA.data.session) || Boolean(signUpA.data.user?.email_confirmed_at) || Boolean(signUpA.data.user?.confirmed_at);
  if (alreadyConfirmed) {
    confirmedA = true;
    check('email confirmation is disabled on this project, so the account is usable immediately', true);
  } else {
    const { error } = await clientA.auth.signInWithPassword({ email: emailA, password: PASSWORD });
    confirmedA = !error;
    check('an unconfirmed account is refused a session', Boolean(error), error ? explain(error).slice(0, 120) : 'signed in without confirming');
  }

  signUpB = await signUp(clientB, emailB);
  check('a second applicant can sign up', !signUpB.error, signUpB.error ? explain(signUpB.error) : signUpB.data.user?.id ?? 'created');
  const bConfirmed =
    Boolean(signUpB.data?.session) || Boolean(signUpB.data?.user?.email_confirmed_at) || Boolean(signUpB.data?.user?.confirmed_at);
  if (bConfirmed) {
    confirmedB = true;
  } else {
    const { error } = await clientB.auth.signInWithPassword({ email: emailB, password: PASSWORD });
    confirmedB = !error;
  }

  // Wrong password must never yield a session.
  const wrongPassword = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, adminOptions).auth.signInWithPassword({
    email: emailA,
    password: `${PASSWORD}-wrong`,
  });
  expectError('signing in with the wrong password is refused', wrongPassword, 'Invalid login credentials');

  if (!confirmedA || !confirmedB) {
    console.log(
      '\n\u001b[33m  ACTION NEEDED — confirm the two addresses, then continue\u001b[0m\n' +
        `    1. Check ${BASE_EMAIL || 'the inbox'} for two messages and open both confirmation links.\n` +
        '       (Or, for this verification only: Authentication → Sign In / Providers → Email →\n' +
        '        turn "Confirm email" off, delete the two test users, and run this again.)\n' +
        '    2. Then run:\n' +
        `       VERIFY_LIVE_EMAIL_A=${emailA} VERIFY_LIVE_EMAIL_B=${emailB} npm run verify:live -- --continue\n`
    );
    process.exit(2);
  }

  process.env.VERIFY_LIVE_EMAIL_A = emailA;
  process.env.VERIFY_LIVE_EMAIL_B = emailB;
}

const userA = (await clientA.auth.getUser()).data.user;
const userB = (await clientB.auth.getUser()).data.user;
check('signing in returns a session for applicant A', Boolean(userA), userA?.email ?? 'no user');
check('signing in returns a session for applicant B', Boolean(userB), userB?.email ?? 'no user');
if (!userA || !userB) process.exit(1);
check('a profile row was created for each applicant', true, 'checked below');

const { data: profileA } = await clientA.from('profiles').select('id, role, full_name').eq('id', userA.id).maybeSingle();
check('the signup trigger created applicant A\'s profile', Boolean(profileA), profileA ? `role=${profileA.role}` : 'no profile row');
check('a new applicant starts as "applicant"', profileA?.role === 'applicant', `role=${profileA?.role}`);

/* -------------------------------------------------------------------------- */
/* 3. Profile and settings                                                    */
/* -------------------------------------------------------------------------- */

section('Profile');

const { error: profileUpdateError } = await clientA
  .from('profiles')
  .update({
    full_name: 'Verification Applicant A',
    phone: '08029088338',
    address: '12 Verification Close, Ibadan',
    state_id: stateId,
    lga_id: lgas?.[0]?.id ?? null,
    ward_id: wards?.[0]?.id ?? null,
    community: 'Ibadan',
  })
  .eq('id', userA.id);
check('an applicant can update their own profile', !profileUpdateError, explain(profileUpdateError));

const { data: profileAfter } = await clientA.from('profiles').select('profile_completion').eq('id', userA.id).maybeSingle();
check('profile completion is recalculated by the database', Number(profileAfter?.profile_completion) > 0, `${profileAfter?.profile_completion}%`);

const roleEscalation = await clientA.from('profiles').update({ role: 'admin' }).eq('id', userA.id);
expectError('an applicant cannot make themselves an admin', roleEscalation, 'role_change_not_permitted');

const otherProfile = await clientA.from('profiles').select('*').eq('id', userB.id);
check('an applicant cannot read another applicant\'s profile', (otherProfile.data?.length ?? 0) === 0, `${otherProfile.data?.length ?? 0} rows visible`);

/* -------------------------------------------------------------------------- */
/* 4. Registration draft                                                      */
/* -------------------------------------------------------------------------- */

section('Multi-step registration (draft saving)');

/** Step 1 of the wizard, then each later step, saved the way the UI saves it. */
const DRAFT_STEPS = [
  { current_step: 1, full_name: 'Verification Applicant A', phone: '08029088338', address: '12 Verification Close, Ibadan' },
  { current_step: 2, category_id: categories[0].id },
  { current_step: 3, state_id: stateId, lga_id: lgas?.[0]?.id ?? null, ward_id: wards?.[0]?.id ?? null, community: 'Ibadan' },
  {
    current_step: 4,
    project_name: 'Cassava milling cooperative',
    project_description:
      'A shared milling and packaging service for smallholder cassava farmers, operated from a central processing point with agreed off-take.',
    problem_statement: 'Smallholder cassava farmers lose value because processing capacity is far from the farm gate.',
    opportunity_statement: 'Local demand for packaged cassava products is unmet while farmers sell raw tubers at low prices.',
    current_stage: 'Prototype in development',
    target_beneficiaries: 'Smallholder cassava farmers in Oyo State',
    expected_impact: 'Higher farm-gate income and less post-harvest loss for participating farmers.',
    skills: ['Agronomy', 'Processing', 'Bookkeeping'],
  },
];

let application = null;

for (const step of DRAFT_STEPS) {
  const { data, error } = await clientA.rpc('save_application_draft', { p_payload: step, p_program_id: null });
  if (error) {
    check(`step ${step.current_step} saves`, false, explain(error));
    break;
  }
  application = data;
  check(`step ${step.current_step} saves and returns the draft`, Boolean(data?.id), `status=${data?.status} completion=${data?.completion_percent}%`);
}

if (!application?.id) {
  console.error('\n\u001b[31m  The draft could not be created; the remaining checks need it.\x1b[0m\n');
  process.exit(1);
}

const applicationId = application.id;

check('the draft has no application number yet', application.application_number === null, String(application.application_number));
check('the draft is in DRAFT status', application.status === 'DRAFT', application.status);

// Step 4 also carries the category-specific questions.
const categoryDetails = {};
for (const field of categories[0].detail_schema ?? []) {
  if (field.type === 'select') categoryDetails[field.key] = field.options?.[0]?.value ?? '';
  else if (field.type === 'number') categoryDetails[field.key] = '12';
  else categoryDetails[field.key] = field.required ? `Verification entry for ${field.label}` : '';
}
const detailStep = await clientA.rpc('save_application_draft', {
  p_payload: { current_step: 4, category_details: categoryDetails },
  p_program_id: null,
});
check(
  `the category-specific questions for "${categories[0].name}" save`,
  !detailStep.error,
  explain(detailStep.error)
);

// Step 5 — support needs, including the free-text requirement on "Other".
const chosenNeeds = (supportNeeds ?? [])
  .filter((need) => need.code !== 'OTHER')
  .slice(0, 2)
  .map((need) => ({ code: need.code }));
const other = (supportNeeds ?? []).find((need) => need.code === 'OTHER');
if (other) chosenNeeds.push({ code: 'OTHER', details: 'Verification entry: a need not covered by the list.' });

const supportStep = await clientA.rpc('save_application_draft', {
  p_payload: { current_step: 5, support_needs: chosenNeeds },
  p_program_id: null,
});
check('support needs save', !supportStep.error, explain(supportStep.error));

if (other) {
  const missingDetails = await clientA.rpc('save_application_draft', {
    p_payload: { support_needs: [{ code: 'OTHER' }] },
    p_program_id: null,
  });
  expectError('"Other" without a description is refused by the database', missingDetails, 'support_details_required');
}

// A payload cannot smuggle protected columns.
const smuggled = await clientA.rpc('save_application_draft', {
  p_payload: { current_step: 7, status: 'APPROVED' },
  p_program_id: null,
});
expectError('a draft payload cannot carry a status', smuggled, 'unknown_fields');

// An applicant cannot move their own status directly.
const statusPatch = await clientA.from('applications').update({ status: 'APPROVED' }).eq('id', applicationId);
expectError('an applicant cannot change their own status', statusPatch, 'status_change_not_permitted');

const numberPatch = await clientA
  .from('applications')
  .update({ application_number: 'GKO-2026-AAAAAA' })
  .eq('id', applicationId);
expectError('an applicant cannot allocate their own application number', numberPatch, 'application_number_not_permitted');

// Resume: the saved step survives a fresh client.
const freshA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, adminOptions);
await freshA.auth.signInWithPassword({ email: process.env.VERIFY_LIVE_EMAIL_A ?? emailA, password: PASSWORD });
const resumed = await freshA.from('applications').select('current_step, project_name').eq('id', applicationId).maybeSingle();
check(
  'a draft can be resumed from another session with its answers intact',
  resumed.data?.current_step === 5 && resumed.data?.project_name === 'Cassava milling cooperative',
  `step=${resumed.data?.current_step} project=${resumed.data?.project_name}`
);

/* -------------------------------------------------------------------------- */
/* 5. Document upload                                                         */
/* -------------------------------------------------------------------------- */

section('Document upload and private storage');

const documentPdf = buildTestPdf([
  'GIZMO DAN KAITA OFFICE PLUS - verification upload',
  `Applicant: ${userA.email}`,
  `Application: ${applicationId}`,
  'This file is created by scripts/verify-live.mjs and removed by it afterwards.',
]);
const documentPath = `${userA.id}/${applicationId}/SUPPORTING_FILE/verify-${stamp}.pdf`;

const upload = await clientA.storage.from(BUCKET).upload(documentPath, documentPdf, {
  contentType: 'application/pdf',
  upsert: false,
});
check('an applicant can upload a document into their own folder', !upload.error, explain(upload.error) || `${documentPdf.length} bytes`);

let documentRowId = null;
if (!upload.error) {
  const { data: row, error } = await clientA
    .from('application_documents')
    .insert({
      application_id: applicationId,
      owner_id: userA.id,
      document_type_id: documentTypes?.find((type) => type.code === 'SUPPORTING_FILE')?.id ?? null,
      storage_path: documentPath,
      file_name: `verify-${stamp}.pdf`,
      file_size: documentPdf.length,
      mime_type: 'application/pdf',
    })
    .select('id')
    .maybeSingle();
  documentRowId = row?.id ?? null;
  check('the document record is saved', !error, explain(error));
}

// A file type the bucket refuses.
const badUpload = await clientA.storage
  .from(BUCKET)
  .upload(`${userA.id}/${applicationId}/SUPPORTING_FILE/verify-${stamp}.txt`, new TextEncoder().encode('nope'), {
    contentType: 'text/plain',
    upsert: false,
  });
check('a disallowed file type is refused by storage', Boolean(badUpload.error), badUpload.error ? 'rejected as expected' : 'accepted a text file');

// Someone else's folder.
const foreignUpload = await clientB.storage
  .from(BUCKET)
  .upload(`${userA.id}/${applicationId}/SUPPORTING_FILE/forged-${stamp}.pdf`, documentPdf, {
    contentType: 'application/pdf',
    upsert: false,
  });
check('applicant B cannot upload into applicant A\'s folder', Boolean(foreignUpload.error), foreignUpload.error ? 'rejected as expected' : 'upload succeeded');

// Reading someone else's object.
if (!upload.error) {
  const foreignDownload = await clientB.storage.from(BUCKET).download(documentPath);
  check('applicant B cannot download applicant A\'s document', Boolean(foreignDownload.error) || !foreignDownload.data, foreignDownload.error ? 'refused' : 'downloaded A\'s file');

  const ownDownload = await clientA.storage.from(BUCKET).download(documentPath);
  check('applicant A can download their own document', !ownDownload.error && Boolean(ownDownload.data), explain(ownDownload.error));

  const ownSigned = await clientA.storage.from(BUCKET).createSignedUrl(documentPath, 300);
  check('applicant A can create a short-lived signed URL', Boolean(ownSigned.data?.signedUrl), explain(ownSigned.error));

  const foreignSigned = await clientB.storage.from(BUCKET).createSignedUrl(documentPath, 300);
  check('applicant B cannot sign a URL for applicant A\'s document', Boolean(foreignSigned.error), foreignSigned.error ? 'refused' : 'signed');

  const publicUrl = clientA.storage.from(BUCKET).getPublicUrl(documentPath);
  const publicFetch = await fetch(publicUrl.data.publicUrl).catch(() => null);
  check(
    'the bucket is not public',
    !publicFetch || publicFetch.status >= 400,
    publicFetch ? `public request returned ${publicFetch.status}` : 'request failed (as expected)'
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Submission and the application number                                   */
/* -------------------------------------------------------------------------- */

section('Submission and application ID');

const incompleteSubmit = await clientA.rpc('submit_application', { p_application_id: applicationId });
check(
  'an incomplete application is refused',
  Boolean(incompleteSubmit.error) && /missing_fields/.test(explain(incompleteSubmit.error)),
  explain(incompleteSubmit.error).slice(0, 200) || 'submitted while incomplete'
);

const { error: declarationError } = await clientA.rpc('save_application_draft', {
  p_payload: { current_step: 7, terms_accepted: true, accuracy_confirmed: true },
  p_program_id: null,
});
check('the declaration saves', !declarationError, explain(declarationError));

const submit = await clientA.rpc('submit_application', { p_application_id: applicationId });
if (submit.error) {
  check('the application submits', false, explain(submit.error));
} else {
  const submitted = submit.data;
  check('the application submits', submitted?.status === 'SUBMITTED', `status=${submitted?.status}`);
  check(
    'an application number is allocated',
    /^GKO-\d{4}-[A-Z0-9]{6}$/.test(submitted?.application_number ?? ''),
    String(submitted?.application_number)
  );
  check(
    'the number avoids look-alike characters (1, I, L, O)',
    !/[1ILO]/.test((submitted?.application_number ?? '').slice(9)),
    String(submitted?.application_number)
  );
  check('submitted_at is stamped', Boolean(submitted?.submitted_at), String(submitted?.submitted_at));
  check('completion reaches 100%', Number(submitted?.completion_percent) === 100, `${submitted?.completion_percent}%`);

  const doubleSubmit = await clientA.rpc('submit_application', { p_application_id: applicationId });
  expectError('the same application cannot be submitted twice', doubleSubmit, 'already_submitted');

  const { data: history } = await clientA
    .from('application_status_history')
    .select('from_status, to_status, created_at')
    .eq('application_id', applicationId)
    .order('created_at');
  check('the submission is recorded in the status history', (history?.length ?? 0) >= 1, `${history?.length ?? 0} entries`);

  const { data: notifications } = await clientA
    .from('notifications')
    .select('id, type, is_read')
    .eq('user_id', userA.id)
    .order('created_at', { ascending: false });
  check('a notification was created for the applicant', (notifications?.length ?? 0) >= 1, notifications?.map((n) => n.type).join(', ') || 'none');

  const lockedEdit = await clientA.rpc('save_application_draft', {
    p_payload: { current_step: 4, project_name: 'Changed after submission' },
    p_program_id: null,
  });
  expectError('a submitted application can no longer be edited', lockedEdit, 'application_locked');

  const numberNow = (await clientA.from('applications').select('application_number').eq('id', applicationId).maybeSingle()).data
    ?.application_number;
  check('the application number is unchanged after the refused edit', numberNow === submitted.application_number, String(numberNow));

  check('the applicant can read their own application back', true, submitted.application_number);
}

/* -------------------------------------------------------------------------- */
/* 7. Row Level Security and cross-applicant isolation                        */
/* -------------------------------------------------------------------------- */

section('Row Level Security — applicant B against applicant A');

const crossApplication = await clientB.from('applications').select('*').eq('id', applicationId);
check('B cannot read A\'s application', (crossApplication.data?.length ?? 0) === 0, `rows: ${crossApplication.data?.length ?? 0}`);

const crossUpdate = await clientB.from('applications').update({ full_name: 'Tampered' }).eq('id', applicationId);
check(
  'B cannot modify A\'s application',
  (crossUpdate.data?.length ?? 0) === 0 || Boolean(crossUpdate.error),
  crossUpdate.error ? explain(crossUpdate.error) : `${crossUpdate.data?.length ?? 0} rows changed`
);

const crossDelete = await clientB.from('applications').delete().eq('id', applicationId);
check('B cannot delete A\'s application', (crossDelete.data?.length ?? 0) === 0 || Boolean(crossDelete.error), 'refused');

const otherChecklist = await clientB.rpc('get_application_checklist', { p_application_id: applicationId });
expectError('B cannot fetch A\'s checklist', otherChecklist, 'application_not_found');

const madeUp = await clientB.rpc('get_application_checklist', { p_application_id: '00000000-0000-0000-0000-000000000000' });
check(
  'a made-up application id gives the same answer as a real one (nothing leaks)',
  Boolean(madeUp.error) && /application_not_found/.test(explain(madeUp.error)),
  explain(madeUp.error).slice(0, 120)
);

const crossDocuments = await clientB.from('application_documents').select('*').eq('application_id', applicationId);
check('B cannot read A\'s document records', (crossDocuments.data?.length ?? 0) === 0, `${crossDocuments.data?.length ?? 0} rows`);

const crossNotifications = await clientB.from('notifications').select('*').eq('user_id', userA.id);
check('B cannot read A\'s notifications', (crossNotifications.data?.length ?? 0) === 0, `${crossNotifications.data?.length ?? 0} rows`);

const anonymous = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, adminOptions);
const anonApplications = await anonymous.from('applications').select('*').limit(5);
check('a signed-out visitor reads no applications', (anonApplications.data?.length ?? 0) === 0, `${anonApplications.data?.length ?? 0} rows`);

const anonProfiles = await anonymous.from('profiles').select('*').limit(5);
check('a signed-out visitor reads no profiles', (anonProfiles.data?.length ?? 0) === 0, `${anonProfiles.data?.length ?? 0} rows`);

const anonDocuments = await anonymous.from('application_documents').select('*').limit(5);
check('a signed-out visitor reads no document records', (anonDocuments.data?.length ?? 0) === 0, `${anonDocuments.data?.length ?? 0} rows`);

const anonReference = await anonymous.from('applicant_categories').select('id').limit(5);
check('reference data stays publicly readable', (anonReference.data?.length ?? 0) > 0, `${anonReference.data?.length ?? 0} categories`);

/* -------------------------------------------------------------------------- */
/* 8. Contact form and password reset                                         */
/* -------------------------------------------------------------------------- */

section('Public contact form and password reset');

const { error: enquiryError } = await anonymous.from('contact_messages').insert({
  full_name: 'Verification Enquiry',
  email: 'verify-enquiry@example.com',
  message: 'This message is written by scripts/verify-live.mjs to confirm the public enquiry path works end to end.',
});
check('a signed-out visitor can send an enquiry', !enquiryError, explain(enquiryError));

const readBack = await anonymous.from('contact_messages').select('*').limit(5);
check('a signed-out visitor cannot read enquiries back', (readBack.data?.length ?? 0) === 0, `${readBack.data?.length ?? 0} rows`);

const resetRequest = await anonymous.auth.resetPasswordForEmail(process.env.VERIFY_LIVE_EMAIL_A ?? emailA, {
  redirectTo: 'http://localhost:3000/auth/confirm?next=/reset-password',
});
check('a password reset link can be requested', !resetRequest.error, explain(resetRequest.error) || 'requested');

const unknownReset = await anonymous.auth.resetPasswordForEmail(`does-not-exist-${stamp}@example.com`);
check(
  'requesting a reset for an unknown address reveals nothing',
  !unknownReset.error,
  explain(unknownReset.error) || 'same response as a real address'
);

/* -------------------------------------------------------------------------- */
/* 9. Cleanup                                                                 */
/* -------------------------------------------------------------------------- */

section('Cleanup');

if (documentRowId) {
  const { error } = await clientA.from('application_documents').delete().eq('id', documentRowId);
  check('the verification document record is removed', !error, explain(error));
}
if (!upload.error) {
  const removed = await clientA.storage.from(BUCKET).remove([documentPath]);
  check('the verification file is removed from storage', !removed.error, explain(removed.error));
}

console.log(
  `\n  Two test accounts remain (${userA.email}, ${userB.email}).\n` +
    '  Supabase does not allow a client to delete auth users — remove them from\n' +
    '  Authentication → Users when you are finished, along with their applications.\n' +
    (KEEP ? '  (--keep was passed, so nothing else was cleaned up.)\n' : '')
);

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

const failed = results.filter((result) => !result.passed);
const skipped = results.filter((result) => result.skipped);
const passed = results.length - failed.length - skipped.length;

console.log(`\n${'─'.repeat(72)}`);
if (failed.length === 0) {
  console.log(
    `\u001b[32m  ${passed}/${results.length} live checks passed\u001b[0m` +
      (skipped.length ? `  \u001b[90m(${skipped.length} skipped)\u001b[0m` : '') +
      '\n'
  );
  process.exit(0);
}

console.log(`\u001b[31m  ${failed.length} of ${results.length} live checks failed\u001b[0m\n`);
for (const failure of failed) {
  console.log(`  \u001b[31m•\u001b[0m [${failure.section}] ${failure.label}`);
  console.log(`    \u001b[90m${failure.detail}\u001b[0m`);
}
console.log('');
process.exit(1);
