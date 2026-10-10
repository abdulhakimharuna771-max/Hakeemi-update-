/* ============================================================
   HAKEE MI RUSH — STREET LEGENDS · app.js
   ============================================================ */
'use strict';

/* ---------------- state ---------------- */
const state = {
  coins: 248750,
  gems: 2450,
  page: 'home',
  char: 'ace',
  car: 'VORTEX X1',
  upgrades: { engine: 3, turbo: 2, brakes: 2, tires: 3, nitro: 2 },
  paint: 265,        // hue-rotate deg applied to garage preview
  paintName: 'MIDNIGHT VIOLET',
  wheels: 'TURBINE',
  nitroTank: 'RACING BLUE',
};

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = n => n.toLocaleString('en-US');

/* ---------------- data ---------------- */
const CHARS = [
  { id: 'ace',    name: 'ACE',    rarity: 'legendary', img: 'assets/char-ace.png',    speed: 92, accel: 88, handling: 79, nitro: 85, bio: 'Former apex champion. Cold, calculated, unbeatable on a straight line.' },
  { id: 'zara',   name: 'ZARA',   rarity: 'epic',      img: 'assets/char-zara.png',   speed: 84, accel: 90, handling: 86, nitro: 80, bio: 'Street prodigy. Reads the road like nobody else on the grid.' },
  { id: 'blaze',  name: 'BLAZE',  rarity: 'epic',      img: 'assets/char-blaze.png',  speed: 88, accel: 76, handling: 81, nitro: 88, bio: 'Lives one inch from the limit. Nitro is his native language.' },
  { id: 'shadow', name: 'SHADOW', rarity: 'epic',      img: 'assets/char-shadow.png', speed: 80, accel: 85, handling: 92, nitro: 78, bio: 'No crew, no record, no face. Just clean apexes and cold exits.' },
  { id: 'luna',   name: 'LUNA',   rarity: 'rare',      img: 'assets/char-luna.png',   speed: 74, accel: 82, handling: 88, nitro: 72, bio: 'Drift queen of the harbor loop. Smooth where it counts.' },
  { id: 'kellen', name: 'KELLEN', rarity: 'common',    img: 'assets/char-kellen.png', speed: 68, accel: 72, handling: 74, nitro: 65, bio: 'Rookie with something to prove. Every lap is a lesson.' },
];

const MODES = [
  { id: 'racing',  name: 'Racing',       sub: 'SPRINT · 6 CARS', img: 'assets/mode-racing.png' },
  { id: 'bet',     name: 'Racing Bet',   sub: 'WAGER & WIN',    img: 'assets/mode-bet.png' },
  { id: 'heist',   name: 'Money Heist',  sub: 'CREW JOB',       img: 'assets/mode-heist.png' },
  { id: 'police',  name: 'Police Chase', sub: 'ESCAPE THE LAW', img: 'assets/mode-police.png' },
  { id: 'champ',   name: 'Championship', sub: 'FULL SERIES',    img: 'assets/mode-championship.png' },
  { id: 'drift',   name: 'Drift',        sub: 'FREESTYLE',      img: 'assets/mode-drift.png' },
  { id: 'stunt',   name: 'Stunt',        sub: 'AIR TIME',       img: 'assets/mode-stunt.png' },
  { id: 'roam',    name: 'Free Roam',    sub: 'OPEN WORLD',     img: 'assets/mode-freeroam.png' },
];

const CAR_STATS = [
  ['Top Speed', 90], ['Acceleration', 88], ['Handling', 82], ['Braking', 85], ['Nitro', 87],
];

const CARS = [
  { name: 'VORTEX X1',   tier: 'S', owned: true,  price: 0,      hue: 0,   stats: [90, 88, 82, 85, 87] },
  { name: 'PHANTOM GT',  tier: 'A', owned: true,  price: 0,      hue: 160, stats: [84, 90, 79, 80, 76] },
  { name: 'BLAZE 458',   tier: 'A', owned: true,  price: 0,      hue: 300, stats: [86, 84, 85, 78, 82] },
  { name: 'NEON VIPER',  tier: 'S', owned: false, price: 185000, hue: 120, stats: [94, 86, 88, 82, 90] },
  { name: 'IRONCLAD RS', tier: 'B', owned: false, price: 96000,  hue: 200, stats: [78, 76, 84, 90, 70] },
  { name: 'SOLARIS GT3', tier: 'A', owned: false, price: 142000, hue: 40,  stats: [88, 82, 87, 84, 85] },
  { name: 'UMBRA TYPE-R',tier: 'S', owned: false, price: 320000, hue: 260, stats: [97, 92, 90, 88, 95] },
  { name: 'COBALT 350Z', tier: 'C', owned: false, price: 54000,  hue: 180, stats: [72, 74, 76, 72, 68] },
];

const MISSIONS = [
  { icon: 'target',  name: 'SUNSET SPRINT',      desc: 'Win a sprint race at the harbor loop',            prog: 2, goal: 3, reward: 12500 },
  { icon: 'bag',     name: 'DOWNTOWN HEIST',     desc: 'Rob the vault and escape with 3 money bags',      prog: 0, goal: 3, reward: 75000 },
  { icon: 'drift',   name: 'DRIFT KING',         desc: 'Score 50,000 drift points in one run',           prog: 32400, goal: 50000, reward: 18000 },
  { icon: 'police',  name: 'HEAT WAVE',          desc: 'Escape a 5-star wanted level alive',              prog: 1, goal: 1, reward: 42000, done: true },
  { icon: 'stunt',   name: 'SKY WALKER',         desc: 'Land 10 stunt jumps over 40 meters',             prog: 7, goal: 10, reward: 22000 },
  { icon: 'crown',   name: 'STREET LEGEND',      desc: 'Win the weekly championship series',             prog: 4, goal: 8, reward: 150000 },
];

const MAP_LEGEND = [
  { k: 'Race',          c: '#22d3ee', g: 'R' },
  { k: 'Heist',         c: '#f5c542', g: '$' },
  { k: 'Mission',       c: '#a855f7', g: 'M' },
  { k: 'Garage',        c: '#60a5fa', g: 'G' },
  { k: 'Shop',          c: '#34d399', g: 'S' },
  { k: 'Police Event',  c: '#f43f5e', g: 'P' },
  { k: 'Victory',       c: '#fbbf24', g: '★' },
  { k: 'Safe House',    c: '#4ade80', g: 'F' },
  { k: 'Escape',        c: '#fb923c', g: 'E' },
  { k: 'Helicopter',    c: '#f87171', g: '✚' },
];

const SHOPS = [
  { name: 'HAND OF CASH', coins: 100000, price: '$4.99',  best: false },
  { name: 'VAULT PACK',   coins: 550000, price: '$19.99', best: true },
  { name: 'MOGUL CRATE',  coins: 1200000, price: '$49.99', best: false },
  { name: 'GEM POUCH',    gems: 500,     price: '$2.99',  best: false },
  { name: 'GEM CHEST',    gems: 2750,    price: '$9.99',  best: false },
  { name: 'GEM VAULT',    gems: 7200,    price: '$24.99', best: true },
];

