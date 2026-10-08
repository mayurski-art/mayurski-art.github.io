// Troll Forces lobby: the Phantom Forces style menu panels, gun and character
// inspectors, map drawer, roster, callsign, heroes, cloud setup and room code.

import { WeaponInspector } from "../inspector.js?v=hb1-nf-wst-ig1-sb2-if1-wb1";
import { CharacterInspector } from "../char-inspector.js?v=hb4-wst-soc1-sb2c2-wb1";
import { CosmeticsPanel, loadCosmetics } from "../cosmetics.js?v=hb4-fc1-wst-soc1-ww1c2";
import { EmoteWheel } from "../emote-wheel.js?v=hb4-em1-wst-soc1c2";
import { padEmotePressed } from "../controller-layout.js?v=cl7";
import { streakPicker } from "../streaks/calling.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1";
import { withClan, getMyCard } from "../calling-cards.js?v=p5-wst-sb2-fu1-wb1";
import { safeUid } from "../chat.js?v=to-social1";
import { syncXp } from "../progression.js?v=p5-wst-sb2-fu1-wb1";
import { renderModes, buildModeButtons } from "./mode-picker.js?v=mp1-fu1b7b7d-wb1";
import { HERO_IDS, HEROES, saveHero, savedHero } from "../heroes.js?v=umb2";
import { heroKit, heroActive } from "../modes/umb-heroes.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1";
import { SETTINGS_KEY, settings, applySettings } from "./settings.js?v=ms1-gj1-fu1b7b7dc2-wb1";
import { BOT_STREAK_KEY } from "../streaks/bot-streaks.js?v=sk1-si1-gj1-fu1b7b7dc2-wb1";
import { initCloudSave } from "../cloud-save.js?v=cs1b7";
import { makeRoomCode } from "../net.js?v=umb3-rm1-ld2-em1-sb1-cb1-rp1-p22-bh1b7";
import { game } from "../core/state.js?v=st1";

// The tab bar across the top swaps what's under it. "deploy" is the Play
// tab (mode list, map card, Deploy); the rest open one panel each.
// Loadout and Customize share the Loadout tab.

const LOBBY_PANELS = ["deploy", "loadout", "customize", "gear", "cosmetics", "streaks", "server", "controls"];
const TAB_FOR_PANEL = { customize: "loadout" };
const pfRoot = document.getElementById("to-pf");
// Tabs, the Loadout/Customize switch and the loadout card's Edit link.
const railButtons = [...document.querySelectorAll("#to-pf [data-panel]")];

const gunView = document.getElementById("to-gun-view");
const gunCanvas = document.getElementById("to-gun-canvas");
export const inspector = gunCanvas ? new WeaponInspector(gunCanvas) : null;

// The Play tab's loadout card previews the primary too, rebuilt only when
// the weapon, its attachments or its skin change.
const sumCanvas = document.getElementById("to-pf-sum-canvas");
export const sumInspector = sumCanvas ? new WeaponInspector(sumCanvas, { thumb: true }) : null;
export function showSumGun() {
  const def = game.loadout.resolved;
  const key = def ? `${def.id}:${JSON.stringify(def.attachments || {})}` : null;
  if (!sumInspector || !def || key === game.sumGunKey) return;
  game.sumGunKey = key;
  sumInspector.show(def);
}
export let inspectorLive = false;

const charView = document.getElementById("to-char-view");
const charCanvas = document.getElementById("to-char-canvas");
export const charInspector = charCanvas ? new CharacterInspector(charCanvas) : null;
/* Cosmetics (cosmetics.js): the face you wear, on the menu operator, your
   own body in matches, and everyone else's view of you (`fc`). */
export const cosmetics = new CosmeticsPanel(document.getElementById("to-cos-body"), (face) => applyOwnFace(face));
function applyOwnFace(face) {
  if (charInspector) charInspector.humanoid.face = face;
  game.localRig.face = face;   // only ever called on a pick, long after localRig exists
}
export let charInspectorLive = false;

