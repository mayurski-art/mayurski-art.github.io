// Troll Forces — the saloon band (BAND.md): the guitar and the trumpet as
// jobs, and the band playing a song together on the room clock.
//
// Take the guitar off Six-String Cisco (or the trumpet off Trumpet Tex) on
// the stage: hold X there. Fire opens its panel (menu/instrument-panel.js):
// chord pads / picked notes on the guitar, the keys with valves on the
// trumpet, sheets at three levels. Hand it back at the same spot.
//
// The band: any musician with a sheet open hits Band. Everyone's client
// plays the song from the same room time (`at`, modes/room-clock.js):
// a part a player holds is theirs to play live (or on Auto), the rest the
// townsfolk play (Piano Pete, Cisco, Tex). Live notes go out stamped with
// the beat the player heard; listeners play the band LAG behind room time
// so those land on their beat.
//
// Wire: `rr` g / t (the job), `bs` `ba` (the song +1 and its room start,
// on the leader's state packet, for late joiners), `bz` (my part's on
// Auto); rp messages {k:"nt"} (a live note) and {k:"band"} (start, stop).

import { game } from "../core/state.js?v=st1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1";
import { atPiano, bar, otherWithRole, piano, putDownDrink, rpExtras, rpListeners, rpSeats, setBarRole } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-nft33-nfh1";
import { peerPosers } from "../net/remote-players.js?v=umb3g-pc1-nf-em1-mi2-wst-ig1-bs1-sb1-cb2-rp1-hf1-sb2-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-jx2-jx3-mb1-mb2-gc1-bt1-nft33-nfh1";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb2-gc1-nft33-nfh1-mg1";
import { localPosers } from "../view/third-person.js?v=tp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-bk1-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mv1-nd2-sp1-hh1-ch1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-tnt1-mb1-mb2-gc1-nft33-nfh1-mg1";
import { touchState } from "../input/touch.js?v=in1-th2-bp1-bf1-pd1-nf1-fs1";
import { roomNow } from "./room-clock.js?v=rc1-cd1-sh1";
import { InstrumentPanel } from "../menu/instrument-panel.js?v=ip1-bw2";
import { GuitarVoice, TrumpetVoice } from "../sound/instrument-voices.js?v=iv1-bw2";
import { PianoVoice } from "./rp-roles.js?v=rp1b7-cd1-sh1-dj2-or1-bw2-sp1-mb1-mb2";
import { holdInstrument, poseInstrument, fpInstrument, hideFpInstrument } from "../characters/instruments.js?v=in1-bw2-fg3-rc1-ls1-ut1-er1-cl1-rb4-rb6-hp1-ht1-bx1-mg1-sp1-mb1-mb2";
import { SONGS, songParts, partEvents } from "../sound/songs.js?v=sg1-bw2";
import { earshot, updateSaloonSound } from "./social-saloon-sound.js?v=ss1-bt1-sp1-mb1-mb2";

export const BAND = {
  takeTime: 0.5,        // hold X at Cisco / Tex: take the instrument, or hand it back
  reach: 1.0,           // m from their spot (the piano stool is 1.45 m from Tex: sitting wins there)
  keysPerSecond: 20,    // live notes on the wire, at most
  lag: 0.4,             // s listeners play the band behind room time (live notes land on the beat)
  countIn: 2.5,         // s from Band to the first beat (4 clicks in it)
  ahead: 0.45,          // s of notes queued ahead
};

/* The two instrument jobs. */
const KINDS = {
  guitar: { role: "guitarist", code: "g", npc: "Guitarist", name: "the guitar", who: "Six-String Cisco" },
  trumpet: { role: "trumpeter", code: "t", npc: "Trumpeter", name: "the trumpet", who: "Trumpet Tex" },
};
const kindOf = (role) => (role === "guitarist" ? "guitar" : role === "trumpeter" ? "trumpet" : null);
const MUSICIANS = new Set(["pianist", "guitarist", "trumpeter"]);

