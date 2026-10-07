#!/usr/bin/env node
/**
 * Generates supabase/seed/002_locations_nigeria.sql from the official INEC
 * electoral geography (37 states, 774 LGAs, 8,809 wards).
 *
 * Source: the `nigeria-inec-geo` dev dependency, which is scraped from the INEC
 * Continuous Voter Registration portal (https://cvr.inecnigeria.org/pu) and
 * ships a manifest with INEC's own published counts. The generator refuses to
 * write output when the counts do not match, so a corrupted dataset cannot
 * silently produce a wrong geography table.
 *
 *   npm run db:seed:locations
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const EXPECTED = { states: 37, lgas: 774, wards: 8809 };

function loadData() {
  try {
    const states = require('nigeria-inec-geo/data/states.json');
    const lgas = require('nigeria-inec-geo/data/lgas.json');
    const wards = require('nigeria-inec-geo/data/wards.json');
    let manifest = {};
    try {
      manifest = require('nigeria-inec-geo/data/manifest.json');
    } catch {
      manifest = {};
    }
    return { states, lgas, wards, manifest };
  } catch (error) {
    console.error(
      '\nUnable to read the INEC geography dataset. Run `npm install` first.\n' + error.message
    );
    process.exit(1);
  }
}

function assertCounts(label, actual, expected) {
  if (actual !== expected) {
    console.error(`\nRefusing to generate: ${label} is ${actual}, expected ${expected}.\n`);
    process.exit(1);
  }
}

function sqlString(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Emits rows in batches so no single INSERT statement gets unreasonably large. */
function rowsToStatements(rows, batchSize, indent = '  ') {
  const statements = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    statements.push(chunk.map((r) => `${indent}(${r})`).join(',\n') + ';');
  }
  return statements;
}

