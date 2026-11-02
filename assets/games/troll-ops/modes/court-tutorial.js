// Troll Forces — the court games' tutorials at Troll Beach (Socialize).
// "Start a tutorial" on the setup card (modes/court-setup.js) walks a
// player through a sport one step at a time: a card in the scorebug's slot
// (court-hud.js tutorialCard) says what to do and how, the step ticks off
// when the game's own state says it happened, and the next one comes up.
//
//   hoops   a ball off the cart, the dribble, a size-up move, a jumper let
//           go in the green, a layup, a dunk, the stance without the ball.
//   tennis  a racket, the toss, a serve into the box, two returns off the
//           club pro's feeds, topspin, slice, a lob, a volley at the net.
//
// The pro feeding balls is social-tennis.js's feeder (the host of the
// tutorial drives him like a match NPC). Hold X at the board or the chair
// to quit; a tutorial is one player's, nobody else's screen changes.

import { game } from "../core/state.js?v=st1";
import { H, hoopsHooks, hoopSpots } from "./social-hoops.js?v=gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-tw1-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3-zft1-pqs1-fbo1-tb1-cti1-chd1-cst1";
import { T, M, tballs, tennisHooks, tennisJudge, startFeeder, stopFeeder } from "./social-tennis.js?v=gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-tw1-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-bt1-nft33-nfh1-nfh5-mg2-ll2-sp9-nft2531-nft2531h-tn12-tn13-rdf2-kbc3-zft1-pqs1-fbo1-cti1-chd1-cst1";
import { tutorialCard, courtNote } from "./court-hud.js?v=chd1-cst1";

const myId = () => game.net?.id || "me";
const touch = () => game.isTouch;
const K = {   // the controls, by what the player holds
  fire: () => (touch() ? "the fire button" : game.gamepadState?.connected ? "RT" : "left mouse"),
  size: () => (touch() ? "AIM" : game.gamepadState?.connected ? "LT" : "right mouse (or Q)"),
  jump: () => (touch() ? "jump" : game.gamepadState?.connected ? "A" : "Space"),
  sprint: () => (touch() ? "push the stick" : game.gamepadState?.connected ? "the left stick in" : "Shift"),
  w: () => (touch() ? "forward" : "W"),
  q: () => (touch() ? "AIM" : "Q"),
};

/* Each step: { title, text (what to do), hint (how), check(st) -> true when
   it happened; enter() / leave() for what it needs set up }. `st` carries
   what the step started from. */