export const band = {
  panels: {},             // kind -> InstrumentPanel (made the first time)
  voices: new Map(),      // "<who>:<kind>" -> a voice (who: "me", a peer id, "npc")
  playAt: 0,              // our last note (the arms busy for a beat)
  sent: [],
  fireWas: false,
  heard: { note: 0, strum: 0, off: 0, band: 0 },
  // the song playing: { s (index), at (room ms of beat 0), leader, spb, beats, end, parts: kind -> { who, ev, next, voice } }
  song: null,
  clicks: 0,
  stopped: null,          // the last song stopped ({ leader, at }): a packet still saying it's on doesn't bring it back
};

const spots = () => (game.isSocial() ? game.builtMap?.map?.rp?.band || null : null);
const now = () => performance.now();
export const myKind = () => kindOf(bar.role);
const near = (p, q, r) => Math.hypot(p.x - q.x, p.z - q.z) < r;

/* ------------------------------------------------------------- the job */

function bandAction() {
  if (!game.isSocial() || !game.player.alive) return null;
  const S = spots();
  if (!S) return null;
  const p = game.move.pos;
  for (const kind of ["guitar", "trumpet"]) {
    const spot = S[kind], K = KINDS[kind];
    if (!near(p, spot, BAND.reach) || Math.abs(p.y - spot.floor) > 1) continue;
    if (bar.role === K.role) {
      return { key: `band:${kind}`, label: `Hand ${K.name} back to ${K.who}`, busy: "Handing it back…", ctx: "Band", time: BAND.takeTime,
        done: () => handBack(`${K.who} has ${K.name} back.`) };
    }
    const other = otherWithRole(K.role);
    if (other) return { key: `band:${kind}`, info: true, label: `${other.name || "Someone"} has ${K.name}` };
    if (bar.role) return { key: `band:${kind}`, info: true, label: "One job at a time" };
    return { key: `band:${kind}`, label: `Take ${K.name} from ${K.who} (${K.role})`, busy: "Taking it…", ctx: "Band", time: BAND.takeTime,
      done: () => {
        if (bar.drink) putDownDrink();
        setBarRole(K.role, `You've got ${K.name}. Fire plays it; sheets and Band are in its panel.`);
        panelOf(kind).open();
      } };
  }
  return null;
}
function handBack(note) {
  const kind = myKind();
  if (kind) band.panels[kind]?.close(true);
  voiceOf("me", kind)?.release?.();
  setBarRole(null, note);
}

/* ----------------------------------------------------------- the panel */

function panelOf(kind) {
  if (band.panels[kind]) return band.panels[kind];
  band.panels[kind] = new InstrumentPanel(kind, {
    mount: game.els.hud,
    isTouch: game.isTouch,
    releaseInputs: () => releaseHeldInputs(),
    lock: () => { if (game.gameState === "playing") game.controls.lock(); },
    unlock: () => game.controls.unlock(),
    banner: (text, ms) => showWaveBanner(text, ms),
    play: (ev) => playLocal(kind, ev),
    onStand: () => handBack(`${KINDS[kind].who} has ${KINDS[kind].name} back.`),
    standLabel: "Hand it back",
    band: bandHooks(kind),
  });
  return band.panels[kind];
}
/* The piano's panel gets the band too (social-rp.js makes it; we hook it). */
export function bandHooks(kind) {
  return {
    running: () => runningFor(),
    start: (s) => startBand(s),
    stop: () => stopBand(true),
    isLeader: () => band.song?.leader === game.net.id,
    auto: () => !!game.net.bandAuto,
    setAuto: (on) => { game.net.bandAuto = on ? 1 : 0; },
    kind,
  };
}

