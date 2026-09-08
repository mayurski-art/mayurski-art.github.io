/* Troll Ops — weekly leaderboard config.
   Uses the shared arcade engine (assets/js/troll-leaderboard.js); see
   assets/games/LEADERBOARD.md. Prizes are display-only mock — the engine
   enforces live:false. game.js reports one event per run: solo Ops runs carry
   a wave, PvP matches carry kills, deaths and whether you won. */
(() => {
  const LB = window.TrollLeaderboard;
  if (!LB) return;

  LB.register({
    gameId: "troll-ops",
    gameName: "Troll Ops",

    blank: () => ({
      score: 0, bestWave: 0, bestKills: 0, runs: 0,
      pvpKills: 0, pvpDeaths: 0, pvpWins: 0, matches: 0, kd: 0,
    }),

    reduce: (you, ev) => {
      if (ev.pvp) {
        you.pvpKills += ev.kills || 0;
        you.pvpDeaths += ev.deaths || 0;
        you.pvpWins += ev.won ? 1 : 0;
        you.matches += 1;
      } else {
        you.bestWave = Math.max(you.bestWave, ev.wave || 0);
        you.runs += 1;
      }
      you.bestKills = Math.max(you.bestKills, ev.kills || 0);
      you.kd = Math.round((you.pvpKills / Math.max(1, you.pvpDeaths)) * 100) / 100;
      // One ladder across both playlists: deep Ops runs and PvP both count.
      you.score = you.bestWave * 10000
        + you.bestKills * 10
        + you.pvpKills * 40
        + you.pvpWins * 2500;
    },

    columns: [
      { key: "bestWave", label: "Best wave", align: "num", accent: "green" },
      { key: "pvpKills", label: "PvP kills", align: "num", accent: "gold" },
      { key: "kd", label: "K/D", align: "num", accent: "muted" },
      { key: "pvpWins", label: "Wins", align: "num", accent: "muted", hideSm: true },
    ],
    rankBy: ["score"],

    player: { dotColor: () => "#7fe066", sublabel: () => "operator" },

    mockRival: (rng) => {
      const bestWave = 1 + Math.floor(rng() * 12);
      const bestKills = bestWave * (8 + Math.floor(rng() * 10));
      const pvpKills = Math.floor(rng() * 90);
      const pvpDeaths = 1 + Math.floor(rng() * 70);
      const pvpWins = Math.floor(rng() * 6);
      return {
        bestWave, bestKills, pvpKills, pvpDeaths, pvpWins,
        matches: pvpWins + Math.floor(rng() * 8),
        runs: 1 + Math.floor(rng() * 8),
        kd: Math.round((pvpKills / Math.max(1, pvpDeaths)) * 100) / 100,
        score: bestWave * 10000 + bestKills * 10 + pvpKills * 40 + pvpWins * 2500,
      };
    },

    prizes: { poolLabel: "Mock prize pool · Troll Ops", pool: "100 USDC + 1M $TROLL" },
  });
})();
