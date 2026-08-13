# Same-origin front door — native page transitions across the network

**Status:** Phase 1 premise verified — see §8
**Date:** 2026-08-13
**Goal:** seamless transitions between all trollrunner sites on mobile.

---

## 1. The finding that shapes this

The reference (`trollface.io` → `trollface.io/city`) is not doing a
transition effect. Both URLs serve the *identical* HTML shell and the
identical bundle (`index-KNK6_RMh.js`). It is a React SPA — react-router
swaps components in place and the browser never navigates. There is
nothing to make seamless.

The important part is not the SPA, it is the **single origin**. The
native cross-document View Transitions API —

```css
@view-transition { navigation: auto; }
```

— makes the browser animate ordinary multi-page navigations, hardware
accelerated, no framework. It has one hard requirement: **same origin**.
Subdomains are separate origins, so between `terminal.trollrunner.net`
and `games.trollrunner.net` it silently does nothing.

So the goal is not "become an SPA". It is "become one origin". Every site
can stay exactly what it is today.

### Why not the SPA rewrite

Measured across the 11 repos:

| | Lines |
|---|---|
| Static HTML sites (8) | ~104,000 |
| └ of which `trollrunner-games` | ~58,000 |
| Next.js apps (3) | ~16,400 |
| **Total** | **~120,000** |

Three things make it worse than the count suggests: the games repo is 19
canvas games where React adds nothing to a `requestAnimationFrame` loop;
`trollrunner-terminal` has 13 API routes holding `ANTHROPIC_API_KEY` and
`SUPABASE_SERVICE_ROLE`, which a client-side SPA cannot hold; and terminal
and fitness would lose SSR. Months of work, to arrive at the features that
already exist.

---

## 2. Current topology

| Site | Host | Stack |
|---|---|---|
| `www` | GitHub Pages | static HTML |
| `games` | GitHub Pages | static HTML |
| `blog` | GitHub Pages | static HTML |
| `finance` | GitHub Pages | static HTML |
| `nutrition` | GitHub Pages | static HTML |
| `projects` | GitHub Pages | static HTML |
| `videos` | GitHub Pages | static HTML |
| `stickers` | GitHub Pages | static HTML |
| `garden` | GitHub Pages | static HTML |
| `maps` | GitHub Pages | Next.js, `output: export` |
| `terminal` | Vercel | Next.js + 13 API routes |
| `fitness` | Vercel | Next.js + 1 API route |

---

## 3. Proposed architecture

One Vercel project becomes the front door at `trollrunner.net` and
rewrites paths to the deployments that already exist. Vercel rewrites
proxy to absolute external URLs, so nothing needs to move hosts.

```
trollrunner.net/            → www      (GitHub Pages)
trollrunner.net/games/*     → games    (GitHub Pages)
trollrunner.net/terminal/*  → terminal (Vercel)
trollrunner.net/fitness/*   → fitness  (Vercel)
trollrunner.net/maps/*      → maps     (GitHub Pages)
…and so on for blog, finance, nutrition, projects, videos, stickers, garden
```

Every response now comes from one origin, so view transitions work
network-wide. Each site keeps its own repo, its own deploy, its own
release cadence.

### The transition itself, mobile only

Added once to each site's CSS. The media query satisfies the mobile-only
requirement; desktop keeps instant navigation.

```css
@media (max-width: 760px) {
  @view-transition { navigation: auto; }
}
```

Shared elements (the header, the mascot) can opt into continuity by
carrying a matching `view-transition-name` on both sides.

**Browser support.** Cross-document view transitions shipped in Chrome 126
and Safari 18.2. Older browsers simply navigate normally with no
transition — this degrades silently and needs no fallback path.

---

## 4. What each site actually needs

Verified against the codebases, not assumed:

**Static sites — near zero work.** They reference assets *relatively*
(`assets/js/site-lock.js`, not `/assets/js/site-lock.js`). Grep for
root-absolute `src=`/`href=` across games, blog, finance and stickers
returns **0 hits**. Relative paths survive a path prefix unchanged, which
removes the usual blocker for this kind of migration.

**Next.js apps — one config line each.** Neither terminal nor fitness sets
`basePath`, so each needs `basePath: '/terminal'` / `'/fitness'` to emit
correct asset and route URLs under its prefix.