/* A note from our panel: heard here now; on the wire unless it's "Hear it". */
function playLocal(kind, ev) {
  const v = voiceOf("me", kind, true);
  if (!v) return;
  const vel = ev.vel ?? 0.8;
  if (kind === "guitar") {
    if (ev.type === "strum") v.strum(ev.midis, ev.up, null, vel, ev.dur ?? null);
    else if (ev.type === "note") v.pluck(ev.midi, null, vel, ev.dur ?? null);
  } else {
    if (ev.type === "off") v.release(ev.midi);
    else if (ev.type === "note") (ev.preview ? v.note(ev.midi, null, ev.dur ?? 0.5, vel) : v.hold(ev.midi, vel));
  }
  if (ev.preview) return;
  band.playAt = now();
  const t = now();
  band.sent = band.sent.filter((x) => t - x < 1000);
  if (ev.type !== "off" && band.sent.length >= BAND.keysPerSecond) return;
  if (ev.type !== "off") band.sent.push(t);
  const m = { k: "nt", i: KINDS[kind].code };
  if (ev.type === "strum") { m.c = ev.midis.slice(0, 6); if (ev.up) m.u = 1; }
  else m.n = ev.midi;
  if (ev.type === "off") m.off = 1;
  const b = beatNow();
  if (b != null) m.b = Math.round(b * 1000) / 1000;   // the beat we heard it on
  game.net.publishRp(m);
}

/* ---------------------------------------------------------------- voices */

/* `who`'s voice for `kind`: "me", a peer id, or "npc". */
function voiceOf(who, kind, make = false) {
  if (!kind) return null;
  const key = `${who}:${kind}`;
  let v = band.voices.get(key);
  if (!v && make) {
    const at = whereIs(who, kind) || { x: 0, y: 1.5, z: 0 };
    v = kind === "guitar" ? new GuitarVoice(game.audio, at) : kind === "trumpet" ? new TrumpetVoice(game.audio, at) : new PianoVoice(game.audio, at);
    band.voices.set(key, v);
  }
  return v || null;
}
/* Where `who` plays `kind` from. */
function whereIs(who, kind) {
  if (kind === "piano") {
    const s = rpSeats()?.find((x) => x.kind === "piano");
    return s ? { x: s.x, y: s.y + 0.6, z: s.z } : null;
  }
  if (who === "me") return { x: game.move.pos.x, y: game.move.pos.y + 1.5, z: game.move.pos.z };
  if (who === "npc") {
    const S = spots()?.[kind];
    return S ? { x: S.x, y: S.floor + 1.5, z: S.z } : null;
  }
  const rp = game.remotes.byId.get(who);
  return rp ? { x: rp.pos.x, y: rp.pos.y + 1.5, z: rp.pos.z } : null;
}
/* How loud from where the camera is (on top of the panner's own falloff):
   the saloon's walls between us count (social-saloon-sound.js). */
const nearGain = (at) => earshot(at);

/* ---------------------------------------------------------------- the room */

function onMessage(p, m) {
  if (game.isBotPeer(p)) return;
  if (m.k === "band") { onBandMessage(p, m); return; }
  if (m.k !== "nt") return;
  const kind = m.i === "g" ? "guitar" : m.i === "t" ? "trumpet" : null;
  if (!kind || p.role !== KINDS[kind].role) return;
  const t = now();
  if (!m.off) {
    p.ntSent = (p.ntSent || []).filter((x) => t - x < 1000);
    if (p.ntSent.length >= BAND.keysPerSecond) return;
    p.ntSent.push(t);
  }
  p.ntAt = t;   // their arms busy (the poser); (p.bandAt is their song's start, net.js)
  const v = voiceOf(p.id, kind, true);
  if (!v) return;
  // with a song on, a stamped note plays on its beat (LAG behind room time)
  const when = whenFor(m.b);
  if (kind === "guitar") {
    const ok = (x) => Number.isFinite(x) && x >= 28 && x <= 96;
    if (Array.isArray(m.c)) { const c = m.c.filter(ok).slice(0, 6); if (c.length) { v.strum(c, !!m.u, when); band.heard.strum++; } }
    else if (ok(m.n)) { v.pluck(m.n, when); band.heard.note++; }
  } else {
    if (!Number.isFinite(m.n) || m.n < 36 || m.n > 96) return;
    if (m.off) { v.release(m.n); band.heard.off++; } else { v.hold(m.n); band.heard.note++; }
  }
}

/* --------------------------------------------------------------- the band */

