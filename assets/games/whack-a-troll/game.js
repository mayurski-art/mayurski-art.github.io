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
    start: document.getElementById("wt-start-overlay"),
    startBtn: document.getElementById("wt-start-btn"),
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
  let popTimer = null;
  let tickTimer = null;
  let activeHole = null;

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
        '<div class="wt-troll"><img src="assets/pfp/base/og.webp" alt="" aria-hidden="true"></div>';
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

  function randomHoleIndex(excludeIndex) {
    let idx;
    do {
      idx = Math.floor(Math.random() * HOLE_COUNT);
    } while (idx === excludeIndex && HOLE_COUNT > 1);
    return idx;
  }

  function popSpeedMs() {
    // Starts slow (~1000ms up-time), ramps down to ~450ms as score climbs.
    const floor = 450;
    const start = 1000;
    const decay = Math.min(score * 8, start - floor);
    return start - decay;
  }

  function scheduleNextPop() {
    if (!running) return;
    const delay = 260 + Math.random() * 320;
    popTimer = setTimeout(() => {
      const idx = randomHoleIndex(activeHole);
      showTroll(idx);
    }, delay);
  }

  function showTroll(idx) {
    if (!running) return;
    const hole = holes[idx];
    activeHole = idx;
    hole.classList.remove("is-hit", "is-missed");
    hole.classList.add("is-up");
    hole.dataset.live = "1";

    const upTime = popSpeedMs();
    hole.dataset.timer = setTimeout(() => {
      if (hole.dataset.live === "1") {
        hole.dataset.live = "0";
        hole.classList.remove("is-up");
        hole.classList.add("is-missed");
        combo = 0;
        updateHud();
        setTimeout(() => hole.classList.remove("is-missed"), 400);
      }
      activeHole = null;
      scheduleNextPop();
    }, upTime);
  }

  function whack(idx) {
    if (!running) return;
    const hole = holes[idx];
    if (hole.dataset.live !== "1") return;

    hole.dataset.live = "0";
    clearTimeout(Number(hole.dataset.timer));
    hole.classList.remove("is-up");
    hole.classList.add("is-hit");
    setTimeout(() => hole.classList.remove("is-hit"), 300);

    combo += 1;
    const points = 10 + Math.min(combo - 1, 10) * 2;
    score += points;
    showScorePop(hole, points);
    updateHud();

    if (activeHole === idx) activeHole = null;
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
  }

  function startRound() {
    score = 0;
    combo = 0;
    timeLeft = ROUND_SECONDS;
    running = true;
    activeHole = null;
    holes.forEach((h) => h.classList.remove("is-up", "is-hit", "is-missed"));
    updateHud();

    els.start.hidden = true;
    els.results.hidden = true;

    scheduleNextPop();
    tickTimer = setInterval(() => {
      timeLeft -= 1;
      updateHud();
      if (timeLeft <= 0) endRound();
    }, 1000);
  }

  function endRound() {
    running = false;
    clearTimeout(popTimer);
    clearInterval(tickTimer);
    holes.forEach((h) => {
      clearTimeout(Number(h.dataset.timer));
      h.classList.remove("is-up", "is-hit", "is-missed");
      h.dataset.live = "0";
    });

    els.finalScore.textContent = score;
    els.finalSub.textContent =
      score >= 400 ? "Certified troll exterminator." :
      score >= 200 ? "Solid whacking. They fear you." :
      "The trolls barely noticed.";
    els.results.hidden = false;

    if (window.TrollLeaderboard) {
      window.TrollLeaderboard.record("whack-a-troll", { score });
    }
  }

  buildBoard();
  els.startBtn.addEventListener("click", startRound);
  els.againBtn.addEventListener("click", startRound);
})();
