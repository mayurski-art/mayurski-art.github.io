// Troll Forces after-action report: the Call of Duty results screen, for PvP.
//
// Three tabs under the result banner:
//   SUMMARY    the rank card (level, the XP bar moving from where the match
//              began to where it ended, a level-up when it crosses), the guns
//              used this match with their own level bars (weapon-xp.js), and
//              the stat grid (score, K/D/A, accuracy, headshots, streak, time).
//   SCOREBOARD the Tab board (core/scoreboard.js), as the match ended.
//   MAP        the level as an architect's plan (view/aar-blueprint.js over
//              view/blueprint-capture.js), with every kill, death and assist
//              of yours where it happened (combat/match-log.js), the line of
//              the shot, filters, a heat view and a timeline to play it back.
// match-end.js hands it the numbers (renderAfterAction) and hides it again
// when the next match loads (hideAfterAction). Ops and Zombies runs keep the
// plain results card.

import { WEAPON_DEFS } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1";
import { weaponProgress, WEAPON_MAX_LEVEL } from "../progression/weapon-xp.js?v=wx1";
import { playerIconSvg } from "../progression/rank-icons.js?v=rk1-or1";
import { gunThumb } from "../view/zombies-thumbs.js?v=zc1-zc2-zp1-sr1-br1-or1-rt1-ut1-rb4-hp1-bx1-mg1-tm2-tx1-sp1-kbt1-gb1-pm1-kbk2-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1";
import { renderScoreboard } from "../core/scoreboard.js?v=sb1-gj1-if1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-aa0-rs1-kc1-dj2-bf1-pd1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3";
import { MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1-kb0-kb1-kb2-kb3-cl1-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-tcs2-mg1-kb12-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb3-jb6-sp1-hh1-yb1-kbt1-gb1-gb3-rh1-gb4-tb1-gb5-gb7-gb8-gb9-tb2-bl1-kbb1-kbb2-dj2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-tfp1-tfp2-tfp3-tfp4-tfp7-tfb8-tfs1-ss1-ta1-ss2-ss3-ta2-tfm2-rfx1-rm1-kzf1";
import { mountBlueprint } from "../view/aar-blueprint.js?v=bp1";
import { game } from "../core/state.js?v=st1";

const CLASS_NAMES = {
  assault: "Assault rifle", carbine: "Carbine", pdw: "SMG", battle: "Battle rifle",
  sniper: "Sniper rifle", lmg: "LMG", shotgun: "Shotgun", sidearm: "Pistol", launcher: "Launcher",
};
const MAX_WEAPON_CARDS = 4;
const BAR_MS = 900;   // one bar's fill, matching .to-aar-fill's transition

const root = () => document.getElementById("to-aar");

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const fmt = (n) => (Number(n) || 0).toLocaleString();
function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------ building */

/* `d`: everything the screen shows, gathered by match-end.js (see
   afterActionData there). Pure DOM: nothing here touches game state. */
export function renderAfterAction(d) {
  const el = root();
  if (!el) return;
  el.hidden = false;
  plainCard(false);
  pendingCapture = null; captureJob = null;   // the last match's plan is not this one's
  el.dataset.result = d.won ? "won" : d.won === false ? "lost" : "";

  const scoreLine = d.ffa
    ? `${fmt(d.stats.kills)} kills`
    : `<span class="to-aar-team" style="color:${esc(d.teams.mine.color)}">${esc(d.teams.mine.name)} <b>${fmt(d.teams.mine.score)}</b></span>`
      + `<span class="to-aar-vs">—</span>`
      + `<span class="to-aar-team" style="color:${esc(d.teams.theirs.color)}"><b>${fmt(d.teams.theirs.score)}</b> ${esc(d.teams.theirs.name)}</span>`;

  el.innerHTML = `
    <header class="to-aar-head">
      <div class="to-aar-result">${esc(d.title)}</div>
      <div class="to-aar-score">${scoreLine}</div>
      <div class="to-aar-meta">${esc(d.modeName)} · ${esc(d.mapName)} · ${clock(d.stats.seconds)}</div>
    </header>
    <div class="to-aar-tabs" role="tablist" aria-label="After-action report">
      <button type="button" role="tab" class="to-aar-tab" data-tab="summary" aria-selected="true" id="to-aar-tab-summary">Summary</button>
      <button type="button" role="tab" class="to-aar-tab" data-tab="board" aria-selected="false" id="to-aar-tab-board">Scoreboard</button>
      <button type="button" role="tab" class="to-aar-tab" data-tab="map" aria-selected="false" id="to-aar-tab-map">Map</button>
    </div>
    <section class="to-aar-pane" data-pane="summary" role="tabpanel" aria-labelledby="to-aar-tab-summary">
      ${rankCardHtml(d.rank)}
      ${weaponsHtml(d.weapons)}
      ${statsHtml(d.stats)}
    </section>
    <section class="to-aar-pane" data-pane="board" role="tabpanel" aria-labelledby="to-aar-tab-board" hidden>
      <div class="to-aar-board">${d.boardHtml || "<p class='to-aar-empty'>No scoreboard for this match.</p>"}</div>
    </section>
    <section class="to-aar-pane" data-pane="map" role="tabpanel" aria-labelledby="to-aar-tab-map" hidden>
      <div class="to-aar-map"></div>
    </section>`;

  blueprint = mountBlueprint(el.querySelector(".to-aar-map"), {
    mapName: d.mapName, modeName: d.modeName, arena: d.arena, colliders: d.colliders,
    events: d.events, counts: d.counts, seconds: d.stats.seconds, capture: pendingCapture,
    weaponName: (id) => WEAPON_DEFS[id]?.name || id,
  });
  el.querySelectorAll(".to-aar-tab").forEach((b) => b.addEventListener("click", () => selectTab(el, b.dataset.tab)));
  animateRank(el, d.rank);
  animateWeapons(el, d.weapons);
  loadThumbs(el, d.weapons);
}

export function hideAfterAction() {
  const el = root();
  if (el) { el.hidden = true; el.innerHTML = ""; }
  blueprint = null; pendingCapture = null; captureJob = null;
  clearTimeout(captureTimer);
  plainCard(true);
}

/* The map tab's plan of the level (view/blueprint-capture.js). The render is
   about a second's work, so it waits until the bars have finished moving, or
   until the Map tab is opened, whichever comes first; match-end.js queues it
   once the match is cleared away (no bots in the shot) and the map is still
   loaded. */
let blueprint = null, pendingCapture = null, captureJob = null, captureTimer = 0;
const CAPTURE_DELAY = 2600;

export function queueBlueprint(job) {
  captureJob = job;
  clearTimeout(captureTimer);
  captureTimer = setTimeout(runCapture, CAPTURE_DELAY);
}

function runCapture() {
  clearTimeout(captureTimer);
  const job = captureJob;
  captureJob = null;
  if (!job) return;
  const bp = job();
  if (!bp) return;
  pendingCapture = bp;
  blueprint?.setCapture(bp);
}

/* The plain results card's three stats and XP line: shown for Ops and Zombies
   runs, folded away under the report (which has them). The level-up line
   keeps whatever match-end.js set. */
function plainCard(show) {
  for (const sel of [".to-go-stats", "#to-go-xp"]) {
    const n = document.querySelector(sel);
    if (n) n.hidden = !show;
  }
  const rank = document.getElementById("to-go-rank");
  if (rank && !show) rank.hidden = true;
}

function selectTab(el, tab) {
  for (const b of el.querySelectorAll(".to-aar-tab")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  for (const p of el.querySelectorAll(".to-aar-pane")) p.hidden = p.dataset.pane !== tab;
  // drawn now, and again once the tab's layout has settled (a scrollbar can come or go)
  if (tab === "map") { runCapture(); blueprint?.draw(); requestAnimationFrame(() => requestAnimationFrame(() => blueprint?.draw())); }
}

/* ------------------------------------------------------------ rank */

function rankCardHtml(r) {
  const up = r.levelAfter > r.levelBefore;
  return `
    <div class="to-aar-rank">
      <div class="to-aar-rank-icon">${playerIconSvg(r.levelBefore, r.prestige, 56)}</div>
      <div class="to-aar-rank-body">
        <div class="to-aar-rank-row">
          <span class="to-aar-label">Level</span>
          <strong class="to-aar-level">${r.levelBefore}</strong>
          <span class="to-aar-gain">+${fmt(r.gained)} XP${r.boosted ? " · +10% veteran bots" : ""}</span>
        </div>
        <div class="to-aar-bar"><i class="to-aar-fill" style="width:${Math.round(r.fracBefore * 100)}%"></i></div>
        <div class="to-aar-rank-foot">
          <span class="to-aar-xptext">${esc(r.xpText || "")}</span>
          <span class="to-aar-levelup" ${up ? "" : "hidden"}>Level up — LV ${r.levelAfter}</span>
        </div>
      </div>
    </div>`;
}

/* The bar fills from where the match began to where it ended; a level
   crossed fills to the end, snaps back and fills on, and the number ticks. */
function animateRank(el, r) {
  const fill = el.querySelector(".to-aar-rank .to-aar-fill");
  const level = el.querySelector(".to-aar-level");
  const icon = el.querySelector(".to-aar-rank-icon");
  if (!fill) return;
  const levels = Math.max(0, r.levelAfter - r.levelBefore);
  let step = 0;
  const run = () => {
    if (step < levels) {
      fill.style.width = "100%";
      step++;
      setTimeout(() => {
        fill.classList.add("is-snap");
        fill.style.width = "0%";
        level.textContent = String(r.levelBefore + step);
        icon.innerHTML = playerIconSvg(r.levelBefore + step, r.prestige, 56);
        requestAnimationFrame(() => requestAnimationFrame(() => { fill.classList.remove("is-snap"); run(); }));
      }, BAR_MS + 60);
    } else {
      fill.style.width = `${Math.round(r.fracAfter * 100)}%`;
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}

/* ------------------------------------------------------------ weapons */

function weaponsHtml(list) {
  const cards = list.slice(0, MAX_WEAPON_CARDS);
  if (!cards.length) return `<div class="to-aar-weapons"><p class="to-aar-empty">No gun kills this match.</p></div>`;
  return `<div class="to-aar-weapons">${cards.map((w) => {
    const def = WEAPON_DEFS[w.id];
    const before = weaponProgress(w.id, w.before);
    return `
      <div class="to-aar-gun" data-weapon="${esc(w.id)}">
        <div class="to-aar-gun-pic"><span class="to-aar-gun-ph">${esc(def?.name || w.id)}</span></div>
        <div class="to-aar-gun-body">
          <div class="to-aar-gun-row">
            <span class="to-aar-gun-name">${esc(def?.name || w.id)}</span>
            <span class="to-aar-gun-cls">${esc(CLASS_NAMES[def?.cls] || "")}</span>
          </div>
          <div class="to-aar-gun-row">
            <span class="to-aar-label">LVL</span><strong class="to-aar-gun-level">${before.level}</strong>
            <span class="to-aar-gain">+${fmt(w.gained)} WXP</span>
            <span class="to-aar-gun-kills">${fmt(w.kills)} kill${w.kills === 1 ? "" : "s"}</span>
          </div>
          <div class="to-aar-bar is-gun"><i class="to-aar-fill" style="width:${Math.round(before.frac * 100)}%"></i></div>
          <span class="to-aar-gun-up" hidden>Weapon level up</span>
        </div>
      </div>`;
  }).join("")}</div>`;
}

function animateWeapons(el, list) {
  for (const w of list.slice(0, MAX_WEAPON_CARDS)) {
    const card = el.querySelector(`.to-aar-gun[data-weapon="${w.id}"]`);
    if (!card) continue;
    const fill = card.querySelector(".to-aar-fill");
    const lvl = card.querySelector(".to-aar-gun-level");
    const up = card.querySelector(".to-aar-gun-up");
    const before = weaponProgress(w.id, w.before), after = weaponProgress(w.id, w.after);
    let step = 0;
    const levels = after.level - before.level;
    const run = () => {
      if (step < levels) {
        fill.style.width = "100%";
        step++;
        setTimeout(() => {
          fill.classList.add("is-snap");
          fill.style.width = "0%";
          lvl.textContent = String(before.level + step);
          up.hidden = false;
          up.textContent = before.level + step >= WEAPON_MAX_LEVEL ? "Max level" : `Weapon level up — LVL ${before.level + step}`;
          requestAnimationFrame(() => requestAnimationFrame(() => { fill.classList.remove("is-snap"); run(); }));
        }, BAR_MS + 60);
      } else {
        fill.style.width = `${Math.round(after.frac * 100)}%`;
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }
}

/* The gun's picture, drawn from its model (view/zombies-thumbs.js); the name
   stands in until it lands, or for good where there's no WebGL for it. */
function loadThumbs(el, list) {
  for (const w of list.slice(0, MAX_WEAPON_CARDS)) {
    gunThumb(w.id).then((url) => {
      const pic = el.querySelector(`.to-aar-gun[data-weapon="${w.id}"] .to-aar-gun-pic`);
      if (!url || !pic) return;
      const img = document.createElement("img");
      img.src = url; img.alt = ""; img.draggable = false;
      pic.replaceChildren(img);
    }).catch(() => {});
  }
}

/* ------------------------------------------------------------ stats */

function statsHtml(s) {
  const kd = (s.kills / Math.max(1, s.deaths)).toFixed(2);
  const acc = s.shotsFired > 0 ? `${Math.round((s.shotsHit / s.shotsFired) * 100)}%` : "—";
  const rows = [
    ["Score", fmt(s.score)], ["Kills", fmt(s.kills)], ["Deaths", fmt(s.deaths)], ["Assists", fmt(s.assists)],
    ["K/D", kd], ["Accuracy", acc], ["Headshots", fmt(s.headshots)], ["Best streak", fmt(s.bestStreak)],
  ];
  return `<div class="to-aar-stats">${rows.map(([k, v]) => `<div><strong>${v}</strong><span>${k}</span></div>`).join("")}</div>`;
}

/* ------------------------------------------------------------ the data */

/* What match-end.js hands renderAfterAction, from the match as it stands.
   `rank` is the XP bar's before and after, caught around addXp. */
export function afterActionData({ title, won, rank, boostedXp }) {
  const mode = game.currentMode();
  const p = game.player;
  const myTeam = game.net.team;
  const theirs = myTeam === "phantom" ? "ghost" : "phantom";
  const teamColor = (t) => (t === "phantom" ? "#7fd1e0" : "#f5b82e");
  renderScoreboard();
  const kills = p.weaponKills || {};
  const weapons = rank.weapons.map((w) => ({ ...w, kills: kills[w.id] | 0 }));
  return {
    title, won, ffa: !!mode.ffa,
    modeName: mode.name || game.modeId,
    mapName: MAPS[game.loadedMapId]?.name || game.loadedMapId || "",
    teams: {
      mine: { name: game.teamName(myTeam), score: game.teamScores[myTeam] ?? 0, color: teamColor(myTeam) },
      theirs: { name: game.teamName(theirs), score: game.teamScores[theirs] ?? 0, color: teamColor(theirs) },
    },
    rank: { ...rank, boosted: !!boostedXp },
    weapons,
    stats: {
      score: p.matchScore, kills: p.kills, deaths: p.deaths, assists: p.assists || 0,
      headshots: p.headshots || 0, bestStreak: p.bestStreak || 0, seconds: p.matchT,
      shotsFired: p.shotsFired || 0, shotsHit: p.shotsHit || 0,
    },
    boardHtml: game.els.scoreboard?.innerHTML || "",
    counts: rank.counts,
    events: rank.events,
    arena: { ...game.ARENA },
    colliders: game.colliders,
  };
}

/* Tests (tools/troll-ops-aar-test.mjs) render a made-up match. */
if (/[?&]tohooks=/.test(location.search)) {
  window.__trollAar = { renderAfterAction, hideAfterAction, queueBlueprint, blueprint: () => blueprint };
}
