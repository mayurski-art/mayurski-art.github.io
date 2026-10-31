/* Socialize: talking to NPCs (docs/NPC-DIALOGUE.md; user, 2026-10-31: "a
   Skyrim-style NPC dialogue system"). Walk up to an NPC who talks (a cast
   entry with `talk: "<script id>"`), look at them and hold X: the view eases
   onto their face, they say a greeting, and what you can say comes up as a
   BO2 text menu. Topics branch, come back to the hub, and end on a goodbye.
   Everyone else in the crowd stays scenery.

   A script is plain data (modes/talk/*.js, registered with registerTalk):
     greet: [{ if, say, set }]   first match wins; `say` a string or a list
     hub: node id                where a topic ends up
     nodes: { id: { say, set, unset, options: [{ text, to, if, set, bye, say }],
                    pick: [ids], unseen, empty, service } }
   Conditions are a closed list, `!` negates, a space is "and": a flag name,
   owner, vip, tipsy, drink, signedIn. Flags are per NPC, kept in this
   browser (trollops:talk). Nothing goes on the wire: the rest of the room
   just sees you stood there.

   Services (registerTalkService) are other systems' doors: North's "What'll
   it be?" is `service: "bar"`, filled in by the bar session; until then
   the NPC says `fallback` and you're back at the hub. */

import { rpExtras, bar } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1";
import { TIPSY } from "../maps/saloon-bar.js?v=sb1b7-cup1-gt1-gt2-cw1-zr10-hr2-zp1-bf1-sr1-or1-nf2-em2-lh1-fg2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-mb1-mb2";
import { clubBand, BAND } from "./club-entry.js?v=ce1c1c2-wb1m1uc4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1";
import { isOwner, isSignedIn } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4-gc1";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1";
import { game } from "../core/state.js?v=st1";
import { padButtonName } from "../menu/controller-layout.js?v=cl7-pd1-or1-pd2-hb4-xb1-mb2";
import * as THREE from "three";

const REACH = 2.8;          // m, eye to the NPC's feet (across a bar counter)
const AIM_COS = Math.cos(0.42);   // look within ~24° of their head to get the prompt
const EASE_IN = 0.45, EASE_OUT = 0.3;   // s
const ZOOM = 1.12;          // the lens narrows a touch onto their face
const TYPE_CPS = 60;        // the line types out this fast
const ECHO_S = 0.5;         // a picked option stays up, dimmed, this long
const MAX_OPTS = 6;
const STORE = "trollops:talk";

/* ------------------------------------------------------------ registry */

const SCRIPTS = new Map();
const SERVICES = new Map();
export function registerTalk(script) { SCRIPTS.set(script.id, script); }
export function registerTalkService(id, fn) { SERVICES.set(id, fn); }

/* ------------------------------------------------------------ flags */

