// Troll Forces Zombies hub: the Weapons and Classes kiosk screens (Zombie
// Rush P6), laid out like Zombie Rush's (refs/zombie-rush/
// weapons-tier1-m1911.png, classes-rookie.png).
//
//   Weapons   a row of six tiers (Common to Mythic); under it the Selected
//             Weapon (picture, stats now > next level, Buy/Upgrade and
//             Equip) and the tier's guns, Owned and Unowned.
//   Classes   the kits down the left (Rookie, the rest coming soon); the
//             Rookie's three deployables on the right, each with its level
//             and an upgrade for Credits.
//
// Everything bought lives in modes/zombies/credits.js. Opened at a hub kiosk
// (hold X, modes/zombies/hub.js) or from the menu's Zombies screen; like DJ
// Lulz's panel it frees the mouse while open and takes it back on close,
// and menu/buttons.js doesn't open the pause menu for it.

import { game } from "../core/state.js?v=st1";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb2-gc1-nft33-nfh1-nfh5-nft2531";
import { WEAPON_DEFS } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4";
import { DEPLOYABLES, KITS, statsAt } from "../modes/zombies/kits.js?v=zr6-zr9-zr10-zd1-wb1";
import {
  GUN_TIERS, GUN_MAX, KIT_MAX, tierOf, tierOpen, owns, gunLevel, gunAction, gunAtLevel, equippedGun,
  buyGun, upgradeGun, equipGun, kitAction, upgradeKit, zsave, onCreditsChange, loggedIn,
} from "../modes/zombies/credits.js?v=zc1-zc2-zf1-wb1-mt2-hb4-gc1";
import { gunThumb, kitThumb } from "./zombies-thumbs.js?v=zc1-zc2-zp1-sr1-br1-or1-rt1-ut1-rb4-hp1-bx1-mg1-tm2-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-lz1-ret1-ret2-mrg1-hd1-ugb1-ug1-ugm1-mrc1-hgb6-tw1-rt2-fd1-ars1-mrg3-p416-mt2-sk1-hb4-sr7-mb1-mb2";

const RARITY = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];
const SOON_KITS = ["Medic", "Recon", "Trapper", "Pyro", "Demolitionist"];

let ui = null;
let open = null;     // "weapons" | "classes" | null
let tier = 1;
let picked = null;   // the gun in the Selected Weapon panel
let wasLocked = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (n) => Math.round(n).toLocaleString();

/* ------------------------------------------------------------ stats */

const dps = (d) => (d.damage * (d.pellets || 1) * (d.rpm || 0)) / 60;
function gunStats(id, lv) {
  const d = gunAtLevel(WEAPON_DEFS[id], Math.max(1, lv));
  return { dps: dps(d), damage: d.damage * (d.pellets || 1), mag: d.magSize, reload: d.reloadTime };
}
const KIT_STATS = {
  turret: [["DPS", (s) => s.damage * s.fireRate], ["Range", (s) => s.range, "m"], ["Health", (s) => s.hp]],
  barricade: [["Health", (s) => s.hp], ["Spikes", (s) => s.spikeDps, "/s"]],
  barrel: [["Damage", (s) => s.damage], ["Blast", (s) => s.radius, "m"]],
};

/* A stats row: "now > next" (next in green), or just "now". */
function statRow(label, now, next, fmt = num) {
  const nx = next != null && fmt(next) !== fmt(now) ? ` &gt; <b class="zk-up">${fmt(next)}</b>` : "";
  return `<div class="zk-stat"><span>${esc(label)}</span><span>${fmt(now)}${nx}</span></div>`;
}

/* ------------------------------------------------------------ the shell */

function build() {
  if (ui) return;
  const root = document.createElement("div");
  root.className = "zk";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.innerHTML = `
    <div class="zk-panel">
      <div class="zk-head">
        <h2 class="zk-title"></h2>
        <div class="zk-credits" aria-label="Credits"><span class="zk-coin" aria-hidden="true"></span><b class="zk-credits-n">0</b>&nbsp;Credits</div>
        <button type="button" class="zk-close" aria-label="Close">✕</button>
      </div>
      <div class="zk-body"></div>
      <p class="zk-foot"></p>
    </div>`;
  (game.els.hud?.parentElement || document.body).appendChild(root);
  ui = {
    root,
    title: root.querySelector(".zk-title"),
    credits: root.querySelector(".zk-credits-n"),
    body: root.querySelector(".zk-body"),
    foot: root.querySelector(".zk-foot"),
    close: root.querySelector(".zk-close"),
  };
  ui.close.addEventListener("click", () => closeKiosk());
  root.addEventListener("click", (e) => {
    if (e.target === root) { closeKiosk(); return; }
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    act(b.dataset.act, b.dataset.id);
  });
  window.addEventListener("keydown", (e) => {
    if (!open) return;
    // nothing under the kiosk hears a key (the menu's Enter would deploy);
    // Tab, Enter and Space still work its own buttons
    e.stopPropagation();
    // (not X held down: the hold that opened it auto-repeats)
    if (e.code === "Escape" || (e.code === "KeyX" && !e.repeat)) { e.preventDefault(); closeKiosk(); }
  }, true);
  onCreditsChange(() => { if (open) render(); });
}

