# Same-origin front door — native page transitions across the network

**Status:** Phase 1 shipped and verified live. Scope narrowed to the four
public apps.
**Date:** 2026-08-13
**Goal:** seamless transitions between the public trollrunner sites on
mobile.

---

## 1. The finding that shapes this

The reference (`trollface.io` → `trollface.io/city`) is not doing a
transition effect. Both URLs serve the *identical* HTML shell and the
identical bundle. It is a React SPA — react-router swaps components in
place and the browser never navigates. There is nothing to make seamless.

The important part is not the SPA, it is the **single origin**. The native
cross-document View Transitions API —

```css
@view-transition { navigation: auto; }
```

— makes the browser animate ordinary multi-page navigations, hardware
accelerated, no framework. It has one hard requirement: **same origin**.
Subdomains are separate origins, so between `terminal.trollrunner.net` and
`maps.trollrunner.net` it silently does nothing.

So the goal is not "become an SPA". It is "become one origin". Every site
stays exactly what it is today. The alternative — consolidating ~120,000
lines across 11 repos into one React app — was measured and rejected: the
games repo alone is ~58,000 lines of canvas games that React does nothing
for, and terminal's 13 API routes hold secrets a client-side SPA cannot.

---

## 2. Scope: the four public apps

Only what the public can already see is in scope. The app grid is rendered
from `tdVisibleSites()` in `index.html`, which returns the entries without
an `adminOnly` flag:

| In scope | Host | Stack | Serves |
|---|---|---|---|
| `terminal` | Vercel | Next.js (SSR) | `/_next`, `/api`, `/faces`, `/lore` |
| `finance` | GitHub Pages | static HTML | relative paths only |
| `stickers` | GitHub Pages | static HTML | relative paths only |
| `maps` | GitHub Pages | Next.js static export | `/_next` |

**Out of scope — do not work on these:** `fitness`, `games`, `garden`,
`blog`/`nutrition`, `videos`, `projects`. All are `adminOnly` and not
public. This is a deliberate instruction, not an oversight.

This narrowing removed the blocker the previous revision of this doc was
stuck on. That blocker was terminal and fitness both serving `/_next/*`;
fitness is admin-only, so it is gone. Of the four public apps only
terminal is a real SSR app, and two are plain static sites.

---

## 3. Architecture

One Vercel project is the front door and rewrites paths to the
deployments that already exist. Vercel rewrites proxy to absolute
external URLs, so nothing moves hosts.

```
trollrunner.net/            → apex   (GitHub Pages)
trollrunner.net/terminal/*  → terminal.trollrunner.net (Vercel)
trollrunner.net/finance/*   → finance.trollrunner.net  (GitHub Pages)
trollrunner.net/stickers/*  → stickers.trollrunner.net (GitHub Pages)
trollrunner.net/maps/*      → maps.trollrunner.net     (GitHub Pages)
```

Every response comes from one origin, so view transitions work across
the set. Each site keeps its own repo, deploy and release cadence.

Config lives in `frontdoor/vercel.json`.

### The transition itself, mobile only

Added once to each site's CSS:

```css
@media (max-width: 760px) {
  @view-transition { navigation: auto; }
}
```

Shipped already in the main site (`index.html`) and terminal
(`app/globals.css`).

**Browser support.** Cross-document view transitions shipped in Chrome 126
and Safari 18.2. Older browsers navigate normally with no transition —
silent degradation, no fallback needed.

---

## 4. What each site needs

Verified against the codebases, not assumed.

**`finance` and `stickers` — nothing.** Both reference assets
*relatively*, and a grep for root-absolute `src=`/`href=` returns **0
hits** in each. Neither serves `/_next`. They can be routed with no code
change and nothing to collide over. This is why they go first.

**`terminal` — nothing, for now.** Phase 1 routes it without `basePath` by
passing `/_next`, `/api`, `/faces` and `/lore` straight through. Works
today; the subdomain keeps working untouched.

