// Troll Forces — the game at Troll Beach's south hoop (5d phase 3,
// docs/GRIN-BEACH-COURTS.md): streetball to 11, 2s and 1s, win by 2,
// make-it-take-it, check ball at the top, take it back past the arc after a
// defensive board, out of bounds to the other side. Winner stays: beat the
// regulars and the legends wait (Hoops Hank, Crossover Carla, Big Grin).
// Plus the 3-point contest at the north hoop: 25 balls, 5 spots, the 5th of
// each rack the money ball, 60 seconds.
//
// - Hold X at the scoreboard: "Run it". Anyone else who holds X there in
//   the next 4 s joins (1 more: 1v1; 2-3 more: 2v2, an NPC fills); nobody,
//   and it's you against the next baller on your ladder.
// - The one who started it hosts: keeps the score, calls possessions, runs
//   the NPCs (their brains here, their bodies streamed to the room 10 times
//   a second), and tells the room (rp "hg" messages, every change and every
//   2 s). The ball and the shots are social-hoops.js's, the same as pickup.
// - A player in the game is placed for each check (the ball to the one
//   checking it at the top of the key, his man in front); nobody shoots
//   till it's checked.
//
// The wire: rp { k: "hg", e: "s", g } the game; { e: "join", g } a player
// joining; { e: "n", g, n: [[i, x, z, yaw, hm, ha, y]] } the NPCs.

import * as THREE from "three";
import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2";
import { rpExtras, rpListeners, seated } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2";
import { H, balls, HOOPS, hoopsHooks, CLIP_IDS, poseHoop, ballInHands, ballFor, dropBall, handPos, clipLen, courtWorld, MOVES, giveBall, npcTakes, npcSteals, setBallLaunch, hoopSpots } from "./social-hoops.js?v=gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2";
import { solveShot, makeLaunch } from "./court-ball.js?v=gb5-gb8";
import { roomNow } from "./room-clock.js?v=rc1-cd1-sh1";
import { drawBoard } from "../maps/grinbeach-courts.js?v=gb5-tb2-kbb2-kbs1-pm1-kbk2";

export const GAME = {
  to: 11, by: 2, wait: 4, check: 1.6,
  boardReach: 2.4,
  npcRate: 0.1,                   // s between NPC updates on the wire
  npcSpeed: 4.4, npcDrive: 5.2,   // m/s
  over: 6,                        // s the final score stays up
  clearArc: 6.25,                 // m from the rim: taken back
  ladderKey: "tf-hoops-ladder",
  contest: { secs: 60, racks: 5, per: 5, key: "tf-hoops-3pt" },
};
const myId = () => game.net?.id || "me";
const send = (m) => game.net?.publishRp?.({ k: "hg", ...m });
const isNpc = (id) => typeof id === "string" && /^npc\d+$/.test(id);
const npcIndex = (id) => +id.slice(3);

/* The game we're in or watching (the host's copy rules), our side of it. */
export const G = { s: null, joinT: 0, sentAt: 0, contest: null, npcSent: 0, seq: 0, lastCheck: -1, calm: false };   // calm: the tests' NPCs neither poke nor block
const brains = new Map();   // npc id -> { x, z, yaw, y, vy, clip, clipAt, mirror, hand, moving, react, frozen, shot, ... }
const shown = new Map();    // npc id -> the last streamed state (non-hosts)

/* ------------------------------------------------------------ the roster */

