// Troll Forces — the court games' HUD at Troll Beach (Socialize). One layer
// (style.css .to-court*) the three sports write to; nothing here reads the
// games, they call in each frame:
//
//   hoops (modes/social-hoops.js, hoops-game.js), the 2K school:
//     shotMeter   the release meter beside you: a capsule that fills as you
//                 rise, the green window where the perfect is, the shot's
//                 name (PULL-UP, FADEAWAY, LAYUP...) and CONTESTED when a hand's
//                 in your face; it freezes on the release and grades it.
//     shotWord    the grade after the ball's gone (EXCELLENT / SLIGHTLY LATE),
//                 then what it did (SPLASH +2 / BRICK).
//     callout     a pop beside you for a move you pulled (CROSSOVER, SPIN,
//                 COMBO), a dunk, a block, a steal, an ankle breaker.
//     stamina     the turbo bar under the crosshair.
//   tennis (modes/social-tennis.js), the Top Spin / Virtua Tennis school:
//     serveMeter  the toss meter: the ball climbs the bar, the sweet band at
//                 the top of the toss, the serve's kind and where it's aimed.
//     strokeWord  the stroke you played and how on time (SWEET / A BIT LATE).
//     pointCall   the umpire's call over the court (ACE, WINNER, OUT, LET,
//                 FAULT, DOUBLE FAULT) with the score.
//   both:
//     scoreCard   the scorebug top centre: the two sides, the score, what the
//                 game's to, whose ball / serve it is, and a status line
//                 (CHECK BALL, TAKE IT BACK, GAME POINT, SECOND SERVE).

import { game } from "../core/state.js?v=st1";

