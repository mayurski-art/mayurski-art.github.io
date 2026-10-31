// Troll Forces — NFT access: the owner hands out the TROLLS bodies (user,
// 2026-10-31). Signed in as troll_runner, Locker > Body has an "NFT access"
// row; it lists every TROLLS body with its holder, and one opens a screen
// with a username box: Give hands it to that account, Take back returns it
// to troll_runner. The server checks it's the owner
// (assets/supabase/troll_forces_nft_holders.sql); the holder then sees it
// after a reload. Nobody else sees these screens.

import { BODIES, holderOf, username } from "../characters/cosmetics.js?v=hb4-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-fj1-zr10-zc1-zc2-bf1-sr1-nf1-or1-nf2-nb1-em2-nb2-pc2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-sf1-mg1-sp1-pk1-mb1-mb2-bt1-nft33-nfh1-nfh5";
import { setHolder } from "../characters/nft-holders.js?v=nfh3";

const OWNER = "troll_runner";
export const isOwnerSignedIn = () => username() === OWNER;

let pick = null;     // the BODIES entry being handed out
let note = "";       // the last Give / Take back's answer
let busy = false;

/* The username box over the Give screen (menu-bo2.js shows it there only). */
export const nftInput = document.createElement("input");
nftInput.type = "text";
nftInput.className = "to-bo2-search";
nftInput.placeholder = "Their trollrunner.net username";
nftInput.setAttribute("aria-label", "Username to give this TROLLS body to");
nftInput.autocomplete = "off";
nftInput.spellcheck = false;
nftInput.maxLength = 20;
nftInput.hidden = true;
/* Under the box: what to do, or the last Give / Take back's answer. */
export const nftNote = document.createElement("p");
nftNote.setAttribute("role", "status");
nftNote.style.cssText = "margin:-4px 0 10px;font:13px 'DM Sans',sans-serif;color:var(--bo2-soft);max-width:340px";
nftNote.hidden = true;
const showNote = () => { nftNote.textContent = note || "Type their username, then Give (or press Enter)."; };

async function give(name, m) {
  if (busy || !pick) return;
  const who = String(name || "").trim();
  if (!who) { note = "Type a username first."; m.refresh(); nftInput.focus(); return; }
  busy = true;
  note = "Saving…";
  m.refresh();
  const r = await setHolder(pick.token, who);
  busy = false;
  note = r.ok
    ? (r.username.toLowerCase() === OWNER ? `${pick.name} is back with you.` : `${pick.name} now belongs to ${r.username}. They'll see it after a reload.`)
    : r.error;
  if (r.ok) nftInput.value = "";
  m.refresh();
}

/* The two screens, merged into menu-bo2.js's screens. */
export const nftScreens = {
  nftAccess: () => ({
    title: "NFT access",
    groups: [
      BODIES.filter((b) => b.token).map((b) => ({
        id: `na-${b.token}`, label: b.name, value: holderOf(b.token),
        desc: `Held by ${holderOf(b.token)}. Pick it to give it to someone or take it back.`,
        onSelect: (_, m) => { pick = b; note = ""; nftInput.value = ""; m.go("nftGive"); },
      })),
    ],
  }),
  nftGive: () => {
    const b = pick || BODIES.find((x) => x.token);
    const held = holderOf(b.token);
    showNote();
    return {
      title: b.name,
      enter: () => setTimeout(() => nftInput.focus(), 0),
      groups: [[
        { id: "ng-give", label: busy ? "Saving…" : "Give", value: `Now: ${held}`, disabled: busy,
          desc: note || "Type their username in the box above, then Give.",
          onSelect: (_, m) => give(nftInput.value, m) },
        { id: "ng-take", label: "Take back", disabled: busy || held === OWNER,
          desc: held === OWNER ? "It's already yours." : `Takes it off ${held} and gives it back to you.`,
          onSelect: (_, m) => give(OWNER, m) },
      ]],
    };
  },
};

/* Enter gives; Down drops into the list; Esc leaves the box. */
export function wireNftInput(menu, nav) {
  nftInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); give(nftInput.value, menu); }
    else if (e.key === "ArrowDown") { e.preventDefault(); nav.querySelector(".tr-menu-item:not([aria-disabled='true'])")?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); nftInput.blur(); menu.back(); }
  });
}