function act(kind, id) {
  let ok = true;
  if (kind === "tier") { tier = +id; picked = null; }
  else if (kind === "pick") picked = id;
  else if (kind === "buy") ok = buyGun(id);
  else if (kind === "upgrade") ok = upgradeGun(id);
  else if (kind === "equip") ok = equipGun(id);
  else if (kind === "kit-up") ok = upgradeKit(id);
  game.audio?.zombieBuy?.(ok);
  render();
}

/* Fill every <img data-thumb> as its picture comes in. */
function paintThumbs() {
  for (const img of ui.body.querySelectorAll("img[data-gun], img[data-kit]")) {
    const p = img.dataset.gun ? gunThumb(img.dataset.gun) : kitThumb(img.dataset.kit);
    p.then((url) => { if (url && img.isConnected) { img.src = url; img.classList.add("is-in"); } });
  }
}
const gunImg = (id) => `<img class="zk-thumb" data-gun="${id}" alt="">`;
const kitImg = (id) => `<img class="zk-thumb" data-kit="${id}" alt="">`;

function render() {
  if (!ui || !open) return;
  const s = zsave();
  ui.root.dataset.kiosk = open;
  ui.credits.textContent = num(s.credits);
  if (open === "weapons") renderWeapons(s);
  else renderClasses(s);
  ui.foot.textContent = loggedIn()
    ? `Runs pay Credits: 1 a kill, 25 a wave, 200 for surviving. Your best wave: ${s.best}.`
    : "Log in or sign up to keep your Credits and guns on your account.";
  paintThumbs();
}

/* ------------------------------------------------------------ Weapons */

function renderWeapons(s) {
  ui.title.textContent = "Weapons";
  const t = GUN_TIERS[tier - 1];
  const eq = equippedGun(s);
  if (!picked || tierOf(picked) !== t) picked = tierOf(eq) === t ? eq : t.guns.find((g) => owns(g, s)) || t.guns[0];

  const tiers = GUN_TIERS.map((x, i) => {
    const openT = tierOpen(x, s);
    return `<button type="button" class="zk-tier r${i + 1}${x.id === tier ? " is-on" : ""}${openT ? "" : " is-locked"}" data-act="tier" data-id="${x.id}" aria-pressed="${x.id === tier}">
      <span class="zk-tier-n">Tier ${x.id}</span>
      ${gunImg(x.guns[0])}
      <span class="zk-tier-r">${openT ? RARITY[i] : `Wave ${x.wave}`}</span>
    </button>`;
  }).join("");

  // the Selected Weapon panel
  const lv = gunLevel(picked, s);
  const a = gunAction(picked, s);
  const now = gunStats(picked, lv || 1);
  const next = a.kind === "upgrade" ? gunStats(picked, lv + 1) : null;
  const sec = (x) => `${x.toFixed(2)}s`;
  let main;
  if (a.kind === "locked") main = `<button type="button" class="zk-btn is-off" disabled>Wave ${a.wave} opens it</button>`;
  else if (a.kind === "buy") main = `<button type="button" class="zk-btn is-buy" data-act="buy" data-id="${picked}"${a.can ? "" : " disabled"}>Buy<span class="zk-price"><span class="zk-coin" aria-hidden="true"></span>${num(a.price)}</span></button>`;
  else if (a.kind === "upgrade") main = `<button type="button" class="zk-btn is-up" data-act="upgrade" data-id="${picked}"${a.can ? "" : " disabled"}>Upgrade<span class="zk-price"><span class="zk-coin" aria-hidden="true"></span>${num(a.price)}</span></button>`;
  else main = `<button type="button" class="zk-btn is-off" disabled>Max level</button>`;
  const equip = !owns(picked, s) ? ""
    : picked === eq ? `<button type="button" class="zk-btn is-off" disabled>Equipped</button>`
      : `<button type="button" class="zk-btn is-equip" data-act="equip" data-id="${picked}">Equip</button>`;

  const card = (g) => {
    const mine = owns(g, s);
    const ga = gunAction(g, s);
    const foot = g === eq ? `<span class="zk-ok">✓ Equipped</span>`
      : mine ? `Lv. ${gunLevel(g, s)}`
        : ga.kind === "locked" ? "Locked" : ga.price ? `<span class="zk-coin" aria-hidden="true"></span>${num(ga.price)}` : "Free";
    return `<button type="button" class="zk-gun r${tier}${g === picked ? " is-on" : ""}" data-act="pick" data-id="${g}" aria-pressed="${g === picked}">
      <span class="zk-gun-name">${esc(WEAPON_DEFS[g].name)}</span>${gunImg(g)}<span class="zk-gun-foot">${foot}</span></button>`;
  };
  const owned = t.guns.filter((g) => owns(g, s));
  const unowned = t.guns.filter((g) => !owns(g, s));

  ui.body.innerHTML = `
    <div class="zk-tiers" role="group" aria-label="Tiers">${tiers}</div>
    <div class="zk-split">
      <section class="zk-sel" aria-label="Selected weapon">
        <h3>Selected Weapon</h3>
        <div class="zk-sel-pic r${tier}">${gunImg(picked)}<div><b>${esc(WEAPON_DEFS[picked].name)}</b><span>${RARITY[tier - 1]}${lv ? ` · Lv. ${lv}/${GUN_MAX}` : ""}</span></div></div>
        <div class="zk-stats">
          <div class="zk-stat is-h"><span>Stat</span><span>Amount</span></div>
          ${statRow("DPS", now.dps, next?.dps)}
          ${statRow("Damage", now.damage, next?.damage)}
          ${statRow("Mag size", now.mag, next?.mag)}
          ${statRow("Reload", now.reload, next?.reload, sec)}
        </div>
        <div class="zk-btns">${main}${equip}</div>
      </section>
      <section class="zk-list" aria-label="Tier ${tier} guns">
        <h4><span>Owned</span></h4>
        <div class="zk-grid">${owned.map(card).join("") || `<p class="zk-none">${tierOpen(t, s) ? "Nothing yet." : `Reach wave ${t.wave} to open this tier.`}</p>`}</div>
        <h4><span>Unowned</span></h4>
        <div class="zk-grid">${unowned.map(card).join("") || `<p class="zk-none">You own them all.</p>`}</div>
      </section>
    </div>`;
}