const HOOPS_STEPS = [
  { title: "Grab a ball", text: "Hold X at the ball cart by the east sideline.", hint: "One ball each; walk 24 m off the court and it goes back.",
    check: () => !!H.ball },
  { title: "Dribble", text: "Walk with it: the dribble is automatic. Sprint for a speed dribble.", hint: () => `Move 5 m. ${K.sprint()} sprints.`,
    enter: (st) => { st.from = { x: game.move.pos.x, z: game.move.pos.z }; }, check: (st) => H.live && Math.hypot(game.move.pos.x - st.from.x, game.move.pos.z - st.from.z) > 5 },
  { title: "Size-up: a crossover", text: () => `Hold ${K.size()} and flick the look toward your other hand.`, hint: () => `Flick back for behind the back, forward for a hesi, a half circle for a spin, back + ${K.jump()} for a step-back. Two in a row chain.`,
    enter: (st) => { st.moves = H.moves || 0; }, check: (st) => (H.moves || 0) > st.moves },
  { title: "Jumper, in the green", text: () => `Stand still, hold ${K.fire()} to rise, let go when the meter hits the white line.`, hint: "The green band is your window: narrower far out, on the move, tired or with a hand in your face.",
    enter: (st) => { st.shots = H.shots || 0; }, check: (st) => (H.shots || 0) > st.shots && H.lastShot === "jumper", after: () => `${H.feedback?.word || "Released"}` },
  { title: "Layup", text: () => `Get the ball back, run at the rim and press ${K.fire()} inside 3 m.`, hint: "Off the left side it goes up with the left hand. A loose ball: walk over it or jump at it.",
    enter: (st) => { st.shots = H.shots || 0; }, check: (st) => (H.shots || 0) > st.shots && H.lastShot === "layup" },
  { title: "Dunk", text: () => `Sprint (${K.sprint()}) straight at the rim and press ${K.fire()} inside 4.5 m.`, hint: "Needs a lane and some stamina: the turbo bar under the crosshair.",
    enter: (st) => { st.shots = H.shots || 0; }, check: (st) => (H.shots || 0) > st.shots && H.lastShot === "dunk" },
  { title: "Defence", text: () => `Put the ball on the cart (hold X there), then hold ${K.size()} for the stance.`, hint: () => `${K.fire()} near a ball handler pokes at it; ${K.jump()} as a shot goes up blocks it.`,
    check: () => !H.ball && !H.shot && H.act?.stance },
  { title: "You're ready", text: "Hold X at the scoreboard: run it 1v1, 2v2 or 3v3, to 11 or 21, with bots or friends.", hint: "2s outside the arc, 1s inside, win by 2, make it take it, take it back past the arc after a board.",
    check: (st) => st.t > 6 },
];
const inBoxEither = (S, x, z, side) => tennisJudge.inBox(S, x, z, side, true) || tennisJudge.inBox(S, x, z, side, false);
const firstBounce = (b) => b.sim?.events.find((e) => e.kind === "bounce");
const TENNIS_STEPS = [
  { title: "Take a racket", text: "Hold X at the hopper inside the west gate.", hint: "Hold X there again to put it back.",
    check: () => T.racket },
  { title: "The toss", text: () => `Stand behind a baseline and press ${K.fire()} once: the ball goes up out of your hand.`, hint: "The serve meter beside you climbs with it; the sweet band sits just under the top.",
    check: () => !!T.toss && !!tballs.get(T.toss)?.sim },
  { title: "Serve into the box", text: () => `Press ${K.fire()} again as the ball reaches the band. Aim with the look: the T, the body or wide.`, hint: () => `${K.q()} for a slice that curves away, ${K.jump()} for a kick that jumps up. Out of the box is a fault: toss again.`,
    enter: (st) => { st.seen = new Set(); }, check: (st) => [...tballs.values()].some((b) => { if (!b.serve || b.hitter !== myId() || st.seen.has(b.id)) return false; const e = firstBounce(b); if (!e) return false; st.seen.add(b.id); const S = hoopSpots(); return S && inBoxEither(S, e.p[0], e.p[2], tennisJudge.sideOf(S, b.sim.launch.p[2])); }) },
  { title: "Return the feeds", text: () => `The pro feeds you balls. Press ${K.fire()} early, as the ball comes over the net: the swing lands on it.`, hint: "The ring on the court is where the ball will be struck: get there. Green: your swing's on time. Two returns in to go on.",
    enter: (st) => { st.returned = 0; st.seen = new Set(); startFeeder(hoopSpots()); }, leave: () => stopFeeder(),
    check: (st) => { st.returned += inReturns(st.seen, null); return st.returned >= 2; } },
  { title: "Topspin", text: () => `Hold ${K.w()} and press ${K.fire()} early on a feed: it dips and kicks up.`, hint: "The rally stroke: heavy, safe over the net, bounces high and long.",
    enter: (st) => { st.seen = new Set(); st.n = 0; startFeeder(hoopSpots()); }, check: (st) => { st.n += inReturns(st.seen, "top"); return st.n >= 1; } },
  { title: "Slice", text: () => `Hold ${K.q()} and press ${K.fire()} early: it floats and skids low.`, hint: () => `${K.q()} + ${K.jump()} together is a drop shot.`,
    enter: (st) => { st.seen = new Set(); st.n = 0; }, check: (st) => { st.n += inReturns(st.seen, "slice"); return st.n >= 1; } },
  { title: "Lob", text: () => `Hold ${K.jump()} and press ${K.fire()} early: high over the net, deep.`, hint: "Against someone at the net.",
    enter: (st) => { st.seen = new Set(); st.n = 0; }, check: (st) => { st.n += inReturns(st.seen, "lob"); return st.n >= 1; } },
  { title: "Volley", text: () => `Come inside the service line and press ${K.fire()} before the ball bounces.`, hint: "Short and punchy; over your head it's a smash.",
    enter: (st) => { st.seen = new Set(); st.n = 0; }, leave: () => stopFeeder(), check: (st) => { st.n += inReturns(st.seen, "volley"); return st.n >= 1; } },
  { title: "You're ready", text: "Hold X at the umpire's chair: singles or doubles, a tiebreak to 7 or 10, against the club pros or friends.", hint: "One serve, then two each; the deuce court on an even count; win by 2.",
    check: (st) => st.t > 6 },
];
/* Our strokes since the step began that landed in on the far side (of
   `kind`, or any kind that isn't a serve). */
