/* Who's online across trollrunner.net: the "N Online" count on the home
   menu and the Troll Forces menu.

   Same Supabase presence channel and payload as world.html and
   troll-presence.js, deduped by viewerId. window.getViewerRoster stays a
   global because troll-accounts.js reads it on every
   trollrunner:presence-sync for the friend-list online dots.

   A page can say what its viewer is doing (setActivity): Troll Forces
   puts the mode, room and map there, so its menu can list who's playing
   what and the servers you can join (assets/games/troll-ops/menu/online.js).
   It's off the wire, so it's cleaned (cleanActivity) before anyone reads it.

   joinSitePresence({ onCount, onSync }) -> { roster(), count(), setActivity(a) } */

const SUPABASE_URL = "https://tjsyhfplxjtakdfkpdtg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3loZnBseGp0YWtkZmtwZHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTc0ODksImV4cCI6MjA5MTk3MzQ4OX0.xLUcPUUguRBQttNwiIRWJHxjJjLqrQDMu4Ubsk5yZoQ";
const VIEWER_ID_KEY = "trollrunner_viewer_id_v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function viewerId() {
  try {
    let id = localStorage.getItem(VIEWER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `viewer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(VIEWER_ID_KEY, id);
    }
    return id;
  } catch { return `viewer-${Date.now()}`; }
}

const profile = () => window.TrollrunnerAccounts?.getCachedProfile?.() || null;

/* An activity off the wire, or null: short strings, a room code, numbers. */
function cleanActivity(a) {
  if (!a || typeof a !== "object") return null;
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);
  const room = typeof a.room === "string" && /^[A-Z0-9]{1,8}$/.test(a.room) ? a.room : null;
  return {
    game: str(a.game, 16), state: str(a.state, 12), mode: str(a.mode, 16), modeName: str(a.modeName, 32),
    map: str(a.map, 24), mapName: str(a.mapName, 32), room, pub: !!a.pub && !!room,
    wave: Math.max(0, Math.min(999, a.wave | 0)), max: Math.max(0, Math.min(200, a.max | 0)),
  };
}

export function joinSitePresence({ onCount = null, onSync = null } = {}) {
  const onlineAt = new Date().toISOString();
  let channel = null;
  let joined = false;
  let activity = null;

  const payload = () => {
    const a = profile();
    return {
      viewerId: viewerId(), userId: a?.userId || null, username: a?.username || null,
      avatarUrl: a?.avatarUrl || null, level: a?.level || null,
      host: location.hostname, path: location.pathname, activeWindow: null, activity,
      onlineAt, trackedAt: new Date().toISOString(),
    };
  };

  function roster() {
    const byViewer = new Map();
    const state = channel ? channel.presenceState() : {};
    Object.values(state).flat().forEach((e) => {
      if (!e || !e.viewerId) return;
      const prev = byViewer.get(e.viewerId);
      if (!prev || String(e.trackedAt) >= String(prev.trackedAt)) byViewer.set(e.viewerId, e);
    });
    if (!byViewer.size) byViewer.set(viewerId(), payload());
    const members = new Map(), guests = [];
    byViewer.forEach((e) => {
      const uid = UUID.test(String(e.userId || "")) ? e.userId : null;
      if (uid && e.username) {
        members.set(uid, { userId: uid, viewerId: e.viewerId, username: String(e.username).slice(0, 20), level: Math.max(1, e.level || 1), avatarUrl: e.avatarUrl || null, activeWindow: e.activeWindow === "games" ? "games" : null, activity: cleanActivity(e.activity) });
      } else guests.push(e);
    });
    guests.sort((a, b) => String(a.onlineAt).localeCompare(String(b.onlineAt)) || String(a.viewerId).localeCompare(String(b.viewerId)));
    return { members: [...members.values()], guests: guests.map((g, i) => ({ viewerId: g.viewerId, label: `Guest${String(i + 1).padStart(3, "0")}`, activity: cleanActivity(g.activity) })) };
  }
  const count = () => { const r = roster(); return Math.max(1, r.members.length + r.guests.length); };
  window.getViewerRoster = roster;

  const sync = () => {
    if (onCount) onCount(count());
    if (onSync) onSync(roster());
    window.dispatchEvent(new CustomEvent("trollrunner:presence-sync"));
  };
  const retrack = async () => { if (!joined) return; try { await channel.untrack(); await channel.track(payload()); } catch {} };

  if (window.supabase) {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    channel = client.channel("trollrunner-site-presence", { config: { presence: { key: viewerId() } } });
    channel.on("presence", { event: "sync" }, sync).subscribe((status) => {
      if (status === "SUBSCRIBED") { joined = true; channel.track(payload()); }
    });
    setInterval(retrack, 30000);
    window.addEventListener("trollrunner:auth-changed", retrack);
  }
  /* What this viewer is doing now (null: nothing in particular). Sent at
     once when it changes, so the servers list stays live. */
  const setActivity = (a) => {
    const next = cleanActivity(a);
    if (JSON.stringify(next) === JSON.stringify(activity)) return;
    activity = next;
    if (joined) channel.track(payload()).catch(() => {});
  };
  if (onCount) onCount(1);
  return { roster, count, setActivity };
}
