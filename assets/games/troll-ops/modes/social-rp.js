/* Socialize roleplay: the saloon bar, seats, the piano and the doctor.

   User, 2026-10-04: "allow users to grab beer mugs and refill themselves
   etc. bartender role that anyone can fill." Troll City's saloon lists its
   spots as `rp.bar` (trollcity.js); everything is hold X there, the same
   prompt and bar as a weapon pickup:
     the rack: a mug (empty) · a tap or the kitchen keg: fill it ·
     the apron hook: become the bartender (one at a time) or hang it up ·
     the back-bar bottles (bartender): a whiskey · the bell (bartender):
     last call for the room · another player with empty hands: hold your
     drink out to them; they hold X by you to take it.
   Fire sips, G puts it down. Sips make you tipsy (saloon-bar.js tipsyFx).
   What's in your hand, a sip, and the role ride the state packet. */

import { REACH, GRAB_TIME, BEER_SIPS, FILL_TIME_BARTENDER, FILL_TIME, APRON_TIME, POUR_TIME, OFFER_SECONDS, TIPSY, drinkMax, SIP_TIME, tipsyFx, BARTENDER_LEAVE_SECONDS, buildDrink, mountDrink, poseDrinkArm, placeDrinkInHand } from "../saloon-bar.js?v=sb1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1";
import { playerName } from "../menu/lobby.js?v=lb1-si1";
import { setSeatLookup } from "../remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2";
import { ROLES, DOCTOR, TUNES, PianoVoice } from "../rp-roles.js?v=rp1";
import { damp } from "../anim-curves.js";
import { touchState } from "../input/touch.js?v=in1";
import { frozenPlayer, setTouchContext } from "../combat/weapons.js?v=wp1-kc2-si1";
import { game } from "../core/state.js?v=st1";

export const bar = {
  drink: null,      // { kind: "beer"|"whiskey", sips }
  sipT: 0,          // counts down through a sip
  sipDone: false,   // this sip has been swallowed (halfway)
  hold: null, holdT: 0, holdLock: false,
  role: null,       // "bartender" while we wear the apron
  outT: 0,          // seconds the bartender has been out of the saloon
  tipsy: 0,
  tipsyShown: false,
  offer: null,      // incoming: { from, name, kind, sips, until }
  outgoing: null,   // { to, name, until }
  fireWas: false,
  fp: null,         // the drink in our first-person hand
  tp: null,         // ...and on our own body
};

export function resetBar() {
  bar.drink = null; bar.sipT = 0; bar.hold = null; bar.holdT = 0; bar.role = null; bar.outT = 0;
  bar.tipsy = 0; bar.tipsyShown = false; bar.offer = null; bar.outgoing = null;
  seated = null;
  stopPianos();
  piano.played = false; piano.tune = 0;
  npcYieldKey = "";
}
const barSpots = () => (game.isSocial() ? game.builtMap?.map?.rp?.bar || null : null);
function barNear(B, spot, reach = REACH) {
  return !!spot && Math.hypot(spot.x - game.move.pos.x, spot.z - game.move.pos.z) <= reach && Math.abs(game.move.pos.y - (B.floorY || 0)) < 1.2;
}
function barInside(B) {
  const z = B.zone;
  return game.move.pos.x > z.x0 && game.move.pos.x < z.x1 && game.move.pos.z > z.z0 && game.move.pos.z < z.z1;
}
const drinkName = (kind) => (kind === "whiskey" ? "whiskey" : "beer");
/* Someone else holding a job (the apron, the piano, the doctor's bag), who
   keeps it if we both took it at once: whoever joined the room first
   (lowest id on a tie). */
function otherWithRole(role, olderOnly = false) {
  if (!role) return null;
  for (const p of game.net.peers.values()) {
    if (game.isBotPeer(p) || p.role !== role) continue;
    if (!olderOnly) return p;
    const since = p.since || 0;
    if (since < game.net.since || (since === game.net.since && p.id < game.net.id)) return p;
  }
  return null;
}
/* The nearest real player within reach with nothing in their hands. */
function barNearestEmptyHanded(reach = 2.2) {
  let best = null, bestD = reach;
  for (const rp of game.remotes.byId.values()) {
    if (!rp.peer || game.isBotPeer(rp.peer) || !rp.alive || (rp.peer.drink | 0)) continue;
    const d = Math.hypot(rp.pos.x - game.move.pos.x, rp.pos.z - game.move.pos.z);
    if (d < bestD && Math.abs(rp.pos.y - game.move.pos.y) < 1.5) { best = rp; bestD = d; }
  }
  return best;
}

