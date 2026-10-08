// Troll Forces HUD helpers: killfeed, hitmarkers, damage numbers, hit
// direction arrows, wave banners, comic words and the streak HUD. Moved out
// of game.js (split phase 1).

import { TEAMS } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2f1";
import * as THREE from "three";
import { flinchRigFrom } from "../character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1";
import { streaksAllowed, STREAK_DEFS, streakBadgeSvg, streakShortName } from "../scorestreaks.js?v=umb1-wst-sb2-fu1";
import { game } from "./state.js?v=st1";


/* Accepts a plain string (joins, leaves, Ops points) or a structured kill.
   A kill reads "killer — weapon → victim", with the headshot marked and both
   names in their team colour, so the feed says what happened rather than just
   that something did. */
export function pushKillfeed(entry) {
  const div = document.createElement("div");
  div.className = "to-kf-item";

  if (typeof entry === "string") {
    div.textContent = entry;
  } else {
    if (entry.mine) div.classList.add("is-mine");

    // Bots wanting their own labeled span (rather than reusing `.to-kf-tag`,
    // which the assist/weapon slot below is also using) keeps a bot kill
    // from ever being mistaken for a headshot or an assist at a glance.
    const nameSpan = (text, team, isBot) => {
      const frag = document.createDocumentFragment();
      const s = document.createElement("span");
      s.className = "to-kf-name";
      // `.ui` is the CSS string; `.color` is a hex number for three.js.
      if (team && TEAMS[team]) s.style.color = TEAMS[team].ui;
      s.textContent = text;
      frag.appendChild(s);
      if (isBot) {
        const bot = document.createElement("span");
        bot.className = "to-kf-bot";
        bot.textContent = "BOT";
        frag.appendChild(bot);
      }
      return frag;
    };

    div.appendChild(nameSpan(entry.killer, entry.killerTeam, entry.killerIsBot));

    if (entry.assist) {
      const tag = document.createElement("span");
      tag.className = "to-kf-tag";
      tag.textContent = "assist";
      div.appendChild(tag);
    } else {
      if (entry.weapon) {
        const w = document.createElement("span");
        w.className = entry.joke ? "to-kf-weapon is-joke" : "to-kf-weapon";
        w.textContent = entry.weapon;
        div.appendChild(w);
      }
      if (entry.head) {
        const h = document.createElement("span");
        h.className = "to-kf-head";
        h.textContent = "HS";
        h.title = "Headshot";
        div.appendChild(h);
      }
      if (entry.tag) {
        const tag = document.createElement("span");
        tag.className = "to-kf-tag";
        tag.textContent = entry.tag;
        div.appendChild(tag);
      }
    }

    // A suicide is one name, not "grinbot → grinbot".
    if (!entry.suicide) {
      const arrow = document.createElement("span");
      arrow.className = "to-kf-arrow";
      arrow.textContent = "→";
      div.appendChild(arrow);
      div.appendChild(nameSpan(entry.victim, entry.victimTeam, entry.victimIsBot));
    }
  }

  game.els.killfeed.appendChild(div);
  // Keep the feed from growing without bound in a busy match.
  while (game.els.killfeed.children.length > 6) game.els.killfeed.firstChild.remove();
  setTimeout(() => div.remove(), 2700);
}

/* `killed` is only ever true when the caller already knows the shot was
   lethal in the same synchronous step (a bot, a grunt, our own registerDeath)
   — a peer's death confirmation comes back over the wire later and marks
   itself there instead, so this never has to guess. */
export function showHitmarker(isCrit, damage = 0, point = null, killed = false) {
  game.audio.hitmarker(isCrit);
  game.els.hitmarker.classList.remove("pop");
  game.els.hitmarker.classList.toggle("is-crit", isCrit);
  game.els.hitmarker.classList.toggle("is-kill", killed);
  void game.els.hitmarker.offsetWidth;
  game.els.hitmarker.classList.add("pop");
  if (damage > 0 && point) spawnDamageNumber(damage, point, isCrit);
}

/* Damage numbers that live in the world: they start at the point the round
   actually landed and drift up from there, so a burst across a moving target
   leaves a legible trail instead of stacking in the middle of the screen. */
export const damageNumbers = [];
const DAMAGE_NUMBER_LIFE = 0.9;