let flagsAll = null;
function flags(id) {
  if (!flagsAll) {
    try { flagsAll = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch { flagsAll = {}; }
  }
  return (flagsAll[id] ??= {});
}
function saveFlags() { try { localStorage.setItem(STORE, JSON.stringify(flagsAll)); } catch { /* private mode */ } }
function setFlags(id, set, unset) {
  const f = flags(id);
  for (const k of String(set || "").split(" ").filter(Boolean)) f[k] = 1;
  for (const k of String(unset || "").split(" ").filter(Boolean)) delete f[k];
  if (set || unset) saveFlags();
}

const TESTS = {
  owner: () => isOwner(),
  vip: () => { const b = clubBand(); return b === BAND.vip || b === BAND.owner; },
  tipsy: () => bar.tipsy >= TIPSY.onset,
  drink: () => !!bar.drink,
  signedIn: () => isSignedIn(),
};
/* "met !askedWho": every word true; a word is a test above or a flag. */
function passes(id, cond) {
  if (!cond) return true;
  const f = flags(id);
  return String(cond).split(" ").filter(Boolean).every((w) => {
    const neg = w[0] === "!", k = neg ? w.slice(1) : w;
    const v = TESTS[k] ? !!TESTS[k]() : !!f[k];
    return neg ? !v : v;
  });
}
const pickLine = (say) => (Array.isArray(say) ? say[Math.floor(Math.random() * say.length)] : say || "");

/* ------------------------------------------------------------ who talks */

/* The talking NPC we're looking at, in reach, or null. */
const _head = new THREE.Vector3();
function talkerInView() {
  const T = game.townNpcs;
  if (!T || !game.isSocial()) return null;
  const e = game.camera.position;
  const fx = -Math.sin(game.look.yaw) * Math.cos(game.look.pitch), fy = Math.sin(game.look.pitch), fz = -Math.cos(game.look.yaw) * Math.cos(game.look.pitch);
  let best = null, bestDot = AIM_COS;
  for (let i = 0; i < T.list.length; i++) {
    const n = T.list[i];
    const id = n.c.talk;
    if (!id || n.off || !SCRIPTS.has(id) || !n.rig.root.visible) continue;
    if (Math.hypot(n.x - game.move.pos.x, n.z - game.move.pos.z) > REACH || Math.abs((n.c.y ?? 0) - game.move.pos.y) > 1.3) continue;
    n.rig.parts.head.getWorldPosition(_head);
    const dx = _head.x - e.x, dy = _head.y - 0.1 - e.y, dz = _head.z - e.z, d = Math.hypot(dx, dy, dz) || 1;
    const dot = (dx * fx + dy * fy + dz * fz) / d;
    if (dot > bestDot) { bestDot = dot; best = { i, n, script: SCRIPTS.get(id) }; }
  }
  return best;
}

rpExtras.push(() => {
  if (talk || !game.player.alive) return null;
  const t = talkerInView();
  if (!t) return null;
  return { key: `talk-${t.i}`, label: `Talk to ${t.script.name}`, ctx: "Talk", time: 0.2, done: () => openTalk(t) };
});

/* ------------------------------------------------------------ a talk */

let talk = null;   // { i, n, s, node, opts, sel, line, shown, echo, echoT, ease, yaw0, pitch0, wasLocked, padArmed, padPrev }
let out = null;    // { t, zoom0 } easing the lens back after a goodbye

export function talkOpen() { return !!talk; }

function openTalk({ i, n, script }) {
  const yaw0 = game.look.yaw, pitch0 = game.look.pitch;
  talk = { i, n, s: script, node: null, opts: [], sel: 0, line: "", shown: 0, echo: "", echoT: 0, ease: 0, yaw0, pitch0,
    wasLocked: !game.isTouch && !!document.pointerLockElement, padArmed: false, padPrev: {}, stickT: 0, typeT: 0 };
  out = null;
  game.townNpcs.takeOver(i, (nn, rig, dt) => poseListener(nn, rig, dt));
  releaseHeldInputs();
  game.localPauseOnly = true;   // the feet, the trigger and hold X are ours till goodbye
  mountUi();
  ui.name.textContent = script.name;
  ui.role.textContent = script.role || "";
  ui.root.hidden = false;
  document.body.classList.add("to-talking");
  if (talk.wasLocked) game.controls?.unlock?.();
  const g = (script.greet || []).find((x) => passes(script.id, x.if)) || { say: "…" };
  setFlags(script.id, g.set, g.unset);
  goTo(script.hub, pickLine(g.say));
}

/* To node `id`; `say` overrides its own line (a greeting, an option's reply). */
function goTo(id, say) {
  const s = talk.s;
  let node = s.nodes[id];
  if (node?.pick) {
    const f = flags(s.id);
    const left = node.pick.filter((k) => !f[`seen:${k}`]);
    const pool = node.unseen ? left : node.pick;
    // all heard: the `empty` line once, then round again
    if (!pool.length) { const e = s.nodes[node.empty]; setFlags(s.id, e?.set, node.pick.map((k) => `seen:${k}`).join(" ")); return say != null ? goTo(s.hub, say) : showNode(s.hub, pickLine(e?.say)); }
    const k = pool[Math.floor(Math.random() * pool.length)];
    setFlags(s.id, `seen:${k}`);
    id = k; node = s.nodes[k];
  }
  if (node?.service) {
    const fn = SERVICES.get(node.service);
    if (fn) {
      // A service either takes over (close / back when it's done) or hands
      // back options to say here: { say, options: [{ text, run }] }, where
      // run() does the thing and returns the NPC's reply.
      talk.node = id;
      const r = fn({ npc: s.id, close: () => closeTalk(), back: (line) => talk && showNode(s.hub, line) });
      if (!talk || talk.node !== id) return;
      setLine(pickLine(r?.say ?? node.say ?? say));
      talk.opts = [...(r?.options || []).map((o) => ({ text: o.text, run: o.run })), { text: node.back || "Never mind.", to: s.hub, say: pickLine(node.backSay) || null }].slice(0, MAX_OPTS);
      talk.sel = 0;
      renderOpts();
      return;
    }
    return showNode(s.hub, pickLine(node.fallback) || "Not now.");
  }
  showNode(id, say != null && say !== "" ? say : pickLine(node?.say));
}

function showNode(id, line) {
  const s = talk.s;
  const node = s.nodes[id] || s.nodes[s.hub];
  setFlags(s.id, node.set, node.unset);
  talk.node = id;
  // a node with no options of its own offers the hub's
  const src = node.options || s.nodes[s.hub].options;
  talk.opts = src.filter((o) => passes(s.id, o.if)).slice(0, MAX_OPTS);
  talk.sel = 0;
  setLine(line);
  renderOpts();
}

function setLine(line) {
  talk.line = line || "";
  talk.shown = 0;
  talk.typeT = 0;
  ui.line.textContent = "";
  ui.line.setAttribute("aria-label", talk.line);
}

function choose(k) {
  if (!talk) return;
  // the first press finishes the line; the next one picks
  if (talk.shown < talk.line.length) { finishLine(); return; }
  const o = talk.opts[k];
  if (!o) return;
  const s = talk.s;
  setFlags(s.id, o.set, o.unset);
  talk.echo = o.text;
  talk.echoT = ECHO_S;
  ui.echo.textContent = o.text;
  ui.echo.hidden = false;
  if (o.run) { showNode(s.hub, String(o.run() ?? "")); return; }
  if (o.bye) {
    setLine(pickLine(o.say) || "Later.");
    talk.opts = [];
    renderOpts();
    talk.byeT = 1.4;
    return;
  }
  goTo(o.to || s.hub, o.say != null ? pickLine(o.say) : null);
}

function finishLine() {
  talk.shown = talk.line.length;
  ui.line.textContent = talk.line;
}

/* Goodbye (or cut off: a death, the map going, the match ending). */
export function closeTalk() {
  if (!talk) return;
  const t = talk;
  talk = null;
  game.townNpcs?.release(t.i);
  game.localPauseOnly = false;
  releaseHeldInputs();
  ui.root.hidden = true;
  document.body.classList.remove("to-talking");
  out = { t: 0, zoom0: game.camera.zoom || 1 };
  if (t.wasLocked && game.gameState === "playing") game.controls?.lock?.();
}

/* ------------------------------------------------------------ each frame */

const smooth = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* From view/player-update.js (Socialize), before the camera is placed. */
export function updateTalk(dt) {
  if (out) {
    out.t += dt;
    const z = out.zoom0 + (1 - out.zoom0) * smooth(out.t / EASE_OUT);
    setZoom(z);
    if (out.t >= EASE_OUT) { setZoom(1); out = null; }
  }
  if (!talk) return;
  if (!game.isSocial() || !game.player.alive || game.gameState !== "playing" || !game.townNpcs?.list[talk.i]) { closeTalk(); return; }
  game.localPauseOnly = true;   // (a resumed pause menu would hand the feet back)
  // the view onto their face, a little under the eyes so the line sits clear below
  talk.ease = Math.min(1, talk.ease + dt / EASE_IN);
  const k = smooth(talk.ease);
  talk.n.rig.parts.head.getWorldPosition(_head);
  const e = game.camera.position;
  const dx = _head.x - e.x, dz = _head.z - e.z, dy = _head.y - 0.12 - e.y;
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  game.look.yaw = talk.yaw0 + wrap(yaw - talk.yaw0) * k;
  game.look.pitch = talk.pitch0 + (pitch - talk.pitch0) * k;
  setZoom(1 + (ZOOM - 1) * k);
  // the line types out
  if (talk.shown < talk.line.length) {
    talk.typeT += dt;
    const n = Math.min(talk.line.length, Math.floor(talk.typeT * TYPE_CPS));
    if (n !== talk.shown) { talk.shown = n; ui.line.textContent = talk.line.slice(0, n); }
  }
  if (talk.echoT > 0 && (talk.echoT -= dt) <= 0) ui.echo.hidden = true;
  if (talk.byeT != null && talk.shown >= talk.line.length && (talk.byeT -= dt) <= 0) { closeTalk(); return; }
  pollPad(dt);
  glyphs();
}

function setZoom(z) {
  const c = game.camera;
  if (Math.abs((c.zoom || 1) - z) < 1e-4) return;
  c.zoom = z;
  c.updateProjectionMatrix();
}

/* The NPC while we talk: his head turns to us (60° at most), hands rest on
   whatever's in front of him, and he talks with one hand while his line types. */
const _eye = new THREE.Vector3();
function poseListener(n, rig, dt) {
  const p = rig.parts;
  _eye.copy(game.camera.position);
  const dx = _eye.x - n.x, dz = _eye.z - n.z;
  const want = wrap(Math.atan2(-dx, -dz) - n.yaw);
  const turn = Math.max(-1.05, Math.min(1.05, want));
  p.headPivot.getWorldPosition(_head);
  const down = Math.atan2(_head.y - _eye.y, Math.hypot(dx, dz));
  n.lookY = (n.lookY ?? 0) + (turn - (n.lookY ?? 0)) * Math.min(1, dt * 6);
  n.lookX = (n.lookX ?? 0) + (down - (n.lookX ?? 0)) * Math.min(1, dt * 6);
  // past 35° the shoulders come round with the head
  const body = Math.sign(n.lookY) * Math.max(0, Math.abs(n.lookY) - 0.6) * 0.6;
  p.chest.rotation.y += body;
  p.headPivot.rotation.y = n.lookY - body;
  p.headPivot.rotation.x = Math.max(-0.4, Math.min(0.5, n.lookX));
  const typing = talk && talk.n === n && talk.shown < talk.line.length;
  const g = typing ? Math.sin(performance.now() / 160) * 0.12 : 0;
  p.armL.rotation.set(0.5, 0, 0.1); p.elbowL.rotation.set(0.6, 0, 0);
  p.armR.rotation.set(0.62 + g, 0, -0.18); p.elbowR.rotation.set(0.9 + g * 1.5, 0, 0);
}

/* ------------------------------------------------------------ input */

function move(d) {
  if (!talk?.opts.length) return;
  talk.sel = (talk.sel + d + talk.opts.length) % talk.opts.length;
  renderSel();
}
function bye() {
  if (!talk) return;
  if (talk.byeT != null) { closeTalk(); return; }
  const k = talk.opts.findIndex((o) => o.bye);
  if (k >= 0) { talk.shown = talk.line.length; choose(k); }
  else closeTalk();
}

window.addEventListener("keydown", (e) => {
  if (!talk) return;
  if (game.chat?.isTyping) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  if (e.repeat && !/^Arrow|^Key[WS]$/.test(e.code)) return;
  const c = e.code;
  if (c === "Escape" || c === "Tab") bye();
  else if (c === "ArrowUp" || c === "KeyW") move(-1);
  else if (c === "ArrowDown" || c === "KeyS") move(1);
  else if (c === "Enter" || c === "Space" || c === "KeyE" || c === "KeyX") choose(talk.sel);
  else {
    const d = /^(?:Digit|Numpad)([1-9])$/.exec(c);
    if (d) { const k = Number(d[1]) - 1; if (talk.shown < talk.line.length) finishLine(); else if (k < talk.opts.length) { talk.sel = k; choose(k); } }
  }
}, true);
// (the game's own key-up handler still needs to hear releases, so keyup isn't captured)

/* A on the pad picks, B says goodbye, the d-pad or left stick moves. Armed
   only once every button is up: the X held to start isn't an answer. */
function pollPad(dt) {
  const gp = game.pickPad?.(navigator.getGamepads ? navigator.getGamepads() : [], game.gpIndex);
  if (!gp) return;
  const b = (i) => !!gp.buttons[i]?.pressed;
  const now = { a: b(0), b: b(1), up: b(12), dn: b(13), x: b(2) };
  const sy = gp.axes[1] || 0;
  if (!talk.padArmed) { talk.padArmed = !Object.values(now).some(Boolean) && Math.abs(sy) < 0.5; talk.padPrev = now; return; }
  const P = talk.padPrev;
  if (now.a && !P.a) choose(talk.sel);
  else if (now.b && !P.b) bye();
  else if (now.up && !P.up) move(-1);
  else if (now.dn && !P.dn) move(1);
  talk.padPrev = now;
  if (!talk) return;
  // the stick: one step, then a repeat while it's held
  if (Math.abs(sy) > 0.6) {
    if (talk.stickT <= 0) { move(sy > 0 ? 1 : -1); talk.stickT = talk.stickHeld ? 0.16 : 0.4; }
    talk.stickT -= dt; talk.stickHeld = true;
  } else { talk.stickT = 0; talk.stickHeld = false; }
}

/* ------------------------------------------------------------ the panel */

let ui = null;
function mountUi() {
  if (ui) return;
  injectCss();
  const root = document.createElement("div");
  root.className = "to-talk";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "to-talk-name");
  root.innerHTML = `
    <div class="to-talk-panel">
      <div class="to-talk-who"><span id="to-talk-name" class="to-talk-name"></span><span class="to-talk-role"></span></div>
      <div class="to-talk-echo" hidden></div>
      <p class="to-talk-line" aria-live="polite"></p>
      <div class="to-talk-opts" role="listbox" aria-label="What you say"></div>
      <div class="to-talk-keys" aria-hidden="true"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  ui = { root, name: $(".to-talk-name"), role: $(".to-talk-role"), echo: $(".to-talk-echo"), line: $(".to-talk-line"), opts: $(".to-talk-opts"), keys: $(".to-talk-keys") };
  // clicks on the panel are the panel's, not the game's (fire, re-lock)
  for (const ev of ["mousedown", "pointerdown", "click", "wheel", "touchstart"]) root.addEventListener(ev, (e) => e.stopPropagation());
  ui.opts.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]");
    if (b) { talk && (talk.sel = Number(b.dataset.k)); choose(Number(b.dataset.k)); }
  });
  ui.opts.addEventListener("pointermove", (e) => {
    const b = e.target.closest("button[data-k]");
    if (b && talk && e.pointerType === "mouse" && talk.sel !== Number(b.dataset.k)) { talk.sel = Number(b.dataset.k); renderSel(); }
  });
  // a tap on the line finishes it
  ui.line.addEventListener("click", () => { if (talk && talk.shown < talk.line.length) finishLine(); });
  document.body.appendChild(root);
}

function renderOpts() {
  ui.opts.textContent = "";
  talk.opts.forEach((o, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "to-talk-opt";
    b.dataset.k = String(k);
    b.setAttribute("role", "option");
    b.innerHTML = `<span class="to-talk-n" aria-hidden="true"></span><span class="to-talk-t"></span>`;
    b.querySelector(".to-talk-n").textContent = String(k + 1);
    b.querySelector(".to-talk-t").textContent = o.text;
    ui.opts.appendChild(b);
  });
  renderSel();
}
function renderSel() {
  [...ui.opts.children].forEach((b, k) => {
    const on = k === talk.sel;
    b.classList.toggle("is-hot", on);
    b.setAttribute("aria-selected", String(on));
  });
}

/* The hint line says what works on this device. */
function inputKind() { return game.isTouch && !game.gamepadState?.connected ? "touch" : game.gamepadState?.connected ? "pad" : "keys"; }
function glyphs() {
  const k = inputKind();
  if (ui.root.dataset.input === k) return;
  ui.root.dataset.input = k;
  ui.root.classList.toggle("is-touch", k === "touch");
  ui.keys.textContent = k === "pad" ? `${padButtonName(0)} say · ${padButtonName(1)} goodbye` : k === "keys" ? "↑↓ choose · E or 1–6 say · Esc goodbye" : "";
  ui.keys.hidden = k === "touch";
}

function injectCss() {
  if (document.getElementById("to-talk-css")) return;
  const s = document.createElement("style");
  s.id = "to-talk-css";
  s.textContent = `
.to-talk { position: absolute; inset: 0; z-index: 32; pointer-events: none; font-family: "DM Sans", system-ui, sans-serif; }
.to-talk-panel { position: absolute; left: 0; right: 0; bottom: 0; padding: 22px 6vw 26px; pointer-events: auto;
  background: linear-gradient(0deg, rgba(8,6,10,.9) 0%, rgba(8,6,10,.78) 55%, rgba(8,6,10,0) 100%); color: #f3ece4; }
.to-talk-who { display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; }
.to-talk-name { font: 600 28px/1 Oswald, "Arial Narrow", sans-serif; letter-spacing: .05em; text-transform: uppercase; color: #ff8a1f;
  text-shadow: 0 2px 10px rgba(0,0,0,.85); }
.to-talk-role { font: 500 13px/1 "DM Mono", ui-monospace, monospace; letter-spacing: .04em; color: #c9b8a6; }
.to-talk-echo { font: 500 14px/1.3 "DM Sans", system-ui, sans-serif; color: #8f7f70; margin: 0 0 4px; }
.to-talk-echo::before { content: "You: "; }
.to-talk-line { margin: 0 0 14px; max-width: 760px; min-height: 1.4em; font: 500 20px/1.4 "DM Sans", system-ui, sans-serif;
  text-shadow: 0 1px 6px rgba(0,0,0,.95); cursor: default; }
.to-talk-opts { display: flex; flex-direction: column; align-items: flex-start; max-width: 560px; }
.to-talk-opt { display: flex; align-items: baseline; gap: 12px; align-self: stretch; min-height: 34px; padding: 0 14px; margin-left: -14px;
  border: 0; background: none; color: inherit; text-align: left; cursor: pointer; font: 500 21px/34px Oswald, "Arial Narrow", sans-serif;
  letter-spacing: .04em; text-transform: uppercase; text-shadow: 0 1px 6px rgba(0,0,0,.85); -webkit-tap-highlight-color: transparent; }
.to-talk-n { font: 500 12px/1 "DM Mono", ui-monospace, monospace; color: #c9b8a6; min-width: 10px; }
.to-talk-opt.is-hot { color: #ff8a1f; background: linear-gradient(90deg, rgba(255,138,31,.28), rgba(255,138,31,0) 85%); }
.to-talk-opt.is-hot .to-talk-n { color: #ffd2a6; }
.to-talk-opt:focus { outline: none; }
.to-talk-opt:focus-visible { outline: 2px solid #ff8a1f; outline-offset: 2px; }
.to-talk-keys { margin-top: 10px; font: 500 12px/1 "DM Mono", ui-monospace, monospace; color: #c9b8a6; letter-spacing: .04em; }
.to-talk.is-touch .to-talk-panel { background: rgb(14,11,16); border-top: 1px solid rgba(255,138,31,.35); padding: 14px 16px 16px; }
.to-talk.is-touch .to-talk-n { display: none; }
.to-talk.is-touch .to-talk-opts { max-width: none; gap: 6px; }
.to-talk.is-touch .to-talk-opt { margin-left: 0; min-height: 48px; line-height: 48px; font-size: 19px; border-radius: 10px;
  background: rgba(255,255,255,.06); touch-action: manipulation; }
.to-talk.is-touch .to-talk-opt.is-hot { background: rgba(255,138,31,.2); }
.to-talk.is-touch .to-talk-line { font-size: 17px; margin-bottom: 10px; }
.to-talk.is-touch .to-talk-name { font-size: 22px; }
@media (max-height: 480px) {
  .to-talk.is-touch .to-talk-panel { left: auto; width: min(58vw, 520px); top: 0; padding: 10px 14px; overflow-y: auto;
    border-top: 0; border-left: 1px solid rgba(255,138,31,.35); display: flex; flex-direction: column; justify-content: flex-end; }
  .to-talk.is-touch .to-talk-opt { min-height: 40px; line-height: 40px; font-size: 17px; }
}
body.to-talking #to-touch, body.to-talking #to-pickup-prompt { display: none !important; }
`;
  document.head.appendChild(s);
}

if (new URLSearchParams(location.search).has("tohooks")) {
  window.__trollTalk = {
    state: () => talk && ({ npc: talk.s.id, node: talk.node, line: talk.line, shown: talk.shown, opts: talk.opts.map((o) => o.text), sel: talk.sel,
      yaw: game.look.yaw, pitch: game.look.pitch, zoom: game.camera.zoom, ease: talk.ease }),
    prompt: () => { const t = talkerInView(); return t ? { i: t.i, name: t.script.name } : null; },
    open: () => { const t = talkerInView(); if (t) openTalk(t); return !!t; },
    choose: (k) => { if (talk) { finishLine(); choose(k); } },
    finish: () => talk && finishLine(),
    bye, close: closeTalk, flags: (id) => ({ ...flags(id) }),
    resetFlags: () => { flagsAll = {}; saveFlags(); },
    scripts: () => [...SCRIPTS.keys()],
  };
}