/* What holding X does where we stand, best first. */
function barAction(B) {
  const now = performance.now();
  // A drink held out to us, its giver beside us.
  if (bar.offer && !bar.drink && now < bar.offer.until) {
    const rp = game.remotes.byId.get(bar.offer.from);
    if (rp && Math.hypot(rp.pos.x - game.move.pos.x, rp.pos.z - game.move.pos.z) < 3) {
      return { key: "take", label: `Take ${bar.offer.name}'s ${drinkName(bar.offer.kind)}`, ctx: "Take", time: 0.35,
        done: () => { game.net.publishRp({ k: "take", to: bar.offer.from }); } };
    }
  }
  if (B) {
    if (!bar.drink && barNear(B, B.rack)) {
      return { key: "rack", label: "Grab a mug", busy: "Grabbing a mug…", ctx: "Grab", time: GRAB_TIME,
        done: () => { bar.drink = { kind: "beer", sips: 0 }; game.audio.brassTinkle?.(4); showWaveBanner(game.isTouch ? "Fill it at a barrel tap" : "Fill it at a barrel tap · G puts it down", 1800); } };
    }
    if (bar.drink?.kind === "beer" && bar.drink.sips < BEER_SIPS && B.taps.some((t) => barNear(B, t))) {
      return { key: "tap", label: bar.drink.sips ? "Top it up" : "Fill your mug", busy: "Pouring…", ctx: "Fill",
        time: bar.role === "bartender" ? FILL_TIME_BARTENDER : FILL_TIME,
        done: () => { bar.drink.sips = BEER_SIPS; game.audio.pump?.(0.4); showWaveBanner(game.isTouch ? "Fire to sip" : "Click to sip", 1400); } };
    }
    if (barNear(B, B.apron)) {
      if (bar.role === "bartender") {
        return { key: "apron", label: "Hang up the apron", busy: "Untying…", ctx: "Apron", time: APRON_TIME,
          done: () => setBarRole(null, "Apron's back on the hook.") };
      }
      const other = otherWithRole("bartender");
      if (other) return { key: "apron", info: true, label: `${other.name} is tending bar` };
      return { key: "apron", label: "Put on the apron (bartender)", busy: "Tying it on…", ctx: "Apron", time: APRON_TIME,
        done: () => setBarRole("bartender", "You're the bartender. You pour faster, pour whiskey at the back-bar and ring the bell for last call.") };
    }
    if (bar.role === "bartender" && !bar.drink && barNear(B, B.bottles)) {
      return { key: "bottles", label: "Pour a whiskey", busy: "Pouring…", ctx: "Pour", time: POUR_TIME,
        done: () => { bar.drink = { kind: "whiskey", sips: 1 }; game.audio.brassTinkle?.(3); } };
    }
    if (bar.role === "bartender" && barNear(B, B.bell)) {
      return { key: "bell", label: "Ring the bell (last call)", ctx: "Bell", time: 0.2,
        done: () => { game.net.publishRp({ k: "bell" }); lastCall(playerName()); } };
    }
  }
  // Trolling Loud: ask DJ Lulz for a song at the booth.
  const dj = game.djLulz.action(game.move.pos);
  if (dj) return dj;
  // Hold a drink out to whoever is beside us with empty hands.
  if (bar.drink?.sips > 0 && !bar.outgoing) {
    const rp = barNearestEmptyHanded();
    if (rp) {
      const name = rp.peer.name || "them";
      return { key: `give:${rp.peer.id}`, label: `Hand ${name} your ${drinkName(bar.drink.kind)}`, ctx: "Give", time: 0.45,
        done: () => {
          bar.outgoing = { to: rp.peer.id, name, until: performance.now() + OFFER_SECONDS * 1000 };
          game.net.publishRp({ k: "offer", to: rp.peer.id, kind: bar.drink.kind, sips: bar.drink.sips });
          showWaveBanner(`Holding it out to ${name}`, 1600);
        } };
    }
  }
  return rpAction();
}

/* One job at a time: taking one puts down whatever we had. */
function setBarRole(role, note) {
  if (bar.role === "pianist" && role !== "pianist") piano.playing = false;
  bar.role = role;
  bar.outT = 0;
  if (note) showWaveBanner(note, role ? 3600 : 1600);
}