/* The beat of the song playing as we hear it (null: no song). */
export function beatNow() {
  const S = band.song;
  if (!S) return null;
  return ((roomNow() - S.at) / 1000 - myLag()) / S.spb;
}
/* Musicians play along with what they hear at once; listeners hear the band
   a little late, so live notes from the stage land on their beat. */
const myLag = () => (MUSICIANS.has(bar.role) ? 0 : BAND.lag);
/* AudioContext time for a live note stamped with beat `b` (null: now). */
function whenFor(b) {
  const S = band.song, a = game.audio;
  if (!S || b == null || !Number.isFinite(+b) || !a?.ctx) return null;
  const tRoom = S.at + (+b * S.spb + myLag()) * 1000;
  const dt = (tRoom - roomNow()) / 1000;
  return dt > 0.01 && dt < 2 ? a.ctx.currentTime + dt : null;
}
function runningFor() {
  const S = band.song;
  return S ? { song: S.s, beat: beatNow(), beats: S.beats, leader: S.leader } : null;
}

function startBand(s, at = roomNow() + BAND.countIn * 1000, leader = game.net.id, quiet = false) {
  const song = SONGS[s];
  if (!song) return;
  stopBand(false);
  const P = songParts(song);
  const spb = 60 / song.bpm;
  band.song = { s, at, leader, spb, beats: P.beats, end: at + (P.beats * spb + 1.5) * 1000, parts: {} };
  band.clicks = 0;
  for (const kind of ["piano", "guitar", "trumpet"]) band.song.parts[kind] = { who: null, ev: partEvents(song, kind), next: 0 };
  if (piano.playing && atPiano()) piano.playing = false;   // the house tune gives way
  if (leader === game.net.id) {
    game.net.bandSong = s + 1; game.net.bandAt = at;
    game.net.publishRp({ k: "band", e: "start", s, at });
  }
  if (!quiet) showWaveBanner(`The band: ${song.name}`, 2200);
}
function stopBand(send) {
  const S = band.song;
  if (!S) return;
  if (send && S.leader === game.net.id) game.net.publishRp({ k: "band", e: "stop" });
  if (S.leader === game.net.id) { game.net.bandSong = 0; game.net.bandAt = 0; }
  for (const P of Object.values(S.parts)) P.voice?.release?.();
  band.stopped = { leader: S.leader, at: S.at };
  band.song = null;
  for (const n of game.townNpcs?.list || []) n.playing = false;
}
function onBandMessage(p, m) {
  if (!MUSICIANS.has(p.role)) return;
  if (m.e === "start" && Number.isInteger(m.s) && SONGS[m.s] && Number.isFinite(+m.at)) {
    if (Math.abs(+m.at - roomNow()) > 15000) return;   // a stale start
    band.heard.band++;
    startBand(m.s, +m.at, p.id);
  } else if (m.e === "stop" && band.song?.leader === p.id) stopBand(false);
}

/* Who plays each part: a player holding it (if they've Auto on, their part
   plays itself from where they are; if not, they play it live), else its
   townsman. */
function partPlayer(kind) {
  const role = kind === "piano" ? "pianist" : KINDS[kind].role;
  if (bar.role === role) return game.net.bandAuto ? "me" : "live";
  for (const p of game.net.peers.values()) if (!game.isBotPeer(p) && p.role === role) return p.bandAuto ? p.id : "live";
  const npcRole = kind === "piano" ? "Pianist" : KINDS[kind].npc;
  const npc = game.townNpcs?.list.find((n) => n.c.role === npcRole);
  return npc && !npc.off ? "npc" : null;
}

