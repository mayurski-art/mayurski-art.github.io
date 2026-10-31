// Troll Royale: the match report while you spectate (user, 2026-10-29: "if
// they died and are spectating since the match hasn't ended they should also
// be able to see the summary, scoreboard map even if its happening in real
// time"). The after-action report's three tabs (modes/after-action.js), live:
//   SUMMARY    where you went out, how many are left, the storm, your guns and
//              your numbers so far.
//   SCOREBOARD the Tab board as it stands.
//   MAP        the plan of the side being played (view/aar-blueprint.js, drawn
//              the first time the tab opens), your kills, deaths and assists,
//              and over them the storm's circle, the next one and everyone
//              still standing (the one you're watching ringed and named).
//              After the flip, the side you started on too (royale-worlds.js).
// Everything redraws once a second while it's open. Opened from the spectate
// bar's button, M, or the pad's Y; Esc, M, Y, the close button or a click
// outside the card goes back to watching. royale.js wires it (initRoyale) and
// closes it when the match ends (teardownRoyale).

import { weaponsHtml, statsHtml, loadThumbs, weaponName, teamHtml } from "./after-action.js?v=aar1-bp2-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hd1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-tw1-rt2-mmd1-rd1-fd1-rx1-op1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-rw1-wb1";
import { matchWeaponReport } from "../progression/weapon-xp.js?v=wx1";
import { matchLog } from "../combat/match-log.js?v=ml1-bp2";
import { mountBlueprint } from "../view/aar-blueprint.js?v=bp1-rw1-wb1";
import { captureBlueprint } from "../view/blueprint-capture.js?v=bc1-rw1-wb1";
import { sideName } from "./royale-worlds.js?v=rw1-wb1";
import { squadCard } from "./royale-squad-end.js?v=se1-wb1";
import { padHooks } from "../input/gamepad.js?v=in1-fu1b7-wb1-th2-ar1-ar2-cl1-bp1-fj1-zr10-zc1-zc2-zp1-aa0-pd1-nf1-or1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-spd1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1";
import { game } from "../core/state.js?v=st1";

const REFRESH_MS = 1000;
const TABS = ["summary", "board", "map"];

let ctx = null;          // { royale(), alive(), ordinal(n) } from royale.js
let el = null, timer = 0, tab = "summary", relock = false;
let maps = [], mapsKey = "";   // the Map tab's plans, and which sides they're of

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* Out of this match and it's still going: the report can open. */
export function canOpenLiveReport() {
  const r = ctx?.royale();
  return !!r && r.live && !r.over && !game.player.alive && game.gameState === "playing";
}
export const liveReportOpen = () => !!el && !el.hidden;

export function toggleLiveReport() {
  if (liveReportOpen()) closeLiveReport();
  else openLiveReport();
}

export function openLiveReport() {
  if (!canOpenLiveReport()) return false;
  build();
  el.hidden = false;
  // the pointer, for the tabs (menu/buttons.js leaves the pause menu shut for this)
  relock = !!game.controls?.isLocked;
  if (relock) game.controls.unlock();
  selectTab(tab);
  refresh();
  clearInterval(timer);
  timer = setInterval(refresh, REFRESH_MS);
  el.querySelector(".to-live-card")?.focus({ preventScroll: true });   // (into the dialog, no tab ringed)
  return true;
}

export function closeLiveReport() {
  clearInterval(timer);
  timer = 0;
  if (!el || el.hidden) return;
  el.hidden = true;
  // back to watching with the mouse, if that's how it was opened
  if (relock && game.gameState === "playing") { try { game.controls.lock(); } catch {} }
  relock = false;
}

