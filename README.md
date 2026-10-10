# HAKEE MI RUSH — Street Legends (UI)

A pixel-faithful, interactive recreation of the **Hakeemi Rush: Street Legends** game
front-end: the full dashboard UI from the reference artwork, built as a real web app.

![sections](assets/hero-car.png)

## What's inside

**Home dashboard** (matches the reference layout)

| Area | Contents |
|---|---|
| Sidebar | Profile chip (avatar, level + XP bar), PLAY / GARAGE / CARS / CHARACTERS / MISSIONS / WORLD MAP / SHOP / PROFILE / SETTINGS, live player counter |
| Top bar | Live event chip, coin & gem counters |
| Hero | Crown, `HAKEE MI RUSH` logo, `STREET LEGENDS` subtitle, hero car art, `RACE • HEIST • CHASE • EXPLORE` tagline |
| Right rail | Live race stats (POS / LAP / best lap + ticking race clock), Wanted Level with flickering stars + police units, Characters panel with rarity tabs |
| Mid row | Money Heist contract card (objectives, pulsing POLICE ALERTED, reward), two gameplay cards with SVG minimaps and animated speedometers |
| Bottom row | Garage (car art, animated stat bars, workshop tabs, DRIVE), World Map (SVG city map + legend), Game Modes (8 modes) |
| Banners | Explore · Customize · Outrun the Police · Real Racing Experience |

**Working sections** — every sidebar entry opens a real page:

- **Garage** — live car preview, upgrade tree that spends coins, paint/livery swatches that
  re-tint the preview car, wheels, nitro tanks.
- **Cars** — 8-car roster with stat bars, buy (spends coins) and select.
- **Characters** — driver detail view with stats + bio, clickable roster.
- **Missions** — contracts with progress bars and claimable rewards.
- **World Map** — large interactive SVG map with clickable POIs.
- **Shop** — currency packs that actually credit coins/gems.
- **Profile** — season stats, XP/rank bars, achievements.
- **Settings** — toggles, quality presets, control reference.

**Extras** — toast notifications, a full-screen "ENTERING RACE" overlay with progress bar and
3-2-1-GO countdown (ESC to cancel), live race clock, hover/press micro-interactions,
image fallbacks, responsive layout down to mobile.

## Run it

No build step — it's plain HTML/CSS/JS:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
# open http://localhost:8080
```

## Files

```
index.html      dashboard markup
styles.css      full design system (dark neon theme, responsive)
app.js          data, SVG art (speedometers / minimaps / city map), router, interactions
assets/         generated art + self-hosted Montserrat / Orbitron fonts
smoke-test.js   jsdom test that boots the page and clicks through every section
```

## Notes

- Art is AI-generated; a few secondary slots (some game-mode thumbnails and banners) fall back
  to hand-built vector scenes drawn in `app.js` — drop a real photo at the matching
  `assets/*.png` path and it replaces the vector art automatically.
- All fonts are self-hosted, so the UI renders identically offline.
