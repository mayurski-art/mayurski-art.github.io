/* ============================================================================
   WHACK A TROLL — 9-hole reflex game.
   Trollfaces pop up out of holes on a 3x3 board; click/tap them before they
   duck back down. Round is 45s, speed ramps up as score climbs.
   ============================================================================ */
(() => {
  "use strict";

  const ROUND_SECONDS = 45;
  const HOLE_COUNT = 9;

  const els = {
    board: document.getElementById("wt-board"),
    score: document.getElementById("wt-score"),
    time: document.getElementById("wt-time"),
    combo: document.getElementById("wt-combo"),
    strikes: document.getElementById("wt-strikes"),
    start: document.getElementById("wt-start-overlay"),
    startBtn: document.getElementById("wt-start-btn"),
    blitzBtn: document.getElementById("wt-blitz-btn"),
    results: document.getElementById("wt-results-overlay"),
    finalScore: document.getElementById("wt-final-score"),
    finalSub: document.getElementById("wt-final-sub"),
    againBtn: document.getElementById("wt-again-btn"),
  };

  const holes = [];
  let score = 0;
  let combo = 0;
  let timeLeft = ROUND_SECONDS;
  let running = false;
  let spawnTimer = null;
  let tickTimer = null;
  let activeCount = 0;
  let blitz = false;
  const MAX_ACTIVE = 3;

  function buildBoard() {
    els.board.innerHTML = "";
    for (let i = 0; i < HOLE_COUNT; i++) {
      const hole = document.createElement("div");
      hole.className = "wt-hole";
      hole.tabIndex = 0;
      hole.setAttribute("role", "button");
      hole.setAttribute("aria-label", "Whack the troll");
      hole.innerHTML =
        '<div class="wt-mound"></div>' +
        '<div class="wt-troll">' +
          '<img class="wt-char-troll" src="assets/pfp/base/og.webp" alt="" aria-hidden="true">' +
          '<img class="wt-char-pepe" src="assets/games/whack-a-troll/art/pepe-stand.png" alt="" aria-hidden="true">' +
        '</div>';
      hole.addEventListener("pointerdown", () => whack(i));
      hole.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          whack(i);
        }
      });
      els.board.appendChild(hole);
      holes.push(hole);
    }
  }

  const PEPE_CHANCE = 0.28;
  const MAX_STRIKES = 3;
  let strikes = 0;

  function freeHoleIndex() {
    const free = [];
    for (let i = 0; i < HOLE_COUNT; i++) {
      if (holes[i].dataset.live !== "1") free.push(i);
    }
    if (!free.length) return -1;
    return free[Math.floor(Math.random() * free.length)];
  }

  function popSpeedMs() {
    // Starts slow, ramps down as score climbs. Blitz mode runs the whole
    // curve faster and bottoms out lower.
    const floor = blitz ? 280 : 500;
    const start = blitz ? 650 : 1100;
    const decay = Math.min(score * (blitz ? 4 : 6), start - floor);
    return start - decay;
  }

  function scheduleNextSpawn() {
    if (!running) return;
    const base = blitz ? 110 : 220;
    const span = blitz ? 140 : 260;
    const delay = base + Math.random() * span;
    spawnTimer = setTimeout(() => {
      if (activeCount < MAX_ACTIVE) {
        const idx = freeHoleIndex();
        if (idx >= 0) showCharacter(idx);
      }
      scheduleNextSpawn();
    }, delay);
  }

  function showCharacter(idx) {
    if (!running) return;
    const hole = holes[idx];
    const isPepe = Math.random() < PEPE_CHANCE;
    hole.classList.remove("is-hit", "is-missed");
    hole.classList.toggle("is-pepe", isPepe);
    hole.dataset.pepe = isPepe ? "1" : "0";
    hole.dataset.live = "1";
    activeCount += 1;

    const upTime = popSpeedMs();
    hole.dataset.timer = setTimeout(() => {
      if (hole.dataset.live === "1") {
        hole.dataset.live = "0";
        hole.classList.remove("is-up");
        activeCount -= 1;
        if (!isPepe) {
          hole.classList.add("is-missed");
          combo = 0;
          updateHud();
          setTimeout(() => hole.classList.remove("is-missed"), 400);
        }
      }
    }, upTime);

    // Separate frame so the "is-up" transition always runs from a clean state.
    requestAnimationFrame(() => hole.classList.add("is-up"));
  }

  function whack(idx) {
    if (!running) return;
    const hole = holes[idx];
    if (hole.dataset.live !== "1") return;

    hole.dataset.live = "0";
    clearTimeout(Number(hole.dataset.timer));
    hole.classList.remove("is-up");
    activeCount -= 1;

    if (hole.dataset.pepe === "1") {
      hole.classList.add("is-strike");
      setTimeout(() => hole.classList.remove("is-strike", "is-pepe"), 300);
      strikes += 1;
      combo = 0;
      updateHud();
      if (strikes >= MAX_STRIKES) {
        endRound(true);
        return;
      }
      return;
    }

    hole.classList.add("is-hit");
    setTimeout(() => hole.classList.remove("is-hit"), 300);

    combo += 1;
    const points = 10 + Math.min(combo - 1, 10) * 2;
    score += points;
    showScorePop(hole, points);
    updateHud();
  }

  function showScorePop(hole, points) {
    const pop = document.createElement("div");
    pop.className = "wt-score-pop";
    pop.textContent = "+" + points;
    hole.appendChild(pop);
    setTimeout(() => pop.remove(), 600);
  }

  function updateHud() {
    els.score.textContent = score;
    els.combo.textContent = combo > 1 ? "x" + combo : "";
    els.time.textContent = timeLeft;
    els.time.classList.toggle("wt-time-low", timeLeft <= 10);
    els.strikes.textContent = "•".repeat(strikes) + "◦".repeat(MAX_STRIKES - strikes);
  }

  function startRound(isBlitz) {
    blitz = !!isBlitz;
    score = 0;
    combo = 0;
    strikes = 0;
    activeCount = 0;
    timeLeft = blitz ? Math.round(ROUND_SECONDS * 0.6) : ROUND_SECONDS;
    running = true;
    holes.forEach((h) => {
      h.classList.remove("is-up", "is-hit", "is-missed", "is-pepe", "is-strike");
      h.dataset.live = "0";
      h.dataset.pepe = "0";
    });
    document.body.classList.toggle("wt-blitz", blitz);
    updateHud();

    els.start.hidden = true;
    els.results.hidden = true;

    scheduleNextSpawn();
    tickTimer = setInterval(() => {
      timeLeft -= 1;
      updateHud();
      if (timeLeft <= 0) endRound(false);
    }, 1000);
  }

  function endRound(struckOut) {
    running = false;
    clearTimeout(spawnTimer);
    clearInterval(tickTimer);
    holes.forEach((h) => {
      clearTimeout(Number(h.dataset.timer));
      h.classList.remove("is-up", "is-hit", "is-missed", "is-pepe", "is-strike");
      h.dataset.live = "0";
    });

    els.finalScore.textContent = score;
    els.finalSub.textContent = struckOut
      ? "Three Pepes whacked. Game over."
      : score >= 400 ? "Certified troll exterminator." :
        score >= 200 ? "Solid whacking. They fear you." :
        "The trolls barely noticed.";
    els.results.hidden = false;

    if (window.TrollLeaderboard) {
      window.TrollLeaderboard.record("whack-a-troll", { score, blitz });
    }
  }

  buildBoard();
  els.startBtn.addEventListener("click", () => startRound(false));
  if (els.blitzBtn) els.blitzBtn.addEventListener("click", () => startRound(true));
  els.againBtn.addEventListener("click", () => startRound(blitz));
})();