/* ------------------------ Socialize roleplay, phase 2 (rp-roles.js) ------------------------

   User, 2026-10-04: "seats everywhere, ... piano player, ... doctor".
   Every chair, stool, bench and settee in town is a seat (the map's
   rp.seats): hold X by one to sit, move or jump to get up. The piano stool
   makes you the pianist (fire plays a tune, again stops, the next start is
   the next tune); everyone nearby hears it. Doc Grin's bag on his desk is
   the doctor's job: hold X by someone for a check-up that sobers them up.
   Anyone can take a tonic at his medicine shelf. A townsfolk NPC with the
   job steps off while a player has it. */
export let seated = null;    // { idx, s } while we're sat down
export const piano = { playing: false, tune: 0, played: false, voices: new Map(), t: 0 };
export let npcYieldKey = "";

export const rpSeats = () => (game.isSocial() ? game.builtMap?.map?.rp?.seats?.() || null : null);
export const docSpots = () => (game.isSocial() ? game.builtMap?.map?.rp?.doctor || null : null);

/* Is seat `i` taken: by a player, or by a townsfolk NPC sat there (the
   piano player gets up for a player). */
export function seatTaken(i) {
  for (const p of game.net.peers.values()) if (!game.isBotPeer(p) && p.seat === i + 1) return true;
  const s = rpSeats()?.[i];
  if (!s || s.kind === "piano") return false;
  for (const n of game.townNpcs?.sitters() || []) {
    if (Math.hypot(n.x - s.x, n.z - s.z) < 0.4 && Math.abs(n.y - s.y) < 0.5) return true;
  }
  return false;
}

/* The nearest free seat within reach, on our floor. */
function nearestSeat(reach = 0.95) {
  const seats = rpSeats();
  if (!seats) return -1;
  let best = -1, bestD = reach;
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i];
    if (Math.abs(game.move.pos.y - s.floor) > 0.6) continue;
    const d = Math.hypot(s.x - game.move.pos.x, s.z - game.move.pos.z);
    if (d < bestD && !seatTaken(i)) { best = i; bestD = d; }
  }
  return best;
}

export function sitDown(idx) {
  const s = rpSeats()?.[idx];
  if (!s) return;
  if (game.emote) game.stopEmote();
  seated = { idx, s };
  game.move.pos.set(s.x, s.floor, s.z);
  game.move.velocity.set(0, 0, 0);
  if (s.yaw != null) game.look.yaw = s.yaw;
  if (s.kind !== "piano") { showWaveBanner(game.isTouch ? "Move to get up" : "Move or jump to get up", 1400); return; }
  // The piano stool: the pianist's job, if it's free and we have no other.
  const other = otherWithRole("pianist");
  if (other) showWaveBanner(`${other.name} has the piano`, 1800);
  else if (bar.role && bar.role !== "pianist") showWaveBanner(`You're the ${ROLES[bar.role].label.toLowerCase()}: one job at a time`, 2000);
  else setBarRole("pianist", game.isTouch ? "You're on the piano. Fire plays a tune, again stops." : "You're on the piano. Click to play a tune, again to stop.");
}

export function standUp() {
  const s = seated?.s;
  seated = null;
  if (!s) return;
  game.move.pos.set(s.stand.x, s.floor, s.stand.z);
  game.move.velocity.set(0, 0, 0);
  if (bar.role === "pianist") setBarRole(null, null);
}

/* Sat down: stay put, eyes at seated height; any move or a jump gets up. */
export function holdSeat(dt, ix, iz, jump) {
  if (ix || iz || jump || !game.player.alive) { standUp(); return; }
  const s = seated.s;
  game.move.pos.set(s.x, s.floor, s.z);
  game.move.velocity.set(0, 0, 0);
  game.move.moving = false;
  game.move.sprinting = false;
  game.move.grounded = true;
  game.move.eyeHeight = damp(game.move.eyeHeight, s.y - s.floor + 0.74, 10, dt);
}