const ICONS = {
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1"/>',
  bag: '<path d="M6 9a6 6 0 0112 0v1H6z"/><path d="M6 10h12v9a2 2 0 01-2 2H8a2 2 0 01-2-2z"/>',
  drift: '<path d="M4 15c3-5 6-7 10-7"/><path d="M14 8l6-3-2 6"/><path d="M4 18h16"/>',
  police: '<path d="M4 9h9a4 4 0 014 4v3H4z"/><path d="M17 12l3-2v6l-3-2"/><path d="M4 16v2M17 16v2"/>',
  stunt: '<path d="M3 17l5-8h8l5 8z"/><path d="M9 9l3-5 3 5"/>',
  crown: '<path d="M3 8l4.5 3L12 5l4.5 6L21 8l-1.6 10H4.6z"/>',
};

/* ============================================================
   SVG ART
   ============================================================ */
let sgId = 0;
function speedoSVG(speed, max) {
  const id = 'sg' + (++sgId);
  const f = Math.min(speed / max, 1);
  const pt = (a, r = 38) => [50 + r * Math.cos(a * Math.PI / 180), 50 + r * Math.sin(a * Math.PI / 180)];
  const arc = (from, to, r = 38) => {
    const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${(to - from) > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const prog = 135 + 270 * f;
  let ticks = '';
  for (let i = 0; i <= 10; i++) {
    const a = 135 + 270 * (i / 10);
    const [x1, y1] = pt(a, 37), [x2, y2] = pt(a, i % 5 === 0 ? 29 : 32);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,${i / 10 > f + .02 ? .1 : .5})" stroke-width="${i % 5 === 0 ? 1.6 : 1}"/>`;
  }
  return `<svg viewBox="0 0 100 100" data-needle="${(prog - 270).toFixed(1)}">
    <defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#f0568c"/>
    </linearGradient></defs>
    <circle cx="50" cy="50" r="45.5" fill="rgba(5,7,15,.85)" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/>
    <path d="${arc(135, 405)}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="6.5" stroke-linecap="round"/>
    <path d="${arc(135, prog)}" fill="none" stroke="url(#${id})" stroke-width="6.5" stroke-linecap="round" style="filter:drop-shadow(0 0 5px rgba(139,92,246,.9))"/>
    ${ticks}
    <g class="needle" transform="rotate(${(prog - 270).toFixed(1)} 50 50)">
      <polygon points="50,50 46.7,53.6 50,16.5 53.3,53.6" fill="#fff"/>
    </g>
    <circle cx="50" cy="50" r="4.2" fill="#fff" stroke="#8b5cf6" stroke-width="2"/>
    <text x="50" y="74" text-anchor="middle" font-family="Orbitron, sans-serif" font-size="15.5" font-weight="900" fill="#fff">${speed}</text>
    <text x="50" y="83" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="6.2" font-weight="800" fill="#939dbe" letter-spacing=".8">KM/H</text>
  </svg>`;
}

function minimapSVG(variant) {
  const roads1 = '<path d="M18 6 V70 H60" /><path d="M6 34 H70 V58" />';
  const roads2 = '<path d="M6 62 H70 V20 H44" /><path d="M44 20 V6" />';
  const route1 = '<path d="M18 6 V34 H44 V70" />';
  const route2 = '<path d="M6 62 H34 V34 H70" />';
  const cops = variant === 2
    ? '<circle cx="52" cy="26" r="3.4" fill="#f43f5e" stroke="#fff" stroke-width="1"/><circle cx="20" cy="48" r="3.4" fill="#3b82f6" stroke="#fff" stroke-width="1"/>'
    : '<circle cx="56" cy="58" r="3" fill="rgba(255,255,255,.75)"/><circle cx="26" cy="20" r="3" fill="rgba(255,255,255,.55)"/>';
  return `<svg viewBox="0 0 76 76">
    <rect width="76" height="76" fill="#0a0f1f"/>
    <g fill="none" stroke="rgba(255,255,255,.14)" stroke-width="5" stroke-linecap="round">${variant === 1 ? roads1 : roads2}</g>
    <g fill="none" stroke="rgba(34,211,238,.85)" stroke-width="2" stroke-dasharray="4 3">${variant === 1 ? route1 : route2}</g>
    ${cops}
    <g transform="translate(${variant === 1 ? 44 : 34} ${variant === 1 ? 34 : 34})">
      <circle r="7" fill="rgba(245,197,66,.25)"><animate attributeName="r" values="5;9;5" dur="1.6s" repeatCount="indefinite"/></circle>
      <polygon points="0,-5.5 4.6,4 -4.6,4" fill="#f5c542" stroke="#fff" stroke-width="1.1"/>
    </g>
  </svg>`;
}

function cityMapSVG(size = 300, interactive = false) {
  const W = size, H = size * 2 / 3;
  const s = W / 300;
  const marks = [
    [58, 52, MAP_LEGEND[0]], [96, 96, MAP_LEGEND[3]], [148, 62, MAP_LEGEND[1]],
    [196, 108, MAP_LEGEND[4]], [232, 58, MAP_LEGEND[2]], [126, 140, MAP_LEGEND[6]],
    [178, 150, MAP_LEGEND[7]], [252, 122, MAP_LEGEND[8]], [70, 122, MAP_LEGEND[5]],
    [214, 30, MAP_LEGEND[9]],
  ];
  let m = '';
  marks.forEach(([x, y, lg], i) => {
    m += `<g class="map-mark" data-district="${lg.k}" style="cursor:pointer">
      <circle cx="${x}" cy="${y}" r="${interactive ? 8 : 6}" fill="${lg.c}" opacity=".22"/>
      <circle cx="${x}" cy="${y}" r="${interactive ? 4.6 : 3.6}" fill="${lg.c}" stroke="rgba(255,255,255,.85)" stroke-width="${interactive ? 1.4 : 1}"/>
      ${interactive ? `<text x="${x}" y="${y + 2.6}" text-anchor="middle" font-family="Montserrat" font-size="4.6" font-weight="900" fill="#05060c">${lg.g}</text>` : ''}
    </g>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
    <defs>
      <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#101731"/><stop offset="1" stop-color="#070a16"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#mg)"/>
    <g opacity=".5" stroke="rgba(139,92,246,.14)" stroke-width=".6">
      ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${(i + 1) * H / 13}" x2="${W}" y2="${(i + 1) * H / 13}"/>`).join('')}
      ${Array.from({ length: 18 }, (_, i) => `<line x1="${(i + 1) * W / 19}" y1="0" x2="${(i + 1) * W / 19}" y2="${H}"/>`).join('')}
    </g>
    <path d="M-10 ${34 * s} C ${60 * s} ${56 * s}, ${92 * s} ${104 * s}, ${152 * s} ${124 * s} S ${238 * s} ${148 * s}, ${W + 10} ${136 * s}"
          fill="none" stroke="rgba(56,130,220,.32)" stroke-width="${13 * s}" stroke-linecap="round"/>
    <g fill="rgba(139,92,246,.1)" stroke="rgba(139,92,246,.28)" stroke-width=".8">
      <ellipse cx="${66 * s}" cy="${52 * s}" rx="${42 * s}" ry="${28 * s}"/>
      <rect x="${168 * s}" y="${34 * s}" width="${72 * s}" height="${44 * s}" rx="${10 * s}"/>
      <rect x="${30 * s}" y="${118 * s}" width="${86 * s}" ry="${10 * s}" height="${34 * s}" rx="${10 * s}"/>
      <rect x="${160 * s}" y="${128 * s}" width="${88 * s}" height="${38 * s}" rx="${10 * s}"/>
    </g>
    <g stroke="rgba(255,255,255,.17)" fill="none" stroke-linecap="round">
      <path d="M${8 * s} ${100 * s} H ${W - 8 * s}" stroke-width="${4.5 * s}"/>
      <path d="M${104 * s} ${8 * s} V ${H - 8 * s}" stroke-width="${4 * s}"/>
      <path d="M${224 * s} ${14 * s} V ${H - 10 * s}" stroke-width="${3 * s}"/>
      <path d="M${16 * s} ${168 * s} L ${W - 30 * s} ${22 * s}" stroke-width="${2.4 * s}" stroke-dasharray="${7 * s} ${5 * s}"/>
      <rect x="${44 * s}" y="${64 * s}" width="${150 * s}" height="${82 * s}" rx="${16 * s}" stroke-width="${1.6 * s}" opacity=".55"/>
    </g>
    ${m}
    <g>
      <circle cx="${148 * s}" cy="${105 * s}" r="${9 * s}" fill="rgba(245,197,66,.2)">
        <animate attributeName="r" values="${7 * s};${12 * s};${7 * s}" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${148 * s}" cy="${105 * s}" r="${4.6 * s}" fill="#f5c542" stroke="#fff" stroke-width="${1.6 * s}"/>
    </g>
    <text x="${150 * s}" y="${(H - 8 * s)}" text-anchor="middle" font-family="Montserrat" font-size="${7 * s}" font-weight="800" fill="rgba(255,255,255,.35)" letter-spacing="${1.6 * s}">DOWNTOWN DISTRICT · 100% EXPLORED</text>
  </svg>`;
}

/* ============================================================
   HOME RENDERERS
   ============================================================ */
/* ACE's key art is landscape, the rest are tall portraits — fit each without ugly crops */
const charFit = c => c.id === 'ace'
  ? 'object-fit:cover;object-position:center 38%'
  : 'object-fit:contain;object-position:center bottom';
const charFitWide = c => c.id === 'ace'
  ? 'object-fit:cover;object-position:center 38%'
  : 'object-fit:cover;object-position:top center';

function renderChars(filter = 'all') {
  const grid = $('#charGrid');
  grid.innerHTML = CHARS
    .filter(c => filter === 'all' || c.rarity === filter)
    .map(c => `
      <div class="char-card ${state.char === c.id ? 'selected' : ''}" data-char="${c.id}">
        <div class="char-img">
          <img src="${c.img}" alt="${c.name}" style="${charFit(c)}">
          <span class="rarity-badge ${c.rarity}">${c.rarity.toUpperCase()}</span>
        </div>
        <div class="char-name">${c.name}</div>
      </div>`).join('');
  imgFallback(grid);
}

function renderModes() {
  $('#modesGrid').innerHTML = MODES.map(m => `
    <div class="mode-card" data-mode="${m.name}">
      <div class="mode-img"><img src="${m.img}" alt="${m.name}" data-art="mode|${m.id}"></div>
      <div class="mode-label">${m.name}<small>${m.sub}</small></div>
    </div>`).join('');
  imgFallback($('#modesGrid'));
}

function renderCarStats() {
  $('#carStats').innerHTML = CAR_STATS.map(([k, v]) => `
    <div class="stat"><span>${k}</span><div class="bar"><i data-w="${v}"></i></div><b>${v}</b></div>`).join('');
  requestAnimationFrame(() => setTimeout(() =>
    $$('#carStats .bar i').forEach(el => el.style.width = el.dataset.w + '%'), 120));
}

function renderMapLegend() {
  $('#mapLegend').innerHTML = MAP_LEGEND.map(l => `
    <div class="lg-item"><span class="lg-ic" style="background:${l.c}">${l.g}</span>${l.k}</div>`).join('');
}

function renderMinimapsAndSpeedos() {
  $$('.minimap').forEach(el => el.innerHTML = minimapSVG(el.dataset.variant));
  $$('.speedo').forEach(el => el.innerHTML = speedoSVG(+el.dataset.speed, +el.dataset.max));
  $('#cityMap').innerHTML = cityMapSVG(300);
}

/* needle idle wobble so the dash feels alive */
function startSpeedoWobble() {
  const speedos = $$('.speedo svg');
  if (!speedos.length) return;
  setInterval(() => {
    speedos.forEach(svg => {
      const base = parseFloat(svg.dataset.needle);
      const jitter = Math.sin(Date.now() / 340) * 1.6 + (Math.random() - .5) * 1.2;
      const g = svg.querySelector('.needle');
      if (g) g.setAttribute('transform', `rotate(${(base + jitter).toFixed(2)} 50 50)`);
    });
  }, 110);
}

/* ============================================================
   PAGES
   ============================================================ */
const PAGES = {
  garage() {
    return `
      <div class="page-head">
        <div><h2>GARAGE</h2><p>Your machine, your rules — tune every bolt.</p></div>
        <button class="mini-btn" data-mode="Stunt">TEST DRIVE</button>
      </div>
      <div class="gen-grid" style="grid-template-columns:1.15fr .85fr">
        <div class="panel">
          <div class="panel-head"><svg viewBox="0 0 24 24" class="ic"><path d="M3 13l2-6a2 2 0 012-1.5h10A2 2 0 0119 7l2 6"/><path d="M3 13h18v5H3z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg><span>${state.car}</span><span class="head-right cur-mini"><b><i class="coin-dot"></i>${fmt(state.coins)}</b><b><i class="gem-dot"></i>${fmt(state.gems)}</b></span></div>
          <div class="car-stage" style="padding:14px">
            <div class="car-img-wrap" style="flex:1"><img id="garagePreview" src="assets/garage-car.png" alt="${state.car}" style="filter:hue-rotate(${state.paint}deg) saturate(1.15)"></div>
          </div>
          <div class="car-title"><span class="car-name" id="garageCarName">${state.car}</span><span class="car-stars">${state.paintName} · ${state.wheels} WHEELS</span></div>
          <div class="stats">${CAR_STATS.map(([k, v], i) => `
            <div class="stat"><span>${k}</span><div class="bar"><i data-w="${Math.min(99, v + state.upgrades[['engine','tur','brakes','tires','nitro'][i]] * 2)}"></i></div><b>${Math.min(99, v + state.upgrades[['engine','turbo','brakes','tires','nitro'][i]] * 2)}</b></div>`).join('')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><svg viewBox="0 0 24 24" class="ic"><path d="M12 4v16M4 12h16"/></svg><span>TUNING</span></div>
          <div class="g-tabs" id="pageGarageTabs" style="margin-bottom:12px">
            ${['upgrade', 'customize', 'paint', 'wheels', 'nitro'].map(t => `<button class="g-tab ${t === 'upgrade' ? 'active' : ''}" data-gtab="${t}">${t.toUpperCase()}</button>`).join('')}
          </div>
          <div id="garageTabBody"></div>
        </div>
      </div>`;
  },

  cars() {
    return `
      <div class="page-head">
        <div><h2>CARS</h2><p>8 rides unlocked across the city. Buy, tune, dominate.</p></div>
      </div>
      <div class="gen-grid cols-4">
        ${CARS.map(c => `
          <div class="car-card">
            <div class="cc-img"><img src="assets/garage-car.png" alt="${c.name}" style="filter:hue-rotate(${c.hue}deg) saturate(1.2)"></div>
            <div class="cc-body">
              <div class="cc-name"><h4>${c.name}</h4><span class="cc-tier ${c.tier.toLowerCase()}">${c.tier} CLASS</span></div>
              <div class="stats">
                ${['TOP SPEED', 'ACCEL', 'HANDLING', 'BRAKING', 'NITRO'].map((k, i) => `
                  <div class="stat"><span>${k}</span><div class="bar"><i data-w="${c.stats[i]}"></i></div><b>${c.stats[i]}</b></div>`).join('')}
              </div>
              <div class="cc-actions">
                ${c.owned
                  ? `<button class="mini-btn" data-toast="${c.name} selected — see you on the street." data-select-car="${c.name}">SELECT</button>`
                  : `<button class="mini-btn" data-buy-car="${c.name}|${c.price}|${c.hue}">BUY · ${fmt(c.price)}</button>`}
                <button class="mini-btn" data-mode="Racing" style="background:linear-gradient(100deg,#f5b91d,#e09b12);color:#3a2500">DRIVE</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  },

  characters() {
    const c = CHARS.find(x => x.id === state.char);
    return `
      <div class="page-head">
        <div><h2>CHARACTERS</h2><p>Every driver brings a different feel to the wheel.</p></div>
      </div>
      <div class="char-detail" style="margin-bottom:12px">
        <div class="char-hero panel" style="padding:0">
          <img src="${c.img}" alt="${c.name}" style="${charFit(c)}">
          <span class="ch-badge rarity-badge ${c.rarity}" style="position:absolute;left:10px;bottom:10px;border-radius:20px;padding:4px 12px">${c.rarity.toUpperCase()}</span>
        </div>
        <div class="panel">
          <div class="panel-head"><span>${c.name}</span><span class="head-right">DRIVER PROFILE</span></div>
          <p style="font-size:11.5px;line-height:1.7;color:var(--muted);font-weight:600;margin-bottom:14px">${c.bio}</p>
          <div class="stats" style="max-width:420px">
            ${[['TOP SPEED', c.speed], ['ACCELERATION', c.accel], ['HANDLING', c.handling], ['NITRO', c.nitro]].map(([k, v]) => `
              <div class="stat"><span>${k}</span><div class="bar"><i data-w="${v}"></i></div><b>${v}</b></div>`).join('')}
          </div>
          <div class="cc-actions" style="margin-top:14px">
            <button class="mini-btn" data-toast="${c.name} is already your active driver.">ACTIVE</button>
            <button class="mini-btn" data-mode="Championship" style="background:linear-gradient(100deg,#f5b91d,#e09b12);color:#3a2500">RACE WITH ${c.name}</button>
          </div>
        </div>
      </div>
      <div class="gen-grid cols-3">
        ${CHARS.map(x => `
          <div class="car-card" style="cursor:pointer" data-char-jump="${x.id}">
            <div class="cc-img" style="aspect-ratio:16/13"><img src="${x.img}" alt="${x.name}" style="object-position:top center"></div>
            <div class="cc-body">
              <div class="cc-name"><h4>${x.name}</h4><span class="cc-tier ${x.rarity === 'legendary' ? 's' : x.rarity === 'epic' ? 'a' : x.rarity === 'rare' ? 'b' : 'c'}">${x.rarity.toUpperCase()}</span></div>
            </div>
          </div>`).join('')}
      </div>`;
  },

  missions() {
    return `
      <div class="page-head">
        <div><h2>MISSIONS</h2><p>Contracts, heists and street challenges across the map.</p></div>
        <button class="mini-btn" data-toast="Daily contracts refreshed.">REFRESH · 02:14</button>
      </div>
      <div class="panel list-panel">
        ${MISSIONS.map((m, i) => `
          <div class="mission-row">
            <div class="mr-icon"><svg viewBox="0 0 24 24" class="ic">${ICONS[m.icon]}</svg></div>
            <div class="mr-body"><h4>${m.name}</h4><p>${m.desc}</p></div>
            <div class="mr-prog">
              <div class="bar"><i data-w="${Math.min(100, m.prog / m.goal * 100)}"></i></div>
              <span>${m.done ? 'COMPLETE' : `${fmt(m.prog)} / ${fmt(m.goal)}`}</span>
            </div>
            <div class="mr-reward">${fmt(m.reward)}</div>
            ${m.done
              ? `<button class="mini-btn" data-toast="Reward of ${fmt(m.reward)} claimed!" data-claim="${m.reward}">CLAIM</button>`
              : `<button class="mini-btn" data-toast="Mission tracked — ${m.name}.">TRACK</button>`}
          </div>`).join('')}
      </div>`;
  },

  worldmap() {
    return `
      <div class="page-head">
        <div><h2>WORLD MAP</h2><p>Downtown · Harbor · Industrial Heights · Neon Mile</p></div>
        <button class="mini-btn" data-toast="Fast travel unlocked at Safe Houses only.">FAST TRAVEL</button>
      </div>
      <div class="panel" style="padding:10px">
        <div class="big-map" id="bigMap">${cityMapSVG(900, true)}</div>
        <div class="tabs" style="margin:12px 2px 0">${MAP_LEGEND.map(l => `<span class="tab" style="cursor:default"><span class="lg-ic" style="background:${l.c};display:inline-grid;vertical-align:-2px;margin-right:6px">${l.g}</span>${l.k}</span>`).join('')}</div>
      </div>`;
  },

  shop() {
    return `
      <div class="page-head">
        <div><h2>SHOP</h2><p>Cash, gems and limited garage crates.</p></div>
        <span class="head-right cur-mini" style="margin-left:auto"><b><i class="coin-dot"></i>${fmt(state.coins)}</b><b><i class="gem-dot"></i>${fmt(state.gems)}</b></span>
      </div>
      <div class="gen-grid cols-3">
        ${SHOPS.map(s => `
          <div class="shop-pack">
            ${s.best ? '<span class="best">BEST VALUE</span>' : ''}
            <div class="big-ic">${s.coins
              ? `<svg viewBox="0 0 24 24" style="width:100%;height:100%"><circle cx="12" cy="12" r="9" fill="none" stroke="#f5c542" stroke-width="1.6"/><path d="M12 7v10M9.4 10h3.8a1.9 1.9 0 010 3.8H9.4l4 3.6" fill="none" stroke="#f5c542" stroke-width="1.6" stroke-linecap="round"/></svg>`
              : `<svg viewBox="0 0 24 24" style="width:100%;height:100%"><path d="M7 4h10l4 6-9 10L3 10z" fill="none" stroke="#60a5fa" stroke-width="1.6"/><path d="M3 10h18M12 4l-3.5 6L12 20l3.5-10z" fill="none" stroke="#60a5fa" stroke-width="1.6"/></svg>`}</div>
            <h4>${s.name}</h4>
            <div class="price">${s.coins ? fmt(s.coins) + ' <small>coins</small>' : fmt(s.gems) + ' <small>gems</small>'}</div>
            <button class="mini-btn" data-buy-pack="${s.coins ? 'c' + s.coins : 'g' + s.gems}">${s.price}</button>
          </div>`).join('')}
      </div>`;
  },

  profile() {
    return `
      <div class="page-head">
        <div><h2>PROFILE</h2><p>Street record, garage net worth and season stats.</p></div>
      </div>
      <div class="gen-grid cols-4" style="margin-bottom:12px">
        ${[['RACES WON', '148', 'gold'], ['TOP SPEED', '342 KM/H', 'cyan'], ['DRIFT SCORE', '1.2M', 'pink'], ['HEISTS', '27', 'green'],
           ['WANTED ESCAPES', '63', 'gold'], ['STUNT AIR', '18,402 M', 'cyan'], ['CREW RANK', '#12', 'pink'], ['NET WORTH', '4.8M', 'green']]
          .map(([k, v, c]) => `<div class="stat-tile"><span class="k">${k}</span><span class="v ${c}">${v}</span></div>`).join('')}
      </div>
      <div class="gen-grid cols-2">
        <div class="panel">
          <div class="panel-head"><span>SEASON PROGRESS</span><span class="head-right">LEVEL 12 → 13</span></div>
          <div class="stat"><span>XP</span><div class="bar"><i data-w="64"></i></div><b>64%</b></div>
          <div class="stat" style="margin-top:8px"><span>RANK</span><div class="bar"><i data-w="81"></i></div><b>81%</b></div>
        </div>
        <div class="panel">
          <div class="panel-head"><span>ACHIEVEMENTS</span><span class="head-right">18 / 42</span></div>
          <div class="list-panel">
            ${[['FIRST BLOOD', 'Win your first race', true], ['GETAWAY DRIVER', 'Complete 10 heists', true], ['AIRBORNE', 'Land a 60m stunt jump', false], ['UNTOUCHABLE', 'Escape 25 wanted levels', false]]
              .map(([n, d, done]) => `<div class="setting-row" style="padding:10px 12px"><div class="mr-icon" style="width:30px;height:30px;background:${done ? 'rgba(52,211,153,.14)' : 'rgba(255,255,255,.05)'};border-color:${done ? 'rgba(52,211,153,.35)' : 'var(--border)'}"><svg viewBox="0 0 24 24" class="ic" style="stroke:${done ? 'var(--green)' : 'var(--dim)'}">${done ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>' : '<circle cx="12" cy="12" r="8"/>'}</svg></div><div><h4>${n}</h4><p>${d}</p></div><span style="margin-left:auto;font-size:9px;font-weight:900;letter-spacing:1px;color:${done ? 'var(--green)' : 'var(--dim)'}">${done ? 'UNLOCKED' : 'LOCKED'}</span></div>`).join('')}
          </div>
        </div>
      </div>`;
  },

  settings() {
    const row = (t, d, ctrl) => `<div class="setting-row"><div><h4>${t}</h4><p>${d}</p></div><div class="sr-right">${ctrl}</div></div>`;
    return `
      <div class="page-head">
        <div><h2>SETTINGS</h2><p>Audio, graphics and controls.</p></div>
      </div>
      <div class="gen-grid cols-2">
        <div class="panel list-panel">
          <div class="panel-head"><span>AUDIO</span></div>
          ${row('Master Sound', 'Engine, crashes and crowd', '<div class="toggle on" data-toggle></div>')}
          ${row('Music', 'Street Legends soundtrack', '<div class="toggle on" data-toggle></div>')}
          ${row('Haptic Feedback', 'Vibration on impacts', '<div class="toggle" data-toggle></div>')}
        </div>
        <div class="panel list-panel">
          <div class="panel-head"><span>GRAPHICS</span></div>
          ${row('Quality Preset', 'Shadows, reflections, draw distance', '<div class="seg" data-seg><button class="active">LOW</button><button>MEDIUM</button><button>HIGH</button><button>ULTRA</button></div>')}
          ${row('Motion Blur', 'Speed-based camera blur', '<div class="toggle on" data-toggle></div>')}
          ${row('Frame Limiter', 'Cap FPS to save battery', '<div class="toggle" data-toggle></div>')}
        </div>
        <div class="panel list-panel">
          <div class="panel-head"><span>CONTROLS</span></div>
          ${[['STEER', 'A / D  ·  ← →'], ['THROTTLE / BRAKE', 'W / S  ·  ↑ ↓'], ['HANDBRAKE DRIFT', 'SPACE'], ['NITRO BOOST', 'SHIFT'], ['RESET CAR', 'R'], ['LOOK BACK', 'B']]
            .map(([k, v]) => `<div class="setting-row" style="padding:10px 12px"><h4>${k}</h4><span style="margin-left:auto;font-family:Orbitron;font-size:10.5px;font-weight:700;color:var(--cyan)">${v}</span></div>`).join('')}
        </div>
        <div class="panel list-panel">
          <div class="panel-head"><span>ACCOUNT</span></div>
          ${row('Cloud Save', 'Sync garage and progress', '<div class="toggle on" data-toggle></div>')}
          ${row('Data Saver', 'Lower texture streaming', '<div class="toggle" data-toggle></div>')}
          ${row('Region', 'EU-WEST · Amsterdam', '<div class="seg" data-seg><button class="active">EU-W</button><button>NA-E</button><button>ASIA</button></div>')}
        </div>
      </div>`;
  },
};

/* ---------------- garage tab bodies ---------------- */
const GARAGE_TABS = {
  upgrade() {
    const items = [['engine', 'ENGINE', 'More power, higher top speed'], ['turbo', 'TURBO', 'Faster spool and boost'],
                   ['brakes', 'BRAKES', 'Shorter stops, tighter drifts'], ['tires', 'TIRES', 'Grip where it matters'], ['nitro', 'NITRO', 'Bigger tanks, longer burns']];
    return `<div class="list-panel">${items.map(([k, n, d]) => {
      const lvl = state.upgrades[k], cost = 8000 + lvl * 6500;
      return `<div class="setting-row" style="padding:10px 12px">
        <div><h4>${n}</h4><p>${d} · Level ${lvl}/6</p></div>
        <div class="bar" style="width:70px;margin:0 12px"><i data-w="${lvl / 6 * 100}"></i></div>
        <button class="mini-btn" data-upgrade="${k}|${cost}">${fmt(cost)} ▲</button>
      </div>`;
    }).join('')}</div>`;
  },
  customize() {
    const paints = [['MIDNIGHT VIOLET', 265], ['SOLAR FLARE', 20], ['TOXIC LIME', 95], ['ARCTIC BLUE', 190], ['CRIMSON FEVER', 335], ['PHANTOM BLACK', 0]];
    return `<div style="font-size:10px;font-weight:800;letter-spacing:1.2px;color:var(--muted);margin-bottom:10px">LIVERY &amp; PAINT</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${paints.map(([n, h]) => `<button class="shop-pack" style="padding:12px 8px;cursor:pointer" data-paint="${n}|${h}">
        <div style="height:44px;border-radius:10px;background:linear-gradient(135deg,hsl(${h} 80% 55%),hsl(${(h + 40) % 360} 85% 35%));box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)"></div>
        <h4 style="margin-top:9px;font-size:9.5px">${n}</h4></button>`).join('')}
      </div>`;
  },
  paint() {
    const finishes = [['GLOSS', 'Deep wet-look clear coat'], ['MATTE', 'Stealth satin wrap'], ['METALLIC', 'Flake-rich pearl'], ['CHROME', 'Mirror polish']];
    return `<div class="list-panel">${finishes.map(([n, d], i) => `
      <div class="setting-row" style="padding:10px 12px;cursor:pointer" data-toast="${n} finish applied to ${state.car}.">
        <div><h4>${n}</h4><p>${d}</p></div>
        <span style="margin-left:auto;font-size:16px">${i === 0 ? '✦' : '○'}</span>
      </div>`).join('')}</div>`;
  },
  wheels() {
    const wheels = [['TURBINE', 'Aero turbine blades'], ['MESH', 'Classic 5-spoke mesh'], ['DEEP DISH', 'Wide lipped stance'], ['SPOKE', 'Y-split performance']];
    return `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
      ${wheels.map(([n, d]) => `<button class="shop-pack" style="padding:14px 10px;cursor:pointer" data-wheel="${n}">
        <div style="width:52px;height:52px;margin:0 auto 8px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#cfd6ea,#5b6478 60%,#232838);box-shadow:inset 0 0 0 5px rgba(0,0,0,.35),0 0 14px rgba(139,92,246,.35)"></div>
        <h4 style="font-size:10px">${n}</h4><p style="font-size:9px;color:var(--muted);margin-top:3px">${d}</p></button>`).join('')}
    </div>`;
  },
  nitro() {
    const tanks = [['RACING BLUE', 78, 'Standard 2.0 bar bottle'], ['PURPLE HAZE', 92, 'Cold-flow twin bottle'], ['GOLD RUSH', 100, 'Championship spec']];
    return `<div class="list-panel">${tanks.map(([n, v, d]) => `
      <div class="setting-row" style="padding:11px 12px;cursor:pointer" data-nitro="${n}">
        <div><h4>${n}</h4><p>${d}</p></div>
        <div class="bar" style="width:80px;margin:0 12px"><i data-w="${v}"></i></div>
        <span class="mr-reward" style="width:auto">${v}%</span>
      </div>`).join('')}</div>`;
  },
};

/* ============================================================
   ROUTER
   ============================================================ */
function go(page) {
  state.page = page;
  $$('.menu-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const home = $('#page-home'), gen = $('#page-generic');
  if (page !== 'home') {
    $$('#garageTabs .g-tab').forEach(t => t.classList.toggle('active', t.dataset.gtab === 'cars'));
  }
  if (page === 'home') {
    home.classList.add('active'); gen.classList.remove('active'); gen.innerHTML = '';
  } else {
    home.classList.remove('active');
    gen.innerHTML = PAGES[page]();
    gen.classList.add('active');
    animateBars(gen);
    imgFallback(gen);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function animateBars(scope = document) {
  requestAnimationFrame(() => setTimeout(() =>
    $$('.bar i[data-w]', scope).forEach(el => { el.style.width = Math.min(100, +el.dataset.w) + '%'; }), 80));
}

/* ============================================================
   FX · toasts · race overlay
   ============================================================ */
function toast(msg) {
  const wrap = $('#toastWrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="t-ic">✦</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2600);
  while (wrap.children.length > 3) wrap.firstElementChild.remove();
}

function updateCurrency() {
  $('#coinValue').textContent = fmt(state.coins);
  $('#gemValue').textContent = fmt(state.gems);
  $$('.cur-mini').forEach(el => {
    const [c, g] = el.children;
    if (c) c.innerHTML = `<i class="coin-dot"></i>${fmt(state.coins)}`;
    if (g) g.innerHTML = `<i class="gem-dot"></i>${fmt(state.gems)}`;
  });
}

let raceTimer = null;
function startRace(modeName) {
  const ov = $('#raceOverlay');
  $('#roMode').textContent = `${modeName.toUpperCase()} · SUNSET LOOP`;
  ov.classList.add('show');
  const bar = $('#roBar'), count = $('#roCount');
  let p = 0; bar.style.width = '0%'; count.textContent = '3'; count.classList.remove('go');
  clearInterval(raceTimer);
  raceTimer = setInterval(() => {
    p += 2.4;
    bar.style.width = Math.min(100, p) + '%';
    if (p < 34) count.textContent = '3';
    else if (p < 67) count.textContent = '2';
    else if (p < 100) count.textContent = '1';
    else {
      count.textContent = 'GO!'; count.classList.add('go');
      clearInterval(raceTimer);
      setTimeout(() => { ov.classList.remove('show'); toast(`Lights out — ${modeName} is live. Good luck!`); }, 620);
    }
  }, 40);
}
function stopRace() { clearInterval(raceTimer); $('#raceOverlay').classList.remove('show'); }

/* live race clock */
function startClock() {
  let t = 48.32;
  setInterval(() => {
    t += 0.03;
    if (t > 5999) t = 0;
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(Math.floor(t % 60)).padStart(2, '0');
    const cs = String(Math.floor((t * 100) % 100)).padStart(2, '0');
    $('#raceTimer').textContent = `${m}:${s}.${cs}`;
  }, 30);
}

function imgFallback(scope = document) {
  $$('img', scope).forEach(img => {
    if (img.dataset.fb) return;
    img.dataset.fb = '1';
    img.addEventListener('error', () => { img.classList.add('missing'); injectArt(img); });
    img.addEventListener('load', () => { const a = img.previousElementSibling; if (a && a.classList.contains('fb-art')) a.remove(); });
    if (img.complete && img.naturalWidth === 0) { img.classList.add('missing'); injectArt(img); }
  });
}

/* ---------- stylized vector art (shown when a photo asset is absent) ---------- */
let artId = 0;
const ART_CAR = (x, y, s = 1, rot = 0) =>
  `<g transform="translate(${x},${y}) scale(${s}) rotate(${rot})">
    <path d="M2 21 L10 7 L30 3 L58 3 L73 10 L85 21 Z" fill="rgba(255,255,255,.16)"/>
    <rect x="0" y="19" width="87" height="9" rx="4.5" fill="rgba(255,255,255,.22)"/>
    <rect x="31" y="6" width="25" height="5" rx="2.5" fill="rgba(255,255,255,.1)"/>
    <circle cx="20" cy="30" r="7.5" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
    <circle cx="67" cy="30" r="7.5" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
  </g>`;

const ART_SCENES = {
  racing: () => `<g opacity=".9">${ART_CAR(14, 46, .78)}${ART_CAR(66, 40, .78)}</g>
    <g stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round"><path d="M4 34h26M0 46h18M6 58h30"/></g>
    <rect x="0" y="82" width="160" height="18" fill="rgba(0,0,0,.35)"/>
    <g stroke="rgba(255,255,255,.3)" stroke-width="2.5" stroke-dasharray="9 8"><path d="M0 91h160"/></g>`,
  bet: () => `<g>${ART_CAR(8, 44, .7)}${ART_CAR(84, 44, .7)}</g>
    <circle cx="42" cy="30" r="13" fill="rgba(255,240,180,.5)"/><circle cx="118" cy="30" r="13" fill="rgba(255,240,180,.5)"/>
    <text x="80" y="42" text-anchor="middle" font-family="Orbitron, sans-serif" font-size="26" font-weight="900" fill="rgba(255,255,255,.8)">VS</text>`,
  heist: () => `<g transform="translate(60,26)">
      <path d="M14 8 h12 l4 9 v27 a9 9 0 0 1 -9 9 H19 a9 9 0 0 1 -9 -9 V17 Z" fill="rgba(245,197,66,.4)" stroke="rgba(245,197,66,.6)" stroke-width="1.5"/>
      <rect x="12" y="0" width="16" height="9" rx="3.5" fill="rgba(245,197,66,.6)"/>
      <text x="20" y="40" text-anchor="middle" font-family="Orbitron, sans-serif" font-size="19" font-weight="900" fill="rgba(255,255,255,.8)">$</text>
    </g>
    <g fill="rgba(245,197,66,.3)"><circle cx="34" cy="72" r="6"/><circle cx="48" cy="78" r="5"/><circle cx="118" cy="74" r="6"/><circle cx="132" cy="80" r="4.5"/></g>`,
  police: () => `<g transform="translate(40,30)">
      <rect x="0" y="0" width="80" height="13" rx="4" fill="rgba(255,255,255,.18)"/>
      <rect x="3" y="2.5" width="34" height="8" rx="3" fill="rgba(244,63,94,.9)"/>
      <rect x="43" y="2.5" width="34" height="8" rx="3" fill="rgba(59,130,246,.9)"/>
      ${ART_CAR(6, 16, .78)}
    </g>
    <circle cx="44" cy="36" r="26" fill="rgba(244,63,94,.16)"/><circle cx="116" cy="36" r="26" fill="rgba(59,130,246,.16)"/>`,
  champ: () => `<g transform="translate(64,20)">
      <path d="M0 6 h32 v12 a16 16 0 0 1 -32 0 Z" fill="rgba(245,197,66,.55)" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>
      <path d="M0 8 h-9 v7 a10 10 0 0 0 9 10 M32 8 h9 v7 a10 10 0 0 1 -9 10" fill="none" stroke="rgba(245,197,66,.55)" stroke-width="3"/>
      <rect x="12" y="36" width="8" height="16" fill="rgba(245,197,66,.45)"/>
      <rect x="0" y="52" width="32" height="8" rx="2.5" fill="rgba(245,197,66,.6)"/>
    </g>
    <g fill="rgba(255,255,255,.28)"><circle cx="30" cy="22" r="2"/><circle cx="128" cy="18" r="2.4"/><circle cx="112" cy="34" r="1.8"/><circle cx="44" cy="40" r="1.6"/></g>`,
  drift: () => `<g opacity=".85">${ART_CAR(38, 40, .82, -12)}</g>
    <g fill="none" stroke="rgba(255,255,255,.3)" stroke-width="3" stroke-linecap="round">
      <path d="M18 66 q14 -16 30 -6"/><path d="M84 70 q16 -14 32 -4"/><path d="M30 76 q22 -10 44 0"/>
    </g>
    <g fill="rgba(255,255,255,.12)"><circle cx="22" cy="56" r="9"/><circle cx="36" cy="64" r="7"/><circle cx="122" cy="60" r="8"/><circle cx="136" cy="68" r="6"/></g>`,
  stunt: () => `<path d="M4 82 L52 82 L52 54 Z" fill="rgba(255,255,255,.15)"/>
    <path d="M52 54 Q104 2 150 44" fill="none" stroke="rgba(34,211,238,.65)" stroke-width="2.2" stroke-dasharray="6 5"/>
    ${ART_CAR(78, 20, .68, -22)}
    <rect x="0" y="82" width="160" height="18" fill="rgba(0,0,0,.3)"/>`,
  roam: () => `<g fill="rgba(255,255,255,.13)">
      <rect x="8" y="52" width="20" height="38"/><rect x="32" y="36" width="15" height="54"/><rect x="51" y="58" width="18" height="32"/>
      <rect x="94" y="44" width="16" height="46"/><rect x="114" y="60" width="14" height="30"/><rect x="132" y="30" width="18" height="60"/>
    </g>
    <g fill="rgba(34,211,238,.28)"><rect x="35" y="42" width="3" height="4"/><rect x="42" y="50" width="3" height="4"/><rect x="136" y="38" width="3" height="4"/><rect x="143" y="48" width="3" height="4"/><rect x="12" y="60" width="3" height="4"/></g>
    <rect x="0" y="86" width="160" height="14" fill="rgba(0,0,0,.4)"/>
    <g stroke="rgba(255,255,255,.3)" stroke-width="2.5" stroke-dasharray="9 8"><path d="M0 93h160"/></g>
    ${ART_CAR(64, 66, .5)}`,
};

function artSVG(kind, sub) {
  const id = 'art' + (++artId);
  const hue = { racing: 258, bet: 282, heist: 34, police: 208, champ: 42, drift: 318, stunt: 188, roam: 250 }[sub] ?? 250;
  const W = kind === 'banner' ? 320 : 160;
  const scene = kind === 'mode' ? (ART_SCENES[sub] || ART_SCENES.racing)() : '';
  const skyline = kind === 'banner'
    ? `<g fill="rgba(0,0,0,.45)"><rect x="0" y="46" width="26" height="44"/><rect x="30" y="30" width="18" height="60"/><rect x="52" y="52" width="22" height="38"/><rect x="96" y="38" width="20" height="52"/><rect x="120" y="56" width="16" height="34"/><rect x="140" y="24" width="24" height="66"/><rect x="168" y="50" width="18" height="40"/><rect x="190" y="34" width="22" height="56"/><rect x="216" y="58" width="20" height="32"/><rect x="240" y="42" width="26" height="48"/><rect x="270" y="30" width="20" height="60"/><rect x="294" y="54" width="26" height="36"/></g>
       <g fill="rgba(255,255,255,.14)"><rect x="34" y="36" width="3" height="4"/><rect x="41" y="46" width="3" height="4"/><rect x="144" y="32" width="3" height="4"/><rect x="151" y="44" width="3" height="4"/><rect x="194" y="42" width="3" height="4"/><rect x="274" y="38" width="3" height="4"/></g>
       <rect x="0" y="86" width="320" height="14" fill="rgba(0,0,0,.55)"/>
       <g stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-dasharray="8 7"><path d="M0 93h320"/></g>${ART_CAR(126, 62, .42)}`
    : '';
  const gameplay = kind === 'gameplay'
    ? `<path d="M64 40 L96 40 L128 92 L32 92 Z" fill="rgba(255,255,255,.07)"/>
       <g stroke="rgba(255,255,255,.22)" stroke-width="2" stroke-dasharray="7 9"><path d="M80 44 L80 92"/></g>
       <circle cx="80" cy="34" r="20" fill="rgba(139,92,246,.28)"/>${ART_CAR(48, 52, .5)}`
    : '';
  return `<div class="fb-art"><svg viewBox="0 0 ${W} 100" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 55% 22%)"/><stop offset=".55" stop-color="hsl(${(hue + 30) % 360} 45% 12%)"/><stop offset="1" stop-color="hsl(${(hue + 300) % 360} 50% 8%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
    ${skyline}${scene}${gameplay}
  </svg></div>`;
}

function injectArt(img) {
  const parent = img.parentElement;
  if (!parent || parent.querySelector('.fb-art')) return;
  const [kind, sub] = (img.dataset.art || 'gameplay|').split('|');
  parent.insertAdjacentHTML('afterbegin', artSVG(kind, sub));
}

/* ============================================================
   GLOBAL EVENTS
   ============================================================ */
document.addEventListener('click', e => {
  const el = e.target;

  const toastEl = el.closest('[data-toast]');
  if (toastEl) toast(toastEl.dataset.toast);

  const pageEl = el.closest('[data-page]');
  if (pageEl) { go(pageEl.dataset.page); return; }

  const modeEl = el.closest('[data-mode]');
  if (modeEl) { startRace(modeEl.dataset.mode); return; }

  const charEl = el.closest('[data-char]');
  if (charEl) {
    state.char = charEl.dataset.char;
    const c = CHARS.find(x => x.id === state.char);
    $$('.char-card').forEach(k => k.classList.toggle('selected', k.dataset.char === state.char));
    toast(`${c.name} selected · ${c.rarity.toUpperCase()} driver`);
    return;
  }

  const jump = el.closest('[data-char-jump]');
  if (jump) { state.char = jump.dataset.charJump; go('characters'); toast('Driver profile opened.'); return; }

  const tab = el.closest('#charTabs .tab');
  if (tab) { $$('#charTabs .tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); renderChars(tab.dataset.rarity); return; }

  const gtab = el.closest('.g-tab');
  if (gtab) {
    const group = gtab.closest('.g-tabs');
    $$('.g-tab', group).forEach(t => t.classList.remove('active'));
    gtab.classList.add('active');
    if (group.id === 'pageGarageTabs') {
      $('#garageTabBody').innerHTML = GARAGE_TABS[gtab.dataset.gtab]();
      animateBars($('#garageTabBody'));
    } else {
      toast(`${gtab.dataset.gtab.toUpperCase()} workshop opened in the Garage.`);
      if (gtab.dataset.gtab !== 'cars') setTimeout(() => go('garage'), 250);
    }
    return;
  }

  const up = el.closest('[data-upgrade]');
  if (up) {
    const [k, cost] = up.dataset.upgrade.split('|');
    if (state.upgrades[k] >= 6) return toast('That upgrade is already maxed out.');
    if (state.coins < +cost) return toast('Not enough coins for this upgrade.');
    state.coins -= +cost; state.upgrades[k]++;
    updateCurrency(); toast(`${k.toUpperCase()} upgraded to level ${state.upgrades[k]}.`);
    $('#garageTabBody').innerHTML = GARAGE_TABS.upgrade();
    animateBars($('#garageTabBody'));
    return;
  }

  const paint = el.closest('[data-paint]');
  if (paint) {
    const [n, h] = paint.dataset.paint.split('|');
    state.paint = +h; state.paintName = n;
    $('#garagePreview').style.filter = `hue-rotate(${h}deg) saturate(1.15)`;
    $('#garageCarName').nextElementSibling.textContent = `${state.paintName} · ${state.wheels} WHEELS`;
    toast(`${n} paint applied.`);
    return;
  }

  const wheel = el.closest('[data-wheel]');
  if (wheel) { state.wheels = wheel.dataset.wheel; toast(`${state.wheels} wheels fitted.`); return; }

  const nitro = el.closest('[data-nitro]');
  if (nitro) { state.nitroTank = nitro.dataset.nitro; toast(`${state.nitroTank} nitro system installed.`); return; }

  const buyCar = el.closest('[data-buy-car]');
  if (buyCar) {
    const [name, price] = buyCar.dataset.buyCar.split('|');
    if (state.coins < +price) return toast(`You need ${fmt(+price - state.coins)} more coins for the ${name}.`);
    state.coins -= +price;
    const car = CARS.find(c => c.name === name);
    if (car) car.owned = true;
    updateCurrency(); toast(`${name} purchased — it's in your garage!`);
    go('cars');
    return;
  }

  const buyPack = el.closest('[data-buy-pack]');
  if (buyPack) {
    const [kind, amt] = [buyPack.dataset.buyPack[0], +buyPack.dataset.buyPack.slice(1)];
    if (kind === 'c') { state.coins += amt; toast(`${fmt(amt)} coins added.`); }
    else { state.gems += amt; toast(`${fmt(amt)} gems added.`); }
    updateCurrency();
    return;
  }

  const claim = el.closest('[data-claim]');
  if (claim) { state.coins += +claim.dataset.claim; updateCurrency(); toast(`+${fmt(+claim.dataset.claim)} coins — mission reward claimed.`); return; }

  const selCar = el.closest('[data-select-car]');
  if (selCar) { state.car = selCar.dataset.selectCar; toast(`${state.car} is now your active ride.`); return; }

  const mark = el.closest('.map-mark');
  if (mark) { toast(`${mark.dataset.district} location marked on your GPS.`); return; }

  const tgl = el.closest('[data-toggle]');
  if (tgl) { tgl.classList.toggle('on'); toast(`${tgl.classList.contains('on') ? 'Enabled' : 'Disabled'} — setting saved.`); return; }

  const seg = el.closest('[data-seg] button');
  if (seg) { $$('button', seg.parentElement).forEach(b => b.classList.remove('active')); seg.classList.add('active'); toast(`${seg.textContent} selected.`); return; }
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') stopRace(); });

/* ============================================================
   BOOT
   ============================================================ */
(function init() {
  renderChars();
  renderModes();
  renderCarStats();
  renderMapLegend();
  renderMinimapsAndSpeedos();
  startSpeedoWobble();
  startClock();
  imgFallback();

  // avatar: use generated portrait if it exists, otherwise keep the "H" initial
  const av = new Image();
  av.onload = () => { $('#avatarBox').innerHTML = `<img src="assets/avatar.png" alt="avatar">`; };
  av.src = 'assets/avatar.png';

  $('#driveBtn').addEventListener('click', () => startRace('Stunt'));
  setTimeout(() => toast('Welcome back, Hakeemi — the streets missed you.'), 700);
})();
