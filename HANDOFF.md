# trollrunner.net v1.0 — HANDOFF

Site-wide handoff for the v1.0 home page work. Game handoffs stay in
their own folders (assets/games/troll-ops/HANDOFF.md, grin-sabers/HANDOFF.md).

## Status
v1.0 is a work in progress. News copy and story list are not final;
build the box so the content can change without touching code.

---

## News box (planned, not built)

### What it is
A game-launcher style "NEWS" modal (reference: an extraction-shooter
lobby news card). Big centered NEWS heading, one card at a time:
art on the left, cream text panel on the right with a headline, two
short paragraphs, an optional bold tag line ("UPDATED BASED ON
COMMUNITY FEEDBACK") and a yellow READ MORE pill. Round prev/next
arrows sit outside the card; the lobby behind it blurs and dims.
`Esc  Back` in the footer closes it.

### Where it lives
- index.html only (CLAUDE.md rule 1: one file, no new deps). Markup is
  one `<section class="home-news" hidden>` beside the other
  `.home-panel`s; CSS and JS inline with the rest.
- Opens:
  1. By itself once a visit (user, 2026-10-28: "a one time thing when
     users are on the website unless they exit out of the site", and not
     again "when users return to the website without exiting"):
     `sessionStorage['tr_news_shown']`, set whenever the card opens.
     Browsing the site and coming back, or reloading: shut. Closing the
     tab and coming back: it opens again. Only after troll_news answers,
     ~0.9 s after the menu paints, never over the site lock, the accounts
     window, a screen or panel off the main menu, or a ?open= deep link.
     Storage blocked: never by itself.
  2. From the main-menu item `News` (first item, desc = newest headline),
     or `#news` on the URL.
- Closes on Esc (reuse the existing `home-back` handler), the Back
  button, or a click on the dimmed backdrop.

### Look (match the existing home tokens, not the reference's colors)
- Backdrop: `backdrop-filter: blur(8px)` + `rgba(3,1,1,.55)` over
  `.home`; fall back to a darker solid where blur is unsupported.
- Heading: `NEWS`, Oswald 700, ~56px, `--ink`, letter-spacing .04em.
- Card: max 560x340, radius 10px, left 40% art, right 60% panel in
  `--ink` (#f3ece4) with `--void` text. Curved divider between art and
  panel (SVG clip or `border-radius` on the art pane), thin `--hot`
  arc echoing the reference's cyan stroke.
- Headline: Oswald 700 ~30px uppercase. Body: DM Sans 15px.
- Tag line: DM Sans 700 13px uppercase, optional per story.
- READ MORE: pill, `--gold` fill, `--void` text, Oswald 600.
- Arrows: 44px white circles with a dark chevron, `aria-label`
  "Previous story" / "Next story". Hidden when there's one story.
- Dots under the card for story count/position (also keyboard focusable).
- Art: rendered from the game (Story art, below). Never the troll
  emoji (CLAUDE.md).

### Story art (user, 2026-10-28: "dont use preexisting images ... high
quality rendered based images based on context and also in game
appearances and well thought out in design")
- Never pre-existing pictures. Every story's art is rendered from the
  game for that story: `tools/news-art.mjs` opens the map through the
  real game (private room, no bots, Supabase blocked), builds the cast
  from the game's own modules (TROLLS bodies with their ink, weapons and
  finishes, emotes), stands them on the real ground, and renders through
  the game's post chain. Writes `assets/images/news/<id>.webp` (1600
  square, the scene) and `<id>-hero.webp` (the lead, cut from the same
  frame by a mask, transparent round it).
- `TRY=1 node tools/news-art.mjs <id>` renders every framing in `cams`
  small to .claude/news-try/ for picking; the first is the one rendered
  for real. `FIND=<map> [FIND_BOX=x0,z0,x1,z1]` lists the map's posts,
  containers and tall meshes to stage on.
- Each shot is written in STORIES with why it fits the copy. Now:
  v1-forces (the Troll Runner's TROLLS #1718 leading a squad down
  Culdegrin at sunset), ladder-champion (the winner on a Grinsite
  container with the Gold Grin rifle, one loser sad, one with the L),
  stickers-slap (the Runner slapping a sticker onto Culdegrin's
  sticker-bombed glass panel).
