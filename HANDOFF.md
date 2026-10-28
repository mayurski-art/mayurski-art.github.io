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
  1. Automatically once per new story: compare the newest story id to
     `localStorage['tr_news_seen']` (wrapped in try/catch).
  2. From a new main-menu item `News` (first item, desc = newest
     headline), via the bo2-menu `go: 'news'` screen like Leaderboard.
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
- Art: trollface artwork only (assets/animations, assets/images/icons,
  assets/pfp). Never the troll emoji (CLAUDE.md).

### Story art (user, 2026-10-28: "rendered based on context and also
in game appearances and well thought out in design")
- Every story's picture shows what the story is about, in the game's own
  look: Troll Forces key art, lobby scenes (ui/lobby), skins, TROLLS
  bodies, sticker sheets. No unrelated memes or generic art.
- Crop each source to its subject and save it as a small webp in
  `assets/images/news/` (crops made with a throwaway Playwright canvas
  script; ~70–190 KB each). Keep logos, QR codes and other cards out of
  the crop.
- Per story: `image`, `alt`, `focus` (object-position that keeps the
  subject in both the tall desktop pane and the wide phone strip), and
  `accent` (arc colour, taken from the art: saber red, champion gold,
  U-mad-bro green).
- `.news-shade` darkens the art toward the curve and the floor so it
  sits in the card.
- Next level (not built): a fresh in-game render per story (character
  on a transparent background, posed for the story) that breaks out
  over the curve like the reference's soldier. The tools/troll-ops-*-
  shots.mjs scripts already stage solo, Supabase-blocked scenes; one
  made for news art would write straight to assets/images/news/.

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
  SQL editor). Public SELECT of published rows; insert/update/delete
  only where `troll_is_admin()` (from troll_admin_lockdown.sql).
- admin.html gets a "News" view: list, add/edit (title, body, tag,
  image path, link, published date, pinned, published), delete. It
  writes with the admin session token it already uses.
- Home reads it with the anon key it already has.

Story shape:
```json
{
  "id": "2026-10-v1-launch",
  "title": "A troll's welcome",
  "body": ["First paragraph.", "Second paragraph."],
  "tag": "Updated based on community feedback",
  "image": "assets/animations/troll-lel_transparent.gif",
  "href": "troll-ops.html",
  "publishedAt": "2026-10-21",
  "pinned": false
}
```
Order: pinned first, then newest `publishedAt`. Show at most 5.
No stories → the menu item and auto-open both stay hidden.

### Build order
1. Static markup + CSS with one hard-coded story; check desktop,
   landscape phone, upright phone.
2. Carousel (arrows, keys, swipe, dots) with 3 placeholder stories.
3. Menu item + Esc/Back wiring + focus handling.
4. troll_news.sql + admin.html News view + home reads the table.
5. Auto-open once per new story.

Until step 4, `#news` on the home page URL opens the box with a
placeholder story (the link keeps working afterwards).

### Open questions for the user
- Real stories and art for launch (placeholders until then).
- Should the auto-open happen at all, or menu-only?
- READ MORE targets: a page per story, or a single news.html list?

## Shipped log
(one line per landed task)
- 2026-10-28 step 1: static news card, #news (site-news 92d2cb84)
- 2026-10-28 steps 2-3: carousel (arrows, keys, swipe, dots), News menu
  item, focus back to the menu, 3 placeholder stories with in-game art
  (site-news)
