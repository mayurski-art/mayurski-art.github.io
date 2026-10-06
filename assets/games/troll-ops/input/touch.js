// Troll Forces touch controls: the move stick, the look pad and the on-screen
// buttons. Moved out of game.js (split phase 1); touchState is read by the
// player update and by aim assist.
import { game } from "../core/state.js?v=st1";


export const touchState = {
  moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, looking: false,
  firing: false, ads: false, jump: false,
  crouch: false, dive: false, interact: false, swap: false, endStreak: false,
};

/* `zone`: a touch anywhere in it moves the stick under the thumb first
   (a floating stick), and it springs back to its rest spot on release. */
function bindStick(el, nub, zone = null) {
  let active = false, startX = 0, startY = 0, id = null;
  const begin = (e) => {
    if (active) return;
    const t = e.changedTouches[0];
    active = true; id = t.identifier; startX = t.clientX; startY = t.clientY;
    if (zone && e.currentTarget === zone) {
      const box = el.offsetParent.getBoundingClientRect();
      el.style.left = `${t.clientX - box.left - el.offsetWidth / 2}px`;
      el.style.top = `${t.clientY - box.top - el.offsetHeight / 2}px`;
      el.style.bottom = "auto";
      el.classList.add("is-floating");
    }
    el.classList.add("is-active");
  };
  el.addEventListener("touchstart", begin, { passive: true });
  zone?.addEventListener("touchstart", begin, { passive: true });
  const move = (e) => {
    if (!active) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      let dx = t.clientX - startX, dy = t.clientY - startY;
      const max = 40;
      dx = Math.max(-max, Math.min(max, dx));
      dy = Math.max(-max, Math.min(max, dy));
      touchState.moveX = dx / max;
      touchState.moveY = dy / max;
      if (nub) nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  };
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      active = false; touchState.moveX = 0; touchState.moveY = 0;
      if (nub) nub.style.transform = "translate(-50%,-50%)";
      el.style.left = el.style.top = el.style.bottom = "";
      el.classList.remove("is-floating", "is-active");
    }
  };
  for (const target of zone ? [el, zone] : [el]) {
    target.addEventListener("touchmove", move, { passive: true });
    target.addEventListener("touchend", end);
    target.addEventListener("touchcancel", end);
  }
}

/* Touch look, tuned toward CoD Mobile's default feel: a much livelier base
   rate than the old flat 0.0028 rad/px (which also ignored the Sensitivity
   slider entirely), a little acceleration so a fast flick covers a turn
   without a second swipe while slow drags stay precise, and a lower rate
   while aiming down sights so the scope doesn't feel twitchy. */
const TOUCH_BASE_SENS = 0.0065;   // rad per CSS px at 100% sensitivity, hip-fire
const TOUCH_ACCEL_START = 0.6;    // px/ms before acceleration kicks in
const TOUCH_ACCEL_MAX = 1.6;      // cap on the flick multiplier
function touchLookGain(dx, dy, dtMs) {
  const speed = Math.hypot(dx, dy) / Math.max(dtMs, 4);
  const accel = Math.min(TOUCH_ACCEL_MAX, 1 + Math.max(0, speed - TOUCH_ACCEL_START) * 0.5);
  const adsScale = 1 - (game.currentWeapon()?.adsT || 0) * 0.4;
  return TOUCH_BASE_SENS * (game.settings.sens / 100) * accel * adsScale;
}
function addTouchLook(t, last) {
  const now = performance.now();
  const dx = t.clientX - last.x, dy = t.clientY - last.y;
  const g = touchLookGain(dx, dy, now - last.t);
  touchState.lookDX += dx * g;
  touchState.lookDY += (game.settings.invert ? -1 : 1) * dy * g;
  last.x = t.clientX; last.y = t.clientY; last.t = now;
}

function bindHold(el, onDown, onUp) {
  el.addEventListener("touchstart", (e) => { e.preventDefault(); el.classList.add("is-held"); onDown(); }, { passive: false });
  el.addEventListener("touchend", (e) => { e.preventDefault(); el.classList.remove("is-held"); onUp(); });
  el.addEventListener("touchcancel", () => { el.classList.remove("is-held"); onUp(); });
}
/* Two fire buttons (right thumb, and a left one for firing while you
   steer), so firing is a count of thumbs down, not a flag either can clear
   for the other. The right one also aims while held: drag it like the look
   pad, the way CoD Mobile's fire button works. */