/* Each frame: queue the next notes of every part someone plays here. */
function stepBand() {
  const S = band.song, a = game.audio;
  // a late joiner (or a dropped start): pick the song up off a musician's packet
  if (!S) {
    for (const p of game.net.peers.values()) {
      if (game.isBotPeer(p) || !p.bandSong || !MUSICIANS.has(p.role) || !SONGS[p.bandSong - 1]) continue;
      if (band.stopped && band.stopped.leader === p.id && band.stopped.at === p.bandAt) continue;   // stopped; their packet hasn't caught up
      const song = SONGS[p.bandSong - 1], end = p.bandAt + (songParts(song).beats * 60 / song.bpm + 1) * 1000;
      if (roomNow() < end) { startBand(p.bandSong - 1, p.bandAt, p.id, true); break; }
    }
    return;
  }
  if (roomNow() > S.end) { stopBand(false); return; }
  if (S.leader !== game.net.id && !game.net.peers.has(S.leader)) { stopBand(false); return; }
  const lag = myLag();
  const nowRoom = roomNow();
  // who plays what doesn't wait on our speakers (no sound yet: keep the place)
  const sound = !!a?._ready?.();
  // the count-in: four clicks before beat 0
  while (sound && band.clicks < 4) {
    const tClick = S.at + ((band.clicks - 4) * S.spb + lag) * 1000;
    if (tClick > nowRoom + BAND.ahead * 1000) break;
    if (tClick > nowRoom - 50) a._tone({ freq: band.clicks === 0 ? 1600 : 1200, duration: 0.04, gain: 0.05, type: "square", delay: Math.max(0, (tClick - nowRoom) / 1000) });
    band.clicks++;
  }
  for (const kind of ["piano", "guitar", "trumpet"]) {
    const P = S.parts[kind];
    const who = partPlayer(kind);
    if (who !== P.who) { P.voice?.release?.(); P.who = who; P.voice = null; }
    // the townsman's arms busy while his part's on
    const npcRole = kind === "piano" ? "Pianist" : KINDS[kind].npc;
    const npc = game.townNpcs?.list.find((n) => n.c.role === npcRole);
    if (npc) npc.playing = who === "npc" && nowRoom > S.at;
    if (!who || who === "live" || !sound) { skipTo(P, S, nowRoom, lag); continue; }
    const at = whereIs(who, kind);
    P.voice = P.voice || voiceOf(who === "me" ? "me" : who, kind, true);
    const v = P.voice;
    if (!v) continue;
    const gain = nearGain(at);
    if (v.move) v.move(at, gain);
    else if (v.out) v.out.gain.setTargetAtTime(gain, a.ctx.currentTime, 0.1);
    if (gain <= 0.001) { skipTo(P, S, nowRoom, lag); continue; }
    while (P.next < P.ev.length) {
      const e = P.ev[P.next];
      const tRoom = S.at + (e.at * S.spb + lag) * 1000;
      if (tRoom > nowRoom + BAND.ahead * 1000) break;
      P.next++;
      if (tRoom < nowRoom - 30) continue;   // gone by
      const when = a.ctx.currentTime + Math.max(0, (tRoom - nowRoom) / 1000), dur = e.beats * S.spb;
      if (kind === "piano") {
        if (!v.out) { v.start(); v.out.gain.value = gain; }
        for (const m of e.midis) v.note(m, when, dur, e.vel);
      } else if (kind === "guitar") {
        if (e.strum) v.strum(e.midis, e.strum === "U", when, e.vel, dur * 0.95);
        else for (const m of e.midis) v.pluck(m, when, e.vel, dur);
      } else for (const m of e.midis) v.note(m, when, dur, e.vel);
    }
  }
}
/* A part nobody here sounds: keep its place. */
function skipTo(P, S, nowRoom, lag) {
  while (P.next < P.ev.length && S.at + (P.ev[P.next].at * S.spb + lag) * 1000 < nowRoom + BAND.ahead * 1000) P.next++;
}

/* ------------------------------------------------------------ each frame */

/* How busy someone's hands look: a beat after a note, or their part on. */
const busyK = (at) => Math.max(0, Math.min(1, 1 - (now() - (at || 0)) / 700));

