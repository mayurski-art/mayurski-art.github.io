// Owner gate (user, 2026-10-20: "dont make troll us and grin sabers games
// public"). A game page that isn't open yet loads this instead of its game:
//
//   <script type="module" src="assets/js/owner-gate.js?v=og2"
//           data-owner-game="assets/games/x/game.js?v=..."></script>
//
// The game module is only imported once the signed-in account is
// troll_runner (needs supabase-js + troll-accounts.js on the page first);
// everyone else is sent straight back to the home page. A page built from
// classic scripts (Troll Kombat) lists them in data-owner-scripts instead,
// space-separated, and they're added in that order.
//
// This is a static site, so the game's files can still be fetched by hand:
// the gate keeps the page shut, it doesn't hide the code.
//
// Local hosts skip it so the headless tests keep working; add ?gate to a
// local URL to see the gate there too.

const OWNER = 'troll_runner';
const tag = document.querySelector('script[data-owner-game], script[data-owner-scripts]');
const local = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(location.hostname);
const params = new URLSearchParams(location.search);

async function isOwner() {
  const A = window.TrollrunnerAccounts;
  if (!A?.getSession) return false;
  try {
    const s = await A.getSession();
    return String(s?.username || '').toLowerCase() === OWNER;
  } catch { return false; }
}

function loadGame() {
  if (tag.dataset.ownerGame) return import(new URL(tag.dataset.ownerGame, document.baseURI).href);
  for (const src of tag.dataset.ownerScripts.trim().split(/\s+/)) {
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // keep the listed order
    document.body.appendChild(s);
  }
}

if ((local && !params.has('gate')) || await isOwner()) await loadGame();
else location.replace('/');