/* royale.js initRoyale: the match's state, and the spectate bar's button. */
export function initLiveReport(c) {
  ctx = c;
  const bar = game.els.spectate;
  if (bar && !bar.querySelector(".to-spectate-report")) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "to-spectate-report";
    b.innerHTML = `Match report <kbd>M</kbd>`;
    b.setAttribute("aria-label", "Open the match report: summary, scoreboard and map, live");
    b.addEventListener("click", () => openLiveReport());
    bar.appendChild(b);
  }
  // before the game's own keys (input/keyboard-mouse.js): M opens and shuts
  // it, and Esc shuts it rather than opening the pause menu
  window.addEventListener("keydown", (e) => {
    if (e.repeat || game.chat?.isTyping || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "")) return;
    if (e.code === "KeyM" && (liveReportOpen() || canOpenLiveReport())) { e.preventDefault(); e.stopImmediatePropagation(); toggleLiveReport(); return; }
    if (!liveReportOpen()) return;
    if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeLiveReport(); }
  }, { capture: true });
  // the pad (input/gamepad.js): Y opens and shuts it, the bumpers go between
  // the tabs while it's open, B shuts it
  padHooks.royaleReport = {
    open: liveReportOpen, can: canOpenLiveReport, toggle: toggleLiveReport, close: closeLiveReport,
    tab: (dir) => selectTab(TABS[(TABS.indexOf(tab) + dir + TABS.length) % TABS.length]),
  };
}

/* ------------------------------------------------------------ building */

function build() {
  if (el?.isConnected) return;
  el = document.createElement("div");
  el.className = "to-live-report";
  el.hidden = true;
  el.innerHTML = `
    <section class="to-aar to-live-card" tabindex="-1" role="dialog" aria-modal="true" aria-label="Match report, live">
      <header class="to-aar-head">
        <button type="button" class="to-live-close" aria-label="Close the match report">✕</button>
        <div class="to-aar-result"><span class="to-live-pill">Live</span> Match report</div>
        <div class="to-aar-score to-live-out"></div>
        <div class="to-aar-meta to-live-meta"></div>
      </header>
      <div class="to-aar-tabs" role="tablist" aria-label="Match report">
        <button type="button" role="tab" class="to-aar-tab" data-tab="summary" id="to-live-tab-summary">Summary</button>
        <button type="button" role="tab" class="to-aar-tab" data-tab="board" id="to-live-tab-board">Scoreboard</button>
        <button type="button" role="tab" class="to-aar-tab" data-tab="map" id="to-live-tab-map">Map</button>
      </div>
      <section class="to-aar-pane" data-pane="summary" role="tabpanel" aria-labelledby="to-live-tab-summary"></section>
      <section class="to-aar-pane" data-pane="board" role="tabpanel" aria-labelledby="to-live-tab-board" hidden>
        <div class="to-aar-board"></div>
      </section>
      <section class="to-aar-pane" data-pane="map" role="tabpanel" aria-labelledby="to-live-tab-map" hidden></section>
      <p class="to-live-hint">Esc or M to go back to watching</p>
    </section>`;
  // next to the spectate bar, in the HUD (it scales with it)
  (game.els.spectate?.parentElement || document.body).appendChild(el);
  el.querySelector(".to-live-close").addEventListener("click", closeLiveReport);
  el.addEventListener("click", (e) => { if (e.target === el) closeLiveReport(); });
  // clicks in here aren't the spectator's next/previous
  el.addEventListener("mousedown", (e) => e.stopPropagation());
  el.querySelectorAll(".to-aar-tab").forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));
  maps = []; mapsKey = "";
}

function selectTab(t) {
  tab = t;
  if (!el) return;
  for (const b of el.querySelectorAll(".to-aar-tab")) b.setAttribute("aria-selected", String(b.dataset.tab === t));
  for (const p of el.querySelectorAll(".to-aar-pane")) p.hidden = p.dataset.pane !== t;
  refresh();
  if (t === "map") requestAnimationFrame(() => requestAnimationFrame(() => { for (const m of maps) m.bp.draw(); }));
}

/* ------------------------------------------------------------ the match, now */

function refresh() {
  if (!liveReportOpen()) return;
  const r = ctx?.royale();
  // the match ended (or we're somehow back in it): the end's report takes over
  if (!r || r.over || game.player.alive || game.gameState !== "playing") { closeLiveReport(); return; }
  const alive = ctx.alive();
  const s = r.zone.state(r.t);
  const out = r.lateJoin ? "Joined mid-match" : ctx.outLine ? ctx.outLine(alive) : `Eliminated — ${ctx.ordinal(r.place || alive.length + 1)} of ${r.peak}`;
  const watching = r.spectate ? ` · watching ${r.spectate.name}` : "";
  const zone = s.stage === "final" ? "Final circle" : s.stage === "closing" ? `Zone ${s.phase} closing ${clock(s.left)}` : `Zone ${s.phase} · closes in ${clock(s.left)}`;
  setText(".to-live-out", `${out}${watching}`);
  setText(".to-live-meta", `${alive.length} alive · ${zone} · ${sideName(game.loadedMapId)} · ${clock(game.player.matchT)}`);
  if (tab === "summary") summary();
  else if (tab === "board") board();
  else map(r, alive);
}