/* One inspector, three panels that want to show it. Weapon Loadout keeps it
   boxed inside its detail card (to-gun-mount-loadout); Customize and Gear
   pull it out to the free-floating hero spot the operator viewer uses on
   Match Setup instead — the weapon stands in for the operator there. */
const pfCenter = document.getElementById("to-pf-center")?.parentElement || null; // .to-pf
function mountGunView(panel) {
  // Beside the panel on desktop; phones have no room beside it, so there the
  // Weapons view keeps it boxed in its detail card.
  const narrow = (pfCenter?.clientWidth || 0) <= 760;
  const boxMount = panel === "loadout" && narrow ? document.getElementById("to-gun-mount-loadout") : null;
  const target = boxMount || pfCenter;
  inspectorLive = !!(gunView && target);
  if (!inspectorLive) return;
  gunView.classList.toggle("is-hero", !boxMount);
  if (gunView.parentElement !== target) target.appendChild(gunView);
  gunView.style.display = "";
}

/* Unlike the gun view, the operator locker viewer isn't nested inside a
   per-panel box — it's a free-floating hero shot over the whole lobby
   (see .to-char-view), so showing it for a panel is just an on/off flag. */
function mountCharView(panel) {
  charInspectorLive = !!(charView && (panel === "deploy" || panel === "cosmetics"));
  if (charView) charView.style.display = charInspectorLive ? "" : "none";
  if (!charInspectorLive) menuEmoteWheel?.close(true);
}

/* Emoting in the main menu (user): the same wheel as in a match, played by
   the operator on Match Setup. H / L3 + R3 together / the Emote button open it. */
export let menuEmoteWheel;
const menuEmoteBtn = document.getElementById("to-char-emote");
// Pad in the menu: both sticks clicked together (or the emote button set on
// the controller card) opens, the right stick points, Cross/A plays, Circle/B closes.
let gpMenuEmotePrev = {};
export function pollMenuEmotePad() {
  const w = menuEmoteWheel;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = w && charInspectorLive ? Array.from(pads).find((p) => p && p.connected) : null;
  if (!gp) { gpMenuEmotePrev = {}; return; }
  const b = (i) => !!gp.buttons[i]?.pressed, edge = (i) => b(i) && !gpMenuEmotePrev[i];
  if (padEmotePressed(gp, edge) || (b(10) && b(11) && (edge(10) || edge(11)))) w.toggle();
  if (w.isOpen) {
    w.aim(gp.axes[2] || 0, gp.axes[3] || 0);
    if (edge(0)) w.close();
    else if (edge(1)) w.close(true);
  }
  gpMenuEmotePrev = {};
  for (let i = 0; i < gp.buttons.length; i++) gpMenuEmotePrev[i] = b(i);
}

// Which panel is currently open, or `null` when every panel is collapsed —
// clicking the already-active rail button toggles it closed instead of
// forcing some other tab to take its place.
export let activeLobbyPanel = "deploy";

export function showLobbyPanel(name) {
  activeLobbyPanel = name;
  if (pfRoot) pfRoot.dataset.panel = name || "";
  if (game.els.title) game.els.title.dataset.panel = name || "";
  for (const id of LOBBY_PANELS) {
    const panel = document.getElementById(`to-pfp-${id}`);
    if (panel) panel.hidden = id !== name;
  }
  const tabName = TAB_FOR_PANEL[name] || name;
  for (const b of railButtons) {
    // Top tabs light up for their whole group; the switch and Edit link
    // only for their exact panel.
    const on = b.classList.contains("to-pf-tab") ? b.dataset.panel === tabName : b.dataset.panel === name;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  }
  if (name !== "deploy") closeMapDrawer(false);
  // The map card's thumbnail can only measure itself once it is on screen.
  if (name === "deploy") game.loadout.drawMapCard();

  if (name === "loadout" || name === "customize") {
    mountGunView(name);
    inspector?.show(game.loadout.resolvedActive);
  } else if (name === "gear") {
    mountGunView(name);
    inspector?.show(game.loadout.melee);
  } else if (name === "streaks") {
    mountGunView(name);
    inspector?.showStreak(streakPicker.selected.at(-1) || "uav");
  } else {
    inspectorLive = false;
    if (gunView) gunView.style.display = "none";
  }

  if (name === "deploy" || name === "cosmetics") {
    mountCharView(name);
  } else {
    charInspectorLive = false;
    if (charView) charView.style.display = "none";
    menuEmoteWheel?.close(true);
  }
}

