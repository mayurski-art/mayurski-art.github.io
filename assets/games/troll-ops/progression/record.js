// Troll Forces combat record (prestige phase 3, design doc "Troll Forces:
// Prestige + Profile Card"). Lifetime PvP totals on the account, BO2-style:
// K/D, W/L, score per minute, accuracy, headshots, best streak, time played,
// matches and favourite gun.
//
// game.js counts a match as it's played and hands the totals here when it
// ends (endMatch, PvP only). Each match is queued in localStorage first and
// sent by troll_forces_record_match() (assets/supabase/troll_forces_record.sql),
// which adds it to public.troll_forces_record and refuses impossible numbers.
// A failed send (offline, or the SQL not run yet) stays queued and retries
// every 30s, so no match is lost. Guests keep nothing, like their XP.

const PENDING_KEY = "trollops:record-pending";
const MAX_QUEUE = 25;

function accounts() { return window.TrollrunnerAccounts; }
function myId() {
  const p = accounts()?.getCachedProfile?.();
  return p?.id || p?.userId || null;
}

function readQueue() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch { /* private mode */ }
}

let sending = null, retryTimer = 0;

/* Send what's queued, oldest first. Safe to call often. */
export function flushRecord() {
  const sb = accounts()?.getClient?.();
  if (sending || !sb || !myId()) return sending;
  clearTimeout(retryTimer);
  sending = (async () => {
    let q = readQueue();
    while (q.length) {
      const { error } = await sb.rpc("troll_forces_record_match", { p_match: q[0] });
      if (error) {
        // A match the server refuses outright would block the queue forever.
        if (/impossible|invalid/i.test(error.message || "")) { q.shift(); writeQueue(q); continue; }
        retryTimer = setTimeout(() => void flushRecord(), 30000);
        break;
      }
      q = readQueue();
      q.shift();
      writeQueue(q);
      cache = null;
    }
  })().finally(() => { sending = null; });
  return sending;
}

/* A finished PvP match. Signed in only. */
export function recordMatch(m) {
  if (!myId()) return;
  const match = {
    won: !!m.won,
    kills: m.kills | 0, deaths: m.deaths | 0, assists: m.assists | 0,
    headshots: m.headshots | 0, best_streak: m.bestStreak | 0,
    score: Math.round(m.score || 0), seconds: Math.round(m.seconds || 0),
    shots_fired: m.shotsFired | 0, shots_hit: m.shotsHit | 0,
    weapon_kills: m.weaponKills || {},
  };
  writeQueue([...readQueue(), match]);
  void flushRecord();
}

let cache = null;   // { id, at, rec }

/* The lifetime record for `userId` (default: you), with the derived numbers.
   Resolves null when there's none yet or the table isn't there. */
export async function fetchRecord(userId = myId()) {
  const sb = accounts()?.getClient?.();
  if (!sb || !userId) return null;
  if (cache && cache.id === userId && performance.now() - cache.at < 15000) return cache.rec;
  const { data, error } = await sb.from("troll_forces_record").select("*").eq("user_id", userId).maybeSingle();
  const rec = error || !data ? null : derive(data);
  cache = { id: userId, at: performance.now(), rec };
  return rec;
}

/* The ratios BO2 shows, from the raw totals. */
export function derive(r) {
  const n = (k) => Number(r?.[k]) || 0;
  const wk = r?.weapon_kills && typeof r.weapon_kills === "object" ? r.weapon_kills : {};
  let favourite = null, favKills = 0;
  for (const [id, k] of Object.entries(wk)) if ((k | 0) > favKills) { favourite = id; favKills = k | 0; }
  return {
    matches: n("matches"), wins: n("wins"), losses: n("losses"),
    kills: n("kills"), deaths: n("deaths"), assists: n("assists"),
    headshots: n("headshots"), bestStreak: n("best_streak"),
    score: n("score"), seconds: n("seconds"),
    shotsFired: n("shots_fired"), shotsHit: n("shots_hit"),
    kd: n("kills") / Math.max(1, n("deaths")),
    wl: n("wins") / Math.max(1, n("losses")),
    spm: n("seconds") > 0 ? n("score") / (n("seconds") / 60) : 0,
    accuracy: n("shots_fired") > 0 ? n("shots_hit") / n("shots_fired") : 0,
    favourite, favKills,
  };
}

/* "3h 12m" / "45m" / "0m". */
export function formatPlayed(seconds) {
  const m = Math.floor(seconds / 60), h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

window.addEventListener("trollrunner:auth-changed", () => { cache = null; void flushRecord(); });
void flushRecord();
