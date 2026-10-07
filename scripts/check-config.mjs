#!/usr/bin/env node
/**
 * Configuration check — offline, instant.
 *
 * Reads .env.local (falling back to the real environment), validates every
 * public value the site will render, and prints exactly what the landing page
 * and footer will show. Needs no network and never prints a secret: the
 * publishable key is reported by length and prefix only.
 *
 *   npm run check:config
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

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
    return true;
  } catch {
    return false;
  }
}

const hadEnvFile = await loadEnvLocal();

let failures = 0;
let checks = 0;

function pass(label, detail = '') {
  checks += 1;
  console.log(`\u001b[32m  PASS\u001b[0m  ${label}${detail ? `  \u001b[90m${detail}\u001b[0m` : ''}`);
}

function warn(label, detail) {
  checks += 1;
  console.log(`\u001b[33m  WARN\u001b[0m  ${label}\n         \u001b[90m${detail}\u001b[0m`);
}

function fail(label, detail) {
  checks += 1;
  failures += 1;
  console.log(`\u001b[31m  FAIL\u001b[0m  ${label}\n         \u001b[90m${detail}\u001b[0m`);
}

const read = (key) => (process.env[key] ?? '').trim();

console.log('\n\u001b[1mConfiguration check\u001b[0m');
console.log(`  source: ${hadEnvFile ? '.env.local' : 'process environment'}`);

/* -------------------------------------------------------------------------- */
/* Supabase                                                                   */
/* -------------------------------------------------------------------------- */

console.log('\n\u001b[1mSupabase\u001b[0m');

const url = read('NEXT_PUBLIC_SUPABASE_URL');
const key = read('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!url) {
  fail('NEXT_PUBLIC_SUPABASE_URL is set', 'missing — the site will show the "not configured" notice');
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
  fail('NEXT_PUBLIC_SUPABASE_URL looks like a Supabase project URL', `got "${url}"`);
} else if (/placeholder/i.test(url)) {
  fail('NEXT_PUBLIC_SUPABASE_URL is a real project', 'it still points at a placeholder');
} else {
  pass('NEXT_PUBLIC_SUPABASE_URL is set', url);
}

if (!key) {
  fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is set', 'missing');
} else if (/placeholder/i.test(key)) {
  fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is a real key', 'it still holds a placeholder value');
} else if (key.length < 30) {
  fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is long enough to be a key', `${key.length} characters`);
} else {
  const kind = key.startsWith('sb_publishable_') ? 'publishable key (new format)' : key.startsWith('eyJ') ? 'legacy anon JWT' : 'unrecognised format';
  pass('NEXT_PUBLIC_SUPABASE_ANON_KEY is set', `${key.slice(0, 18)}… · ${key.length} chars · ${kind}`);
}

// A service-role key must never appear in this application.
for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']) {
  if (read(name)) fail(`${name} must not be set`, 'this application never uses a service-role key');
}
if (/service_role/i.test(key)) fail('the anon key is not a service-role key', 'a service-role key was supplied in its place');

const siteUrl = read('NEXT_PUBLIC_SITE_URL');
if (!siteUrl) {
  pass('NEXT_PUBLIC_SITE_URL is not set', 'fine for local development; set it in production for correct email links');
} else if (!/^https?:\/\//.test(siteUrl)) {
  fail('NEXT_PUBLIC_SITE_URL is a full URL', `got "${siteUrl}"`);
} else {
  pass('NEXT_PUBLIC_SITE_URL is set', siteUrl);
}

/* -------------------------------------------------------------------------- */
/* Contact channels                                                           */
/* -------------------------------------------------------------------------- */

console.log('\n\u001b[1mContact channels (rendered from configuration)\u001b[0m');

const email = read('NEXT_PUBLIC_CONTACT_EMAIL');
const phones = read('NEXT_PUBLIC_CONTACT_PHONES') || read('NEXT_PUBLIC_CONTACT_PHONE');
const whatsapp = read('NEXT_PUBLIC_CONTACT_WHATSAPP');
const address = read('NEXT_PUBLIC_CONTACT_ADDRESS');
const hours = read('NEXT_PUBLIC_CONTACT_HOURS');
const handle = read('NEXT_PUBLIC_SOCIAL_HANDLE');
const links = read('NEXT_PUBLIC_SOCIAL_LINKS');

const emailOk = email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/example\./i.test(email);
if (!email) warn('no email address configured', 'the contact block will hide the email row');
else if (emailOk) pass('email address', email);
else fail('email address', `"${email}" does not look like a deliverable address`);

const phoneList = phones.split(',').map((entry) => entry.trim()).filter(Boolean);
if (phoneList.length === 0) warn('no phone number configured', 'the contact block will hide the phone rows');
else {
  const bad = phoneList.filter((phone) => phone.replace(/\D/g, '').length < 10);
  if (bad.length > 0) fail('phone numbers', `too short: ${bad.join(', ')}`);
  else pass(`${phoneList.length} phone number${phoneList.length === 1 ? '' : 's'}`, phoneList.join(' · '));
}

const whatsappNumber = whatsapp || phoneList[0] || '';
if (whatsappNumber) {
  const digits = whatsappNumber.replace(/\D/g, '');
  const international = digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
  pass('WhatsApp link', `https://wa.me/${international}`);
} else {
  warn('no WhatsApp number configured', 'the WhatsApp row will be hidden');
}

if (address) {
  pass('office address', address.split('|').map((line) => line.trim()).filter(Boolean).join(' · '));
} else {
  warn('no office address configured', 'the address block will be hidden rather than invented');
}

if (hours) pass('office hours', hours);
else warn('no office hours configured', 'the hours line will be hidden');

if (handle || links) {
  if (handle) pass('social handle', handle);
  if (links) {
    const entries = links.split(',').map((entry) => entry.trim()).filter(Boolean);
    const bad = entries.filter((entry) => !/^[^=]+=https?:\/\//.test(entry));
    if (bad.length > 0) fail('social links', `expected Name=URL pairs; rejected: ${bad.join(', ')}`);
    else pass(`${entries.length} social link${entries.length === 1 ? '' : 's'}`, entries.join(' · '));
  } else {
    warn('only a handle is configured', 'it is displayed as text — add NEXT_PUBLIC_SOCIAL_LINKS as Name=URL pairs to make them clickable');
  }
} else {
  warn('no social presence configured', 'the Follow block will be hidden');
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

console.log(`\n${'─'.repeat(72)}`);
if (failures === 0) {
  console.log(`\u001b[32m  ${checks} configuration checks passed\u001b[0m\n`);
  process.exit(0);
}
console.log(`\u001b[31m  ${failures} of ${checks} configuration checks failed\u001b[0m\n`);
process.exit(1);