/* ------------------------------------------------------------ Classes */

function renderClasses(s) {
  ui.title.textContent = "Classes";
  const kit = KITS.rookie;
  const kits = `<button type="button" class="zk-kit is-on"><span class="zk-kit-n">Rookie</span><span class="zk-ok">✓ Equipped</span></button>`
    + SOON_KITS.map((n) => `<div class="zk-kit is-soon"><span class="zk-kit-n">${n}</span><span>Coming soon</span></div>`).join("");
  const rows = kit.deployables.map((id) => {
    const d = DEPLOYABLES[id];
    const a = kitAction(id, s);
    const lv = a.level;
    const now = statsAt(id, lv), next = a.kind === "upgrade" ? statsAt(id, lv + 1) : null;
    const stats = KIT_STATS[id].map(([label, f, unit = ""]) =>
      statRow(label, f(now), next ? f(next) : null, (x) => (unit ? `${x.toFixed(1)}${unit}` : num(x)))).join("");
    const btn = a.kind === "upgrade"
      ? `<button type="button" class="zk-btn is-up" data-act="kit-up" data-id="${id}"${a.can ? "" : " disabled"} aria-label="Upgrade ${esc(d.name)}"><span class="zk-price"><span class="zk-coin" aria-hidden="true"></span>${num(a.price)}</span></button>`
      : `<button type="button" class="zk-btn is-off" disabled>Max level</button>`;
    return `<div class="zk-dep">
      <div class="zk-dep-pic">${kitImg(id)}<span class="zk-dep-cash">$${d.price}</span></div>
      <div class="zk-dep-mid"><b>${esc(d.name)}</b><span class="zk-lv">Lv. ${lv}/${KIT_MAX}</span>${btn}</div>
      <div class="zk-stats">${stats}</div>
    </div>`;
  }).join("");
  ui.body.innerHTML = `
    <div class="zk-split is-classes">
      <div class="zk-kits" aria-label="Classes">${kits}</div>
      <section class="zk-kitbox" aria-label="Rookie">
        <div class="zk-kit-head"><div><b>Rookie</b><span class="zk-ok">Equipped</span></div><p>${esc(kit.blurb)}</p></div>
        ${rows}
      </section>
    </div>`;
}

/* ------------------------------------------------------------ open / close */

export function kioskOpen() { return !!open; }

export function openKiosk(id) {
  build();
  if (open) return;
  open = id === "classes" ? "classes" : "weapons";
  tier = tierOf(equippedGun())?.id || 1;
  picked = null;
  releaseHeldInputs();
  wasLocked = !game.isTouch && !!game.controls?.isLocked;
  ui.root.hidden = false;
  document.body.classList.add("zk-open");
  render();
  if (wasLocked) game.controls.unlock();
  ui.close.focus({ preventScroll: true });
}

export function closeKiosk() {
  if (!open) return;
  open = null;
  ui.root.hidden = true;
  document.body.classList.remove("zk-open");
  releaseHeldInputs();
  if (wasLocked) { try { game.controls.lock(); } catch { /* the pause screen catches it */ } }
}
