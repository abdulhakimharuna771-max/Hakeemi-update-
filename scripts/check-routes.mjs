#!/usr/bin/env node
/**
 * Route smoke test.
 *
 * Checks that every route answers the way it should — public pages render,
 * protected pages bounce a signed-out visitor to the login screen with a `next`
 * parameter, unknown paths 404 — and that the landing page still renders its
 * key content.
 *
 * It makes no assumptions about whether Supabase is configured: the expected
 * status codes are the same in both cases, because the redirect for a
 * signed-out visitor is produced by the application, not by the database.
 *
 * Usage — with a server already running:
 *   npm run check:routes                     # http://localhost:3000
 *   BASE_URL=https://… npm run check:routes
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

let failures = 0;
let checks = 0;

function pass(label, detail = '') {
  checks += 1;
  console.log(`\u001b[32m  PASS\u001b[0m  ${label}${detail ? `  \u001b[90m${detail}\u001b[0m` : ''}`);
}

function fail(label, detail) {
  checks += 1;
  failures += 1;
  console.log(`\u001b[31m  FAIL\u001b[0m  ${label}\n         \u001b[90m${detail}\u001b[0m`);
}

async function request(path) {
  const response = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' });
  const body = await response.text();
  return { status: response.status, location: response.headers.get('location'), body };
}

function expectStatus(label, actual, expected) {
  if (actual === expected) pass(label, `${actual}`);
  else fail(label, `expected ${expected}, got ${actual}`);
}

console.log(`\n\u001b[1mPublic routes\u001b[0m  (${BASE_URL})\n`);

const landing = await request('/');
expectStatus('GET /', landing.status, 200);

// With no Supabase credentials the portal cannot check a session, so the app
// sends a signed-out visitor to the login screen with an explicit
// "not configured" reason instead of a destination. Both states are valid; the
// script reports which one it found.
const UNCONFIGURED = landing.body.includes('not configured');

if (UNCONFIGURED) {
  console.log(
    '\n\u001b[33m  NOTE\u001b[0m  Supabase is not configured on this server.\n' +
      '        Protected routes are expected to redirect with error=not_configured.\n' +
      '        Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to\n' +
      '        exercise the full session redirect instead.\n'
  );
}

const LANDING_COPY = [
  'Turn Ideas Into Opportunities.',
  'Start registration',
  'Track application',
  'Who can register',
  'How it works',
  'Frequently asked questions',
];

for (const phrase of LANDING_COPY) {
  if (landing.body.includes(phrase)) pass(`landing page renders "${phrase}"`);
  else fail(`landing page renders "${phrase}"`, 'phrase not found in the HTML');
}

for (const path of ['/register', '/login', '/verify-email', '/forgot-password', '/reset-password']) {
  const response = await request(path);
  expectStatus(`GET ${path}`, response.status, 200);
}

console.log('\n\u001b[1mProtected routes redirect a signed-out visitor\u001b[0m\n');

for (const path of [
  '/portal/dashboard',
  '/portal/application',
  '/portal/documents',
  '/portal/profile',
  '/portal/notifications',
  '/track',
]) {
  const response = await request(path);

  if (![307, 308].includes(response.status)) {
    fail(`GET ${path}`, `expected a redirect, got ${response.status}`);
    continue;
  }

  const location = response.location ?? '';
  if (!location.includes('/login')) {
    fail(`GET ${path}`, `redirected to ${location || '(no Location header)'} instead of /login`);
    continue;
  }

  const decoded = decodeURIComponent(location);

  if (UNCONFIGURED) {
    if (!decoded.includes('error=not_configured')) {
      fail(`GET ${path}`, `expected error=not_configured, got ${location}`);
      continue;
    }
    pass(`GET ${path}`, `→ ${location}`);
    continue;
  }

  if (!decoded.includes(`next=${path}`)) {
    fail(`GET ${path}`, `redirect did not preserve the destination: ${location}`);
    continue;
  }

  pass(`GET ${path}`, `→ ${location}`);
}

console.log('\n\u001b[1mEdge cases\u001b[0m\n');

const confirm = await request('/auth/confirm');
if ([307, 308].includes(confirm.status) && (confirm.location ?? '').includes('error=')) {
  pass('GET /auth/confirm without a token', `→ ${confirm.location}`);
} else {
  fail('GET /auth/confirm without a token', `expected a redirect carrying an error, got ${confirm.status}`);
}

const notFound = await request('/definitely-not-a-real-page');
expectStatus('GET /definitely-not-a-real-page', notFound.status, 404);

const externalRedirect = await request('/auth/confirm?code=x&next=https://example.com');
if ((externalRedirect.location ?? '').includes('example.com')) {
  fail('external redirect target is refused', `redirected to ${externalRedirect.location}`);
} else {
  pass('external redirect target is refused');
}

console.log('');
if (failures === 0) {
  console.log(`\u001b[32m  ${checks}/${checks} route checks passed\u001b[0m`);
  process.exit(0);
}
console.log(`\u001b[31m  ${failures} of ${checks} route checks failed\u001b[0m`);
process.exit(1);
