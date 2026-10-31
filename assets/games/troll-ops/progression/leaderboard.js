/* Troll Forces — weekly leaderboard config.
   Uses the shared arcade engine (assets/js/troll-leaderboard.js); see
   assets/games/LEADERBOARD.md. game.js reports one event per run: solo Ops runs carry
   a wave, PvP matches carry kills, deaths and whether you won. */
(() => {
  const LB = window.TrollLeaderboard;
  if (!LB) return;

  LB.register({
    gameId: "troll-ops",
    gameName: "Trollnite",

    blank: () => ({
      score: 0, bestWave: 0, bestKills: 0, runs: 0,
      pvpKills: 0, pvpDeaths: 0, pvpWins: 0, matches: 0, kd: 0,
      assists: 0, headshots: 0, bestStreak: 0,
    }),

    reduce: (you, ev) => {
      if (ev.pvp) {
        you.pvpKills += ev.kills || 0;
        you.pvpDeaths += ev.deaths || 0;
        you.pvpWins += ev.won ? 1 : 0;
        you.assists += ev.assists || 0;
        you.headshots += ev.headshots || 0;
        you.bestStreak = Math.max(you.bestStreak || 0, ev.streak || 0);
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

    // (the score is what ranks you: shown first)
    columns: [
      { key: "score", label: "Score", align: "num", accent: "gold" },
      { key: "bestWave", label: "Best wave", align: "num", accent: "green" },
      { key: "pvpKills", label: "PvP kills", align: "num", accent: "gold" },
      { key: "kd", label: "K/D", align: "num", accent: "muted" },
      { key: "pvpWins", label: "Wins", align: "num", accent: "muted", hideSm: true },
    ],
    rankBy: ["score"],

    player: { dotColor: () => "#7fe066", sublabel: () => "operator" },
  });
})();