/* Hold X (after the saloon bar's own): the doctor, a seat. */
function rpAction() {
  if (seated) return null;
  // The doctor: a check-up for whoever's beside us (before the bag:
  // a patient by the desk shouldn't get the bag put down).
  if (bar.role === "doctor") {
    const rp = rpNearestPlayer(2.0);
    if (rp) {
      const name = rp.peer.name || "them";
      return { key: `check:${rp.peer.id}`, label: `Give ${name} a check-up`, busy: "Say ahh…", ctx: "Check", time: DOCTOR.checkTime,
        done: () => { game.net.publishRp({ k: "cure", to: rp.peer.id }); showWaveBanner(`${name}: a clean bill of health`, 1600); } };
    }
  }
  const D = docSpots();
  if (D) {
    if (barNear(D, D.bag)) {
      if (bar.role === "doctor") {
        return { key: "docbag", label: "Put down the doctor's bag", busy: "Closing it up…", ctx: "Bag", time: DOCTOR.bagTime,
          done: () => setBarRole(null, "Doc's bag is back on the desk.") };
      }
      const other = otherWithRole("doctor");
      if (other) return { key: "docbag", info: true, label: `${other.name} is the doctor` };
      return { key: "docbag", label: "Take the doctor's bag (doctor)", busy: "Opening it…", ctx: "Bag", time: DOCTOR.bagTime,
        done: () => setBarRole("doctor", "You're the doctor. Hold X by anyone for a check-up: it sobers them right up.") };
    }
    if (barNear(D, D.tonic)) {
      return { key: "tonic", label: "Take a tonic", busy: "Glug…", ctx: "Tonic", time: DOCTOR.tonicTime,
        done: () => { bar.tipsy = Math.max(0, bar.tipsy - DOCTOR.tonic); game.audio.brassTinkle?.(2); showWaveBanner(bar.tipsy > TIPSY.onset ? "A little steadier" : "Steady as a rock", 1400); } };
    }
  }
  const i = nearestSeat();
  if (i >= 0) {
    const s = rpSeats()[i];
    return { key: `seat:${i}`, label: s.kind === "piano" ? "Sit at the piano" : "Sit down", ctx: "Sit", time: 0.3, done: () => sitDown(i) };
  }
  return null;
}

/* The nearest real player within reach, whatever's in their hands. */
function rpNearestPlayer(reach) {
  let best = null, bestD = reach;
  for (const rp of game.remotes.byId.values()) {
    if (!rp.peer || game.isBotPeer(rp.peer) || !rp.alive) continue;
    const d = Math.hypot(rp.pos.x - game.move.pos.x, rp.pos.z - game.move.pos.z);
    if (d < bestD && Math.abs(rp.pos.y - game.move.pos.y) < 1.5) { best = rp; bestD = d; }
  }
  return best;
}

/* Fire at the piano: start a tune (the next one each time), or stop. */
function togglePiano() {
  if (piano.playing) { piano.playing = false; return; }
  if (piano.played) piano.tune = (piano.tune + 1) % TUNES.length;
  piano.played = true;
  piano.playing = true;
  showWaveBanner(`♪ ${TUNES[piano.tune].name}`, 1800);
}
export const atPiano = () => seated?.s.kind === "piano" && bar.role === "pianist";

/* Each frame in Socialize: the townsfolk off shift, every piano that's
   playing (ours and the room's), heard from where we stand. */
function updateRp(dt) {
  if (bar.role === "pianist" && !atPiano()) setBarRole(null, null);
  // Which NPC jobs a player has.
  const yieldRoles = new Set();
  const seats = rpSeats();
  const jobs = [bar.role, ...[...game.net.peers.values()].filter((p) => !game.isBotPeer(p)).map((p) => p.role)];
  for (const r of jobs) if (ROLES[r]) yieldRoles.add(ROLES[r].npc);
  if (seated?.s.kind === "piano") yieldRoles.add(ROLES.pianist.npc);
  for (const p of game.net.peers.values()) if (p.seat && seats?.[p.seat - 1]?.kind === "piano") yieldRoles.add(ROLES.pianist.npc);
  const key = [...yieldRoles].sort().join();
  if (key !== npcYieldKey && game.townNpcs) { npcYieldKey = key; game.townNpcs.setYield(yieldRoles); }

  // The pianos: ours, and each player at a piano with a tune going.
  const want = new Map();
  if (piano.playing && atPiano()) want.set("me", { tune: piano.tune, s: seated.s });
  for (const p of game.net.peers.values()) {
    const s = p.piano && p.seat ? seats?.[p.seat - 1] : null;
    if (s?.kind === "piano" && p.role === "pianist") want.set(p.id, { tune: p.piano - 1, s });
  }
  for (const [id, v] of piano.voices) {
    const w = want.get(id);
    if (!w || w.tune !== v.tune) { v.stop(); piano.voices.delete(id); }
  }
  for (const [id, w] of want) {
    let v = piano.voices.get(id);
    if (!v) { v = new PianoVoice(game.audio, { x: w.s.x, y: w.s.y + 0.6, z: w.s.z }, w.tune); piano.voices.set(id, v); }
    // Loud in the saloon, gone a street away.
    const d = Math.hypot(w.s.x - game.camera.position.x, w.s.z - game.camera.position.z);
    v.update(Math.max(0, Math.min(1, 1 - (d - 10) / 28)) * 0.9);
  }
}

