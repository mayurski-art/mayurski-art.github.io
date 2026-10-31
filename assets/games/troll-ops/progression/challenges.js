// Trollnite challenges: daily, weekly and the event's (user, 2026-10-31: "we
// also need to add challenges daily, weekly, and event lasting. the
// challenges need to have descriptions as well").
//
//   daily    three a day, new at local midnight
//   weekly   three a week, new each Monday (the leaderboard's week)
//   event    the season's own set, for as long as it runs (core/season.js:
//            Chapter One, to the end of 12 November)
//
// Everyone gets the same picks on the same day or week: they're drawn from
// the pools below by a seed made of the date. Every finished match or run
// (modes/match-end.js onMatch) counts towards them; a challenge done pays its
// XP (progression.js addXp) and leaves a message in the inbox
// (menu/inbox.js, through "trollforces:notify"). Progress is kept under KEY,
// which cloud-save.js syncs to the account, so it follows the player between
// devices; the lobby's Challenges card and the Quests tab draw from view().

import { addXp } from "./progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4-gc1";
import { SEASON } from "../core/season.js?v=zf1-wb1";

const KEY = "trollops:challenges";

/* What a match adds to each measure. `max`: the best in one match counts,
   not the total. */
const MEASURE = {
  matches: (m) => 1,
  kills: (m) => m.kills,
  headshots: (m) => m.headshots,
  assists: (m) => m.assists,
  wins: (m) => (m.won ? 1 : 0),
  pvpWins: (m) => (m.won && m.pvp ? 1 : 0),
  streak: (m) => m.streak,
  wave: (m) => (m.zombies ? m.wave : 0),
  zombieKills: (m) => (m.zombies ? m.kills : 0),
  royale: (m) => (m.royale ? 1 : 0),
  royaleWins: (m) => (m.royale && m.won ? 1 : 0),
  hollowgrinKills: (m) => (m.map === "hollowgrin" ? m.kills : 0),
  hollowgrinMatches: (m) => (m.map === "hollowgrin" ? 1 : 0),
};
const MAX = new Set(["streak", "wave"]);

/* The pools. `desc` is what the card and the Quests tab say under the name. */
const DAILY = [
  { id: "d-play3", name: "Warm up", desc: "Finish 3 matches or runs in any mode.", measure: "matches", goal: 3, xp: 300 },
  { id: "d-kills25", name: "Troll patrol", desc: "Get 25 kills across any modes.", measure: "kills", goal: 25, xp: 400 },
  { id: "d-win1", name: "Take the W", desc: "Win a match: any versus mode or Troll Royale.", measure: "pvpWins", goal: 1, xp: 400 },
  { id: "d-head5", name: "Head games", desc: "Land 5 headshot kills.", measure: "headshots", goal: 5, xp: 350 },
  { id: "d-assist8", name: "Wingman", desc: "Get 8 assists. Shoot it, let a teammate finish it.", measure: "assists", goal: 8, xp: 300 },
  { id: "d-streak5", name: "On a roll", desc: "Get 5 kills in a row without dying, in one match.", measure: "streak", goal: 5, xp: 450 },
  { id: "d-wave5", name: "Hold the line", desc: "Reach wave 5 in a Zombies run.", measure: "wave", goal: 5, xp: 400 },
  { id: "d-royale1", name: "Drop in", desc: "Play a match of Troll Royale.", measure: "royale", goal: 1, xp: 250 },
];
const WEEKLY = [
  { id: "w-kills150", name: "Body count", desc: "Get 150 kills this week, across any modes.", measure: "kills", goal: 150, xp: 1500 },
  { id: "w-win5", name: "Winning streak", desc: "Win 5 versus or Troll Royale matches.", measure: "pvpWins", goal: 5, xp: 1500 },
  { id: "w-head30", name: "Sharpshooter", desc: "Land 30 headshot kills.", measure: "headshots", goal: 30, xp: 1400 },
  { id: "w-play15", name: "Regular", desc: "Finish 15 matches or runs.", measure: "matches", goal: 15, xp: 1200 },
  { id: "w-wave12", name: "Last troll standing", desc: "Reach wave 12 in a single Zombies run.", measure: "wave", goal: 12, xp: 1600 },
  { id: "w-zkills300", name: "Exterminator", desc: "Kill 300 zombies.", measure: "zombieKills", goal: 300, xp: 1400 },
  { id: "w-royalewin", name: "Victory Royale", desc: "Win a match of Troll Royale.", measure: "royaleWins", goal: 1, xp: 2000 },
  { id: "w-streak10", name: "Unstoppable", desc: "Get 10 kills in a row without dying, in one match.", measure: "streak", goal: 10, xp: 1800 },
];
/* The event's: the whole set, for the season. */
const EVENT = {
  id: "ch1-halloween",
  name: "Halloween",
  ends: SEASON.end,
  list: [
    { id: "e-hg-play", name: "Welcome to Hollowgrin", desc: "Play 5 matches on Hollowgrin, the island's haunted underside.", measure: "hollowgrinMatches", goal: 5, xp: 1500 },
    { id: "e-hg-kills", name: "Pumpkin patrol", desc: "Get 100 kills on Hollowgrin.", measure: "hollowgrinKills", goal: 100, xp: 2500 },
    { id: "e-wave10", name: "Night of the living trolls", desc: "Reach wave 10 in a single Zombies run.", measure: "wave", goal: 10, xp: 2000 },
    { id: "e-royale3", name: "Trick or treat", desc: "Win 3 matches of Troll Royale.", measure: "royaleWins", goal: 3, xp: 3000 },
  ],
};