function setText(sel, text) {
  const n = el.querySelector(sel);
  if (n && n.textContent !== text) n.textContent = text;
}

function stats() {
  const p = game.player;
  return {
    score: p.matchScore, kills: p.kills, deaths: p.deaths, assists: p.assists || 0,
    headshots: p.headshots || 0, bestStreak: p.bestStreak || 0, seconds: p.matchT,
    shotsFired: p.shotsFired || 0, shotsHit: p.shotsHit || 0,
  };
}

let summaryKey = "";
function summary() {
  const pane = el.querySelector('[data-pane="summary"]');
  const kills = game.player.weaponKills || {};
  // the bars where they stand now (the end's report moves them from where they began)
  const weapons = matchWeaponReport().map((w) => ({ ...w, before: w.after, kills: kills[w.id] | 0 }));
  // in teams: the team, how many each of you has, who's still standing (royale-squad-end.js)
  const team = squadCard(ctx?.royale());
  const html = teamHtml(team) + weaponsHtml(weapons) + statsHtml(stats());
  const key = JSON.stringify([weapons.map((w) => [w.id, w.after, w.kills]), stats(), team]);
  if (key === summaryKey && pane.childElementCount) return;
  summaryKey = key;
  pane.innerHTML = html;
  loadThumbs(pane, weapons);
}

function board() {
  game.renderScoreboard?.();
  const html = game.els.scoreboard?.innerHTML || "<p class='to-aar-empty'>No scoreboard yet.</p>";
  const box = el.querySelector(".to-aar-board");
  if (box.innerHTML !== html) box.innerHTML = html;
}

/* ------------------------------------------------------------ the map */

function countOf(events) {
  const c = { kill: 0, death: 0, assist: 0 };
  for (const e of events) c[e.kind]++;
  return c;
}

/* The sides to show: the one being played now, live; after the flip, the
   one you started on before it, as it was. */
function sides(r) {
  const now = { id: game.loadedMapId, live: true };
  const w = r.worlds?.[0];
  return w && w.id !== now.id ? [{ id: w.id, w }, now] : [now];
}

function eventsFor(side, r) {
  const w = r.worlds?.[0];
  if (!w || w.id === game.loadedMapId) return matchLog.events.slice();
  return matchLog.events.filter((e) => side.live ? (e.t || 0) > w.untilT : (e.t || 0) <= w.untilT);
}

function map(r, alive) {
  const pane = el.querySelector('[data-pane="map"]');
  const list = sides(r);
  const key = list.map((s) => s.id).join("|");
  liveAlive = alive;
  if (key !== mapsKey) mountMaps(pane, list, r);
  for (const m of maps) {
    const ev = eventsFor(m.side, r);
    m.bp.setEvents(ev, countOf(ev), game.player.matchT);
    const b = pane.querySelector(`.to-aar-world[data-world="${m.i}"] small`);
    if (b) b.textContent = `${m.side.live ? "Now" : "Before the flip"} · ${countOf(ev).kill} kill${countOf(ev).kill === 1 ? "" : "s"}`;
  }
}