/* Map picker: "Change" on the map card slides it in from the right. Picking
   a map applies straight away (loadout.js), Done or Esc just closes it. */
const mapDrawer = document.getElementById("to-map-drawer");
const mapScrim = document.getElementById("to-map-scrim");
const mapChange = document.getElementById("to-pf-mapcard-change");

function openMapDrawer() {
  if (!mapDrawer) return;
  mapDrawer.hidden = false;
  if (mapScrim) mapScrim.hidden = false;
  game.els.title?.classList.add("has-drawer");
  mapChange?.setAttribute("aria-expanded", "true");
  game.loadout.drawMapThumbs();
  (mapDrawer.querySelector(".to-lo-map.is-active") || mapDrawer.querySelector("button"))?.focus();
}

function closeMapDrawer(returnFocus = true) {
  if (!mapDrawer || mapDrawer.hidden) return;
  mapDrawer.hidden = true;
  if (mapScrim) mapScrim.hidden = true;
  game.els.title?.classList.remove("has-drawer");
  mapChange?.setAttribute("aria-expanded", "false");
  if (returnFocus) mapChange?.focus();
}

export function renderLobbyRoster() {
  const box = document.getElementById("to-pf-roster");
  if (!box || !game.lobbyReady) return;

  const rows = [{ name: withClan(playerName(), getMyCard().clan), state: "READY", you: true, uid: game.playerUid() }];
  if (game.isPvp() && game.net.connected) {
    for (const p of game.net.peers.values()) {
      rows.push({ name: withClan(p.name, p.clan), state: game.isBotPeer(p) ? "BOT" : "IN ROOM", uid: safeUid(p.uid) });
    }
  }

  box.innerHTML = "";
  for (const row of rows) {
    const el = document.createElement("div");
    el.className = row.you ? "to-pf-op is-you" : "to-pf-op is-idle";
    const box2 = document.createElement("i");
    const name = document.createElement(row.uid ? "button" : "span");
    name.textContent = row.name;
    if (row.uid) {
      name.type = "button";
      name.className = "to-pf-op-name";
      name.title = `View ${row.name}'s profile`;
      name.addEventListener("click", () => game.openPlayerProfile(row.uid));
    }
    const state = document.createElement("b");
    state.textContent = row.state;
    el.append(box2, name, state);
    box.appendChild(el);
  }

  if (rows.length === 1) {
    const note = document.createElement("p");
    note.className = "to-pf-empty";
    note.textContent = game.isPvp()
      ? (noBotsRoom()
          ? "No bots room — just you until you share the code above."
          : game.roomIsCustom
            ? "No one else in the room yet — share the code."
            : "No one else has deployed into this mode yet. Anyone who hits Deploy lands here with you.")
      : "Solo drop. No other operators.";
    box.appendChild(note);
  }
}

/* The lobby header's profile button: your whole site profile (avatar,
   banner, level, friends, settings), or the sign-in when signed out. */
function renderProfileBtn() {
  const btn = document.getElementById("to-pf-profile");
  if (!btn) return;
  const profile = window.TrollrunnerAccounts?.getCachedProfile?.();
  btn.querySelector("span").textContent = profile?.username || "Sign in";
  const img = btn.querySelector("img");
  img.hidden = !profile?.avatarUrl;
  if (profile?.avatarUrl) img.src = profile.avatarUrl;
  const svg = btn.querySelector("svg");
  if (svg) svg.style.display = profile?.avatarUrl ? "none" : "";
  const label = profile?.username ? `Your profile (${profile.username})` : "Sign in";
  btn.title = label;
  btn.setAttribute("aria-label", label);
}