- The card: `image`, `hero`, `alt`, `focus` (object-position measured
  from where the hero sits, so the tall desktop pane and the wide phone
  strip both keep them), `accent` (from the scene). The hero layer sits
  in the scene's box, unclipped, so they break out over the curve;
  `.news-shade` settles the scene into the card.
- Gotchas: the wave and high-five emotes raise the arm forward, not to
  the side, so pose "slap" sets the arm by hand (rotation z lifts it
  sideways, 1.9 rad is level; the tool tries both arms and signs). The
  "frame" on Culdegrin's centre line is glass. Further back than z -1 in
  the Grinsite yard the camera is inside a container. A screenshot of
  the Browser pane right after paging can show a stale blank card.

### Behaviour
- Arrow keys / swipe (pointer events, 40px threshold) change stories;
  wraps around.
- READ MORE: `href` per story. Internal pages open in place, external
  ones in a new tab with `rel="noopener noreferrer"`. No href → button
  hidden.
- Focus moves into the card on open and returns to the menu on close;
  `role="dialog" aria-modal="true" aria-labelledby` the headline.
- `prefers-reduced-motion`: no slide, just a cross-fade.

### Phone layout (≤ 760px and upright `max-aspect-ratio:9/10`)
- Card stacks: art on top (~160px tall), text below, full width with
  16px gutters. Arrows move under the card next to the dots.
- Must stay inside `--foot-h` and safe-area insets like `.home-panel`.

### Data (decided 2026-10-28: Supabase + admin)
Stories are content, so they come from data, not markup.

Its own table, `troll_news`, not the shared `site_updates` row. Five
writers (admin.html, both site-lock.js copies, troll-notis.js,
world.html) each read that whole row and write it back, so two saves
at once can drop one; news shouldn't ride on that.
- SQL file: `assets/supabase/troll_news.sql` (run once in the Supabase
  SQL editor, after troll_admin_lockdown.sql). Anyone reads published
  rows; insert/update/delete only where `troll_is_admin()`. Checks: art
  only from `assets/images/news/`, href only a site page or https (never
  javascript:), go only arcade/leaderboard/map, accent/focus formats.
  Seeds the three launch stories (a re-run never overwrites edits).
- admin.html "News" view (#news): the list in home-page order (drafts
  dimmed, which five are live), and a form: headline, body (blank line =
  new paragraph), tag, art (a tools/news-art.mjs render name, with a
  live crop preview), focus sliders, arc colour, hero on/off, alt, Read
  more (nothing / a page or link / Arcade / Leaderboard / Map), date,
  pinned, published; save, delete. Writes check for the admin token
  itself (adminRpcHeaders falls back to the anon key) and treat a write
  that returns no row as refused (RLS makes anon writes silent no-ops).
- Home reads it with the anon key: published, pinned first, newest,
  five. No table yet or the request fails: the launch stories in
  index.html stay. An empty table: no News item at all. Links are
  re-checked on the page too.

Row: `id` (slug from the headline), `title`, `body`, `tag`, `image`,
`hero`, `alt`, `focus`, `accent`, `href` | `go`, `pinned`, `published`,
`published_at`.

### Build order
1. Static markup + CSS with one hard-coded story; check desktop,
   landscape phone, upright phone.
2. Carousel (arrows, keys, swipe, dots) with 3 placeholder stories.
3. Menu item + Esc/Back wiring + focus handling.
4. troll_news.sql + admin.html News view + home reads the table.
5. Opens by itself once a visit (done).

`#news` on the home page URL opens the box.

To go live: run `assets/supabase/troll_news.sql` once in the Supabase
SQL editor (until then the home page shows the launch stories), then
merge site-news.

### Open questions for the user
- Real stories and art for launch (placeholders until then).
- READ MORE targets: a page per story, or a single news.html list?

## Shipped log
(one line per landed task)
- 2026-10-28 step 1: static news card, #news (site-news 92d2cb84)
- 2026-10-28 steps 2-3: carousel (arrows, keys, swipe, dots), News menu
  item, focus back to the menu, 3 placeholder stories (site-news a01de97c)
- 2026-10-28 story art rendered from the game (tools/news-art.mjs), hero
  cut-outs breaking out over the curve (site-news cbabe88a)
- 2026-10-28 step 4: troll_news table (SQL run), admin.html News view,
  home reads it with the launch stories as fallback (main 7d35a209)
- 2026-10-28 step 5: the card opens by itself once a visit (site-news)
