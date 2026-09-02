/* ============================================================================
   TROLL RACER — leaderboard CONFIG for the shared arcade engine.

   The engine (assets/js/troll-leaderboard.js) does all the work; this file only
   describes Troll Racer's stats. game.js feeds finished races via:
       TrollLeaderboard.record("troll-racer", { bestLap, position, win, laps })

   Ranked on fastest lap first — it's a racing game, the clock is the truth.
   ============================================================================ */
(() => {
  "use strict";
  const LB = window.TrollLeaderboard;
  if (!LB) { console.warn("[troll-racer] leaderboard engine not loaded"); return; }

  const fmtLap = (s) => {
    if (!s || s <= 0 || s >= 9999) return "--:--.---";
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec.toFixed(3);
  };

  LB.register({
    gameId: "troll-racer",
    gameName: "Troll Racer",
    // auto-mounts the weekly board into the page section below the cabinet;
    // without this the engine registers the game but never renders anything.
    mount: "#lb-root",

    blank: () => ({ races: 0, wins: 0, podiums: 0, bestLap: 0, lapRank: 0 }),
    reduce: (you, ev) => {
      you.races = (you.races || 0) + 1;
      you.wins = (you.wins || 0) + (ev.win ? 1 : 0);
      if (ev.position && ev.position <= 3) you.podiums = (you.podiums || 0) + 1;
      const lap = +ev.bestLap || 0;
      // fastest lap wins, so keep the MINIMUM non-zero time
      if (lap > 0 && (!you.bestLap || lap < you.bestLap)) you.bestLap = lap;
      // The engine ranks DESCENDING and sends rankBy[0] to the backend as the
      // row's sortable score, so store the negated lap time: bigger = faster.
      // Kept on the aggregate (not just in derive) so the backend sorts right.
      you.lapRank = you.bestLap > 0 ? -you.bestLap : -999999;
    },

    columns: [
      { key: "bestLap", label: "Best lap", align: "num", accent: "green",
        format: v => fmtLap(v) },
      { key: "wins",    label: "Wins",    align: "num", accent: "gold" },
      { key: "races",   label: "Races",   align: "num", accent: "muted", hideSm: true },
    ],
    // Ranked ascending by lap time via the negated `lapRank` (see reduce).
    // derive() recomputes it so rows written before this field existed, and
    // rows coming back from the backend, still sort correctly.
    rankBy: ["lapRank", "wins", "races"],
    derive: e => ({ lapRank: e.bestLap > 0 ? -e.bestLap : -999999 }),

    player: {
      dotColor: () => "#4dff73",
      sublabel: e => (e.races ? "Best " + fmtLap(e.bestLap) : "No races yet"),
    },

    footNote: "Fastest lap around the trollface wins. Resets every Monday.",

    prizes: {
      poolLabel: "Mock prize pool · Troll Racer",
      pool: "500 USDC  +  1M $TROLL",
    },
  });
})();
