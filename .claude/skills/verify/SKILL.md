---
name: verify
description: How to run and verify the Troll Runner main site (index.html) end-to-end with headless Chrome.
---

# Verifying the main site (mayurski-art.github.io)

Static single-page site — no build step. Serve the repo root over HTTP and
drive it with Playwright chromium (binaries are cached in
`%LOCALAPPDATA%/ms-playwright`; `npm i playwright` in a scratch dir with
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is enough).

## Serve

Any static server on the repo root works. A ~15-line `http.createServer`
with a MIME map is fine; `file://` is NOT — Supabase fetch/CORS breaks.

## Getting to the desktop (two gates)

1. **Coming-soon overlay** (`assets/js/coming-soon.js`, `#coming-soon-gate`,
   z-index 2147483000) blocks everything and only unlocks with a real admin
   Supabase session. In tests, strip it after `domcontentloaded`:
   ```js
   await page.evaluate(() => {
     document.documentElement.classList.remove('cs-locked');
     document.getElementById('coming-soon-gate')?.remove();
     Array.from(document.body.children).forEach(c => c.removeAttribute('inert'));
   });
   ```
2. **Site gate** (`#site-gate`): click `#site-gate-enter` → troll desktop
   boots. Taskbar tray (`#td-tray`, bottom right) holds clock, viewer pill
   (`#site-viewer-pill`), ONLINE badge.

Use a desktop viewport (≥1440×900) — under the mobile breakpoint the tray
hides the viewer pill.

## Poking at page internals

The whole app is ONE inline `<script>`. Top-level `function` declarations
are reachable from `page.evaluate` as bare identifiers (e.g.
`getViewerRoster()`, `openViewerProfileCard(...)`). Top-level `let`/`const`
(e.g. `viewerPresenceChannel`) are NOT `window.*` properties but ARE
reachable by bare identifier inside evaluate.

## Live backend caveats

- The page talks to the REAL Supabase project (presence channel
  `trollrunner-site-presence`, view counter RPC). Local test tabs join the
  same live presence room as real visitors — assert on deltas/contains, not
  exact counts.
- Simulate login without creating accounts: stub
  `window.TrollrunnerAccounts.getCachedProfile = () => ({userId, username, avatarUrl, level})`
  with a REAL profile row (fetch one from
  `rest/v1/troll_profiles?select=id,username&limit=3` with the anon key from
  index.html), then
  `window.dispatchEvent(new CustomEvent('trollrunner:auth-changed', {detail: {...}}))`.
- Supabase presence gotcha: re-`track()` ACCUMULATES metas under the key on
  other clients (leave diffs don't reliably arrive). The site untracks
  before re-tracking and picks the freshest `trackedAt` meta per viewer —
  keep both if touching presence.
- Allow ~4–5s after gate entry for the presence channel to subscribe/sync
  before asserting counts.

## Multi-user flows

One `browser.newContext()` per simulated visitor (separate localStorage →
separate `viewerId` → separate presence key). Presence changes propagate
between contexts in ~1–2s.