export function spawnDamageNumber(damage, point, isCrit, text = null) {
  const el = document.createElement("span");
  el.className = "to-dmg-num" + (isCrit ? " is-crit" : "") + (text ? " is-word" : "");
  el.textContent = text || String(Math.round(damage));
  game.els.damageNumbers.appendChild(el);
  damageNumbers.push({
    el,
    pos: point.clone(),
    life: DAMAGE_NUMBER_LIFE,
    // A little sideways drift keeps rapid hits from printing on top of
    // each other.
    drift: (Math.random() - 0.5) * 26,
  });
  // A long burst on several targets could otherwise pile up unbounded.
  while (damageNumbers.length > 24) {
    damageNumbers.shift().el.remove();
  }
}

/* U Mad Bro?: a comic-book word over a body as it goes flying. Rides the
   damage-number layer, bigger, tilted and slower to fade. */
const COMIC_WORD_LIFE = 1.4;
const COMIC_WORDS = ["BONK!", "POW!", "OOF!", "YEET!", "WHAM!", "GG!", "BOING!", "SPLAT!", "KAPOW!", "RIP"];
const COMIC_HEAD_WORDS = ["NO SCOPE!", "HEADSHOT!", "CRITICAL!", "BOOM!"];
export function spawnComicWord(point, head = false, text = null) {
  const words = head ? COMIC_HEAD_WORDS : COMIC_WORDS;
  const el = document.createElement("span");
  el.className = "to-dmg-num is-comic";
  el.textContent = text || words[Math.floor(Math.random() * words.length)];
  game.els.damageNumbers.appendChild(el);
  damageNumbers.push({
    el, pos: point.clone().setY(point.y + 1.5), life: COMIC_WORD_LIFE, max: COMIC_WORD_LIFE,
    drift: (Math.random() - 0.5) * 40, tilt: (Math.random() - 0.5) * 24,
  });
  while (damageNumbers.length > 24) damageNumbers.shift().el.remove();
}

/* The U Mad Bro? killfeed swaps the weapon for what happened to them. */
const JOKE_VERBS = ["bonked", "ratio'd", "deleted", "uninstalled", "yeeted", "sent to Brazil", "told to touch grass", "muted", "clapped", "rekt"];
export const jokeVerb = (head) => (head ? "no-scoped" : JOKE_VERBS[Math.floor(Math.random() * JOKE_VERBS.length)]);

const _dmgProject = new THREE.Vector3();