let el = null, parts = null;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function mount() {
  if (el) return parts;
  el = document.createElement("div");
  el.className = "to-court";
  el.innerHTML = `
    <div class="to-court-card" hidden>
      <div class="to-court-card__row">
        <span class="to-court-card__side to-court-card__a"><i class="to-court-card__poss"></i><span class="to-court-card__name"></span></span>
        <b class="to-court-card__score to-court-card__sa">0</b>
        <span class="to-court-card__mid"></span>
        <b class="to-court-card__score to-court-card__sb">0</b>
        <span class="to-court-card__side to-court-card__b"><span class="to-court-card__name"></span><i class="to-court-card__poss"></i></span>
      </div>
      <div class="to-court-card__status"></div>
    </div>
    <div class="to-court-meter" hidden>
      <div class="to-court-meter__kind"></div>
      <div class="to-court-meter__bar"><i class="to-court-meter__band"></i><i class="to-court-meter__fill"></i><i class="to-court-meter__line"></i></div>
      <div class="to-court-meter__tag"></div>
    </div>
    <div class="to-court-word" hidden><b></b><span></span></div>
    <div class="to-court-callouts"></div>
    <div class="to-court-stamina" hidden><i></i></div>
    <div class="to-court-call" hidden><b></b><span></span></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  parts = {
    card: $(".to-court-card"), cardA: $(".to-court-card__a .to-court-card__name"), cardB: $(".to-court-card__b .to-court-card__name"),
    possA: $(".to-court-card__a .to-court-card__poss"), possB: $(".to-court-card__b .to-court-card__poss"),
    sa: $(".to-court-card__sa"), sb: $(".to-court-card__sb"), mid: $(".to-court-card__mid"), status: $(".to-court-card__status"),
    meter: $(".to-court-meter"), kind: $(".to-court-meter__kind"), band: $(".to-court-meter__band"), fill: $(".to-court-meter__fill"), line: $(".to-court-meter__line"), tag: $(".to-court-meter__tag"),
    word: $(".to-court-word"), callouts: $(".to-court-callouts"), stamina: $(".to-court-stamina"), staminaFill: $(".to-court-stamina i"),
    call: $(".to-court-call"),
  };
  return parts;
}
export const courtHudEl = () => el;

/* ------------------------------------------------------------ the card */

/* { sport, a, b, sa, sb, mid ("TO 11", "TIEBREAK"), poss (0 | 1 | -1: whose
   ball or serve), status ("CHECK BALL"), final } or null. */
let cardKey = "", cardOwner = "";
export function scoreCard(c, owner = "hoops") {
  const P = mount();
  if (!c) { if (!P.card.hidden && cardOwner === owner) { P.card.hidden = true; cardKey = ""; cardOwner = ""; } return; }
  const key = JSON.stringify(c);
  if (key === cardKey) return;
  cardKey = key; cardOwner = owner;
  P.card.hidden = false;
  P.card.dataset.sport = c.sport || "";
  P.card.classList.toggle("is-final", !!c.final);
  P.cardA.textContent = c.a; P.cardB.textContent = c.b;
  P.sa.textContent = c.sa; P.sb.textContent = c.sb;
  P.mid.textContent = c.mid || "";
  P.possA.classList.toggle("is-on", c.poss === 0); P.possB.classList.toggle("is-on", c.poss === 1);
  P.status.textContent = c.status || "";
  P.status.hidden = !c.status;
}

/* ------------------------------------------------------- the shot meter */

/* { t (s risen), full (s: the meter's top), rel (s: the perfect), w (s:
   half the green), released, relAt (s), kind ("PULL-UP"), contest (0..1) }
   or null. */
let meterOn = false, meterOwner = "";
export function shotMeter(s, owner = "hoops") {
  const P = mount();
  if (!s) { if (meterOn && meterOwner === owner) { P.meter.hidden = true; meterOn = false; meterOwner = ""; } return; }
  if (!meterOn) { P.meter.hidden = false; meterOn = true; P.meter.classList.remove("is-done"); }
  meterOwner = owner;
  const T = s.full;
  const at = s.released ? s.relAt : s.t;
  P.fill.style.height = `${Math.min(100, (at / T) * 100)}%`;
  P.band.style.bottom = `${((s.rel - s.w) / T) * 100}%`;
  P.band.style.height = `${((2 * s.w) / T) * 100}%`;
  P.line.style.bottom = `${(s.rel / T) * 100}%`;
  P.meter.classList.toggle("is-done", !!s.released);
  P.meter.classList.toggle("is-contested", (s.contest || 0) > 0.25);
  if (P.kind.textContent !== (s.kind || "")) P.kind.textContent = s.kind || "";
  const tag = (s.contest || 0) > 0.6 ? "SMOTHERED" : (s.contest || 0) > 0.25 ? "CONTESTED" : s.open ? "OPEN" : "";
  if (P.tag.textContent !== tag) P.tag.textContent = tag;
}

/* { word, grade ("x" perfect, "g" good, "b" bad), sub } for a moment, or null. */
let wordKey = "", wordOwner = "";
export function shotWord(f, owner = "hoops") {
  const P = mount();
  if (!f) { if (!P.word.hidden && wordOwner === owner) { P.word.hidden = true; wordKey = ""; wordOwner = ""; } return; }
  const key = `${f.word}|${f.sub || ""}|${f.grade}`;
  if (key === wordKey) return;
  wordKey = key; wordOwner = owner;
  P.word.hidden = false;
  P.word.dataset.grade = f.grade || "";
  P.word.querySelector("b").textContent = f.word;
  P.word.querySelector("span").textContent = f.sub || "";
  P.word.classList.remove("is-in"); void P.word.offsetWidth; P.word.classList.add("is-in");
}

/* A pop beside you: "CROSSOVER", "ANKLE BREAKER", "SLAM DUNK"... kinds:
   move, big (a dunk, a breaker), bad (stripped, blocked), good (a steal). */
export function callout(text, kind = "move", ms = 1100) {
  const P = mount();
  const d = document.createElement("div");
  d.className = `to-court-callout is-${kind}`;
  d.textContent = text;
  // the newest on top, three at most
  P.callouts.prepend(d);
  while (P.callouts.children.length > 3) P.callouts.lastChild.remove();
  setTimeout(() => { d.classList.add("is-out"); setTimeout(() => d.remove(), 260); }, ms);
}

/* The turbo bar (0..1), or null. */
let staminaOn = false, staminaK = -1;
export function stamina(v) {
  const P = mount();
  if (v == null) { if (staminaOn) { P.stamina.hidden = true; staminaOn = false; } return; }
  if (!staminaOn) { P.stamina.hidden = false; staminaOn = true; }
  const k = Math.round(Math.max(0, Math.min(1, v)) * 100);
  if (k !== staminaK) { staminaK = k; P.staminaFill.style.width = `${k}%`; P.stamina.classList.toggle("is-low", k < 25); }
}

/* ------------------------------------------------------- tennis: serve */

/* { u (0..1: the ball up the toss, 1 at the top), band [lo, hi] (the
   sweet stretch of it), kind ("FLAT"), aim ("WIDE"), hit (u it was hit at,
   or null) } or null. The same capsule as the shot meter. */
export function serveMeter(s) {
  const P = mount();
  if (!s) { if (meterOn && meterOwner === "tennis") { P.meter.hidden = true; meterOn = false; meterOwner = ""; } return; }
  if (!meterOn) { P.meter.hidden = false; meterOn = true; }
  meterOwner = "tennis";
  P.fill.style.height = `${Math.max(0, Math.min(100, (s.hit ?? s.u) * 100))}%`;
  P.band.style.bottom = `${s.band[0] * 100}%`;
  P.band.style.height = `${(s.band[1] - s.band[0]) * 100}%`;
  P.line.style.bottom = `${s.band[1] * 100}%`;
  P.meter.classList.toggle("is-done", s.hit != null);
  P.meter.classList.remove("is-contested");
  const kind = `${s.kind}${s.aim ? " · " + s.aim : ""}`;
  if (P.kind.textContent !== kind) P.kind.textContent = kind;
  if (P.tag.textContent !== "SERVE") P.tag.textContent = "SERVE";
}

/* { stroke ("TOPSPIN"), word ("SWEET"), good } */
export const strokeWord = (f) => shotWord(f && { word: f.word, sub: f.stroke, grade: f.good ? "x" : /BIT/.test(f.word) ? "g" : "b" }, "tennis");

/* The call over the court: { text ("ACE"), score ("3–2"), kind: good |
   bad | flat }, for a moment. */
let callT = 0;
export function pointCall(c, ms = 1500) {
  const P = mount();
  P.call.hidden = false;
  P.call.dataset.kind = c.kind || "flat";
  P.call.querySelector("b").textContent = c.text;
  P.call.querySelector("span").textContent = c.score || "";
  P.call.classList.remove("is-in"); void P.call.offsetWidth; P.call.classList.add("is-in");
  clearTimeout(callT);
  callT = setTimeout(() => { P.call.hidden = true; }, ms);
}

/* Off the court (or the map): everything away. */
export function courtHudOff() {
  if (!el) return;
  for (const o of ["hoops", "tennis"]) { scoreCard(null, o); shotMeter(null, o); shotWord(null, o); }
  stamina(null);
  parts.callouts.textContent = "";
  parts.call.hidden = true;
}

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollCourtHud = {
    state: () => el && {
      card: !parts.card.hidden && { a: parts.cardA.textContent, b: parts.cardB.textContent, sa: parts.sa.textContent, sb: parts.sb.textContent, mid: parts.mid.textContent, status: parts.status.textContent, poss: parts.possA.classList.contains("is-on") ? 0 : parts.possB.classList.contains("is-on") ? 1 : -1 },
      meter: !parts.meter.hidden && { kind: parts.kind.textContent, tag: parts.tag.textContent, fill: parts.fill.style.height, band: [parts.band.style.bottom, parts.band.style.height], done: parts.meter.classList.contains("is-done") },
      word: !parts.word.hidden && { word: parts.word.querySelector("b").textContent, sub: parts.word.querySelector("span").textContent, grade: parts.word.dataset.grade },
      callouts: [...parts.callouts.children].map((d) => d.textContent),
      stamina: !parts.stamina.hidden && parts.staminaFill.style.width,
      call: !parts.call.hidden && { text: parts.call.querySelector("b").textContent, score: parts.call.querySelector("span").textContent, kind: parts.call.dataset.kind },
    },
  };
}
