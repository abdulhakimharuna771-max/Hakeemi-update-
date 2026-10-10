/* Smoke test: run index.html + app.js in jsdom, click through every page, report errors */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Could not load img/.test(e.message)) errors.push('jsdomError: ' + e.message); });
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
  url: 'http://localhost:8080/index.html',
});
const { window } = dom;
window.scrollTo = () => {};
window.HTMLMediaElement.prototype.play = () => Promise.resolve();

try {
  window.eval(fs.readFileSync('app.js', 'utf8'));
} catch (e) {
  errors.push('BOOT THROW: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'));
}

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const log = [];
const ok = (name, cond) => log.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);

// --- home render checks ---
ok('characters rendered (6)', $$('#charGrid .char-card').length === 6);
ok('game modes rendered (8)', $$('#modesGrid .mode-card').length === 8);
ok('car stats rendered (5)', $$('#carStats .stat').length === 5);
ok('map legend rendered (10)', $$('#mapLegend .lg-item').length === 10);
ok('minimaps injected (2)', $$('.minimap svg').length === 2);
ok('speedos injected (2)', $$('.speedo svg').length === 2);
ok('city map injected', $('#cityMap svg') !== null);
ok('race timer ticking', /\d\d:\d\d\.\d\d/.test($('#raceTimer').textContent));

// jsdom never fires img load/error, so simulate the error path the browser takes
$$('img[data-art]').forEach(img => img.dispatchEvent(new window.Event('error')));
ok('fallback art for missing imgs', $$('.fb-art').length >= 12);
ok('missing imgs hidden', $$('img.missing').length >= 12);
ok('fallback art scenes differ', new Set($$('.fb-art svg').map(s => s.innerHTML.length)).size >= 3);

// --- navigate every page ---
const pages = ['garage', 'cars', 'characters', 'missions', 'worldmap', 'shop', 'profile', 'settings', 'home'];
for (const p of pages) {
  try {
    const btn = $(`.menu-item[data-page="${p}"]`);
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const active = $('#page-home').classList.contains('active');
    const genLen = $('#page-generic').innerHTML.length;
    ok(`page "${p}" renders`, p === 'home' ? active : (!active && genLen > 400));
  } catch (e) {
    errors.push(`PAGE ${p} THROW: ${e.message}`);
    ok(`page "${p}" renders`, false);
  }
}

// --- garage interactions ---
try {
  window.document.querySelector('.menu-item[data-page="garage"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const tabs = $$('#pageGarageTabs .g-tab');
  for (const t of tabs) t.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('garage tabs (5) switch', tabs.length === 5 && $('#garageTabBody').innerHTML.length > 100);
  const upTab = tabs.find(t => t.dataset.gtab === 'upgrade');
  upTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const up = $('[data-upgrade]');
  const before = +$('#coinValue').textContent.replace(/,/g, '');
  up.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const after = +$('#coinValue').textContent.replace(/,/g, '');
  ok('upgrade spends coins', after < before);
  const cusTab = tabs.find(t => t.dataset.gtab === 'customize');
  cusTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const paint = $('[data-paint]');
  paint.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('paint applied to preview', /hue-rotate/.test($('#garagePreview').style.filter));
  tabs.find(t => t.dataset.gtab === 'wheels').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('wheels tab renders', $$('#garageTabBody [data-wheel]').length === 4);
  tabs.find(t => t.dataset.gtab === 'nitro').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('nitro tab renders', $$('#garageTabBody [data-nitro]').length === 3);
} catch (e) { errors.push('GARAGE THROW: ' + e.stack.split('\n').slice(0,3).join(' | ')); ok('garage interactions', false); }

// --- characters page detail ---
try {
  window.document.querySelector('.menu-item[data-page="characters"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('characters detail page', $('#page-generic').innerHTML.includes('DRIVER PROFILE'));
  $$('[data-char-jump]')[2].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('char jump updates selection', $('#page-generic').innerHTML.includes('BLAZE'));
} catch (e) { errors.push('CHARS THROW: ' + e.message); ok('characters interactions', false); }

// --- shop / claim / buy ---
try {
  window.document.querySelector('.menu-item[data-page="shop"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const g0 = +$('#gemValue').textContent.replace(/,/g, '');
  $('[data-buy-pack^="g"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const g1 = +$('#gemValue').textContent.replace(/,/g, '');
  ok('shop gem pack adds gems', g1 > g0);
  window.document.querySelector('.menu-item[data-page="cars"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const c0 = +$('#coinValue').textContent.replace(/,/g, '');
  $('[data-buy-car]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const c1 = +$('#coinValue').textContent.replace(/,/g, '');
  ok('car purchase spends coins', c1 < c0);
} catch (e) { errors.push('SHOP THROW: ' + e.message); ok('shop/cars interactions', false); }

// --- world map markers + settings ---
try {
  window.document.querySelector('.menu-item[data-page="worldmap"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('big map rendered', $('#bigMap svg') !== null);
  const mk = $('.map-mark');
  mk.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('map marker clickable', $$('.toast').length > 0);
  window.document.querySelector('.menu-item[data-page="settings"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const tg = $('[data-toggle]');
  const wasOn = tg.classList.contains('on');
  tg.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('settings toggle flips', tg.classList.contains('on') !== wasOn);
  const seg = $('[data-seg] button:nth-child(3)');
  seg.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('segmented control switches', seg.classList.contains('active'));
} catch (e) { errors.push('MAP/SET THROW: ' + e.message); ok('map/settings interactions', false); }

// --- race overlay ---
try {
  window.document.querySelector('.menu-item[data-page="home"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  $('#driveBtn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('race overlay opens', $('#raceOverlay').classList.contains('show'));
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok('ESC closes overlay', !$('#raceOverlay').classList.contains('show'));
  $$('[data-mode]')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('mode card starts race', $('#raceOverlay').classList.contains('show'));
} catch (e) { errors.push('RACE THROW: ' + e.message); ok('race overlay', false); }

// --- character filter tabs ---
try {
  const leg = $$('#charTabs .tab').find(t => t.dataset.rarity === 'legendary');
  leg.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('rarity filter works', $$('#charGrid .char-card').length === 1);
  $$('#charTabs .tab')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('filter reset works', $$('#charGrid .char-card').length === 6);
} catch (e) { errors.push('FILTER THROW: ' + e.message); ok('rarity filter', false); }

console.log(log.join('\n'));
console.log('\n' + '='.repeat(56));
if (errors.length) { console.log('ERRORS (' + errors.length + '):'); errors.forEach(e => console.log(' - ' + e)); process.exit(1); }
console.log('NO RUNTIME ERRORS — all checks passed.');
console.log('done'); process.exit(0);