function stopPianos() {
  for (const v of piano.voices.values()) v.stop();
  piano.voices.clear();
  piano.playing = false;
}

function lastCall(who) {
  showWaveBanner(`Last call at the Rusty Grin! (${who})`, 2600);
  game.audio.medal?.("gold");
}

export function putDownDrink() {
  if (!bar.drink) return;
  bar.drink = null;
  bar.sipT = 0;
  bar.outgoing = null;
  game.audio.brassTinkle?.(3);
}

/* Off the wire (net "rp"). */
export function onBarMessage(p, m) {
  if (!game.isSocial() || game.isBotPeer(p)) return;
  if (m.k === "bell") { lastCall(p.name || "the bartender"); return; }
  if (m.to !== game.net.id) return;
  const now = performance.now();
  if (m.k === "cure") {
    // Only from whoever has the doctor's bag.
    if (p.role !== "doctor") return;
    bar.tipsy = 0;
    showWaveBanner(`${p.name || "The doctor"} gave you a check-up: right as rain`, 2200);
    game.audio.brassTinkle?.(2);
    return;
  }
  if (m.k === "offer") {
    if (bar.drink) return;
    const kind = m.kind === "whiskey" ? "whiskey" : "beer";
    bar.offer = { from: p.id, name: p.name || "someone", kind, sips: Math.max(1, Math.min(drinkMax(kind), m.sips | 0)), until: now + OFFER_SECONDS * 1000 };
    showWaveBanner(`${bar.offer.name} offers you a ${drinkName(kind)}: hold X by them`, 2600);
  } else if (m.k === "take") {
    // Only the drink we held out, to them, if we still have it.
    if (!bar.outgoing || bar.outgoing.to !== p.id || !bar.drink) return;
    const d = bar.drink;
    bar.drink = null; bar.outgoing = null; bar.sipT = 0;
    game.net.publishRp({ k: "give", to: p.id, kind: d.kind, sips: d.sips });
  } else if (m.k === "give") {
    if (!bar.offer || bar.offer.from !== p.id || bar.drink) return;
    const kind = m.kind === "whiskey" ? "whiskey" : "beer";
    bar.drink = { kind, sips: Math.max(0, Math.min(drinkMax(kind), m.sips | 0)) };
    bar.offer = null;
    game.audio.brassTinkle?.(4);
    showWaveBanner("Cheers!", 1200);
  }
}