**`maps` — the one real conflict.** It is a Next.js static export and
serves `/_next/*`, which collides with terminal's `/_next/*` under one
origin. Only one of the two can own that path. Resolving it means giving
one of them a `basePath`, which is the coupled step described below.

**Cross-site links.** Internal links point at absolute subdomain URLs
(`https://terminal.trollrunner.net`). They must become path-relative
(`/terminal`) or transitions will not fire — a cross-origin link defeats
the whole exercise.

**Trailing slashes.** A page served at `/finance` resolves its relative
assets against `/`, not `/finance/`. The rewrite must land on `/finance/`
(or redirect to it) or every relative asset 404s. This is the most likely
way the static routing breaks.

---

## 5. Risks

**`basePath` breaks the standalone subdomain.** Setting
`basePath: '/maps'` makes the app serve *only* under that prefix, so
`maps.trollrunner.net/` starts returning 404 and stays broken until the
domain points at the front door. Any phase that sets `basePath` is
therefore welded to the DNS cutover. Phase 1 avoided this by not setting
one.

**CNAME files.** The GitHub Pages sites are bound to their subdomains by
`CNAME` files, and the standing instruction is not to touch them. The
cutover implies changing how those domains resolve — explicit sign-off
required, and it goes last.

**SSO gets simpler, but the cutover can log people out.**
`troll-accounts.js` writes a `Domain=.trollrunner.net` cookie *because*
localStorage is per-origin and siblings cannot see each other's copy. One
origin makes that bridge unnecessary. The risk is the cutover itself:
sessions must be re-adopted from the cookie rather than dropped. The
existing `adoptSsoCookie()` path already does this.

**Old URLs must keep working.** Anything bookmarked at
`maps.trollrunner.net` needs a 301 to `trollrunner.net/maps`.

**CSP.** `connect-src` and `frame-src` on these sites are strict and fail
silently. Consolidating origins changes what counts as same-origin;
headers need review at cutover.

**Deploy permission.** Production deploys to the front door project are
currently rejected — see §7. Nothing further ships until that is fixed.

---

## 6. Phasing

Reordered so everything reversible happens before anything that isn't.
The old ordering put a coupled step second; this puts it last.

1. **Front door + terminal.** ✅ Shipped and verified — see §7. No
   `basePath`, passthrough routing, subdomain untouched.
2. **Static sites.** ✅ Built and verified locally — see §7.2. `finance`
   and `stickers` routed with trailing-slash redirects; both carry the
   transition CSS. Not deployed: blocked on the permission below.
3. **Internal links → paths.** Convert absolute subdomain links to
   relative paths so transitions actually fire between the routed sites.
4. **Shared scripts + CSP.** Move `troll-notis.js` / `troll-accounts.js`
   to same-origin paths; review CSP headers.
5. **Cutover — one atomic step.** DNS, `basePath` for the Next apps,
   `maps` `/_next` disambiguation, and 301s from the old subdomains, all
   together. This is the irreversible step, it touches CNAME, and it
   needs explicit sign-off.

Rollback for phases 1–4: delete the rewrite. The subdomain still serves
its site directly, because no underlying deployment moved.

`maps` deliberately does not appear before phase 5. Routing it requires
resolving the `/_next` collision, which requires `basePath`, which breaks
its subdomain — so it belongs with the cutover, not before it.

---

## 7. Phase 1 verification (2026-08-13)

### Live and phone-testable

**https://trollrunner-frontdoor.vercel.app/demo.html**

Measured with the `pagereveal` event, whose `viewTransition` property is
non-null only when a cross-document transition actually runs, rather than
inferred from timing. `/terminal` proxies the real production terminal.

| Viewport | Result |
|---|---|
| 390×844 | **transition fired** |
| 1280×800 | no transition, as intended |

