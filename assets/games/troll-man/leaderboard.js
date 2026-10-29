/* Troll Man: leaderboard config for the shared arcade engine
   (assets/js/troll-leaderboard.js, see assets/games/LEADERBOARD.md).
   game.js reports each finished 1-player game:
       TrollLeaderboard.record("troll-man", { score, level })
   Ranked by best score, then the furthest level, over every game ever. */
(() => {
  "use strict";
  const LB = window.TrollLeaderboard;
  if (!LB) return;

  LB.register({
    gameId: "troll-man",
    gameName: "Troll Man",
    // no mount: game.js draws the board itself, the cabinet's way
    // (TrollLeaderboard.board, the HIGH SCORES page and the trophy panel)

    blank: () => ({ score: 0, level: 0, games: 0 }),
    reduce: (you, ev) => {
      you.games++;
      you.score = Math.max(you.score, Math.round(ev.score || 0));
      you.level = Math.max(you.level, ev.level || 0);
    },

    columns: [
      { key: "score", label: "Best", align: "num", accent: "gold" },
      { key: "level", label: "Level", align: "num", accent: "cyan" },
      { key: "games", label: "Games", align: "num", accent: "muted", hideSm: true },
    ],
    rankBy: ["score", "level"],

    player: {
      dotColor: () => "#ffcc00",
      sublabel: e => (e.level ? `Reached level ${e.level}` : ""),
    },
    prizes: null,
    // never resets: every score since launch counts (user, 2026-10-28)
    allTime: true,
    footNote: "Best 1-player score, all time.",
  });
})();