**Cross-site links.** Internal links currently point at absolute
subdomain URLs (`https://terminal.trollrunner.net`). These must become
path-relative (`/terminal`) — a cross-origin link defeats the whole
exercise, since view transitions will not fire across origins.

**Shared scripts.** Sites load
`https://mayurski-art.github.io/assets/js/troll-notis.js` and
`https://www.trollrunner.net/assets/js/troll-accounts.js` cross-origin.
These should become same-origin paths so they stop being third-party
requests.

---

## 5. Risks

**CNAME files.** Nine sites are GitHub Pages with `CNAME` files binding
them to subdomains. Standing instruction is not to touch CNAME. This
migration eventually implies changing how those domains resolve — that
step needs explicit sign-off and should be last, not first.

**SSO gets simpler, but the cutover can log people out.**
`troll-accounts.js` writes a `Domain=.trollrunner.net` cookie *specifically*
because localStorage is per-origin and siblings cannot see each other's
copy. One origin makes that bridge unnecessary. The risk is the cutover
itself: sessions live in per-origin localStorage today, so users must be
re-adopted from the cookie rather than dropped. The existing
`adoptSsoCookie()` path already does this and should keep working through
the transition.

**Old URLs must keep working.** Anything bookmarked or linked at
`games.trollrunner.net` needs a 301 to `trollrunner.net/games`. Skipping
this breaks inbound links and loses SEO.

**Proxy traffic.** All network traffic now flows through one Vercel
project. Worth watching bandwidth against plan limits, since GitHub Pages
was previously absorbing most of it.

**CSP.** Per prior incidents, `connect-src` and `frame-src` on these sites
are strict and fail silently. Consolidating origins changes which sources
are same-origin; CSP headers need review as part of the cutover.

---

## 6. Phasing

Each phase is independently shippable and reversible.

1. **Prototype.** Front door with two routes: `/` (www) and `/terminal`.
   Add the mobile view-transition CSS to both. Verify a real transition on
   a real phone. This validates the whole premise cheaply.
2. **Next.js apps.** Add `basePath` to terminal and fitness; route them
   through the front door.
3. **Static sites.** Route the remaining nine. Mostly config, given
   relative assets.
4. **Internal links.** Convert absolute subdomain links to paths, so
   transitions actually fire between sites.
5. **Shared scripts + CSP.** Move `troll-notis.js` / `troll-accounts.js`
   to same-origin paths; review CSP.
6. **Redirects + DNS.** 301 the old subdomains. Requires explicit sign-off
   (see CNAME risk).

Rollback at any point: remove the rewrite and the subdomain still serves
its site directly, because none of the underlying deployments moved.

---

## 8. Phase 1 verification (2026-08-13)

The premise was tested against a local proxy mirroring `frontdoor/vercel.json`
exactly, with `/` → the live GitHub Pages site and `/terminal` → a real
Next.js build carrying the new CSS. Measured with the `pagereveal` event,
whose `viewTransition` property is non-null only when a cross-document
transition actually runs — rather than inferring from timing.

| Viewport | Result |
|---|---|
| 390×844 (mobile) | **transition fired** |
| 1280×800 (desktop) | no transition, as intended |

Two separately-deployed sites — GitHub Pages and Vercel, different stacks —
animated between each other natively, purely because the front door put them
on one origin. No SPA, no framework, no shared bundle.

**`@view-transition` inside `@media` is valid and is the correct gate.**
This was flagged as uncertain when the doc was written. Isolated test:

| | mobile | desktop |
|---|---|---|
| bare `@view-transition` | fires | fires |
| wrapped in `@media (max-width: 760px)` | fires | **does not fire** |

So the media query is what delivers the mobile-only requirement, and it
works.

**Testing note.** Playwright's `isMobile: true` device-emulation flag
suppresses the transition and produces a false negative. Anyone re-running
this should set only `viewport`, not `isMobile`.

**Deployment note.** The front door is deployed as a Vercel *preview*
(`trollrunner-frontdoor`), which sits behind Vercel Authentication and so
cannot be opened on a phone without logging in. Creating a production
deployment was rejected: the account role lacks permission. Making this
phone-testable needs either deployment protection disabled for this project
or a production deploy from an account that can — a dashboard action, not a
code change.

---

## 7. Open questions

1. Which domain is canonical — `trollrunner.net` or `www.trollrunner.net`?
2. Should subdomains 301 permanently, or keep serving in parallel for a
   while as a safety net?
3. Is `garden` in scope? It is live but has no local repo checkout.
