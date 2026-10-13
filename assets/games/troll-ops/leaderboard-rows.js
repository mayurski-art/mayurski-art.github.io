// Troll Forces leaderboards: weekly, monthly and all-time, from the rows the
// game already files.
//
// Every finished match or run is one row in troll_leaderboard_view (game
// "troll-ops"), filed by match-end.js through
// TrollrunnerAccounts.reportGameResult for logged-in players. Its meta says
// what happened: mode, pvp, won, kills, deaths, assists, headshots, streak,
// wave. A board is those rows over a window, added up per player:
//   - the hub's Highest Wave / Total Kills (modes/zombies/hub.js), weekly and
//     monthly;
//   - the menu's Leaderboards (TrollLeaderboard provider, weekly or monthly);
//   - a player's all-time Zombies line on their profile card.
// Guests aren't filed (the server takes logged-in results only), so they're
// on no board; they're told to log in.

const GAME = "troll-ops";
const PAGE = 1000;       // rows per request
const MAX_ROWS = 20000;  // a month of a busy game, and then some

/* ------------------------------------------------------------ windows */

/* This week: the leaderboard engine's (Monday to Monday, local time). */
export function weekWindow(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return { start, end };
}
/* This calendar month, local time. */
export function monthWindow(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}
export const windowFor = (period, date = new Date()) => (period === "month" ? monthWindow(date) : weekWindow(date));

/* "5d 14h 2m" until the window turns over. */
export function timeLeft(period, date = new Date()) {
  const ms = Math.max(0, windowFor(period, date).end - date);
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}
export function periodLabel(period, date = new Date()) {
  if (period === "month") return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const { start, end } = weekWindow(date);
  const last = new Date(end); last.setDate(last.getDate() - 1);
  const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Week of ${fmt(start)} – ${fmt(last)}`;
}

/* ------------------------------------------------------------ rows */

const client = () => window.TrollrunnerAccounts?.getClient?.() || null;
export const hasBackend = () => !!client();
export function myUserId() {
  const p = window.TrollrunnerAccounts?.getCachedProfile?.();
  return p?.userId || p?.id || null;
}

/* Every troll-ops row in [start, end), optionally one player's or one mode's.
   Pages through the view; throws if the backend does. */
export async function fetchRows({ start = null, end = null, userId = null, mode = null } = {}) {
  const sb = client();
  if (!sb) return null;
  const out = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let q = sb.from("troll_leaderboard_view").select("user_id,username,meta,achieved_at").eq("game_id", GAME);
    if (start) q = q.gte("achieved_at", start.toISOString());
    if (end) q = q.lt("achieved_at", end.toISOString());
    if (userId) q = q.eq("user_id", userId);
    if (mode) q = q.eq("meta->>mode", mode);
    const { data, error } = await q.order("achieved_at", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const SOLO = new Set(["ops", "zombies", "range", "view"]);
/* Rows filed before 2026-10-13 have no `pvp`: their mode says. */
const isPvp = (m) => (m.pvp != null ? !!m.pvp : !SOLO.has(m.mode) && m.mode !== "social" && m.mode !== "zhub");

/* Per player over the rows: the menu board's columns (leaderboard.js) and
   the Zombies numbers. */
export function tallyPlayers(rows) {
  const by = new Map();
  for (const r of rows || []) {
    const m = r.meta || {};
    let u = by.get(r.user_id);
    if (!u) {
      by.set(r.user_id, u = {
        id: r.user_id, name: r.username || "troll",
        bestWave: 0, bestKills: 0, runs: 0,
        pvpKills: 0, pvpDeaths: 0, pvpWins: 0, matches: 0, assists: 0, headshots: 0, bestStreak: 0,
        zWave: 0, zKills: 0, zRuns: 0, zWins: 0,
      });
    }
    if (r.username) u.name = r.username;   // ascending: the latest name wins
    const kills = +m.kills || 0;
    u.bestKills = Math.max(u.bestKills, kills);
    if (isPvp(m)) {
      u.matches += 1;
      u.pvpKills += kills;
      u.pvpDeaths += +m.deaths || 0;
      u.pvpWins += m.won ? 1 : 0;
      u.assists += +m.assists || 0;
      u.headshots += +m.headshots || 0;
      u.bestStreak = Math.max(u.bestStreak, +m.streak || 0);
    } else {
      u.runs += 1;
      u.bestWave = Math.max(u.bestWave, +m.wave || 0);
      if (m.mode === "zombies") {
        u.zRuns += 1;
        u.zWave = Math.max(u.zWave, +m.wave || 0);
        u.zKills += kills;
        u.zWins += m.won ? 1 : 0;
      }
    }
  }
  for (const u of by.values()) {
    u.kd = Math.round((u.pvpKills / Math.max(1, u.pvpDeaths)) * 100) / 100;
    // leaderboard.js's ladder: deep runs and PvP both count
    u.score = u.bestWave * 10000 + u.bestKills * 10 + u.pvpKills * 40 + u.pvpWins * 2500;
  }
  return [...by.values()];
}

/* ------------------------------------------------------------ the menu board */

/* A TrollLeaderboard provider for troll-ops: this week's or this month's rows,
   added up. Nothing is written through it (match-end.js files the rows). */
export function makeTrollOpsProvider() {
  const state = { period: "week" };
  return {
    name: "troll-ops-rows",
    get period() { return state.period; },
    setPeriod(p) { state.period = p === "month" ? "month" : "week"; },
    async getBoard() {
      const period = state.period;
      const now = new Date();
      const { start, end } = windowFor(period, now);
      const myId = myUserId();
      const base = {
        weekId: period === "month" ? "Monthly" : "Weekly",
        weekLabel: periodLabel(period, now),
        resetsIn: timeLeft(period, now),
        countdown: () => timeLeft(period),
        emptyText: `No plays yet this ${period} — be the first on the board.`,
        footNote: `Live — every logged-in player's matches this ${period}, added up. Resets ${period === "month" ? "on the 1st" : "every Monday"}.`,
        loggedIn: !!myId,
      };
      let rows;
      try { rows = await fetchRows({ start, end }); }
      catch (err) { console.warn("[leaderboard] troll-ops rows", err); return { ...base, source: "live", entries: [] }; }
      if (!rows) return { ...base, source: "local", entries: [], footNote: "Log in to get on the board." };
      const entries = tallyPlayers(rows).map((u) => ({ ...u, you: u.id === myId }));
      return { ...base, source: "live", entries };
    },
    recordEvent() { /* match-end.js files the row */ },
  };
}

/* ------------------------------------------------------------ all time */

/* One player's Zombies, all time (the profile card): best wave, kills, runs,
   runs survived. null with no backend; zeros with no runs. */
export async function zombiesAllTime(userId) {
  if (!userId) return null;
  const rows = await fetchRows({ userId, mode: "zombies" });
  if (!rows) return null;
  const u = tallyPlayers(rows)[0];
  return { bestWave: u?.zWave || 0, kills: u?.zKills || 0, runs: u?.zRuns || 0, wins: u?.zWins || 0 };
}