function inReturns(seen, kind) {
  const S = hoopSpots();
  if (!S) return 0;
  let n = 0;
  for (const b of tballs.values()) {
    if (b.hitter !== myId() || b.serve || b.toss || seen.has(b.id + ":" + b.sim?.launch.at)) continue;
    const e = firstBounce(b);
    if (!e) continue;
    seen.add(b.id + ":" + b.sim.launch.at);
    const side = tennisJudge.sideOf(S, e.p[2]);
    const mine = tennisJudge.sideOf(S, b.sim.launch.p[2]);
    const k = b.stroke || T.lastStroke?.kind;
    if (side !== mine && tennisJudge.inSingles(S, e.p[0], e.p[2], side) && (!kind || k === kind)) n++;
  }
  return n;
}

/* The one running: { sport, steps, i, st, t } */
export const TUT = { on: null };
export const courtTutorialOn = () => !!TUT.on;
export function startCourtTutorial(sport) {
  if (!hoopSpots()) return;
  if (TUT.on) stopCourtTutorial();
  const steps = sport === "tennis" ? TENNIS_STEPS : HOOPS_STEPS;
  TUT.on = { sport, steps, i: -1, st: null, t: 0, passedAt: 0 };
  next();
  courtNote(`${sport === "tennis" ? "Tennis" : "Hoops"} tutorial: hold X at the ${sport === "tennis" ? "chair" : "scoreboard"} to quit`, 2600);
}
export function stopCourtTutorial() {
  const R = TUT.on;
  if (!R) return;
  R.steps[R.i]?.leave?.(R.st);
  TUT.on = null;
  tutorialCard(null);
}
function next() {
  const R = TUT.on;
  R.steps[R.i]?.leave?.(R.st);
  R.i++;
  if (R.i >= R.steps.length) { stopCourtTutorial(); return; }
  R.st = { t: 0 }; R.t = 0; R.passedAt = 0;
  R.steps[R.i].enter?.(R.st);
  show();
}
const txt = (v) => (typeof v === "function" ? v() : v);
function show() {
  const R = TUT.on, s = R.steps[R.i];
  tutorialCard({ sport: R.sport, title: s.title, i: R.i + 1, of: R.steps.length, text: txt(s.text), hint: txt(s.hint), done: !!R.passedAt });
}
/* Each frame (view/player-update.js). */
export function updateCourtTutorial(dt) {
  const R = TUT.on;
  if (!R) return;
  if (!hoopSpots() || !game.isSocial() || !game.player.alive) { stopCourtTutorial(); return; }
  R.t += dt; R.st.t += dt;
  const s = R.steps[R.i];
  if (!R.passedAt) {
    if (s.check(R.st)) {
      R.passedAt = R.t;
      const word = s.after?.(R.st);
      courtNote(word ? `${s.title}: ${word}` : `${s.title}: done`, 1200);
      show();
    }
  } else if (R.t - R.passedAt > 1.2) next();
}
hoopsHooks.tutorial = (sport) => startCourtTutorial(sport);
hoopsHooks.tutorialOn = courtTutorialOn;
hoopsHooks.quitTutorial = stopCourtTutorial;
tennisHooks.tutorial = (sport) => startCourtTutorial(sport);
tennisHooks.tutorialOn = courtTutorialOn;
tennisHooks.quitTutorial = stopCourtTutorial;

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollCourtTutorial = { TUT, start: startCourtTutorial, stop: stopCourtTutorial, skip: () => TUT.on && next(),
    state: () => TUT.on && { sport: TUT.on.sport, step: TUT.on.i + 1, of: TUT.on.steps.length, title: TUT.on.steps[TUT.on.i].title, passed: !!TUT.on.passedAt } };
}