export function renderCallsign() {
  const el = document.getElementById("to-pf-callsign");
  if (el) el.textContent = `Signed in as ${playerName()}`;
}

export function playerName() {
  const profile = window.TrollrunnerAccounts?.getCachedProfile?.();
  return String(profile?.username || "operator").slice(0, 14);
}

export function setNetStatus(text, state = "") {
  game.els.netStatus.textContent = text;
  game.els.netStatus.classList.toggle("is-live", state === "live");
  game.els.netStatus.classList.toggle("is-bad", state === "bad");
}

/* U Mad Bro? hero picker. Hidden buttons the BO2 menu reads and clicks
   (menu-bo2.js "heroes" screen), like every other lobby list. The pick is
   saved (heroes.js) and used from the next spawn. */
function buildHeroButtons() {
  const box = document.createElement("div");
  box.id = "to-lo-heroes";
  box.hidden = true;
  for (const id of HERO_IDS) {
    const h = HEROES[id];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "to-lo-hero";
    b.dataset.hero = id;
    b.title = `${h.blurb} ${h.hp} HP, ${Math.round(h.speed * 100)}% speed. Passive: ${h.passive}.`;
    b.innerHTML = `<strong></strong>`;
    b.firstChild.textContent = h.name;
    // heroKit is built lazily (it needs move/look, declared further down).
    b.addEventListener("click", () => { if (heroKit) heroKit.setHero(id); else saveHero(id); renderHeroButtons(); });
    box.appendChild(b);
  }
  game.els.loMode.parentElement.appendChild(box);
  renderHeroButtons();
}
function renderHeroButtons() {
  for (const b of document.querySelectorAll("#to-lo-heroes .to-lo-hero")) {
    const on = b.dataset.hero === (heroKit ? heroKit.id : savedHero());
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  }
}

/* Your setup follows your account (cloud-save.js). When the account's copy
   lands on this device (signing in, or coming back to the tab after
   changing things on another one), put it into the running game. */
function applyCloudSetup(changed) {
  const has = (k) => changed.includes(k);
  if (has(SETTINGS_KEY)) {
    try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch { /* bad JSON: keep ours */ }
    applySettings();
  }
  if (has("trollops:loadout") && !game.loadout.restoreSaved()) game.loadout.render();
  if (has("trollops:streaks")) streakPicker.restore();
  if (changed.some((k) => k.startsWith("trollops.hudLayout."))) game.hudLayout.reload();
  if (has("trollops:cosmetics")) {
    cosmetics.state = loadCosmetics();
    cosmetics.paint();
    applyOwnFace(cosmetics.face);
  }
  if (has("trollops:hero")) {
    if (heroKit && !heroActive()) heroKit.setHero(savedHero());
    renderHeroButtons();
  }
  if (has(BOT_STREAK_KEY) && game.els.botStreaks) {
    try { game.els.botStreaks.checked = localStorage.getItem(BOT_STREAK_KEY) !== "0"; } catch { /* private window */ }
  }
}

/* A private room opens the prestige reward maps (loadout.js mapOpen). */
function syncPrivateRoom() { game.loadout.setPrivateRoom(game.roomIsCustom && !!game.els.room.value); }

/* "No bots" — walk a map alone without a match happening around you. Ticking
   it alone is enough to get a private room (auto-generates a code exactly
   like clicking "Private room", if one isn't already set) — you only need
   to hand the code to anyone if you actually want them to join you. */
export function noBotsRoom() { return !!game.els.noBots?.checked; }

