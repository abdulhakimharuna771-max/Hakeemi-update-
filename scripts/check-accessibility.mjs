#!/usr/bin/env node
/**
 * Accessibility sanity check for the public routes.
 *
 * This is not a substitute for testing with a real screen reader, but it catches
 * the structural mistakes that affect assistive technology most often: unnamed
 * form controls, missing labels, several <h1> elements on one page, images
 * without alternative text, buttons with no accessible name and a missing
 * document language.
 *
 * Usage — with a server already running:
 *   npm run check:a11y                     # http://localhost:3000
 *   BASE_URL=https://… npm run check:a11y
 *
 * Signed-in routes (the portal and /track) redirect to the login page when no
 * session is present, so they are checked by hand rather than here.
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/**
 * `footer` notes whether the route carries the public site chrome; the auth
 * screens deliberately do not, and the 404 page is expected to answer 404.
 */
const ROUTES = [
  { path: '/', footer: true },
  { path: '/register', footer: false },
  { path: '/login', footer: false },
  { path: '/verify-email', footer: false },
  { path: '/forgot-password', footer: false },
  { path: '/reset-password', footer: false },
  { path: '/nope', footer: true, status: 404 },
];

const attr = (tag, name) => {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return match ? match[1] : null;
};

const stripTags = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

let failures = 0;
let checks = 0;

function report(route, problems) {
  if (problems.length === 0) return;
  failures += problems.length;
  console.log(`\u001b[31m  FAIL\u001b[0m  ${route}`);
  for (const problem of [...new Set(problems)]) console.log(`        · ${problem}`);
}

for (const route of ROUTES) {
  const problems = [];
  const expectedStatus = route.status ?? 200;
  let html = '';

  try {
    const response = await fetch(`${BASE_URL}${route.path}`);
    html = await response.text();
    if (response.status !== expectedStatus) {
      problems.push(`HTTP ${response.status} (expected ${expectedStatus})`);
    }
  } catch (error) {
    console.log(`\u001b[31m  FAIL\u001b[0m  ${route.path} — could not be reached (${error.message})`);
    failures += 1;
    continue;
  }

  // One <h1> per page, and a document language.
  const h1Count = [...html.matchAll(/<h1[\s>]/g)].length;
  if (h1Count !== 1) problems.push(`${h1Count} <h1> elements (expected exactly 1)`);
  if (!/<html[^>]+lang="en/i.test(html)) problems.push('missing lang attribute on <html>');

  // Every visible form control needs an accessible name.
  const labelFor = new Set(
    [...html.matchAll(/<label[^>]*>/g)].map((match) => attr(match[0], 'for')).filter(Boolean)
  );

  const controls = [...html.matchAll(/<(input|select|textarea)[^>]*>/g)].map((match) => match[0]);
  for (const control of controls) {
    const type = (attr(control, 'type') ?? '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset'].includes(type)) continue;
    if (type === 'file') continue; // checked separately: the wizard pairs it with a labelled <label for>

    const id = attr(control, 'id');
    const named =
      (id && labelFor.has(id)) || attr(control, 'aria-label') || attr(control, 'aria-labelledby');
    if (!named) problems.push(`control without an accessible name: ${control.slice(0, 90)}`);
  }

  // Radio groups must be grouped and described.
  const radios = [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((match) => match[0]);
  if (radios.length > 1) {
    const names = new Set(radios.map((radio) => attr(radio, 'name')));
    if (names.size !== 1) problems.push(`${names.size} radio group names (expected 1)`);
    if (!/<fieldset/i.test(html)) problems.push('radio group is not inside a <fieldset>');
  }

  for (const image of html.matchAll(/<img[^>]*>/g)) {
    if (!/alt\s*=/.test(image[0])) problems.push(`<img> without alt: ${image[0].slice(0, 80)}`);
  }

  for (const button of html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)) {
    const text = stripTags(button[1]);
    const labelled = /aria-label\s*=/.test(button[0]) || /aria-labelledby\s*=/.test(button[0]);
    if (!text && !labelled) problems.push(`button without an accessible name: ${button[0].slice(0, 80)}`);
  }

  // Landmarks and a way to skip past the navigation.
  if (!/id="main-content"/.test(html)) problems.push('no #main-content landmark');
  if (!/skip to main/i.test(html)) problems.push('no skip-to-content link');
  if (route.footer && !/<footer/i.test(html)) problems.push('no <footer> landmark');

  checks += 1;
  report(route.path, problems);
  if (problems.length === 0) console.log(`\u001b[32m  PASS\u001b[0m  ${route.path}`);
}

console.log('');
if (failures === 0) {
  console.log(`\u001b[32m  ${checks}/${checks} routes passed the accessibility checks\u001b[0m`);
  process.exit(0);
}
console.log(`\u001b[31m  ${failures} accessibility problem(s) found\u001b[0m`);
process.exit(1);