let firingThumbs = 0;
const fireDown = () => { firingThumbs++; touchState.firing = true; };
const fireUp = () => { firingThumbs = Math.max(0, firingThumbs - 1); touchState.firing = firingThumbs > 0; };
/* A held button that also aims: drag it like the look pad. Fire, and the
   throwable (user: free look up and down while holding a grenade). */
function dragAims(el) {
  if (!el) return;
  let id = null;
  const last = { x: 0, y: 0, t: 0 };
  el.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    id = t.identifier; last.x = t.clientX; last.y = t.clientY; last.t = performance.now();
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      addTouchLook(t, last);
      touchState.looking = true;
    }
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; touchState.looking = false; } };
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
}
/* AIM is a tap toggle, like CoD Mobile's default: tap to scope in, tap
   again to come out, so the right thumb stays free to aim and shoot. */
export function setTouchAds(on) {
  touchState.ads = on;
  game.els.touchAds.classList.toggle("is-on", on);
  game.els.touchAds.setAttribute("aria-pressed", String(on));
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initTouch() {
  bindStick(game.els.touchMove, game.els.touchMoveNub, game.els.touchMoveZone);

  (function bindLook() {
    let id = null;
    const last = { x: 0, y: 0, t: 0 };
    game.els.touchLook.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      id = t.identifier; last.x = t.clientX; last.y = t.clientY; last.t = performance.now();
      touchState.looking = true;
    }, { passive: true });
    game.els.touchLook.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) addTouchLook(t, last);
    }, { passive: true });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) { id = null; touchState.looking = false; }
    };
    game.els.touchLook.addEventListener("touchend", end);
    game.els.touchLook.addEventListener("touchcancel", end);
  })();
  bindHold(game.els.touchFire, fireDown, fireUp);
  if (game.els.touchFireL) bindHold(game.els.touchFireL, fireDown, fireUp);
  dragAims(game.els.touchFire);
  game.els.touchAds.addEventListener("touchstart", (e) => { e.preventDefault(); setTouchAds(!touchState.ads); }, { passive: false });
  bindHold(game.els.touchJump, () => touchState.jump = true, () => touchState.jump = false);
  bindHold(game.els.touchSlide, () => touchState.crouch = true, () => touchState.crouch = false);
  game.els.touchReload.addEventListener("touchstart", (e) => { e.preventDefault(); game.tryReload(); });
  game.els.touchMelee.addEventListener("touchstart", (e) => { e.preventDefault(); game.swingMelee(); });
  // Touch cooks for as long as the button is held, same as the key.
  bindHold(game.els.touchNade, () => game.startCook("lethal"), () => game.releaseCook());
  dragAims(game.els.touchNade);
  if (game.els.touchTac) bindHold(game.els.touchTac, () => game.startCook("tactical"), () => game.releaseCook());
  dragAims(game.els.touchTac);
  bindHold(game.els.touchInteract, () => touchState.interact = true, () => touchState.interact = false);
  bindHold(game.els.touchSwap, () => { touchState.swap = true; if (game.warshipView()) game.toggleWarshipGun(); }, () => touchState.swap = false);
  // Admire (inspect) the gun or melee in your hands, the T key on a keyboard.
  game.els.touchAdmire?.addEventListener("touchstart", (e) => { e.preventDefault(); game.startInspect(); }, { passive: false });
  // A tap, not a hold — and it doubles as the confirm for a marked spot, the
  // same way the key and the d-pad do.
  if (game.els.touchEndStreak) bindHold(game.els.touchEndStreak, () => { touchState.endStreak = true; }, () => { touchState.endStreak = false; });
  if (game.els.touchStreak) {
    game.els.touchStreak.addEventListener("touchstart", (e) => { e.preventDefault(); if (game.heroActive()) game.useHeroAbility(); else game.callReadyStreak(); });
  }
  // Emotes on touch: tap to open the wheel (its slices are plain buttons
  // without pointer lock), tap a slice to play it, tap EMOTE again to shut it.
  // Duo invites are accepted by holding X, same as the key.
  if (game.els.touchEmote) {
    game.els.touchEmote.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (game.emoteWheel.isOpen) game.emoteWheel.close(true);
      else if (game.gameState === "playing" && game.player.alive) game.emoteWheel.open();
      game.els.touchEmote.setAttribute("aria-expanded", String(game.emoteWheel.isOpen));
    }, { passive: false });
  }
}
