/* ============================================================================
   WHACK A TROLL — leaderboard CONFIG for the shared arcade engine.
   game.js reports finished rounds via:
       TrollLeaderboard.record("whack-a-troll", { score })
   Ranked on best single-round score.
   ============================================================================ */
(() => {
  "use strict";
  const LB = window.TrollLeaderboard;
  if (!LB) { console.warn("[whack-a-troll] leaderboard engine not loaded"); return; }

  LB.register({
    gameId: "whack-a-troll",
    gameName: "Whack a Troll",
    mount: "#lb-root",

    blank: () => ({ rounds: 0, bestScore: 0 }),
    reduce: (you, ev) => {
      you.rounds = (you.rounds || 0) + 1;
      const s = +ev.score || 0;
      if (s > (you.bestScore || 0)) you.bestScore = s;
    },

    columns: [
      { key: "bestScore", label: "Best score", align: "num", accent: "green" },
      { key: "rounds",    label: "Rounds",     align: "num", accent: "muted", hideSm: true },
    ],
    rankBy: ["bestScore", "rounds"],

    player: {
      dotColor: () => "#4dff73",
      sublabel: e => (e.rounds ? "Best " + (e.bestScore || 0) : "No rounds yet"),
    },

    footNote: "Highest single 45-second round wins. Resets every Monday.",

    prizes: {
      poolLabel: "Mock prize pool · Whack a Troll",
      pool: "250 USDC  +  500K $TROLL",
    },
  });
})();