/* ------------------------------------------------------------ the periods */

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function weekStart(d = new Date()) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));   // back to Monday
  return s;
}
const weekKey = (d = new Date()) => `w${dayKey(weekStart(d))}`;
function nextDay(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
function nextWeek(d = new Date()) { const s = weekStart(d); s.setDate(s.getDate() + 7); return s; }

/* Three picks from a pool, the same for everyone with the same key. */
function pick(pool, key, n = 3) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
  const list = [...pool];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  // (never two on the same measure: "25 kills" and "150 kills" side by side
  // read as one)
  const out = [], seen = new Set();
  for (const c of list) { if (out.length >= n) break; if (!seen.has(c.measure)) { out.push(c); seen.add(c.measure); } }
  return out;
}

const eventLive = (now = Date.now()) => now >= SEASON.start.getTime() && now <= EVENT.ends.getTime();

/* ------------------------------------------------------------ the save */

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === "object" ? s : {}; } catch { return {}; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }

/* This period's slot in the save, started fresh when the key moves on. */
function slot(s, name, key) {
  if (!s[name] || s[name].key !== key) s[name] = { key, p: {}, done: [] };
  return s[name];
}

/* ------------------------------------------------------------ public */

/* Every group as the UI draws it: { id, name, ends, list: [{ ...challenge,
   progress, done }] }. */
export function view(now = new Date()) {
  const s = load();
  const groups = [
    { id: "daily", name: "Daily", key: dayKey(now), ends: nextDay(now), list: pick(DAILY, `d${dayKey(now)}`) },
    { id: "weekly", name: "Weekly", key: weekKey(now), ends: nextWeek(now), list: pick(WEEKLY, weekKey(now)) },
  ];
  if (eventLive(now.getTime())) groups.push({ id: "event", name: EVENT.name, key: EVENT.id, ends: EVENT.ends, list: EVENT.list });
  return groups.map((g) => {
    const st = s[g.id]?.key === g.key ? s[g.id] : { p: {}, done: [] };
    return {
      id: g.id, name: g.name, ends: g.ends,
      list: g.list.map((c) => ({ ...c, progress: Math.min(c.goal, st.p[c.id] || 0), done: st.done.includes(c.id) })),
    };
  });
}

/* "5H left", "2D 4H left": how long a group has. */
export function timeLeft(ends, now = Date.now()) {
  const m = Math.max(0, Math.floor((ends - now) / 60000)), d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24;
  return d ? `${d}D ${h}H left` : h ? `${h}H ${m % 60}M left` : `${m % 60}M left`;
}

/* A finished match or run (modes/match-end.js): { mode, pvp, won, kills,
   deaths, assists, headshots, streak, wave, map }. Returns the challenges it
   finished. */
export function onMatch(r, now = new Date()) {
  const m = {
    kills: r.kills | 0, headshots: r.headshots | 0, assists: r.assists | 0, streak: r.streak | 0, wave: r.wave | 0,
    won: !!r.won, pvp: !!r.pvp, map: r.map || "",
    zombies: /zombie/i.test(r.mode || ""), royale: /^royale/.test(r.mode || ""),
  };
  if (/^social/.test(r.mode || "")) return [];   // hanging out isn't playing
  const s = load(), finished = [];
  for (const g of view(now)) {
    const st = slot(s, g.id, g.id === "daily" ? dayKey(now) : g.id === "weekly" ? weekKey(now) : EVENT.id);
    for (const c of g.list) {
      if (st.done.includes(c.id)) continue;
      const add = MEASURE[c.measure]?.(m) || 0;
      const was = st.p[c.id] || 0;
      st.p[c.id] = MAX.has(c.measure) ? Math.max(was, add) : was + add;
      if (st.p[c.id] >= c.goal) { st.done.push(c.id); finished.push({ ...c, group: g.name }); }
    }
  }
  save(s);
  for (const c of finished) {
    addXp(c.xp);
    dispatchEvent(new CustomEvent("trollforces:notify", { detail: {
      id: `ch-${c.id}-${dayKey(now)}`, kind: "challenge",
      title: `${c.group} challenge complete`, body: `${c.name}: ${c.desc} +${c.xp.toLocaleString()} XP.`, screen: "quests",
    } }));
  }
  if (finished.length) dispatchEvent(new CustomEvent("trollforces:challenges"));
  return finished;
}

// the save changing under us (another device, through cloud save): redraw
addEventListener("trollforces:cloud-restored", (e) => { if (e.detail?.includes?.(KEY)) dispatchEvent(new CustomEvent("trollforces:challenges")); });