/* The ballers in the cast: the regulars by skill, then the legends. */
function roster() {
  const list = game.townNpcs?.list || [];
  return list.map((n, i) => ({ id: `npc${i}`, i, name: n.c.name, hoops: n.c.hoops })).filter((r) => r.hoops).sort((a, b) => a.hoops.skill - b.hoops.skill);
}
function ladder() {
  try { return Math.max(0, +localStorage.getItem(GAME.ladderKey) || 0); } catch { return 0; }
}
function setLadder(v) { try { localStorage.setItem(GAME.ladderKey, String(v)); } catch { /* storage off */ } }
// a name as the board writes it: letters, digits and a few marks (no tag glyphs)
const clean = (n) => String(n || "").replace(/[^p{L}p{N} _.'-]/gu, "").trim().slice(0, 16);
const nameOf = (id) => clean(isNpc(id) ? game.townNpcs?.list?.[npcIndex(id)]?.c.name || "Baller" : id === myId() ? (game.net?.name || "You") : game.net?.peers?.get(id)?.name || "Player") || "Player";
const skillOf = (id) => game.townNpcs?.list?.[npcIndex(id)]?.c.hoops?.skill ?? 0.5;
const styleOf = (id) => game.townNpcs?.list?.[npcIndex(id)]?.c.hoops?.style ?? "all";

/* ----------------------------------------------------------- positions */

const rimOf = (S) => S.layout.rims[0];
function checkSpots(S) {
  const r = rimOf(S);
  return { ball: { x: r.x, z: r.z + 7.4 }, def: { x: r.x, z: r.z + 5.9 }, wing: [{ x: r.x - 5.2, z: r.z + 4.6 }, { x: r.x + 5.2, z: r.z + 4.6 }] };
}
function posOf(id) {
  if (id === myId()) return { x: game.move.pos.x, z: game.move.pos.z, y: game.move.pos.y };
  if (isNpc(id)) {
    const b = brains.get(id) || shown.get(id);
    if (b) return { x: b.x, z: b.z, y: b.y || 0 };
    const n = game.townNpcs?.list?.[npcIndex(id)];
    return n ? { x: n.x, z: n.z, y: 0 } : null;
  }
  const r = game.remotes?.byId?.get(id);
  return r ? { x: r.pos.x, z: r.pos.z, y: r.pos.y } : null;
}
const teamOf = (s, id) => (!s || !id ? -1 : s.teams[0].includes(id) ? 0 : s.teams[1].includes(id) ? 1 : -1);
function inLines(S, x, z, pad = 0) {
  const [x0, x1, z0] = S.layout.court.lines;
  return x > x0 - pad && x < x1 + pad && z > z0 - pad && z < S.layout.court.z + pad;
}

/* -------------------------------------------------------- starting one */

function boardNear(S) {
  const b = S.hoops.board;
  return Math.hypot(b.x - game.move.pos.x, b.z - game.move.pos.z) < GAME.boardReach;
}
function gameAction() {
  const S = hoopSpots();
  if (!S || !game.player.alive || seated || !boardNear(S)) return null;
  const s = G.s;
  if (G.contest) return { key: "hg:busy", info: true, label: "Finish your 3-point contest first" };
  if (s && s.phase === "wait" && s.host !== myId() && !s.teams.flat().includes(myId()))
    return { key: "hg:join", label: `Join ${nameOf(s.host)}'s game`, ctx: "Join", time: 0.4, done: () => send({ e: "join", g: s.id }) };
  if (s && s.phase !== "done") return { key: "hg:on", info: true, label: s.teams.flat().includes(myId()) ? "You're in the game" : "Game on: next" };
  const r = roster();
  const next = r[Math.min(ladder(), r.length - 1)];
  // two choices off one board: the side you stand on picks
  const north = game.move.pos.z > S.hoops.board.z;
  if (north) return { key: "hg:3pt", label: "3-point contest (60 s, north hoop)", ctx: "3PT", time: 0.5, done: () => startContest(S) };
  return { key: "hg:run", label: next ? `Run it: 1v1 to 11 vs ${next.name}` : "Run it: 1v1 to 11", ctx: "Run it", time: 0.6, done: () => startGame(S) };
}
function startGame(S) {
  const id = `${myId()}-g${++G.seq}`;
  G.s = { id, host: myId(), teams: [[myId()], []], score: [0, 0], poss: 0, phase: "wait", clear: true, to: GAME.to, ball: `${id}-b`,
    waitUntil: roomNow() + GAME.wait * 1000, checkAt: 0, checkSeq: 0, holder: null, last: -1, winner: -1, names: {} };
  publish(true);
  showWaveBanner("Run it: anyone at the board in the next 4 s joins", 2600);
}
/* Teams from who turned up: one more = 1v1; three or four = 2v2, an NPC
   making up the numbers; nobody = the next baller on our ladder. */
function formTeams(S, s) {
  const humans = [s.host, ...s.joiners || []].slice(0, 4);
  const r = roster().filter((x) => !game.townNpcs.list[x.i].off);
  if (humans.length === 1) {
    const opp = r[Math.min(ladder(), r.length - 1)];
    s.teams = [[humans[0]], [opp ? opp.id : null].filter(Boolean)];
    s.ladderRung = ladder();
  } else if (humans.length === 2) s.teams = [[humans[0]], [humans[1]]];
  else {
    const a = [humans[0], humans[2]], b = [humans[1]];
    if (humans[3]) b.push(humans[3]);
    else { const fill = r[Math.min(2, r.length - 1)]; if (fill) b.push(fill.id); }
    s.teams = [a, b];
  }
  for (const id of s.teams.flat()) s.names[id] = nameOf(id);
}

/* ---------------------------------------------------------------- host */

function publish(force = false) {
  const s = G.s;
  if (!s || s.host !== myId()) return;
  const now = performance.now();
  if (!force && now - G.sentAt < 2000) return;
  G.sentAt = now;
  send({ e: "s", g: s });
  drawGame(s);
}
/* Possession to team t, checked at the top: the ball to `who` (a team
   player: the scorer on a make, else the first of them). */
function check(S, s, t, who) {
  const team = s.teams[t];
  const holder = who && team.includes(who) ? who : team[0];
  s.poss = t; s.phase = "check"; s.clear = true; s.holder = holder; s.checkSeq++;
  s.checkAt = roomNow() + GAME.check * 1000;
  // the ball goes to him; the NPCs get placed here (players place themselves)
  const C = checkSpots(S);
  if (holder === myId()) giveBall(s.ball);
  else if (isNpc(holder)) npcTakes(s.ball, holder);
  else { const b = balls.get(s.ball); if (b) { b.holder = null; b.sim = null; } }
  for (const id of s.teams.flat()) {
    if (!isNpc(id)) continue;
    const br = brain(id);
    const def = s.teams[1 - t].includes(id);
    const spot = id === holder ? C.ball : def && s.teams[1 - t][0] === id ? C.def : C.wing[(s.teams[t].indexOf(id) + (def ? 1 : 0)) % 2];
    br.x = spot.x; br.z = spot.z; br.y = 0; br.vy = 0; br.shot = null; br.frozen = 0;
  }
  publish(true);
}
function hostFrame(S, s, dt) {
  const now = roomNow();
  if (s.phase === "wait") {
    if (now >= s.waitUntil) {
      formTeams(S, s);
      if (!s.teams[1].length) { G.s = null; showWaveBanner("Nobody to run it with", 1600); return; }
      for (const id of s.teams.flat()) if (isNpc(id)) takeNpc(id);
      ballFor(s.ball);
      showWaveBanner(`${teamName(s, 0)} vs ${teamName(s, 1)}: to ${s.to}, 2s and 1s, win by 2`, 2600);
      check(S, s, 0, s.host);
    }
    return publish();
  }
  if (s.phase === "check" && now >= s.checkAt) { s.phase = "live"; publish(true); showWaveBanner("Ball in", 700); }
  if (s.phase === "over") {
    if (now >= s.overAt) endGame(s);
    return publish();
  }
  if (s.phase === "live") {
    const b = balls.get(s.ball);
    // taken back past the arc
    if (b?.holder && !s.clear && teamOf(s, b.holder) === s.poss) {
      const p = posOf(b.holder), r = rimOf(S);
      if (p && Math.hypot(p.x - r.x, p.z - r.z) >= GAME.clearArc) { s.clear = true; publish(true); }
    }
    // out of bounds: a loose ball off the half court, or a holder who walks off it
    const out = b?.sim && !b.sim.rest ? (b.sim.p[1] < 1.2 && !inLines(S, b.sim.p[0], b.sim.p[2], 0.05)) : b?.sim?.rest ? !inLines(S, b.sim.p[0], b.sim.p[2], 0.05) : false;
    const walked = b?.holder && (() => { const p = posOf(b.holder); return p && !inLines(S, p.x, p.z, 0.4); })();
    if (out || walked) {
      const t = walked ? 1 - teamOf(s, b.holder) : s.last >= 0 ? 1 - s.last : 1 - s.poss;
      showWaveBanner(walked ? "Stepped out" : "Out of bounds", 900);
      check(S, s, t);
    }
  }
  // the NPCs
  for (const id of s.teams.flat()) if (isNpc(id)) npcThink(S, s, id, dt);
  streamNpcs(s);
  publish();
}
function endGame(s) {
  s.phase = "done";
  for (const id of s.teams.flat()) if (isNpc(id)) releaseNpc(id);
  const b = balls.get(s.ball);
  if (b && (b.holder === myId())) { /* keep playing with it */ } else if (b && s.host === myId()) { dropBall(s.ball); game.net?.publishRp?.({ k: "hb", e: "gone", id: s.ball }); }
  publish(true);
  G.s = null;
}
const teamName = (s, t) => s.teams[t].map((id) => s.names[id] || nameOf(id)).join(" & ") || "?";

/* ---------------------------------------------------- the rules (hooks) */

hoopsHooks.onScore.push((b, e) => {
  const s = G.s, S = hoopSpots();
  if (!s || !S || b.id !== s.ball || e.hoop !== 0) return;
  if (s.host !== myId() || s.phase !== "live") return;
  const t = teamOf(s, b.shooter);
  if (t < 0) return;
  if (t !== s.poss || !s.clear) {
    showWaveBanner("Take it back! Doesn't count", 1400);
    check(S, s, 1 - t);
    return;
  }
  s.score[t] += b.pts > 1 ? 2 : 1;
  if (s.score[t] >= s.to && s.score[t] - s.score[1 - t] >= GAME.by) {
    s.phase = "over"; s.winner = t; s.overAt = roomNow() + GAME.over * 1000;
    if (s.teams[t].includes(myId()) && s.ladderRung != null && s.teams[1 - t].some(isNpc)) setLadder(Math.max(ladder(), s.ladderRung + 1));
    publish(true);
    return;
  }
  check(S, s, t, b.shooter);   // make it, take it
});
hoopsHooks.onGrab.push((b, by) => {
  const s = G.s;
  if (!s || b.id !== s.ball || s.host !== myId() || s.phase !== "live") return;
  const t = teamOf(s, by);
  if (t < 0) return;
  s.last = t;
  // a defensive board or a steal: theirs now, and it has to go back out
  if (t !== s.poss) { s.poss = t; s.clear = false; publish(true); }
});
hoopsHooks.onLaunch.push((b) => {
  const s = G.s;
  if (s && b.id === s.ball) { const t = teamOf(s, b.shooter); if (t >= 0) s.last = t; }
});
hoopsHooks.onSteal.push((b, by) => {
  const s = G.s;
  if (s && b.id === s.ball) { const t = teamOf(s, by); if (t >= 0) s.last = t; }
});
hoopsHooks.canShoot = () => {
  const s = G.s;
  if (G.contest) return true;
  if (!s || !s.teams.flat().includes(myId())) return true;
  return s.phase === "live" && s.poss === teamOf(s, myId());
};
hoopsHooks.defenders = () => {
  const s = G.s;
  if (!s) {
    // pickup: anyone close by contests
    const out = [];
    for (const r of game.remotes?.byId?.values?.() || []) out.push({ x: r.pos.x, z: r.pos.z, jump: r.pos.y > 0.4 });
    return out;
  }
  const t = teamOf(s, myId());
  if (t < 0) return [];
  return s.teams[1 - t].map((id) => { const p = posOf(id); return p && { x: p.x, z: p.z, jump: (p.y || 0) > 0.3 }; }).filter(Boolean);
};
hoopsHooks.mates = () => {
  const s = G.s;
  const t = teamOf(s, myId());
  if (t < 0) return [];
  return s.teams[t].filter((id) => id !== myId()).map((id) => ({ id, ...posOf(id) })).filter((m) => m.x != null);
};
hoopsHooks.stealOdds = (b) => (isNpc(b.holder) ? 1.25 - skillOf(b.holder) * 0.6 : 1);

/* ------------------------------------------------------------ the NPCs */

function brain(id) {
  let b = brains.get(id);
  if (!b) {
    const n = game.townNpcs.list[npcIndex(id)];
    b = { id, x: n.x, z: n.z, yaw: n.yaw, y: 0, vy: 0, clip: "hoop-stance", clipAt: roomNow(), mirror: false, hand: 1, moving: false, frozen: 0, decide: 0, shot: null, move: null, react: 0.5 - skillOf(id) * 0.35, lag: [] };
    brains.set(id, b);
  }
  return b;
}
const setNpcClip = (b, name, mirror = false) => { if (b.clip !== name || b.mirror !== mirror) { b.clip = name; b.mirror = mirror; b.clipAt = roomNow(); } };
function takeNpc(id) {
  const N = game.townNpcs;
  const i = npcIndex(id);
  if (!N?.list?.[i] || N.list[i].override) return;
  N.takeOver(i, (n, rig, dt) => poseNpc(id, n, rig, dt));
}
function releaseNpc(id) {
  brains.delete(id); shown.delete(id);
  game.townNpcs?.release?.(npcIndex(id));
}
/* Every client: the NPC stood where its brain (host) or the stream says,
   in its clip, the ball in its hands if it has it. */
const _bp = new THREE.Vector3();
function poseNpc(id, n, rig, dt) {
  const b = brains.get(id) || shown.get(id);
  if (!b) return;
  if (shown.has(id) && !brains.has(id)) {
    // smooth toward the stream
    const k = Math.min(1, dt * 12);
    b.sx = (b.sx ?? b.x) + (b.x - (b.sx ?? b.x)) * k; b.sz = (b.sz ?? b.z) + (b.z - (b.sz ?? b.z)) * k;
    n.x = b.sx; n.z = b.sz;
  } else { n.x = b.x; n.z = b.z; }
  n.yaw = b.yaw; n.moving = !!b.moving;
  const t = (roomNow() - b.clipAt) / 1000;
  const full = !b.moving || /jumper|layup|dunk|block|grab|steal|spin|stepback/.test(b.clip);
  if (poseHoop(rig, b.clip, t, b.mirror, full)) {
    rig.root.position.y = (n.c.y ?? 0) + (b.y || 0);
    rig.root.updateMatrixWorld(true);
    rig.body?.update?.();
  }
  const s = G.s;
  const ball = s && balls.get(s.ball);
  if (ball?.mesh && ball.holder === id) {
    ballInHands(rig, b.clip, t, b.mirror, b.hand, _bp);
    ball.mesh.position.copy(_bp);
  }
}
function streamNpcs(s) {
  const now = performance.now();
  if (now - G.npcSent < GAME.npcRate * 1000) return;
  G.npcSent = now;
  const n = [];
  for (const id of s.teams.flat()) {
    if (!isNpc(id)) continue;
    const b = brains.get(id);
    if (!b) continue;
    const i = CLIP_IDS.indexOf(b.clip);
    n.push([npcIndex(id), +b.x.toFixed(2), +b.z.toFixed(2), +b.yaw.toFixed(2), (i + 1) * (b.mirror ? -1 : 1), b.clipAt, +(b.y || 0).toFixed(2), b.moving ? 1 : 0, b.hand]);
  }
  if (n.length) send({ e: "n", g: s.id, n });
}

/* An NPC's turn (host only). */
function npcThink(S, s, id, dt) {
  const b = brain(id);
  const ball = balls.get(s.ball);
  const t = teamOf(s, id), rim = rimOf(S);
  const skill = skillOf(id), style = styleOf(id);
  const me = { x: b.x, z: b.z };
  b.frozen = Math.max(0, b.frozen - dt);
  // in the air: a jump's arc
  if (b.y > 0 || b.vy > 0) { b.vy -= 9.81 * 0.75 * dt; b.y = Math.max(0, b.y + b.vy * dt); if (b.y === 0) b.vy = 0; }
  if (b.shot) return npcShoot(S, s, id, b, dt);
  if (b.move) {
    b.move.t += dt;
    const d = b.move.def;
    if (b.move.t >= d.at[0] && b.move.t <= d.at[1]) {
      const k = d.burst[2] * dt;
      b.x += b.move.dir.x * k; b.z += b.move.dir.z * k;
    }
    if (d.swap && b.move.t >= (d.bounce ?? d.dur * 0.5) && b.hand === b.move.from) b.hand = -b.move.from;
    if (b.move.t >= d.dur) b.move = null;
    clampToCourt(S, b);
    return;
  }
  if (s.phase === "check") { b.moving = false; setNpcClip(b, ball?.holder === id ? "hoop-hold" : t === s.poss ? "hoop-hold" : "hoop-stance"); face(b, ball?.mesh?.position || rim); return; }
  if (s.phase !== "live") { b.moving = false; return; }

  const holder = ball?.holder;
  if (holder === id) {
    // ---- with the ball
    const d = Math.hypot(rim.x - b.x, rim.z - b.z);
    const def = nearestOpp(s, id, t);
    const dd = def ? Math.hypot(def.x - b.x, def.z - b.z) : 99;
    const front = def ? ((def.x - b.x) * (rim.x - b.x) + (def.z - b.z) * (rim.z - b.z)) / (dd * d || 1) > 0.3 : false;
    let goal;
    if (!s.clear) {
      // take it back
      const out = { x: (b.x - rim.x) / (d || 1), z: (b.z - rim.z) / (d || 1) };
      goal = { x: rim.x + out.x * (GAME.clearArc + 0.8), z: rim.z + out.z * (GAME.clearArc + 0.8) };
    } else {
      b.decide -= dt;
      if (b.decide <= 0) {
        b.decide = 0.3 + Math.random() * 0.25;
        const range = style === "handles" ? 7.6 : style === "post" ? 4.2 : style === "dunk" ? 3.2 : 6.4;
        const open = !front || dd > 1.8;
        if (d < 2.4) return startNpcShot(S, s, id, b, style === "dunk" || (skill > 0.7 && open) ? "dunk" : "layup");
        if (d < range && open && Math.random() < 0.55 + 0.3 * skill) return startNpcShot(S, s, id, b, "jumper");
        if (front && dd < 1.5 && Math.random() < 0.35 + 0.5 * skill) return startNpcMove(s, id, b, style);
      }
      // drive at the rim, off the defender's shoulder
      const side = def ? Math.sign((def.x - b.x) * (rim.z - b.z) - (def.z - b.z) * (rim.x - b.x)) || 1 : 0;
      goal = { x: rim.x + side * 0.9, z: rim.z + 1.4 };
    }
    walkTo(S, b, goal, s.clear ? GAME.npcDrive * (0.8 + 0.2 * skill) : GAME.npcSpeed, dt);
    setNpcClip(b, b.moving ? (b.hand > 0 ? "hoop-dribble-r" : "hoop-dribble-l") : "hoop-hold");
    return;
  }
  if (ball?.sim && !ball.holder) {
    // ---- a loose ball: go and get it
    const p = ball.sim.p;
    walkTo(S, b, { x: p[0], z: p[2] }, GAME.npcDrive, dt);
    setNpcClip(b, "hoop-stance");
    const reach = Math.hypot(p[0] - b.x, p[2] - b.z);
    const falling = ball.sim.v[1] < 0.5 || p[1] < 1.6;
    if (reach < 0.9 && falling && p[1] < 2.7 + (b.y || 0) && !(ball.shooter === id && roomNow() - ball.sim.launch.at < 900)) {
      npcTakes(s.ball, id);
      setNpcClip(b, "hoop-grab");
      b.hand = 1;
    } else if (reach < 1.4 && p[1] > 2.2 && p[1] < 3.3 && b.y === 0) { b.vy = 3.6; setNpcClip(b, "hoop-grab"); }
    return;
  }
  if (holder && teamOf(s, holder) !== t) {
    // ---- defence: between him and the rim, a step off, a beat late
    const hp = posOf(holder);
    if (!hp) return;
    const dx = rim.x - hp.x, dz = rim.z - hp.z, n = Math.hypot(dx, dz) || 1;
    const goal = { x: hp.x + dx / n * 1.25, z: hp.z + dz / n * 1.25 };
    b.lag.push({ at: roomNow(), goal });
    while (b.lag.length > 1 && roomNow() - b.lag[1].at > b.react * 1000) b.lag.shift();
    if (b.frozen <= 0) walkTo(S, b, b.lag[0].goal, GAME.npcSpeed * (0.85 + 0.25 * skill), dt);
    else b.moving = false;
    face(b, hp);
    // he's going up: contest it
    const sh = shooterClip(holder);
    if (sh && !G.calm && b.y === 0 && b.frozen <= 0 && Math.hypot(hp.x - b.x, hp.z - b.z) < 2.0) { b.vy = 3.4 + skill; setNpcClip(b, "hoop-block"); b.blockT = 0.6; }
    else if (b.blockT > 0) b.blockT -= dt;
    else setNpcClip(b, "hoop-stance");
    // he made a move: bite, maybe
    const mv = moveClip(holder);
    if (mv && mv !== b.sawMove) { b.sawMove = mv; if (Math.random() < (MOVES[mv]?.brk || 0.5) * (1.1 - skill)) { b.frozen = 0.35 + 0.3 * (1 - skill); showWaveBanner("Ankles!", 600); } }
    if (!mv) b.sawMove = null;
    // a poke
    if (!sh && !G.calm && b.frozen <= 0 && Math.hypot(hp.x - b.x, hp.z - b.z) < 1.25 && Math.random() < dt * 0.4 * skill) {
      setNpcClip(b, "hoop-steal");
      if (Math.random() < 0.28 * skill * (mv ? 0.4 : 1)) {
        const bp = ball.mesh?.position || { x: hp.x, y: 1, z: hp.z };
        npcSteals(s.ball, id, makeLaunch([bp.x, Math.max(0.4, bp.y), bp.z], [(b.x - hp.x) * 1.2, 2.2, (b.z - hp.z) * 1.2], [0, 0, 0], roomNow(), id));
        showWaveBanner(`${nameOf(id)} pokes it loose`, 1000);
      }
    }
    // a block: a ball just up, at his hands
    npcBlock(S, s, id, b);
    return;
  }
  // ---- our ball, someone else has it: get open on the wing
  const C = checkSpots(S);
  walkTo(S, b, C.wing[(s.teams[t].indexOf(id)) % 2], GAME.npcSpeed, dt);
  setNpcClip(b, "hoop-stance");
}
function shooterClip(id) {
  if (id === myId()) return H.shot ? H.shot.kind : null;
  const p = game.net?.peers?.get(id);
  const name = p ? CLIP_IDS[Math.abs(p.hoopMove | 0) - 1] : brains.get(id)?.clip;
  return /jumper|layup|dunk/.test(name || "") ? name : null;
}
function moveClip(id) {
  if (id === myId()) return H.move?.name || null;
  const p = game.net?.peers?.get(id);
  const name = p ? CLIP_IDS[Math.abs(p.hoopMove | 0) - 1] : brains.get(id)?.clip;
  const m = Object.entries(MOVES).find(([, d]) => d.clip === name);
  return m ? m[0] : null;
}
function nearestOpp(s, id, t) {
  let best = null, bd = 1e9;
  const me = posOf(id);
  for (const o of s.teams[1 - t]) {
    const p = posOf(o);
    if (!p) continue;
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function face(b, p) { b.yaw = Math.atan2(-(p.x - b.x), -(p.z - b.z)); }
function walkTo(S, b, goal, speed, dt) {
  const dx = goal.x - b.x, dz = goal.z - b.z, d = Math.hypot(dx, dz);
  if (d < 0.15) { b.moving = false; return; }
  const k = Math.min(d, speed * dt);
  b.x += dx / d * k; b.z += dz / d * k;
  b.moving = true;
  b.yaw = Math.atan2(-dx, -dz);
  clampToCourt(S, b);
}
function clampToCourt(S, b) {
  const [x0, x1, z0] = S.layout.court.lines;
  b.x = Math.max(x0 + 0.2, Math.min(x1 - 0.2, b.x));
  b.z = Math.max(z0 + 0.3, Math.min(S.layout.court.z - 0.2, b.z));
}
function startNpcMove(s, id, b, style) {
  const names = style === "handles" ? ["cross", "behind", "spin", "hesi", "stepback"] : style === "post" ? ["spin", "hesi"] : ["cross", "hesi", "spin"];
  const name = names[Math.floor(Math.random() * names.length)];
  const d = MOVES[name];
  const rim = rimOf(hoopSpots());
  const to = { x: rim.x - b.x, z: rim.z - b.z }, n = Math.hypot(to.x, to.z) || 1;
  const fwd = { x: to.x / n, z: to.z / n }, right = { x: -fwd.z, z: fwd.x };
  const toHand = d.swap ? -b.hand : b.hand;
  const sx = d.burst[0] * toHand, sf = d.burst[1], m = Math.hypot(sx, sf) || 1;
  b.move = { name, def: d, t: 0, from: b.hand, dir: { x: (right.x * sx + fwd.x * sf) / m, z: (right.z * sx + fwd.z * sf) / m } };
  setNpcClip(b, d.clip, b.hand < 0);
}
/* An NPC's shot: the clip, a jump, the ball out at the release, in or not
   by his skill, the distance and the hand in his face. */
function startNpcShot(S, s, id, b, kind) {
  const rim = rimOf(S);
  face(b, rim);
  b.shot = { kind, t: 0, launched: false, from: { x: b.x, z: b.z } };
  setNpcClip(b, kind === "jumper" ? "hoop-jumper" : kind === "layup" ? "hoop-layup" : "hoop-dunk");
  b.moving = false;
}
function npcShoot(S, s, id, b, dt) {
  const sh = b.shot, rim = rimOf(S);
  sh.t += dt;
  const rel = sh.kind === "jumper" ? 0.44 : sh.kind === "layup" ? 0.46 : 0.5;
  if (sh.kind === "jumper" && sh.t >= 0.14 && !sh.jumped) { sh.jumped = true; b.vy = 4.0; }
  if (sh.kind === "layup") { const k = Math.min(1, sh.t / 0.46); b.x = sh.from.x + (rim.x - sh.from.x) * 0.6 * k; b.z = sh.from.z + (rim.z + 0.5 - sh.from.z) * 0.6 * k; if (!sh.jumped) { sh.jumped = true; b.vy = 4.4; } }
  if (sh.kind === "dunk") {
    const k = Math.min(1, sh.t / 0.32), e = k * k * (3 - 2 * k);
    const tx = rim.x, tz = rim.z + 0.55;
    b.x = sh.from.x + (tx - sh.from.x) * e; b.z = sh.from.z + (tz - sh.from.z) * e;
    b.y = sh.t < 0.8 ? Math.max(0, rim.y - 2.25) * Math.sin(e * Math.PI / 2) : b.y;
    b.vy = sh.t >= 0.8 ? -1 : 0;
  }
  if (!sh.launched && sh.t >= rel) {
    sh.launched = true;
    const ball = balls.get(s.ball);
    const n = game.townNpcs.list[npcIndex(id)];
    const pts = Math.hypot(sh.from.x - rim.x, sh.from.z - rim.z) >= HOOPS.arc ? 2 : 1;
    let L;
    if (sh.kind === "dunk") L = makeLaunch([rim.x, rim.y + 0.22, rim.z], [0, -5.5, 0], [0, 0, 0], roomNow(), id);
    else {
      const hp = n?.rig ? handPos(n.rig, 1) : { x: b.x, y: 2.3, z: b.z };
      const from = [hp.x, Math.max(1.8, hp.y), hp.z];
      const d = Math.hypot(rim.x - from[0], rim.z - from[2]);
      const apex = sh.kind === "layup" ? 0.32 + 0.05 * d : 0.6 + 0.14 * d;
      const dx = (rim.x - from[0]) / d, dz = (rim.z - from[2]) / d;
      L = solveShot(courtWorld(S), from, rim, apex, [dz * 18, 0, -dx * 18], roomNow());
      // in, or not: skill, distance, the hand in his face
      const def = nearestOpp(s, id, teamOf(s, id));
      const dd = def ? Math.hypot(def.x - b.x, def.z - b.z) : 9;
      const contest = dd < 1.6 ? (1.6 - dd) / 1.6 : 0;
      const skill = skillOf(id);
      const p = sh.kind === "layup" ? 0.5 + 0.4 * skill - 0.35 * contest : skill * (1.1 - 0.07 * Math.max(0, d - 3)) * (1 - 0.5 * contest);
      const make = Math.random() < Math.max(0.08, Math.min(0.93, p));
      const eff = make ? (Math.random() - 0.5) * 0.4 : (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 1.6);
      if (eff) {
        const k = 1 + 0.011 * eff, yaw = 0.008 * eff * (Math.random() < 0.5 ? -1 : 1), c = Math.cos(yaw), si = Math.sin(yaw);
        L = makeLaunch(L.p, [(L.v[0] * c - L.v[2] * si) * k, L.v[1] * k, (L.v[0] * si + L.v[2] * c) * k], L.w, L.at, id);
      }
    }
    if (ball) setBallLaunch(s.ball, L, { by: id, pts, dunk: sh.kind === "dunk" });
  }
  if (sh.t >= clipLen(b.clip) + 0.05) { b.shot = null; setNpcClip(b, "hoop-stance"); if (sh.kind === "dunk") { b.vy = 0; } }
}
/* An NPC up for a block: a ball just off the shooter's hands, at his. */
function npcBlock(S, s, id, b) {
  if (!(b.y > 0.2)) return;
  const ball = balls.get(s.ball);
  if (!ball?.sim || ball.sim.rest || ball.blocked || ball.pass || teamOf(s, ball.shooter) === teamOf(s, id)) return;
  if (roomNow() - ball.sim.launch.at > 450) return;
  const p = ball.sim.p;
  const hy = (b.y || 0) + 2.45;
  if (Math.hypot(p[0] - b.x, p[2] - b.z) > 0.7 || Math.abs(p[1] - hy) > 0.5) return;
  if (Math.random() > 0.25 + 0.5 * skillOf(id)) { ball.blocked = true; return; }   // got a fingertip on nothing
  const v = ball.sim.v, dx = p[0] - b.x, dz = p[2] - b.z, n = Math.hypot(dx, dz) || 1;
  setBallLaunch(s.ball, makeLaunch(p.slice(), [-v[0] * 0.3 + dx / n * 2.4, -1.4, -v[2] * 0.3 + dz / n * 2.4], [0, 0, 0], roomNow(), id), { by: id, block: true });
  showWaveBanner(`Rejected by ${nameOf(id)}`, 1100);
}

/* ------------------------------------------------- everyone, each frame */

hoopsHooks.onFrame.push((dt, S) => {
  if (!S) {
    if (G.s || G.contest) { for (const id of [...brains.keys(), ...shown.keys()]) releaseNpc(id); G.s = null; G.contest = null; }
    cardHud(null);
    return;
  }
  const s = G.s;
  if (s?.host === myId()) { playerFrame(S, s); if (G.s === s) hostFrame(S, s, dt); }
  else if (s) playerFrame(S, s);
  if (G.contest) contestFrame(S, dt);
  cardHud(G.s);
});
/* A player (not the host) in the game: take the ball at our check, stand
   in front of their checker. */
function playerFrame(S, s) {
  if (s.phase === "done") return;
  const t = teamOf(s, myId());
  if (t < 0) return;
  if (s.phase === "check" && G.lastCheck !== s.checkSeq) {
    G.lastCheck = s.checkSeq;
    const C = checkSpots(S);
    if (s.holder === myId()) { game.move.reset(C.ball.x, C.ball.z, 0.06); if (H.ball !== s.ball) giveBall(s.ball); }
    else if (t !== s.poss && s.teams[t][0] === myId()) game.move.reset(C.def.x, C.def.z, 0.06);
    face2(C.ball, rimOf(S));
  }
}
function face2(from, to) { game.look.yaw = Math.atan2(-(to.x - from.x), -(to.z - from.z)); }

/* ------------------------------------------------------------- the wire */

rpListeners.push((p, m) => {
  if (m.k !== "hg") return;
  if (m.e === "s" && m.g && typeof m.g.id === "string") {
    const g = m.g;
    if (G.s && G.s.host === myId() && G.s.id !== g.id && G.s.phase !== "done") return;   // ours stands
    if (!Array.isArray(g.teams) || !Array.isArray(g.score)) return;
    const was = G.s;
    G.s = g;
    // the NPCs in it: ours to pose from the stream
    for (const id of g.teams.flat()) if (isNpc(id) && !shown.has(id)) { shown.set(id, { x: 0, z: 0, yaw: 0, clip: "hoop-stance", clipAt: roomNow(), mirror: false, hand: 1 }); takeNpc(id); }
    if (g.phase === "done") { for (const id of [...shown.keys()]) releaseNpc(id); G.s = null; }
    if (g.phase === "over" && was?.phase !== "over") showWaveBanner(`${teamName(g, g.winner)} win ${g.score[g.winner]}-${g.score[1 - g.winner]}`, 3000);
    drawGame(g);
  } else if (m.e === "join" && G.s && G.s.host === myId() && G.s.id === m.g && G.s.phase === "wait") {
    G.s.joiners = G.s.joiners || [];
    if (!G.s.joiners.includes(p.id) && G.s.joiners.length < 3) { G.s.joiners.push(p.id); G.s.names[p.id] = nameOf(p.id); publish(true); showWaveBanner(`${p.name || "Someone"} is in`, 1200); }
  } else if (m.e === "n" && G.s && m.g === G.s.id && Array.isArray(m.n)) {
    for (const r of m.n) {
      const id = `npc${r[0] | 0}`;
      const b = shown.get(id) || {};
      Object.assign(b, { x: +r[1], z: +r[2], yaw: +r[3], clip: CLIP_IDS[Math.abs(r[4] | 0) - 1] || "hoop-stance", mirror: r[4] < 0, clipAt: +r[5] || roomNow(), y: +r[6] || 0, moving: !!r[7], hand: r[8] < 0 ? -1 : 1 });
      shown.set(id, b);
      if (!game.townNpcs?.list?.[r[0] | 0]?.override) takeNpc(id);
    }
  }
});

/* ------------------------------------------------- the board, the card */

function drawGame(s) {
  if (!s) return drawBoard("hoops", "HOOPS", [], "Run it to 11");
  const foot = s.phase === "wait" ? "Hold X here to join" : s.phase === "over" || s.phase === "done" ? `${teamName(s, s.winner)} win` : s.phase === "check" ? "Check ball" : !s.clear ? "Take it back" : `To ${s.to}, win by 2`;
  drawBoard("hoops", "HOOPS", [[teamName(s, 0), s.score[0]], [teamName(s, 1), s.score[1]]], foot);
}
let cardEl = null;
function cardHud(s) {
  const mine = s && s.phase !== "wait" && s.phase !== "done";
  if (!mine) { if (cardEl) cardEl.hidden = true; return; }
  if (!cardEl) {
    cardEl = document.createElement("div");
    cardEl.className = "to-hoop-card";
    document.body.appendChild(cardEl);
  }
  cardEl.hidden = false;
  const poss = (t) => (s.poss === t && s.phase !== "over" ? " is-poss" : "");
  const txt = `<span class="to-hoop-card__team${poss(0)}">${esc(teamName(s, 0))}</span><b>${s.score[0]}</b><i>${s.phase === "over" ? "FINAL" : `TO ${s.to}`}</i><b>${s.score[1]}</b><span class="to-hoop-card__team${poss(1)}">${esc(teamName(s, 1))}</span>`;
  if (cardEl._t !== txt) { cardEl._t = txt; cardEl.innerHTML = txt; }
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ------------------------------------------------- the 3-point contest */

/* Five spots round the north hoop's arc (corner, wing, top, wing, corner);
   stand on the ring and a ball's in your hands; five each, the fifth the
   money ball (2); sixty seconds. */
function contestSpots(S) {
  const r = S.layout.rims[1], R = HOOPS.arc + 0.4, [x0, x1] = S.layout.court.lines;
  // the north hoop faces -z: out from it is -z. The corners sit just inside
  // the sidelines, a step up from the baseline (6.1 m out: still a three).
  return [{ x: x0 + 0.45, z: r.z - 0.5 }, { x: r.x - R * Math.SQRT1_2, z: r.z - R * Math.SQRT1_2 }, { x: r.x, z: r.z - R },
    { x: r.x + R * Math.SQRT1_2, z: r.z - R * Math.SQRT1_2 }, { x: x1 - 0.45, z: r.z - 0.5 }];
}
let ringMesh = null;
function startContest(S) {
  const spots = contestSpots(S);
  G.contest = { S, spots, rack: 0, shot: 0, score: 0, t: GAME.contest.secs, ballIds: [], live: null, done: false };
  if (H.ball) { const id = H.ball; dropBall(id); game.net?.publishRp?.({ k: "hb", e: "gone", id }); }
  if (!ringMesh) {
    ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.85, depthWrite: false }));
    ringMesh.rotation.x = -Math.PI / 2;
  }
  game.scene.add(ringMesh);
  game.move.reset(spots[0].x, spots[0].z, 0.06);
  face2(spots[0], S.layout.rims[1]);
  showWaveBanner("3-point contest: 60 s, 25 balls, the 5th of each rack is the money ball", 2600);
}
function contestFrame(S, dt) {
  const c = G.contest;
  if (c.done) return;
  c.t -= dt;
  const spot = c.spots[c.rack];
  ringMesh.position.set(spot.x, 0.07, spot.z);
  ringMesh.material.color.set(c.shot === GAME.contest.per - 1 ? 0xff5a3a : 0xffd23a);
  const on = Math.hypot(game.move.pos.x - spot.x, game.move.pos.z - spot.z) < 0.7;
  // a ball in hand on the spot; the last one shot, the next
  if (!H.ball && !H.shot && on && c.shot < GAME.contest.per) {
    const id = `${myId()}-3pt${++G.seq}`;
    c.ballIds.push({ id, money: c.shot === GAME.contest.per - 1, rack: c.rack, at: performance.now() });
    giveBall(id);
    H.live = true;
  }
  // time, or the last ball down
  const lastBall = c.last && balls.get(c.ballIds.at(-1)?.id);
  if (c.t <= 0 || (c.last && !H.shot && (!lastBall || lastBall.sim?.rest))) finishContest(S);
  // tidy the balls that came to rest
  for (const b of c.ballIds) {
    const ball = balls.get(b.id);
    if (ball?.sim?.rest && performance.now() - b.at > 1500) { dropBall(b.id); game.net?.publishRp?.({ k: "hb", e: "gone", id: b.id }); }
  }
  drawBoard("hoops", "3-POINT CONTEST", [["Score", c.score], ["Time", Math.max(0, Math.ceil(c.t))], ["Rack", `${Math.min(c.rack + 1, 5)}/5`]], c.shot === GAME.contest.per - 1 ? "Money ball" : "");
}
hoopsHooks.onLaunch.push((b) => {
  const c = G.contest;
  if (!c || c.done) return;
  const rec = c.ballIds.find((x) => x.id === b.id);
  if (!rec || rec.shot) return;
  rec.shot = true;
  c.shot++;
  if (c.shot >= GAME.contest.per && c.rack < GAME.contest.racks - 1) { c.rack++; c.shot = 0; showWaveBanner(`Rack ${c.rack + 1}`, 700); }
  else if (c.shot >= GAME.contest.per) c.last = true;
});
hoopsHooks.onScore.push((b, e) => {
  const c = G.contest;
  if (!c || e.hoop !== 1) return;
  const rec = c.ballIds.find((x) => x.id === b.id);
  if (!rec || rec.scored) return;
  rec.scored = true;
  c.score += rec.money ? 2 : 1;
  if (c.last && c.ballIds.every((x) => x.shot)) setTimeout(() => G.contest === c && finishContest(c.S), 600);
});
function finishContest(S) {
  const c = G.contest;
  if (!c || c.done) return;
  c.done = true;
  let best = 0;
  try { best = +localStorage.getItem(GAME.contest.key) || 0; if (c.score > best) localStorage.setItem(GAME.contest.key, String(c.score)); } catch { /* storage off */ }
  showWaveBanner(c.score > best ? `New best: ${c.score} of 30` : `${c.score} of 30 (best ${best})`, 3000);
  drawBoard("hoops", "3-POINT CONTEST", [["Final", c.score], ["Best", Math.max(best, c.score)]], "Hold X on the north side to go again");
  ringMesh?.parent?.remove(ringMesh);
  if (H.ball && c.ballIds.some((x) => x.id === H.ball)) { const id = H.ball; dropBall(id); game.net?.publishRp?.({ k: "hb", e: "gone", id }); }
  setTimeout(() => { if (G.contest === c) G.contest = null; }, 2500);
}

rpExtras.push(gameAction);

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollHoopsGame = {
    GAME, G, brains, shown, roster, ladder, setLadder, startGame: () => hoopSpots() && startGame(hoopSpots()), startContest: () => hoopSpots() && startContest(hoopSpots()),
    check: (t, who) => G.s && check(hoopSpots(), G.s, t, who), finishContest: () => finishContest(hoopSpots()),
    state: () => ({ s: G.s && { id: G.s.id, host: G.s.host, teams: G.s.teams, score: G.s.score, poss: G.s.poss, phase: G.s.phase, clear: G.s.clear, holder: G.s.holder, winner: G.s.winner, last: G.s.last },
      npcs: [...brains.entries()].map(([id, b]) => ({ id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), clip: b.clip, shot: b.shot?.kind || null, frozen: +b.frozen.toFixed(2) })),
      shown: [...shown.keys()], contest: G.contest && { score: G.contest.score, rack: G.contest.rack, shot: G.contest.shot, t: +G.contest.t.toFixed(1), done: G.contest.done } }),
  };
}