export function updateBar(dt) {
  const B = barSpots();
  const now = performance.now();
  bar.tipsy = Math.max(0, bar.tipsy - TIPSY.decay * dt);
  if (bar.offer && now > bar.offer.until) bar.offer = null;
  if (bar.outgoing && now > bar.outgoing.until) bar.outgoing = null;

  // A sip: fire, one at a time. The drink goes down halfway through it.
  const fireNow = !game.localPauseOnly && !game.emoteWheel.isOpen && (game.mouseDown || (game.isTouch && touchState.firing) || (game.gamepadState.connected && game.gamepadState.firing));
  if (fireNow && !bar.fireWas && atPiano() && game.player.alive) togglePiano();   // at the piano, fire plays
  else if (fireNow && !bar.fireWas && bar.drink?.sips > 0 && bar.sipT <= 0 && game.player.alive) {
    bar.sipT = SIP_TIME; bar.sipDone = false;
    if (game.emote) game.stopEmote();
  }
  bar.fireWas = fireNow;
  if (bar.sipT > 0) {
    bar.sipT = Math.max(0, bar.sipT - dt);
    if (!bar.sipDone && bar.sipT <= SIP_TIME / 2 && bar.drink) {
      bar.sipDone = true;
      bar.drink.sips = Math.max(0, bar.drink.sips - 1);
      bar.tipsy = Math.min(TIPSY.max + 1, bar.tipsy + (bar.drink.kind === "whiskey" ? TIPSY.perShot : TIPSY.perBeerSip));
      if (!bar.drink.sips && bar.drink.kind === "whiskey") bar.drink = null;   // the shot glass goes back
      else if (!bar.drink.sips) showWaveBanner("Empty. Fill it again at a tap", 1400);
    }
  }
  if (bar.tipsy >= TIPSY.onset && !bar.tipsyShown) { bar.tipsyShown = true; showWaveBanner("You're feeling it…", 1800); }
  if (bar.tipsy < TIPSY.onset * 0.5) bar.tipsyShown = false;
  const fx = tipsyFx(bar.tipsy, now / 1000);
  if (fx.k > 0 && game.player.alive && !game.localPauseOnly) game.look.yaw += fx.yaw;

  // The bartender: off the job if they wander out. Any job: off it if
  // someone who got there first has it too.
  if (bar.role === "bartender") {
    if (!B) bar.role = null;
    else {
      bar.outT = barInside(B) ? 0 : bar.outT + dt;
      if (bar.outT > BARTENDER_LEAVE_SECONDS) setBarRole(null, "You left the saloon: the apron's back on its hook.");
    }
  }
  const older = otherWithRole(bar.role, true);
  if (older) setBarRole(null, `${older.name} already has that job.`);
  updateRp(dt);

  // Hold X.
  const act = game.player.alive ? barAction(B) : null;
  const held = !frozenPlayer() && !game.duoXClaimed && !game.localPauseOnly
    && (game.keys.has("KeyX") || (game.isTouch && touchState.swap) || !!game.gamepadState.pickup);
  if (!held) bar.holdLock = false;
  if (act && !act.info && held && !bar.holdLock) {
    if (bar.hold?.key !== act.key) { bar.hold = act; bar.holdT = 0; }
    bar.holdT += dt;
    if (bar.holdT >= act.time) {
      bar.hold = null; bar.holdT = 0; bar.holdLock = true;
      act.done();
    }
  } else { bar.hold = null; bar.holdT = 0; }

  setTouchContext(act && !act.info ? act.ctx : null);
  if (game.els.pickupPrompt) {
    if (act) {
      game.els.pickupPrompt.hidden = false;
      game.els.pickupPromptText.textContent = bar.hold && act.busy ? act.busy : act.label;
      // A keycap that pulses until you hold it, like Troll Royale's loot:
      // nobody knows the bar is a hold otherwise.
      const cap = !game.isTouch && !act.info;
      game.els.pickupPrompt.classList.toggle("is-royale", cap);
      if (game.els.pickupKey) {
        game.els.pickupKey.hidden = !cap;
        if (cap) {
          const k = game.gamepadState.connected ? "D-pad →" : "X";
          if (game.els.pickupKeyCap.textContent !== k) game.els.pickupKeyCap.textContent = k;
          game.els.pickupKey.classList.toggle("is-held", !!bar.hold);
        }
      }
      game.els.pickupBarFill.style.width = `${act.info ? 0 : Math.round(Math.min(1, bar.holdT / act.time) * 100)}%`;
    } else game.els.pickupPrompt.hidden = true;
  }
  document.body.classList.toggle("to-social-drink", !!bar.drink);
  document.body.classList.toggle("to-social-armed", !game.socialUnarmed());
}

/* The sip as a 0..1..0 lift (up to the mouth, back down). */
export function barSipK() {
  if (bar.sipT <= 0) return 0;
  const t = 1 - bar.sipT / SIP_TIME;
  return Math.min(1, Math.sin(Math.PI * t) * 1.6);
}

/* Our own body's drink, in third person. */
export function syncLocalDrink(show) {
  const kind = show && bar.drink ? bar.drink.kind : null;
  if ((bar.tp?.userData.kind || null) !== kind) {
    if (bar.tp) { bar.tp.parent?.remove(bar.tp); bar.tp = null; }
    if (kind) { bar.tp = buildDrink(kind); mountDrink(game.localRig, bar.tp); }
  }
  if (!bar.tp) return;
  bar.tp.userData.setSips(bar.drink.sips);
  poseDrinkArm(game.localRig, barSipK());
}

/* Our first-person hand's drink, placed on the right streak-arm hand (its
   transform, not its child: the hand itself is hidden). */
export function syncFpDrink(show) {
  const kind = show && bar.drink ? bar.drink.kind : null;
  if ((bar.fp?.userData.kind || null) !== kind) {
    if (bar.fp) { bar.fp.parent?.remove(bar.fp); bar.fp = null; }
    if (kind) bar.fp = buildDrink(kind);
  }
  if (!bar.fp) return;
  const hand = game.streakArms.userData.arms[0].hand;
  if (bar.fp.parent !== hand.parent) hand.parent.add(bar.fp);
  bar.fp.userData.setSips(bar.drink.sips);
  placeDrinkInHand(bar.fp, hand, 1);
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initSocialRp() {
  setSeatLookup(() => rpSeats());
}