/* What used to run at load in game.js: called from game.js where this code was. */
export function initLobby() {
  showSumGun();
  if (charInspector) charInspector.humanoid.face = cosmetics.face;
  // The operator on the main menu carries your equipped primary.
  charInspector?.setWeapon(game.loadout.resolved);

  /* Emoting in the main menu (user): the same wheel as in a match, played by
     the operator on Match Setup. H / L3 + R3 together / the Emote button open it. */
  menuEmoteWheel = charView && game.els.title ? new EmoteWheel(game.els.title, (i) => charInspector?.playEmote(i)) : null;
  menuEmoteWheel?.el.classList.add("is-menu");
  menuEmoteBtn?.addEventListener("click", () => {
    menuEmoteWheel?.toggle(charInspectorLive && game.gameState === "menu");
    menuEmoteBtn.setAttribute("aria-expanded", String(!!menuEmoteWheel?.isOpen));
  });

  // "deploy" (Match Setup) is the panel left un-hidden in the HTML, so it's
  // what a player sees first without any click - nothing else calls
  // showLobbyPanel("deploy") on first load, so the locker view has to be
  // shown here or it stays hidden until the player clicks away and back.
  mountCharView("deploy");

  for (const b of railButtons) {
    b.addEventListener("click", () => showLobbyPanel(b.dataset.panel));
  }
  if (pfRoot) pfRoot.dataset.panel = activeLobbyPanel;
  if (game.els.title) game.els.title.dataset.panel = activeLobbyPanel;

  mapChange?.addEventListener("click", openMapDrawer);
  mapScrim?.addEventListener("click", () => closeMapDrawer());
  document.getElementById("to-map-close")?.addEventListener("click", () => closeMapDrawer());
  document.getElementById("to-map-done")?.addEventListener("click", () => closeMapDrawer());
  mapDrawer?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closeMapDrawer(); }
  });
  renderProfileBtn();
  document.getElementById("to-pf-profile")?.addEventListener("click", () => {
    const acc = window.TrollrunnerAccounts;
    if (acc?.getCachedProfile?.()) acc.openProfile?.();
    else if (acc?.openLogin) acc.openLogin("login");
    else acc?.openProfile?.();
  });

  // The profile arrives after the accounts script signs in, so redraw then --
  // the level shown is the account level, and any XP queued while signed out
  // gets credited now.
  window.addEventListener("trollrunner:auth-changed", () => {
    renderCallsign();
    game.renderViewModeRow();
    renderProfileBtn();
    renderLobbyRoster();
    // Picks locked by the guest level at page load come back now that the
    // account level is known (phones: the profile often lands after the lobby).
    if (!game.loadout.restoreSaved()) game.loadout.render();
    streakPicker.restore();
    void syncXp()?.then(() => game.loadout.render());
  });
  // Prestige landed (loaded after sign-in, or you just prestiged): the level
  // shown and the "Prestige ready" readout change with it.
  window.addEventListener("trollforces:prestige-changed", () => {
    if (!game.loadout.restoreSaved()) game.loadout.render();
    streakPicker.restore();
    renderModes();   // U Mad Bro? unlocks at Prestige 2
  });
  // Your clan tag changed (Barracks): the roster shows it.
  window.addEventListener("trollforces:card-changed", () => renderLobbyRoster());

  buildModeButtons();
  buildHeroButtons();
  initCloudSave({ apply: applyCloudSetup });
  game.els.newRoom.addEventListener("click", () => {
    game.els.room.value = makeRoomCode();
    game.roomIsCustom = true;   // an explicit fresh code means "private room", not quickplay
    syncPrivateRoom();
  });
  game.els.room.addEventListener("input", () => {
    game.els.room.value = game.els.room.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    game.roomIsCustom = game.els.room.value.length > 0;
    syncPrivateRoom();
  });
  game.els.noBots?.addEventListener("change", () => {
    if (game.els.noBots.checked && !game.els.room.value) {
      game.els.room.value = makeRoomCode();
      game.roomIsCustom = true;
      syncPrivateRoom();
    }
  });
}