export function updateDamageNumbers(dt) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    d.life -= dt;
    if (d.life <= 0) { d.el.remove(); damageNumbers.splice(i, 1); continue; }

    const t = 1 - d.life / (d.max || DAMAGE_NUMBER_LIFE);
    _dmgProject.copy(d.pos).project(game.camera);
    // Behind the camera projects to a mirrored on-screen point, so hide it.
    if (_dmgProject.z > 1) { d.el.style.opacity = "0"; continue; }

    const x = (_dmgProject.x * 0.5 + 0.5) * window.innerWidth + d.drift * t;
    const y = (-_dmgProject.y * 0.5 + 0.5) * window.innerHeight - t * 46;
    // Comic words punch in big, then settle; numbers just shrink a little.
    const sc = d.tilt != null ? 1 + Math.max(0, 0.6 - t * 4) : 1 + (1 - t) * 0.25;
    d.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(2)})${d.tilt != null ? ` rotate(${d.tilt.toFixed(1)}deg)` : ""}`;
    d.el.style.opacity = String(Math.min(1, d.life / 0.35));
  }
}

export function clearDamageNumbers() {
  for (const d of damageNumbers) d.el.remove();
  damageNumbers.length = 0;
}
export function flashHit() {
  game.hitFlashT = 1;
}

/* Hit-direction markers: one red arc round the crosshair per attacker,
   pointing where the hit came from. The arc holds the attacker's position
   at the moment of the hit, not where they go after — it says "from there",
   it isn't a wallhack — and turns as you turn. A fresh hit from the same
   source refreshes its arc rather than stacking another. */
const HITDIR_LIFE = 1.6;
const HITDIR_MAX = 6;
export const hitDirs = new Map();   // source key -> { el, x, z, t }
const _hitDirFwd = new THREE.Vector3();

/* Flinch whoever was hit, away from whoever hit them — the local player's
   own body included. Cosmetic: a peer may never know its rig flinched here. */
const _flinchDir = new THREE.Vector3();
export function flinchPeer(targetId, fromId, isHead, fromPos = null) {
  const rig = targetId === game.net.id ? game.localRig : game.remotes.byId.get(targetId)?.rig;
  if (!rig) return;
  const from = fromPos || (fromId === game.net.id ? game.move.pos : (game.remotes.byId.get(fromId)?.pos || game.bots.byId(fromId)?.pos));
  if (!from) { flinchRigFrom(rig, _flinchDir.set(0, 0, 0), isHead ? 1 : 0.5); return; }
  _flinchDir.subVectors(rig.root.position, from);
  _flinchDir.y = 0;
  if (_flinchDir.lengthSq() < 1e-6) _flinchDir.set(0, 0, 1);
  flinchRigFrom(rig, _flinchDir.normalize(), isHead ? 1 : 0.5);
}

export function noteHitDirection(fromId, fromPos = null) {
  if (fromId && fromId === game.net.id) return;   // your own grenade: you know where it was
  const pos = fromPos || (fromId ? (game.remotes.byId.get(fromId)?.pos || game.bots.byId(fromId)?.pos) : null);
  if (!pos || !game.els.hitdir) return;
  const key = fromId || `${Math.round(pos.x)},${Math.round(pos.z)}`;
  let h = hitDirs.get(key);
  if (!h) {
    if (hitDirs.size >= HITDIR_MAX) {
      const [oldKey, old] = hitDirs.entries().next().value;
      old.el.remove();
      hitDirs.delete(oldKey);
    }
    const el = document.createElement("div");
    el.className = "to-hitdir-mark";
    game.els.hitdir.appendChild(el);
    h = { el };
    hitDirs.set(key, h);
  }
  h.x = pos.x;
  h.z = pos.z;
  h.t = HITDIR_LIFE;
  updateHitDirs(0);
}

export function updateHitDirs(dt) {
  if (!hitDirs.size) return;
  game.camera.getWorldDirection(_hitDirFwd);
  const fl = Math.hypot(_hitDirFwd.x, _hitDirFwd.z) || 1;
  const fx = _hitDirFwd.x / fl, fz = _hitDirFwd.z / fl;
  for (const [key, h] of hitDirs) {
    h.t -= dt;
    if (h.t <= 0) { h.el.remove(); hitDirs.delete(key); continue; }
    const tx = h.x - game.move.pos.x, tz = h.z - game.move.pos.z;
    // Bearing from straight ahead, clockwise: right of you is +90°.
    const deg = Math.atan2(tx * -fz + tz * fx, tx * fx + tz * fz) * 180 / Math.PI;
    h.el.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    h.el.style.opacity = Math.min(1, h.t / 0.5).toFixed(2);
  }
}

export function clearHitDirs() {
  for (const h of hitDirs.values()) h.el.remove();
  hitDirs.clear();
}

export function showWaveBanner(text, ms = 1800) {
  game.els.waveBanner.textContent = text;
  game.els.waveBanner.classList.add("is-visible");
  clearTimeout(showWaveBanner._t);
  showWaveBanner._t = setTimeout(() => game.els.waveBanner.classList.remove("is-visible"), ms);
}

/* The scorestreak strip: a meter toward the cheapest streak that isn't ready
   yet, then one row per selected streak. Rebuilt only when the set of rows
   changes; the meter itself is just a width. */
const STREAK_ICON_URL = (id) => new URL(`../streak-icons/${id}.png?v=ss3`, import.meta.url).href;

export function updateStreakHud() {
  if (!game.els.ssHud) return;
  const on = streaksAllowed(game.currentMode()) && (game.streaks.selected.length > 0 || game.streaks.readyIds().length > 0);
  game.els.ssHud.hidden = !on;
  // On a phone the button only exists when there's something to call —
  // an always-on dead button is just lost screen space.
  if (game.els.touchStreak) {
    // Touch calls a streak by tapping its row; this button is only the
    // big "drop it here" confirm while one is being marked.
    // U Mad Bro? has no streaks: the button is the hero ability (updateHero).
    if (!game.heroActive()) game.els.touchStreak.hidden = !game.isTouch || !on || !game.markingStreak;
  }
  if (!on) return;

  const next = game.streaks.nextProgress();
  game.els.ssMeterFill.style.width = next ? `${Math.round(next.frac * 100)}%` : "100%";

  const onPad = game.gamepadState.connected && !game.isTouch;
  const key = onPad ? "→" : "4";
  const selId = game.streaks.ready(game.selectedStreak) ? game.selectedStreak : game.readyStreaksOrdered()[0];
  // On a pad, a ready streak also needs to show WHICH one d-pad right will
  // fire — d-pad down moved off "call directly" onto "pick", so the ready
  // key alone no longer says that.
  // A care package can grant a streak outside the loadout's three picks
  // (rollPackageReward/grant) — it still needs its own slot or securing the
  // package looks like it did nothing.
  const slotIds = game.streakSlotIds();
  const freshId = game.freshStreak && performance.now() < game.freshStreak.until ? game.freshStreak.id : "";
  // A ready Dragonfire says so when you're somewhere it can't launch from.
  const dfWhy = slotIds.includes("dragonfire") && game.streaks.ready("dragonfire") ? game.dragonfireBlocked() : null;
  const signature = `${key}|${onPad || game.isTouch ? selId : ""}|${game.markingStreak || ""}|${freshId}|${dfWhy || ""}|`
    + slotIds.map((id) => `${id}:${game.streaks.ready(id) ? 1 : 0}:${Math.ceil(game.streakLockLeft(id))}`).join("|");
  if (game.els.ssSlots.dataset.sig !== signature) {
    game.els.ssSlots.dataset.sig = signature;
    game.els.ssSlots.innerHTML = "";
    slotIds.forEach((id, slot) => {
      const def = STREAK_DEFS[id];
      const lock = Math.ceil(game.streakLockLeft(id));
      const ready = game.streaks.ready(id) && !lock;
      const isSelected = (onPad || game.isTouch) && ready && id === selId;
      const row = document.createElement("div");
      const fresh = ready && game.freshStreak && game.freshStreak.id === id && performance.now() < game.freshStreak.until;
      const skyBlocked = id === "dragonfire" && ready && dfWhy;
      row.className = `to-ss-slot${ready ? " is-ready" : ""}${skyBlocked ? " is-blocked" : ""}${lock ? " is-locked" : ""}${isSelected ? " is-selected" : ""}${id === game.markingStreak ? " is-marking" : ""}${fresh ? " is-fresh" : ""}`;
      // Touch: tap a row to call that streak (the pad and keyboard have keys).
      if (game.isTouch && ready) {
        row.setAttribute("role", "button");
        row.setAttribute("aria-label", `Call ${def.name}`);
        row.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); game.callStreakSlot(slot); }, { passive: false });
      }
      // A picture of the streak, not its name (user, 2026-09-28): rendered
      // from the game's own models (models/render_streak_icons.blender.py).
      // Ready = lit with a green rim; not yet = dimmed grey.
      const img = document.createElement("img");
      img.className = "to-ss-img";
      img.src = STREAK_ICON_URL(id);
      img.alt = "";
      img.draggable = false;
      row.appendChild(img);
      // BO2: every streak carries its badge (tier metal + its symbol) and its
      // name, with the cost under it until it's earned, then how to call it.
      const badge = document.createElement("i");
      badge.className = "to-ss-badge";
      badge.innerHTML = streakBadgeSvg(id, { dim: !ready });
      row.appendChild(badge);
      const cap = document.createElement("div");
      cap.className = "to-ss-cap";
      const nm = document.createElement("b");
      nm.textContent = streakShortName(id);
      const sub = document.createElement("span");
      sub.textContent = lock ? `${game.streakLockWhy[id] === "jammed" ? "JAMMED" : "COOLDOWN"} ${lock}s`
        : skyBlocked ? game.DF_BLOCK_TEXT[dfWhy]
        : ready ? (game.isTouch ? "READY · TAP" : `READY · ${onPad ? "→" : game.streakKeyLabel(id)}`) : `${def.cost}`;
      cap.append(nm, sub);
      row.appendChild(cap);
      if (skyBlocked) {
        // A roof over the picture: get outside to fly it.
        const tag = document.createElement("em");
        tag.className = "to-ss-sky";
        tag.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M4 4l16 16"/></svg>`;
        row.appendChild(tag);
      }
      row.title = `${def.name}${skyBlocked ? ` (${dfWhy === "covered" ? "needs open sky overhead" : "too confined here"}: get outside)` : ""}${lock ? ` (${game.streakLockWhy[id] === "jammed" ? "jammed" : "cooldown"}, ${lock}s)` : ready ? " (ready)" : `: ${def.cost}`}`;
      if (!row.hasAttribute("aria-label")) row.setAttribute("aria-label", row.title);
      game.els.ssSlots.appendChild(row);
    });
  }
}