function build() {
  const { states, lgas, wards, manifest } = loadData();

  assertCounts('states', states.length, EXPECTED.states);
  assertCounts('LGAs', lgas.length, EXPECTED.lgas);
  assertCounts('wards', wards.length, EXPECTED.wards);

  // Integrity checks: every LGA must reference a known state, every ward a known LGA.
  const stateCodes = new Set(states.map((s) => s.code));
  const lgaKeys = new Set();
  for (const lga of lgas) {
    if (!stateCodes.has(lga.state_code)) {
      console.error(`Refusing to generate: LGA ${lga.name} references unknown state ${lga.state_code}.`);
      process.exit(1);
    }
    const key = `${lga.state_code}/${lga.code}`;
    if (lgaKeys.has(key)) {
      console.error(`Refusing to generate: duplicate LGA key ${key}.`);
      process.exit(1);
    }
    lgaKeys.add(key);
  }

  const wardKeys = new Set();
  for (const ward of wards) {
    const parent = `${ward.state_code}/${ward.lga_code}`;
    if (!lgaKeys.has(parent)) {
      console.error(`Refusing to generate: ward ${ward.name} references unknown LGA ${parent}.`);
      process.exit(1);
    }
    const key = `${parent}/${ward.code}`;
    if (wardKeys.has(key)) {
      console.error(`Refusing to generate: duplicate ward key ${key}.`);
      process.exit(1);
    }
    wardKeys.add(key);
  }

  const lgaCountByState = new Map();
  for (const lga of lgas) {
    lgaCountByState.set(lga.state_code, (lgaCountByState.get(lga.state_code) ?? 0) + 1);
  }

  const stateRows = states.map(
    (s) => `${sqlString('state')}, ${sqlString(s.code)}, ${sqlString(s.name)}, null`
  );

  const lgaRows = lgas.map(
    (l) =>
      `${sqlString('lga')}, ${sqlString(`${l.state_code}/${l.code}`)}, ${sqlString(l.name)}, ` +
      `${sqlString(l.state_code)}`
  );

  const wardRows = wards.map(
    (w) =>
      `${sqlString('ward')}, ${sqlString(`${w.state_code}/${w.lga_code}/${w.code}`)}, ` +
      `${sqlString(w.name)}, ${sqlString(`${w.state_code}/${w.lga_code}`)}`
  );

  const out = [];
  out.push(`-- =============================================================================
-- GIZMO DAN KAITA OFFICE PLUS — Nigerian location reference data
--
-- GENERATED FILE — do not edit by hand. Regenerate with:
--     npm run db:seed:locations
--
-- Source: INEC electoral geography (37 states, ${EXPECTED.lgas} LGAs, ${EXPECTED.wards} wards),
-- scraped from ${manifest.source ?? 'https://cvr.inecnigeria.org/pu'}${
    manifest.scraped_at ? `\n-- Dataset scraped at: ${manifest.scraped_at}` : ''
  }
-- INEC published counts: ${JSON.stringify(manifest.inec_published ?? EXPECTED)}
--
-- Row counts verified at generation time: ${states.length} states, ${lgas.length} LGAs, ${wards.length} wards.
-- Safe to re-run: locations are upserted by their official code.
-- =============================================================================

begin;

create temp table _seed_locations (
  level        text,
  code         text,
  name         text,
  parent_code  text
) on commit drop;
`);

  // One statement per batch of rows, uniform for every level.
  const normalised = [...stateRows, ...lgaRows, ...wardRows];

  out.push('insert into _seed_locations (level, code, name, parent_code) values');
  out.push(rowsToStatements(normalised, 1000).join('\n\ninsert into _seed_locations (level, code, name, parent_code) values\n'));

  out.push(`
-- States
insert into public.locations (level, code, name, parent_id, state_id, lga_id)
select 'state'::public.location_level, s.code, s.name, null, null, null
from _seed_locations s
where s.level = 'state'
on conflict (code) do update
  set name = excluded.name,
      parent_id = null,
      state_id = null,
      lga_id = null;

-- LGAs (parent = state; state_id points at the state, for one-join analytics)
insert into public.locations (level, code, name, parent_id, state_id, lga_id)
select 'lga'::public.location_level, s.code, s.name, p.id, p.id, null
from _seed_locations s
join public.locations p on p.code = s.parent_code and p.level = 'state'
where s.level = 'lga'
on conflict (code) do update
  set name = excluded.name,
      parent_id = excluded.parent_id,
      state_id = excluded.state_id,
      lga_id = null;

-- Wards (parent = LGA; denormalised ancestry = LGA and its state)
insert into public.locations (level, code, name, parent_id, state_id, lga_id)
select 'ward'::public.location_level, s.code, s.name, lg.id, lg.state_id, lg.id
from _seed_locations s
join public.locations lg on lg.code = s.parent_code and lg.level = 'lga'
where s.level = 'ward'
on conflict (code) do update
  set name = excluded.name,
      parent_id = excluded.parent_id,
      state_id = excluded.state_id,
      lga_id = excluded.lga_id;

commit;

-- Post-condition check: fails loudly rather than leaving a partial geography.
do $$
declare
  v_states int;
  v_lgas   int;
  v_wards  int;
begin
  select count(*) into v_states from public.locations where level = 'state';
  select count(*) into v_lgas   from public.locations where level = 'lga';
  select count(*) into v_wards  from public.locations where level = 'ward';

  if v_states <> ${EXPECTED.states} or v_lgas <> ${EXPECTED.lgas} or v_wards <> ${EXPECTED.wards} then
    raise exception 'location seed incomplete: % states, % lgas, % wards', v_states, v_lgas, v_wards;
  end if;

  raise notice 'location seed verified: % states, % lgas, % wards', v_states, v_lgas, v_wards;
end $$;
`);

  const target = resolve(repoRoot, 'supabase/seed/002_locations_nigeria.sql');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, out.join('\n'), 'utf8');

  const bytes = Buffer.byteLength(out.join('\n'), 'utf8');
  console.log(`Wrote ${target}`);
  console.log(`  states: ${states.length}`);
  console.log(`  LGAs:   ${lgas.length} (per state: ${[...lgaCountByState.values()].join(', ')})`);
  console.log(`  wards:  ${wards.length}`);
  console.log(`  size:   ${(bytes / 1024).toFixed(0)} KB`);
}

build();
