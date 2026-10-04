// Troll Forces — your setup follows your account (user, 2026-10-03: "when
// logging in from one device to another, the loadout, scorestreaks,
// settings etc. should all be synced").
//
// Everything the game keeps about you already lives in localStorage under a
// handful of keys (loadout.js, streak-picker.js, the settings, the HUD
// layouts, cosmetics, the hero...). This mirrors those keys into the
// account's row in troll_game_saves (assets/supabase/troll_game_saves.sql:
// owner-only RLS, the same table Trollrreria and the Pizzeria save to), so
// nothing in the game has to change how it stores things.
//
//   Sign in            the account's copy wins and is written over this
//                      device's (applied live via onRestore), unless this
//                      device has changes made on this account that never
//                      made it up. No copy on the account yet: this
//                      device's goes up.
//   Change something   it goes up a moment later (debounced), and on the
//                      way out of the tab.
//   Back to the tab    the account's copy is fetched again, so a change made
//                      on the phone is there when you come back to the PC.
//
// One whole-setup blob, last writer wins. Guests keep everything local.

const GAME_ID = "troll-forces";
export const SYNCED_KEYS = [
  "trollops:loadout",              // guns, attachments, finishes, melee, throwables
  "trollops:streaks",              // scorestreak picks
  "trollops:settings",             // sensitivity, FOV, volume, gloves... (not gfx: see below)
  "trollops.hudLayout.touch.v1",   // the phone HUD you dragged about
  "trollops.hudLayout.desk.v1",
  "trollops:padEmote",
  "trollops:cosmetics",
  "trollops:hero",
  "trollops:botStreaks",
  "trollops:radio-v2",
];
const SYNCED = new Set(SYNCED_KEYS);
// Graphics quality is about the machine, not the player: a phone shouldn't
// inherit the gaming PC's "high".
const DEVICE_SETTINGS = ["gfx"];
const STAMP_KEY = "trollops:cloud-stamp";   // { user, at, dirty } for this device
const PUSH_DELAY = 1500;
const PULL_EVERY = 30000;

let rawSet = null, rawRemove = null;
let userId = null;
let pushT = null;
let lastPull = 0;
let busy = Promise.resolve();
let onRestore = () => {};

const accounts = () => window.TrollrunnerAccounts;
const client = () => accounts()?.getClient?.() || null;

function readStamp() {
  try { return JSON.parse(localStorage.getItem(STAMP_KEY)) || {}; } catch { return {}; }
}
function writeStamp(s) {
  try { rawSet.call(localStorage, STAMP_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

function snapshot() {
  const keys = {};
  for (const k of SYNCED_KEYS) {
    const v = localStorage.getItem(k);
    if (v != null) keys[k] = v;
  }
  return { v: 1, keys };
}

/* Write the account's copy over this device's, without counting it as a
   local change. Returns the keys that actually changed. */
function restore(data) {
  const changed = [];
  const keys = data?.keys || {};
  for (const k of SYNCED_KEYS) {
    let v = keys[k];
    if (k === "trollops:settings" && v != null) {
      try {
        const cloud = JSON.parse(v), local = JSON.parse(localStorage.getItem(k) || "{}");
        for (const d of DEVICE_SETTINGS) { if (d in local) cloud[d] = local[d]; else delete cloud[d]; }
        v = JSON.stringify(cloud);
      } catch { /* leave it as it came */ }
    }
    const cur = localStorage.getItem(k);
    if (v == null) {
      // Not on the account: keep what this device has.
      continue;
    }
    if (cur === v) continue;
    try { rawSet.call(localStorage, k, v); changed.push(k); } catch { /* quota */ }
  }
  return changed;
}

async function pull(force = false) {
  const sb = client();
  if (!sb || !userId) return;
  const me = userId;
  const { data, error } = await sb.from("troll_game_saves").select("data, updated_at")
    .eq("user_id", me).eq("game_id", GAME_ID).maybeSingle();
  if (me !== userId) return;   // signed out / switched while we waited
  if (error) { console.warn("[troll-forces] cloud load failed:", error.message || error); return; }
  lastPull = Date.now();
  const stamp = readStamp();
  if (!data) {
    // Nothing on the account yet: this device's setup becomes the account's.
    await push();
    return;
  }
  const cloudAt = new Date(data.updated_at).getTime() || 0;
  const mineUnsent = stamp.user === me && stamp.dirty && (stamp.at || 0) > cloudAt;
  if (mineUnsent) { await push(); return; }
  if (!force && stamp.user === me && (stamp.at || 0) >= cloudAt) return;   // already have it
  const changed = restore(data.data);
  writeStamp({ user: me, at: cloudAt, dirty: false });
  if (changed.length) {
    try { onRestore(changed); } catch (e) { console.warn("[troll-forces] applying cloud setup failed:", e); }
  }
}

async function push() {
  clearTimeout(pushT);
  pushT = null;
  const sb = client();
  if (!sb || !userId) return;
  const me = userId;
  const at = new Date();
  const { error } = await sb.from("troll_game_saves").upsert({
    user_id: me, game_id: GAME_ID, data: snapshot(), updated_at: at.toISOString(),
  });
  if (error) { console.warn("[troll-forces] cloud save failed:", error.message || error); return; }
  const s = readStamp();
  // Only clear dirty if nothing changed while the save was in flight.
  if (s.user === me && (s.at || 0) <= at.getTime()) writeStamp({ user: me, at: at.getTime(), dirty: false });
}

/* Serialise cloud work: a push and a pull never overlap. */
function queue(fn) { busy = busy.then(fn, fn).catch((e) => console.warn("[troll-forces] cloud sync:", e)); return busy; }

function localChange() {
  if (!userId) return;
  writeStamp({ user: userId, at: Date.now(), dirty: true });
  clearTimeout(pushT);
  pushT = setTimeout(() => queue(push), PUSH_DELAY);
}

async function setUser(id) {
  if (id === userId) return;
  userId = id || null;
  clearTimeout(pushT);
  pushT = null;
  if (userId) await queue(() => pull(true));
}

/* `apply(changedKeys)`: put a restored setup into the running game. */
export function initCloudSave({ apply } = {}) {
  if (rawSet) return;
  onRestore = apply || onRestore;
  // Watch the game's own writes to the synced keys: no module has to know
  // about the cloud. (Storage.prototype, because assigning setItem on the
  // localStorage object itself would just store an item called "setItem".)
  rawSet = Storage.prototype.setItem;
  rawRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) {
    const before = this === localStorage && SYNCED.has(k) ? this.getItem(k) : undefined;
    rawSet.call(this, k, v);
    if (before !== undefined && before !== String(v)) localChange();
  };
  Storage.prototype.removeItem = function (k) {
    const had = this === localStorage && SYNCED.has(k) && this.getItem(k) != null;
    rawRemove.call(this, k);
    if (had) localChange();
  };

  window.addEventListener("trollrunner:auth-changed", (e) => { void setUser(e.detail?.userId || null); });
  // Signed in before this module loaded: no event is coming for that.
  const cached = accounts()?.getCachedProfile?.();
  if (cached?.id || cached?.userId) void setUser(cached.id || cached.userId);
  else void accounts()?.getSession?.().then((s) => { if (s?.userId) void setUser(s.userId); }).catch(() => {});

  const flush = () => { if (pushT) void queue(push); };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
    else if (userId && Date.now() - lastPull > PULL_EVERY && !readStamp().dirty) void queue(() => pull());
  });
}

/* Tests: the state of play. */
export function cloudSaveState() { return { userId, stamp: readStamp(), pending: !!pushT }; }