export function updateBand(dt) {
  const S = spots();
  const kind = myKind();
  if (!S) {
    if (kind) handBack(null);
    if (band.song) stopBand(false);
    holdInstrument(game.localRig, null);
    updateSaloonSound(false);
    return;
  }
  // our hands: an instrument means no drink
  if (kind && bar.drink) { putDownDrink(); showWaveBanner(`Your hands are full: ${KINDS[kind].name}`, 1400); }
  if (!kind) { game.net.bandAuto = 0; for (const k of ["guitar", "trumpet"]) band.panels[k]?.close(true); }
  // fire opens the panel (as fire plays the piano)
  const fireNow = !game.localPauseOnly && !game.emoteWheel.isOpen && (game.mouseDown || (game.isTouch && touchState.firing) || (game.gamepadState.connected && game.gamepadState.firing));
  if (kind && fireNow && !band.fireWas && game.player.alive && !panelOf(kind).isOpen) panelOf(kind).open();
  band.fireWas = fireNow;
  // our own voice follows us
  const me = whereIs("me");
  for (const k of ["guitar", "trumpet"]) voiceOf("me", k)?.move(me, 1);
  // other players' voices follow them; gone or off the job, they stop
  for (const [key, v] of band.voices) {
    const [who, k] = key.split(":");
    if (who === "me" || who === "npc") continue;
    const p = game.net.peers.get(who);
    const keep = p && (k === "piano" ? p.role === "pianist" : p.role === KINDS[k]?.role);
    if (!keep) { v.stop(); band.voices.delete(key); continue; }
    if (k !== "piano") v.move?.(whereIs(who, k), nearGain(whereIs(who, k)));
    // a held trumpet note whose key-up got lost
    if (k === "trumpet" && v.sounding != null && now() - (p.ntAt || 0) > 4000) v.release();
  }
  stepBand();
  // Pete on his own between songs, and the room's murmur
  updateSaloonSound(!!band.song);
}

/* Our body, third person (view/third-person.js localPosers). */
function poseLocal(rig) {
  const kind = game.isSocial() ? myKind() : null;
  holdInstrument(rig, kind);
  if (kind) poseInstrument(rig, now() / 1000, Math.max(busyK(band.playAt), band.song && game.net.bandAuto ? 0.8 : 0));
}
/* First person: the instrument in view and the hands on it (view/fp-emote.js). */
export function bandArms() {
  const kind = game.isSocial() ? myKind() : null;
  const parent = game.streakArms?.userData.arms[0].hand.parent;
  if (!kind || !parent) { hideFpInstrument(); return null; }
  const f = fpInstrument(kind, parent, now() / 1000, Math.max(busyK(band.playAt), band.song && game.net.bandAuto ? 0.8 : 0));
  return f ? { ...f, gun: false, cam: { pitch: 0, yaw: 0 }, social: true, instrument: true } : null;
}
export { hideFpInstrument };

/* ------------------------------------------------------------- hook up */

rpExtras.push(bandAction);
// the piano is the band's too: its panel gets Band/Auto, its live keys the beat
piano.bandHooks = bandHooks("piano");
piano.bandBeat = () => (band.song ? beatNow() : null);
piano.bandWhen = (b) => whenFor(b);
rpListeners.push(onMessage);
localPosers.push(poseLocal);
// everyone else's instrument, in their hands
peerPosers.push((rp) => {
  const kind = game.isSocial() ? kindOf(rp.peer?.role) : null;
  holdInstrument(rp.rig, kind);
  if (kind) poseInstrument(rp.rig, now() / 1000 + (rp.peer.id?.length || 0), Math.max(busyK(rp.peer.ntAt), band.song && rp.peer.bandAuto ? 0.8 : 0));
});

if (typeof window !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollBand = {
    BAND, band, KINDS, SONGS,
    panel: (k) => panelOf(k), beatNow, startBand, stopBand: () => stopBand(true), partPlayer,
    audioOn: () => { game.audio.init?.(); game.audio.resume?.(); return game.audio.ctx?.state || null; },
    voices: () => [...band.voices.keys()],
    state: () => ({ role: bar.role, kind: myKind(), song: band.song && { s: band.song.s, at: band.song.at, leader: band.song.leader, beat: beatNow(), parts: Object.fromEntries(Object.entries(band.song.parts).map(([k, P]) => [k, { who: P.who, next: P.next }])) },
      heard: { ...band.heard }, auto: game.net.bandAuto, holding: game.localRig?.instrument?.userData.kind || null }),
  };
}
