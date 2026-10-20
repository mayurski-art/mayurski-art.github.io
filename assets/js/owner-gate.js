// Owner gate (user, 2026-10-20: "dont make troll us and grin sabers games
// public"). A game page that isn't open yet loads this instead of its game:
//
//   <script type="module" src="assets/js/owner-gate.js?v=og2"
//           data-owner-game="assets/games/x/game.js?v=..."></script>
//
// The game module is only imported once the signed-in account is
// troll_runner (needs supabase-js + troll-accounts.js on the page first);
// everyone else is sent straight back to the home page.
//
// This is a static site, so the game's files can still be fetched by hand:
// the gate keeps the page shut, it doesn't hide the code.
//
// Local hosts skip it so the headless tests keep working; add ?gate to a
// local URL to see the gate there too.

const OWNER = 'troll_runner';
const tag = document.querySelector('script[data-owner-game]');
const game = new URL(tag.dataset.ownerGame, document.baseURI).href;
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

if ((local && !params.has('gate')) || await isOwner()) await import(game);
else location.replace('/');
