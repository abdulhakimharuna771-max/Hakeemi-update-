#!/usr/bin/env node
/**
 * Database verification harness.
 *
 * Runs the shipped migrations and seed files against a real PostgreSQL engine
 * (PGlite — PostgreSQL compiled to WebAssembly) inside a Supabase-shaped
 * environment, then asserts the behaviour the portal depends on:
 * schema, reference data, the draft/submit lifecycle, application number
 * allocation, and — most importantly — that Row Level Security actually stops
 * one applicant from reaching another applicant's data.
 *
 *   npm run db:verify
 *
 * Exit code is non-zero if any check fails.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const read = (p) => readFileSync(resolve(repoRoot, p), 'utf8');

const MIGRATIONS = [
  'supabase/migrations/0001_foundation.sql',
  'supabase/migrations/0002_reference_tables.sql',
  'supabase/migrations/0003_core_tables.sql',
  'supabase/migrations/0004_logic.sql',
  'supabase/migrations/0005_rls.sql',
  'supabase/migrations/0006_storage.sql',
  'supabase/migrations/0007_contact_messages.sql',
];

const SEEDS = [
  'supabase/seed/001_reference_data.sql',
  'supabase/seed/002_locations_nigeria.sql',
];

// ---------------------------------------------------------------------------
// Minimal test runner
// ---------------------------------------------------------------------------
const results = [];
let currentSection = '';

function section(name) {
  currentSection = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

function record(ok, name, detail) {
  results.push({ ok, name, section: currentSection, detail });
  const mark = ok ? '\x1b[32m  PASS\x1b[0m' : '\x1b[31m  FAIL\x1b[0m';
  console.log(`${mark}  ${name}${ok || !detail ? '' : `\n         \x1b[90m${detail}\x1b[0m`}`);
}

function check(name, condition, detail) {
  record(Boolean(condition), name, condition ? '' : detail ?? 'assertion was false');
}

function checkEqual(name, actual, expected) {
  const ok = actual === expected;
  record(ok, name, ok ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ---------------------------------------------------------------------------
// Supabase-shaped environment shim
// ---------------------------------------------------------------------------
async function createSupabaseShim(db) {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role authenticator noinherit login;

    create schema if not exists auth;
    create schema if not exists storage;
    create schema if not exists extensions;
  `);

  // auth.users — only the columns the portal's trigger and policies rely on.
  await db.exec(`
    create table if not exists auth.users (
      id                  uuid primary key default gen_random_uuid(),
      email               text unique,
      raw_user_meta_data  jsonb default '{}'::jsonb,
      email_confirmed_at  timestamptz,
      created_at          timestamptz not null default now()
    );
  `);

  // auth.uid() / auth.jwt(), matching Supabase's definitions.
  await db.exec(`
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      )::uuid
    $$;

    create or replace function auth.jwt()
    returns jsonb
    language sql
    stable
    as $$
      select coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb,
        jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true), ''))
      )
    $$;

    create or replace function auth.role()
    returns text
    language sql
    stable
    as $$ select coalesce(current_setting('request.jwt.claim.role', true), 'anon') $$;
  `);

  // Supabase grants the API roles usage on the auth schema and execute on the
  // claim helpers — without this, policies calling auth.uid() would fail with
  // "permission denied for schema auth" and the harness would be unfaithful.
  await db.exec(`
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;
    grant execute on function auth.role() to anon, authenticated;
  `);

  // storage — buckets + objects + foldername(), mirroring Supabase's storage API.
  await db.exec(`
    create table if not exists storage.buckets (
      id                 text primary key,
      name               text not null,
      public             boolean default false,
      file_size_limit    bigint,
      allowed_mime_types text[],
      created_at         timestamptz default now()
    );

    create table if not exists storage.objects (
      id         uuid primary key default gen_random_uuid(),
      bucket_id  text references storage.buckets(id),
      name       text,
      owner      uuid,
      created_at timestamptz default now(),
      unique (bucket_id, name)
    );

    create or replace function storage.foldername(name text)
    returns text[]
    language plpgsql
    immutable
    as $$
      declare _parts text[];
      begin
        select string_to_array(name, '/') into _parts;
        return _parts[1:array_length(_parts, 1) - 1];
      end
    $$;

    grant usage on schema storage to anon, authenticated;
    grant execute on function storage.foldername(text) to anon, authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant select on storage.buckets to anon, authenticated;
  `);
}

// ---------------------------------------------------------------------------
// Role switching helpers
// ---------------------------------------------------------------------------
async function actAs(db, role, user = null) {
  await db.exec('reset role;');
  if (user) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user.id]);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [
      JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated' }),
    ]);
  } else {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
  if (role) await db.exec(`set role ${role};`);
}

async function asSystem(db) {
  await db.exec('reset role;');
}

async function count(db, sql, params = []) {
  const r = await db.query(sql, params);
  return Number(r.rows[0]?.count ?? 0);
}

async function expectErrorWithParams(db, sql, params, expectSubstring) {
  try {
    await db.query(sql, params);
    return { ok: false, reason: 'statement unexpectedly succeeded' };
  } catch (error) {
    const message = String(error.message ?? error);
    const detail = String(error.detail ?? '');
    const haystack = `${message} ${detail}`;
    const ok = haystack.includes(expectSubstring);
    return { ok, ok_detail: message, reason: ok ? haystack : `expected "${expectSubstring}" but got "${message}"` };
  }
}

async function expectError(db, sql, expectSubstring) {
  try {
    await db.query(sql);
    return { ok: false, reason: 'statement unexpectedly succeeded' };
  } catch (error) {
    const message = String(error.message ?? error);
    const detail = String(error.detail ?? '');
    const haystack = `${message} ${detail}`;
    const ok = haystack.includes(expectSubstring);
    return { ok, reason: ok ? haystack : `expected "${expectSubstring}" but got "${message}"` };
  }
}

async function affected(db, sql, params = []) {
  const r = await db.query(sql, params);
  return r.affectedRows ?? 0;
}

// ---------------------------------------------------------------------------
// Fixture payload
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\x1b[1mGIZMO DAN KAITA — Phase 1 database verification\x1b[0m');
  console.log('Engine: PGlite (PostgreSQL via WebAssembly), Supabase-compatible shim\n');

  const db = await PGlite.create();
  await createSupabaseShim(db);

  // --- Migrations --------------------------------------------------------
  section('Migrations apply cleanly');
  for (const file of MIGRATIONS) {
    try {
      await db.exec(read(file));
      check(`applied ${file.split('/').pop()}`, true);
    } catch (error) {
      check(`applied ${file.split('/').pop()}`, false, String(error.message ?? error).split('\n')[0]);
    }
  }

  section('Migrations are re-runnable (safe to paste twice)');
  for (const file of MIGRATIONS) {
    try {
      await db.exec(read(file));
      check(`re-applied ${file.split('/').pop()}`, true);
    } catch (error) {
      check(`re-applied ${file.split('/').pop()}`, false, String(error.message ?? error).split('\n')[0]);
    }
  }

  // --- Seeds -------------------------------------------------------------
  section('Seed data');
  await db.exec(read(SEEDS[0]));
  check('applied reference data seed', true);
  await db.exec(read(SEEDS[1]));
  check('applied Nigeria location seed', true);

  const counts = {
    states: await count(db, `select count(*) from public.locations where level = 'state'`),
    lgas: await count(db, `select count(*) from public.locations where level = 'lga'`),
    wards: await count(db, `select count(*) from public.locations where level = 'ward'`),
    categories: await count(db, 'select count(*) from public.applicant_categories'),
    supportNeeds: await count(db, 'select count(*) from public.support_needs'),
    documentTypes: await count(db, 'select count(*) from public.document_types'),
    statuses: await count(db, 'select count(*) from public.application_statuses'),
    programs: await count(db, 'select count(*) from public.programs'),
  };
  checkEqual('37 states seeded', counts.states, 37);
  checkEqual('774 LGAs seeded', counts.lgas, 774);
  checkEqual('8809 wards seeded', counts.wards, 8809);
  checkEqual('5 applicant categories seeded', counts.categories, 5);
  checkEqual('11 support needs seeded', counts.supportNeeds, 11);
  checkEqual('7 document types seeded', counts.documentTypes, 7);
  checkEqual('9 application statuses seeded', counts.statuses, 9);
  checkEqual('1 program seeded', counts.programs, 1);

  checkEqual(
    'no applicant rows exist in a freshly seeded database',
    await count(db, 'select count(*) from public.applications'),
    0
  );
  checkEqual(
    'no fake notifications seeded',
    await count(db, 'select count(*) from public.notifications'),
    0
  );

  // --- Structure ---------------------------------------------------------
  section('Schema structure');
  const requiredTables = [
    'contact_messages',
    'profiles', 'applications', 'applicant_categories', 'locations',
    'application_support_needs', 'support_needs', 'application_documents',
    'application_status_history', 'notifications', 'programs', 'application_statuses',
    'document_types',
  ];
  for (const table of requiredTables) {
    checkEqual(`table public.${table} exists`, await count(
      db,
      `select count(*) from pg_tables where schemaname = 'public' and tablename = $1`,
      [table]
    ), 1);
  }

  const rlsTables = [
    'contact_messages',
    'profiles', 'applications', 'application_support_needs', 'application_documents',
    'application_status_history', 'notifications', 'locations', 'applicant_categories',
    'support_needs', 'document_types', 'programs', 'application_statuses',
  ];
  for (const table of rlsTables) {
    checkEqual(`RLS enabled on ${table}`, await count(
      db,
      `select count(*) from pg_tables where schemaname = 'public' and tablename = $1 and rowsecurity = true`,
      [table]
    ), 1);
  }

  checkEqual('storage.objects RLS enabled', await count(
    db,
    `select count(*) from pg_tables where schemaname = 'storage' and tablename = 'objects' and rowsecurity = true`
  ), 1);

  // --- Users -------------------------------------------------------------
  section('Signup creates a profile');
  const userA = { id: '11111111-1111-4111-8111-111111111111', email: 'applicant.a@example.com' };
  const userB = { id: '22222222-2222-4222-8222-222222222222', email: 'applicant.b@example.com' };
  const userC = { id: '33333333-3333-4333-8333-333333333333', email: 'applicant.c@example.com' };

  for (const u of [userA, userB, userC]) {
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
      [u.id, u.email, JSON.stringify({ full_name: `Test Applicant ${u.email.slice(0, -12)}`, phone: '08030000000' })]
    );
  }
  checkEqual('profiles created for 3 signups', await count(db, 'select count(*) from public.profiles'), 3);
  checkEqual(
    'new profiles default to the applicant role',
    await count(db, `select count(*) from public.profiles where role = 'applicant'`),
    3
  );
  checkEqual(
    'signup metadata populates the profile name',
    await count(db, `select count(*) from public.profiles where full_name is not null`),
    3
  );

  // --- Geography lookup --------------------------------------------------
  const oyo = (await db.query(
    `select id from public.locations where level = 'state' and name = 'OYO'`
  )).rows[0];
  const oyoIbadanNorth = (await db.query(
    `select id, state_id from public.locations where level = 'lga' and name = 'IBADAN NORTH' and state_id = $1`,
    [oyo.id]
  )).rows[0];
  const oyoWard = (await db.query(
    `select id from public.locations where level = 'ward' and lga_id = $1 order by code limit 1`,
    [oyoIbadanNorth.id]
  )).rows[0];
  const lagosLga = (await db.query(
    `select l.id from public.locations l join public.locations s on s.id = l.state_id
      where l.level = 'lga' and s.name = 'LAGOS' order by l.code limit 1`
  )).rows[0];
  check('Oyo State resolves', Boolean(oyo?.id));
  check('Ibadan North LGA resolves and carries its state', oyoIbadanNorth?.state_id === oyo?.id);
  check('a ward within Ibadan North resolves', Boolean(oyoWard?.id));

  const categoryIds = {};
  for (const row of (await db.query('select id, code from public.applicant_categories')).rows) {
    categoryIds[row.code] = row.id;
  }

  // --- Draft lifecycle ---------------------------------------------------
  section('Draft lifecycle (save progress / continue later)');
  await actAs(db, 'authenticated', userA);

  const draft1 = (await db.query(
    `select public.save_application_draft($1::jsonb, null) as app`,
    [JSON.stringify({
      full_name: 'Amina Yusuf Bello',
      phone: '08031234567',
      current_step: 2,
    })]
  )).rows[0].app;

  check('save_application_draft creates a draft', draft1?.status === 'DRAFT');
  check('draft has no application number yet', draft1?.application_number === null);
  check('draft completion reflects partial entry', Number(draft1?.completion_percent) > 0 && Number(draft1?.completion_percent) < 100,
    `completion_percent = ${draft1?.completion_percent}`);

  const draft2 = (await db.query(
    `select public.save_application_draft($1::jsonb, null) as app`,
    [JSON.stringify({ address: 'No. 14, Testing Layout, Ibadan', current_step: 3 })]
  )).rows[0].app;
  check('a second save updates the same draft (no duplicate)', draft2?.id === draft1?.id);
  check('previously saved fields survive a partial save', draft2?.full_name === 'Amina Yusuf Bello');
  check('current step is persisted for "continue later"', Number(draft2?.current_step) === 3);

  const unknownKey = await expectError(
    db,
    `select public.save_application_draft('{"status":"APPROVED"}'::jsonb, null)`,
    'unknown_fields'
  );
  check('draft save rejects non-whitelisted keys (cannot smuggle status)', unknownKey.ok, unknownKey.reason);

  const badGeo = await expectErrorWithParams(
    db,
    `select public.save_application_draft($1::jsonb, null)`,
    [JSON.stringify({ state_id: oyo.id, lga_id: lagosLga.id })],
    'lga_state_mismatch'
  );
  check('contradictory state/LGA is rejected', badGeo.ok, badGeo.reason);

  const foreignWard = (await db.query(
    `select id from public.locations
      where level = 'ward' and state_id = $1 and lga_id <> $2 order by code limit 1`,
    [oyo.id, oyoIbadanNorth.id]
  )).rows[0];
  const badWard = await expectErrorWithParams(
    db,
    `select public.save_application_draft($1::jsonb, null)`,
    [JSON.stringify({ state_id: oyo.id, lga_id: oyoIbadanNorth.id, ward_id: foreignWard.id })],
    'ward_lga_mismatch'
  );
  check('ward from a different LGA is rejected', badWard.ok, badWard.reason);

  // category + category_details validation
  const missingDetails = await expectErrorWithParams(
    db,
    `select public.save_application_draft($1::jsonb, null)`,
    [JSON.stringify({
      category_id: categoryIds.STUDENT,
      category_details: { institution: 'University of Ibadan' },
    })],
    'invalid_category_details'
  );
  check('category-specific required fields are enforced', missingDetails.ok, missingDetails.reason);

  const badOption = await expectErrorWithParams(
    db,
    `select public.save_application_draft($1::jsonb, null)`,
    [JSON.stringify({
      category_id: categoryIds.STUDENT,
      category_details: {
        institution: 'University of Ibadan',
        department: 'Computer Science',
        study_level: 'Doctorate',
        fyp_status: 'In progress',
      },
    })],
    'invalid_category_details'
  );
  check('category select values are validated against the DB schema', badOption.ok, badOption.reason);

  const goodDetails = (await db.query(
    `select public.save_application_draft($1::jsonb, null) as app`,
    [JSON.stringify({
      category_id: categoryIds.STUDENT,
      category_details: {
        institution: 'University of Ibadan',
        department: 'Computer Science',
        course_of_study: 'B.Sc. Computer Science',
        study_level: 'Undergraduate',
        fyp_status: 'In progress',
      },
      state_id: oyo.id,
      lga_id: oyoIbadanNorth.id,
      ward_id: oyoWard.id,
    })]
  )).rows[0].app;
  check('valid category details are accepted', Array.isArray(goodDetails) === false && goodDetails?.category_id === categoryIds.STUDENT);
  check('geography is auto-resolved/normalised', goodDetails?.state_id === oyo.id && goodDetails?.lga_id === oyoIbadanNorth.id);

  const badSupport = await expectError(
    db,
    `select public.save_application_draft('{"support_needs":[{"code":"FREE_MONEY"}]}'::jsonb, null)`,
    'unknown_support_need'
  );
  check('unknown support need codes are rejected', badSupport.ok, badSupport.reason);

  const otherNeedsDetails = await expectError(
    db,
    `select public.save_application_draft('{"support_needs":[{"code":"OTHER"}]}'::jsonb, null)`,
    'support_details_required'
  );
  check('support needs requiring detail are enforced', otherNeedsDetails.ok, otherNeedsDetails.reason);

  // derived column tampering
  const tampered = (await db.query(
    `update public.applications set completion_percent = 99, missing_fields = array['x'] returning completion_percent, missing_fields`
  )).rows[0];
  check('client cannot force completion_percent', Number(tampered?.completion_percent) !== 99, `got ${tampered?.completion_percent}`);
  check('client cannot force missing_fields', JSON.stringify(tampered?.missing_fields) !== '["x"]');

  const escalate = await expectError(
    db,
    `update public.profiles set role = 'admin' where id = auth.uid()`,
    'role_change_not_permitted'
  );
  check('applicant cannot escalate their own role to admin', escalate.ok, escalate.reason);

  const setStatus = await expectError(
    db,
    `update public.applications set status = 'APPROVED'`,
    'status_change_not_permitted'
  );
  check('applicant cannot set their own application status', setStatus.ok, setStatus.reason);

  const setNumber = await expectError(
    db,
    `update public.applications set application_number = 'GKO-2026-HACKED'`,
    'application_number_not_permitted'
  );
  check('applicant cannot fabricate an application number', setNumber.ok, setNumber.reason);

  // --- Other applicant's data -------------------------------------------
  section('An applicant is isolated from other applicants');
  await actAs(db, 'authenticated', userB);

  checkEqual(
    "applicant B cannot see applicant A's application",
    await count(db, 'select count(*) from public.applications'),
    0
  );
  checkEqual(
    "applicant B cannot see applicant A's profile",
    await count(db, `select count(*) from public.profiles where id <> auth.uid()`),
    0
  );
  checkEqual(
    "applicant B sees only their own profile",
    await count(db, 'select count(*) from public.profiles'),
    1
  );

  checkEqual(
    "applicant B cannot update applicant A's application",
    await affected(db, `update public.applications set full_name = 'Compromised'`),
    0
  );
  checkEqual(
    "applicant B cannot delete applicant A's application",
    await affected(db, `delete from public.applications`),
    0
  );
  checkEqual(
    "applicant B cannot read applicant A's documents",
    await count(db, 'select count(*) from public.application_documents'),
    0
  );
  checkEqual(
    "applicant B cannot read applicant A's notifications",
    await count(db, 'select count(*) from public.notifications'),
    0
  );
  checkEqual(
    "applicant B cannot read applicant A's status history",
    await count(db, 'select count(*) from public.application_status_history'),
    0
  );
  const checklistForeign = await expectErrorWithParams(
    db,
    `select public.get_application_checklist($1) as c`,
    [draft1.id],
    'application_not_found'
  );
  check(
    "applicant B cannot read applicant A's checklist",
    checklistForeign.ok,
    checklistForeign.reason
  );

  checkEqual(
    "applicant B cannot attach support needs to applicant A's application",
    await affected(
      db,
      `insert into public.application_support_needs (application_id, support_need_id)
       select id, (select id from public.support_needs where code = 'FUNDING')
       from public.applications`
    ),
    0
  );

  const submitOthers = await expectError(
    db,
    `select public.submit_application('${draft1.id}')`,
    'application_not_found'
  );
  check(
    "applicant B cannot submit applicant A's application (and gets no signal it exists)",
    submitOthers.ok,
    submitOthers.reason
  );
  checkEqual(
    'an anonymous visitor cannot read applications at all',
    await (async () => {
      await actAs(db, 'anon');
      const r = await expectError(db, 'select count(*) from public.applications', 'permission denied');
      return r.ok ? 1 : 0;
    })(),
    1
  );
  checkEqual(
    'an anonymous visitor CAN read public reference data',
    await (async () => {
      await actAs(db, 'anon');
      return count(db, 'select count(*) from public.applicant_categories');
    })(),
    5
  );

  // --- Submission --------------------------------------------------------
  section('Submission, validation and Application ID generation');

  await actAs(db, 'authenticated', userA);
  const incomplete = await expectError(
    db,
    `select public.submit_application('${draft1.id}')`,
    'missing_fields'
  );
  check('submitting an incomplete application is refused', incomplete.ok, incomplete.reason);
  check(
    'the refusal names exactly which fields are missing',
    incomplete.reason.includes('project_name') && incomplete.reason.includes('terms_accepted'),
    incomplete.reason
  );

  // Complete it.
  await db.query(
    `select public.save_application_draft($1::jsonb, null)`,
    [JSON.stringify({
      full_name: 'Amina Yusuf Bello',
      phone: '08031234567',
      address: 'No. 14, Testing Layout, Ibadan',
      community: 'Bodija',
      project_name: 'Smart Irrigation Advisory',
      project_description: 'A low-cost soil moisture device paired with SMS advisories for smallholder farmers.',
      problem_statement: 'Smallholder farmers irrigate by guesswork, wasting water and losing yield.',
      opportunity_statement: 'Widespread mobile phone use makes advisory services viable at scale.',
      current_stage: 'Working prototype',
      target_beneficiaries: 'Smallholder vegetable farmers',
      skills: ['Embedded systems', 'Agronomy'],
      expected_impact: 'Reduce water use and improve dry-season yields.',
      terms_accepted: true,
      accuracy_confirmed: true,
      current_step: 7,
      support_needs: [{ code: 'TRAINING' }, { code: 'FUNDING' }, { code: 'EQUIPMENT' }],
    })]
  );

  const submitted = (await db.query(`select public.submit_application('${draft1.id}') as app`)).rows[0].app;
  checkEqual('status becomes SUBMITTED', submitted?.status, 'SUBMITTED');
  check('application number has the GKO-YYYY-XXXXXX format',
    /^GKO-\d{4}-[A-Z0-9]{6}$/.test(submitted?.application_number ?? ''),
    `got ${submitted?.application_number}`);
  check('application number avoids ambiguous characters (0/1/I/L/O)',
    !/[01ILO]/.test((submitted?.application_number ?? '').slice(9)),
    `got ${submitted?.application_number}`);
  check('submitted_at is stamped', Boolean(submitted?.submitted_at));
  check('terms_accepted_at is stamped', Boolean(submitted?.terms_accepted_at));
  check('completion reaches 100%', Number(submitted?.completion_percent) === 100,
    `got ${submitted?.completion_percent}`);

  const checklist = (await db.query(
    `select public.get_application_checklist('${draft1.id}') as c`
  )).rows[0].c;
  check('checklist RPC reports the application as submitted and locked',
    checklist?.status === 'SUBMITTED' && checklist?.is_editable === false,
    JSON.stringify(checklist?.status));
  check('checklist RPC reports 100% completion with nothing missing',
    Number(checklist?.completion_percent) === 100 && (checklist?.missing_fields ?? []).length === 0,
    JSON.stringify({ p: checklist?.completion_percent, m: checklist?.missing_fields }));
  const resubmit = await expectError(
    db,
    `select public.submit_application('${draft1.id}')`,
    'already_submitted'
  );
  check('an application cannot be submitted twice', resubmit.ok, resubmit.reason);

  checkEqual(
    'submission writes exactly one status-history entry',
    await count(db, `select count(*) from public.application_status_history where application_id = '${draft1.id}'`),
    1
  );
  checkEqual(
    'submission creates an applicant notification',
    await count(db, `select count(*) from public.notifications where user_id = '${userA.id}'`),
    1
  );

  checkEqual(
    'a submitted application is no longer editable by the applicant',
    await affected(db, `update public.applications set full_name = 'Changed After Submit'`),
    0
  );

  const stillOriginal = (await (async () => {
    await asSystem(db);
    const r = await db.query(`select full_name from public.applications where id = '${draft1.id}'`);
    return r.rows[0].full_name;
  })()) ;
  checkEqual('the submitted record is intact', stillOriginal, 'Amina Yusuf Bello');

  // A second applicant submits a complete application of their own.
  await asSystem(db);
  const kanoStateId = (await db.query(`select id from public.locations where level = 'state' and name = 'KANO'`)).rows[0].id;
  const kanoLga = (await db.query(
    `select id from public.locations where level = 'lga' and state_id = $1 order by code limit 1`,
    [kanoStateId]
  )).rows[0];
  const kanoWard = (await db.query(
    `select id from public.locations where level = 'ward' and lga_id = $1 order by code limit 1`,
    [kanoLga.id]
  )).rows[0];
  await actAs(db, 'authenticated', userB);
  await db.query(`select public.save_application_draft($1::jsonb, null)`, [
    JSON.stringify({
      full_name: 'Ibrahim Musa Aliyu',
      phone: '08087654321',
      address: 'No. 8, Second Layout, Kano',
      community: 'Nassarawa',
      category_id: categoryIds.FARMER,
      category_details: {
        farming_type: 'Crop farming',
        main_products: 'Tomatoes, pepper',
        production_stage: 'Small-scale commercial',
        main_challenge: 'Storage losses after harvest.',
      },
      state_id: kanoStateId,
      lga_id: kanoLga.id,
      ward_id: kanoWard.id,
      project_name: 'Tomato Storage Cooperative',
      project_description: 'A shared cold-storage and aggregation point for tomato farmers.',
      problem_statement: 'Post-harvest losses destroy up to half of the tomato harvest each season.',
      opportunity_statement: 'Aggregating produce creates bargaining power with off-takers.',
      current_stage: 'Idea stage',
      target_beneficiaries: 'Tomato farmers around Kano',
      skills: ['Agro-processing', 'Cooperative management'],
      expected_impact: 'Cut post-harvest losses and raise farmer income.',
      terms_accepted: true,
      accuracy_confirmed: true,
      current_step: 7,
      support_needs: [{ code: 'EQUIPMENT' }, { code: 'MARKET_ACCESS' }],
    }),
  ]);
  const draftB = (await db.query(
    `select id from public.applications order by created_at limit 1`
  )).rows[0];
  const submittedB = (await db.query(`select public.submit_application('${draftB.id}') as app`)).rows[0].app;

  check('a second applicant receives a different application number',
    submittedB?.application_number !== submitted?.application_number,
    `A=${submitted?.application_number} B=${submittedB?.application_number}`);
  check('numbers share the expected year prefix',
    submittedB?.application_number?.startsWith('GKO-' + new Date().getFullYear()),
    `got ${submittedB?.application_number}`);

  await asSystem(db);
  checkEqual(
    'duplicate (user, program) applications are impossible',
    await count(db, `select count(*) from public.applications where user_id = '${userA.id}'`),
    1
  );
  checkEqual(
    'application numbers are unique in the database',
    await count(db, 'select count(distinct application_number) from public.applications'),
    2
  );

  // --- Admin readiness ---------------------------------------------------
  section('Admin readiness (Phase 3 preparation, no admin UI shipped)');
  await asSystem(db);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [userB.id]);
  checkEqual(
    'a profile can be promoted by a privileged writer',
    await count(db, `select count(*) from public.profiles where role = 'admin'`),
    1
  );

  await actAs(db, 'authenticated', userB);
  checkEqual(
    'an admin sees every application',
    await count(db, 'select count(*) from public.applications'),
    2
  );
  checkEqual(
    'is_admin() reflects the role',
    (await db.query('select public.is_admin() as v')).rows[0].v,
    true
  );

  const adminUpdate = await affected(
    db,
    `update public.applications set status = 'UNDER_REVIEW' where id = '${draft1.id}'`
  );
  checkEqual('an admin can advance a status', adminUpdate, 1);
  checkEqual(
    'the admin transition is recorded in history',
    await count(db, `select count(*) from public.application_status_history where application_id = '${draft1.id}'`),
    2
  );
  checkEqual(
    'a status change notifies the applicant',
    await count(db, `select count(*) from public.notifications where user_id = '${userA.id}' and type = 'STATUS_CHANGED'`),
    1
  );
  checkEqual(
    'reviewed_at is stamped on entering review',
    await count(db, `select count(*) from public.applications where id = '${draft1.id}' and reviewed_at is not null`),
    1
  );

  // internal-only history entry must stay hidden from the applicant
  await db.query(
    `insert into public.application_status_history (application_id, from_status, to_status, note, visible_to_applicant)
     values ('${draft1.id}', 'UNDER_REVIEW', 'UNDER_REVIEW', 'Internal reviewer note', false)`
  );

  await actAs(db, 'authenticated', userA);
  checkEqual(
    'the applicant sees their status timeline',
    await count(db, 'select count(*) from public.application_status_history'),
    2
  );
  checkEqual(
    'internal reviewer entries are never exposed to the applicant',
    await count(db, `select count(*) from public.application_status_history where note = 'Internal reviewer note'`),
    0
  );
  checkEqual(
    'the applicant sees their own notification feed',
    await count(db, 'select count(*) from public.notifications'),
    2
  );

  const markRead = await affected(db, `update public.notifications set is_read = true where type = 'STATUS_CHANGED'`);
  checkEqual('an applicant can mark their notification read', markRead, 1);
  checkEqual(
    'read_at is filled automatically',
    await count(db, `select count(*) from public.notifications where is_read and read_at is not null`),
    1
  );
  const tamperNotification = (await db.query(
    `update public.notifications set title = 'Forged notice', body = 'x' where is_read returning title`
  )).rows;
  check(
    'notification content cannot be edited by an applicant',
    tamperNotification.length === 0 || tamperNotification[0].title !== 'Forged notice',
    JSON.stringify(tamperNotification)
  );

  // --- Documents ---------------------------------------------------------
  section('Documents and private storage');
  await asSystem(db);

  // A new draft for applicant C, to exercise document writes.
  await actAs(db, 'authenticated', userC);
  const draftC = (await db.query(
    `select public.save_application_draft('{"full_name":"Sadiq Abdullahi","current_step":1}'::jsonb, null) as app`
  )).rows[0].app;
  check('applicant C has a draft', draftC?.status === 'DRAFT');

  const docInsertOwn = await affected(
    db,
    `insert into public.application_documents (application_id, owner_id, document_type_id, storage_path, file_name, file_size, mime_type)
     values (
       '${draftC.id}', '${userC.id}',
       (select id from public.document_types where code = 'IDENTIFICATION'),
       '${userC.id}/${draftC.id}/identification/cv.pdf', 'cv.pdf', 20480, 'application/pdf'
     )`
  );
  checkEqual('an applicant can register a document on their own draft', docInsertOwn, 1);

  const docInsertOther = await expectError(
    db,
    `insert into public.application_documents (application_id, owner_id, storage_path, file_name, file_size, mime_type)
     values ('${draft1.id}', '${userA.id}', 'x/y/z.pdf', 'z.pdf', 100, 'application/pdf')`,
    'row-level security'
  );
  check('an applicant cannot attach a document to someone else\'s application',
    docInsertOther.ok, docInsertOther.reason);

  const bucket = (await db.query(`select * from storage.buckets where id = 'applicant-documents'`)).rows[0];
  check('the documents bucket exists', Boolean(bucket));
  checkEqual('the documents bucket is private', bucket?.public, false);
  checkEqual('the bucket enforces a 5 MB limit', Number(bucket?.file_size_limit), 5242880);
  check('the bucket restricts MIME types', (bucket?.allowed_mime_types ?? []).includes('application/pdf'));

  // Storage object policies
  await actAs(db, 'authenticated', userC);
  const objOwn = await affected(
    db,
    `insert into storage.objects (bucket_id, name, owner) values ('applicant-documents', '${userC.id}/${draftC.id}/identification/cv.pdf', '${userC.id}')`
  );
  checkEqual('an applicant can upload into their own storage folder', objOwn, 1);

  const objOther = await expectError(
    db,
    `insert into storage.objects (bucket_id, name, owner) values ('applicant-documents', '${userA.id}/anything/stolen.pdf', '${userC.id}')`,
    'row-level security'
  );
  check('an applicant cannot upload into another applicant\'s storage folder', objOther.ok, objOther.reason);

  await actAs(db, 'authenticated', userA);
  checkEqual(
    "an applicant cannot list another applicant's stored files",
    await count(db, `select count(*) from storage.objects where owner = '${userC.id}'`),
    0
  );

  // --- Views -------------------------------------------------------------
  section('Dashboard-ready views respect the caller');
  checkEqual(
    'an applicant sees only their own row through the overview view',
    await count(db, 'select count(*) from public.v_applications_overview'),
    1
  );
  const supportDemand = await count(db, 'select count(*) from public.v_support_need_demand');
  checkEqual('support-demand view is queryable', supportDemand, 11);

  await actAs(db, 'authenticated', userB);
  checkEqual(
    'an admin sees every application, including other applicants\' drafts',
    await count(db, 'select count(*) from public.v_applications_overview'),
    3
  );

  // --- Contact form -------------------------------------------------------
  section('Public contact form stores enquiries privately');
  await actAs(db, 'anon');
  const contactInserted = await affected(
    db,
    `insert into public.contact_messages (full_name, email, message)
     values ('Public Enquirer', 'enquirer@example.com', 'Please share the registration deadline.')`
  );
  checkEqual('an anonymous visitor can send an enquiry', contactInserted, 1);

  const shortMessage = await expectError(
    db,
    `insert into public.contact_messages (full_name, email, message) values ('A B', 'x@y.co', 'hi')`,
    'contact_messages_message_len'
  );
  check('an enquiry that is too short is rejected by the database', shortMessage.ok, shortMessage.reason);

  const badEmail = await expectError(
    db,
    `insert into public.contact_messages (full_name, email, message) values ('A B', 'not-an-email', 'A sufficiently long enquiry message.')`,
    'contact_messages_email_like'
  );
  check('an enquiry with a malformed email is rejected', badEmail.ok, badEmail.reason);

  checkEqual(
    'the public cannot read enquiries back',
    await (async () => {
      const r = await expectError(db, 'select count(*) from public.contact_messages', 'permission denied');
      return r.ok ? 1 : 0;
    })(),
    1
  );

  await actAs(db, 'authenticated', userB);
  checkEqual(
    'an admin can read enquiries (Phase 3 dashboard readiness)',
    await count(db, 'select count(*) from public.contact_messages'),
    1
  );

  // --- Application number distribution -----------------------------------
  section('Application ID space');
  await asSystem(db);
  const sample = (await db.query(
    `select public.generate_application_number() as n from generate_series(1, 400)`
  )).rows.map((r) => r.n);
  checkEqual('400 generated numbers are all distinct', new Set(sample).size, 400);
  check('all generated numbers match the public format',
    sample.every((n) => /^GKO-\d{4}-[A-Z0-9]{6}$/.test(n)),
    `examples: ${sample.filter((n) => !/^GKO-\d{4}-[A-Z0-9]{6}$/.test(n)).slice(0, 3).join(', ')}`);
  check('generated numbers never contain ambiguous characters',
    sample.every((n) => !/[01IO]/.test(n.slice(9))),
    `examples: ${sample.filter((n) => /[01IO]/.test(n.slice(9))).slice(0, 3).join(', ')}`);
  const lastChars = sample.map((n) => n.slice(-1));
  check('generated numbers are not sequential',
    new Set(lastChars).size > 3,
    `distinct trailing characters: ${new Set(lastChars).size}`);

  // --- Summary -----------------------------------------------------------
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '─'.repeat(72));
  console.log(
    `${results.length - failed.length}/${results.length} checks passed` +
      (failed.length ? `  —  \x1b[31m${failed.length} failed\x1b[0m` : '  —  \x1b[32mall green\x1b[0m')
  );
  if (failed.length) {
    console.log('\nFailed checks:');
    for (const f of failed) console.log(`  • [${f.section}] ${f.name}\n    ${f.detail}`);
  }
  console.log('─'.repeat(72));

  await db.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('\nVerification harness crashed:\n', error);
  process.exit(1);
});
