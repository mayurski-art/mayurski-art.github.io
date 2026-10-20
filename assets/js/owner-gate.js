// Owner gate (user, 2026-10-20: "dont make troll us and grin sabers games
// public"). A game page that isn't open yet loads this instead of its game:
//
//   <script type="module" src="assets/js/owner-gate.js?v=og1"
//           data-owner-game="assets/games/x/game.js?v=..."></script>
//
// The game module is only imported once the signed-in account is
// troll_runner (needs supabase-js + troll-accounts.js on the page first);
// everyone else gets a short "not open yet" card.
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

function lockedCard() {
  const name = document.title.split('|')[0].trim() || 'This game';
  const wrap = document.createElement('div');
  wrap.id = 'owner-gate';
  wrap.setAttribute('role', 'alert');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;'
    + 'background:#05060c;color:#e9ebf2;font:500 16px/1.45 "DM Sans",Arial,sans-serif;text-align:center';
  wrap.innerHTML = `
    <div style="max-width:340px">
      <img src="/assets/images/wallpaper/trollface%20transparent.png" alt="" width="96" height="90" style="display:block;margin:0 auto 18px;opacity:.9">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800"></h1>
      <p style="margin:0 0 22px;color:#a3a8b8">Not open yet. Still cooking. Problem?</p>
      <a href="/?open=arcade" style="display:inline-block;padding:10px 18px;border-radius:12px;background:#fff;color:#05060c;font-weight:700;text-decoration:none">Back to the arcade</a>
    </div>`;
  wrap.querySelector('h1').textContent = name;
  document.body.append(wrap);
  // Nothing behind the card should take the keyboard.
  for (const el of document.body.children) if (el !== wrap && el.tagName !== 'SCRIPT') el.inert = true;
}

if ((local && !params.has('gate')) || await isOwner()) await import(game);
else lockedCard();
