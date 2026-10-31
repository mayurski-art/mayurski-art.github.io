// Troll Forces — items the server gives away. The first is the Pumpkin Head
// (user, 2026-10-31): every account that comes into the game during Chapter
// One, 26 October to the end of 12 November 2026, gets it free and keeps it.
//
// The server decides, on its own clock (assets/supabase/
// troll_forces_pumpkin_head.sql): troll_forces_claim_pumpkin_head() grants
// it inside the window and only answers outside it, and the accounts that
// had already played since 26 October were granted by that file's backfill.
// This module asks on every sign-in, remembers the answer per account (so
// the Locker knows offline), and the first time an account has it here:
// a TrollNotis toast, and the yellow "new" dot on the way to it (the
// Locker tab, the Face slot, the item) until the Face screen is opened.

const PUMPKIN = "pumpkin-head";
const OWN_KEY = "trollops:grants";        // { userId: [item, ...] }
const NEW_KEY = "trollops:new-items";     // { userId: [item not seen yet, ...] }
const TOLD_KEY = "trollops:grants-told";  // { userId: [item the toast went out for, ...] }
const OWNER = "troll_runner";

const accounts = () => window.TrollrunnerAccounts;
const profile = () => accounts()?.getCachedProfile?.() || null;
const myId = () => profile()?.id || profile()?.userId || null;
const isOwner = () => String(profile()?.username || "").toLowerCase() === OWNER;

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; }
}
function list(key, uid) { return uid ? [...(read(key)[uid] || [])] : []; }
function put(key, uid, items) {
  if (!uid) return;
  const all = read(key);
  if (items.length) all[uid] = items; else delete all[uid];
  try { localStorage.setItem(key, JSON.stringify(all)); } catch { /* private mode */ }
}
/* (`seen`: only a "new" mark went; the screen showing it keeps its dot) */
const changed = (seen = false) => window.dispatchEvent(new CustomEvent("trollforces:grants", { detail: { seen } }));

/* Does the signed-in account own `item`? Guests own nothing; the owner
   owns every item, as with the TROLLS bodies. */
export function ownsItem(item) {
  if (!myId()) return false;
  return isOwner() || list(OWN_KEY, myId()).includes(item);
}
/* Is `item` new to the signed-in account (granted, not seen yet)? */
export function isNew(item) { return list(NEW_KEY, myId()).includes(item); }
/* Anything new at all (the Locker tab's dot). */
export function hasNew() { return list(NEW_KEY, myId()).length > 0; }
/* The account has seen `item` (its screen opened): its dots go. */
export function markSeen(item) {
  const uid = myId(), now = list(NEW_KEY, uid);
  if (!now.includes(item)) return;
  put(NEW_KEY, uid, now.filter((i) => i !== item));
  changed(true);
}

/* Mark `item` owned for this account; the first time here, new + a toast. */
function own(uid, item) {
  const have = list(OWN_KEY, uid);
  if (!have.includes(item)) put(OWN_KEY, uid, [...have, item]);
  const told = list(TOLD_KEY, uid);
  if (told.includes(item)) return;
  put(TOLD_KEY, uid, [...told, item]);
  put(NEW_KEY, uid, [...new Set([...list(NEW_KEY, uid), item])]);
  notify(item);
}

function notify(item) {
  if (item !== PUMPKIN) return;
  window.TrollNotis?.show?.({
    id: `tf-grant-${item}-${myId()}`,
    platform: "reward",
    summary: "You got the Pumpkin Head, free for playing Chapter One. It's yours to keep. Find it in the Locker, under Face.",
    screen: "faces",   // (the inbox keeps the message: menu/inbox.js opens this screen from it)
    onCta: () => window.dispatchEvent(new CustomEvent("trollforces:open-screen", { detail: "faces" })),
  });
}

/* Ask the server, once per sign-in. No SQL yet, offline, or signed out:
   nothing changes (what this browser already knows stands). */
let askedFor = null;
export async function claimGrants() {
  const uid = myId();
  if (!uid || askedFor === uid) return;
  askedFor = uid;
  const sb = accounts()?.getClient?.();
  if (!sb) { askedFor = null; return; }
  try {
    const { data, error } = await sb.rpc("troll_forces_claim_pumpkin_head");
    if (error || myId() !== uid) { if (error) askedFor = null; return; }
    if (data?.owned) own(uid, PUMPKIN);
  } catch { askedFor = null; return; }
  changed();
}

window.addEventListener("trollrunner:auth-changed", () => { changed(); void claimGrants(); });
void claimGrants();
