/* Troll Ops — weekly leaderboard config.
   Uses the shared arcade engine (assets/js/troll-leaderboard.js); see
   assets/games/LEADERBOARD.md. Prizes are display-only mock — the engine
   enforces live:false. game.js reports one event per run (death or quit).
   Score rewards wave reached first, kills second. */
(() => {
  const LB = window.TrollLeaderboard;
  if (!LB) return;

  LB.register({
    gameId: "troll-ops",
    gameName: "Troll Ops",

    blank: () => ({ score: 0, bestWave: 0, bestKills: 0, runs: 0 }),
    reduce: (you, ev) => {
      you.score = Math.max(you.score, ev.score || 0);
      you.bestWave = Math.max(you.bestWave, ev.wave || 0);
      you.bestKills = Math.max(you.bestKills, ev.kills || 0);
      you.runs += 1;
    },

    columns: [
      { key: "bestWave", label: "Best wave", align: "num", accent: "green" },
      { key: "bestKills", label: "Best kills", align: "num", accent: "gold" },
      { key: "runs", label: "Runs", align: "num", accent: "muted", hideSm: true },
    ],
    rankBy: ["score"],

    player: { dotColor: () => "#7fe066", sublabel: () => "operator" },

    mockRival: (rng) => {
      const bestWave = 1 + Math.floor(rng() * 12);
      const bestKills = bestWave * (8 + Math.floor(rng() * 10));
      const score = bestWave * 10000 + bestKills * 10;
      return { score, bestWave, bestKills, runs: 1 + Math.floor(rng() * 8) };
    },

    prizes: { poolLabel: "Mock prize pool · Troll Ops", pool: "100 USDC + 1M $TROLL" },
  });
})();