Two separately-deployed sites — GitHub Pages and Vercel, different stacks
— animating between each other natively, purely because the front door put
them on one origin.

**`@view-transition` inside `@media` is valid and is the correct gate.**
Flagged as uncertain when first written; isolated and confirmed:

| | mobile | desktop |
|---|---|---|
| bare `@view-transition` | fires | fires |
| wrapped in `@media (max-width: 760px)` | fires | **does not fire** |

**Testing note.** Playwright's `isMobile: true` device-emulation flag
suppresses the transition and produces a false negative. Set only
`viewport`.

## 7.2 Phase 2 verification (2026-08-13)

Measured against a local mirror of `frontdoor/vercel.json`, counting every
failed response and request on each page.

| Route | Resources | Broken |
|---|---|---|
| `/stickers/` | 50 | **0** |
| `/terminal` | 21 | **0** (was 4) |
| `/finance/` | 225 | 3 distinct, all explained below |

**Trailing-slash redirects work.** `/finance` → `/finance/` → 200, with
every relative asset resolving inside the prefix. This was called out in
§4 as the most likely way static routing breaks; it doesn't.

### A real defect this caught in Phase 1

Terminal's own page routes — `/vault`, `/logs`, `/reports`,
`/undervoice`, `/inspect`, `/faces` — are root-absolute, so the catch-all
was sending them to the apex and every in-app link 404d. Next prefetches
them on load, which is what surfaced it. Phase 1 handled terminal's
*assets* but not its *routes*.

Now matched explicitly in `frontdoor/vercel.json`. This list has to track
`app/**/page.tsx` by hand and will rot the next time terminal adds a
page — giving terminal a `basePath` at cutover is what makes it
self-maintaining.

### Failures that are NOT caused by the front door

Established by loading `finance.trollrunner.net` directly and diffing the
failures, rather than assuming:

| Failure | Verdict |
|---|---|
| `403 api.mainnet-beta.solana.com` | pre-existing, fails live too |
| `FAIL cdn.syndication.twimg.com` (tweet embeds) | pre-existing, fails live too |
| `404 assets/animations/troll-grin.gif` | pre-existing, fails live too |

The gif is worth its own note: nothing in the finance repo references it.
It comes from `troll-accounts.js:1470`, which uses the **relative** path
`assets/animations/troll-grin.gif`. A relative path in a cross-origin
script resolves against the *page*, so every site that loads
`troll-accounts.js` without hosting that asset 404s it. `troll-notis.js`
gets this right with an absolute URL. One-line fix, unrelated to this
migration, not done here.

### One genuine new failure: third-party origin allowlists

`trollrunner-rpc-proxy.vercel.app/api/rpc` succeeds on
`finance.trollrunner.net` and fails through the front door. The request
is unchanged; only the page's origin differs, which points at a CORS
allowlist keyed to the origin.

This generalises beyond one endpoint: **any third-party service that
allowlists `*.trollrunner.net` origins needs `trollrunner.net` added
before cutover.** Worth auditing while phases 3–4 are in flight.

### Known wart

The `home` link 301s away to `trollrunner.net` and leaves the front door,
because the deployed config still proxies `www.trollrunner.net`, which
itself redirects to the apex. Fixed in `frontdoor/vercel.json` but not yet
published — see below.

### Deploy permission is blocked

Creating a production deployment is rejected with `403 — you don't have
permission to create a Production Deployment for this project`. The public
URL serves the *first* deployment, which is why the apex fix is not live.
Raising the account role is a dashboard action, not a code change, and it
gates every phase after this one.

---

## 8. Open questions

1. ~~Which domain is canonical?~~ **Answered: the apex.**
   `www.trollrunner.net` 301s to `trollrunner.net`.
2. Should the old subdomains 301 permanently at cutover, or keep serving
   in parallel for a while as a safety net?
3. At cutover, does `maps` take the `basePath` and leave `/_next` to
   terminal, or the reverse?