let liveAlive = [];
function mountMaps(pane, list, r) {
  mapsKey = list.map((s) => s.id).join("|");
  const sel = list.length - 1;
  pane.innerHTML = (list.length > 1 ? `<div class="to-aar-worlds" role="group" aria-label="Side of the island">${list.map((s, i) => `
      <button type="button" class="to-aar-world" data-world="${i}" aria-pressed="${i === sel}"><span>${esc(sideName(s.id))}</span><small></small></button>`).join("")}</div>` : "")
    + list.map((s, i) => `<div class="to-aar-map" data-world="${i}"${i === sel ? "" : " hidden"}></div>`).join("");
  maps = list.map((side, i) => {
    const w = side.w;
    const bp = mountBlueprint(pane.querySelector(`.to-aar-map[data-world="${i}"]`), {
      mapName: sideName(side.id), modeName: "Troll Royale · live",
      arena: w ? w.arena : { ...game.ARENA }, colliders: w ? w.colliders : game.colliders,
      events: [], counts: countOf([]), seconds: game.player.matchT, weaponName,
      capture: w ? w.capture?.finish() || null : r.liveBp?.id === side.id ? r.liveBp.bp : null,
      overlay: side.live ? drawLive : null,
    });
    return { i, side, bp };
  });
  pane.querySelectorAll(".to-aar-world").forEach((b) => b.addEventListener("click", () => {
    const i = Number(b.dataset.world);
    for (const x of pane.querySelectorAll(".to-aar-world")) x.setAttribute("aria-pressed", String(Number(x.dataset.world) === i));
    for (const m of pane.querySelectorAll(".to-aar-map")) m.hidden = Number(m.dataset.world) !== i;
    requestAnimationFrame(() => { for (const m of maps) m.bp.draw(); });
  }));
  // the side being played, drawn once a match per side (about a second's
  // render: after the tab has painted, so the click answers first)
  const live = maps.find((m) => m.side.live);
  if (live && r.liveBp?.id !== live.side.id) {
    setTimeout(() => {
      const rr = ctx?.royale();
      if (!rr || !liveReportOpen() || game.loadedMapId !== live.side.id) return;
      const wall = rr.visual?.group, shown = wall?.visible;
      if (wall) wall.visible = false;
      const bp = captureBlueprint({ renderer: game.renderer, scene: game.scene, colliders: game.colliders, arena: game.ARENA, floorY: 0, events: [] });
      if (wall) wall.visible = shown;
      if (!bp) return;
      rr.liveBp = { id: live.side.id, bp };
      live.bp.setCapture(bp);
    }, 120);
  }
}

/* Over the live side's plan: the storm (outside the circle tinted), the next
   circle dashed, everyone still standing, the one you're watching named. */
function drawLive(g, P, M, inner) {
  const r = ctx?.royale();
  if (!r) return;
  const s = r.zone.state(r.t);
  const rad = (x, z, rr) => Math.abs(P(x + rr, z)[0] - P(x, z)[0]);
  const [cx, cy] = P(s.x, s.z), cr = rad(s.x, s.z, s.r);
  g.save();
  g.beginPath(); g.rect(M, M, inner, inner); g.clip();
  g.beginPath();
  g.rect(M, M, inner, inner);
  g.arc(cx, cy, cr, 0, Math.PI * 2, true);
  g.fillStyle = "rgba(168,84,230,.16)";
  g.fill("evenodd");
  g.lineWidth = 2; g.strokeStyle = "rgba(197,140,255,.95)";
  g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.stroke();
  if (s.next) {
    const [nx, ny] = P(s.next.x, s.next.z);
    g.setLineDash([5, 4]); g.lineWidth = 1.4; g.strokeStyle = "rgba(255,255,255,.85)";
    g.beginPath(); g.arc(nx, ny, rad(s.next.x, s.next.z, s.next.r), 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
  }
  const watched = r.spectate?.id;
  for (const a of liveAlive) {
    if (!a.pos) continue;
    const [x, y] = P(a.pos.x, a.pos.z);
    const on = a.id === watched;
    g.beginPath(); g.arc(x, y, on ? 5 : 3.5, 0, Math.PI * 2);
    g.fillStyle = on ? "#7dff4a" : "#ffffff"; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = "rgba(6,17,31,.9)"; g.stroke();
    if (on) {
      g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.strokeStyle = "rgba(125,255,74,.8)"; g.lineWidth = 1.5; g.stroke();
      g.font = "600 11px 'DM Mono', monospace"; g.textAlign = "left"; g.textBaseline = "middle";
      const label = String(a.name || "");
      const w = g.measureText(label).width + 8;
      g.fillStyle = "rgba(6,17,31,.85)"; g.fillRect(x + 12, y - 8, w, 16);
      g.fillStyle = "#c9ffb0"; g.fillText(label, x + 16, y);
    }
  }
  g.restore();
}

/* Tests (tools/troll-ops-royale-live-report-test.mjs). */
if (/[?&]tohooks=/.test(location.search)) {
  window.__trollLiveReport = { open: openLiveReport, close: closeLiveReport, toggle: toggleLiveReport, isOpen: liveReportOpen, can: canOpenLiveReport, tab: selectTab };
}
