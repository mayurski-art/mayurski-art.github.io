// Troll Forces — who holds each TROLLS NFT body, from the server (user,
// 2026-10-31: troll_runner hands them out in the game). The table and its two
// functions are assets/supabase/troll_forces_nft_holders.sql. cosmetics.js
// asks holderFromServer() first and falls back to the name in its BODIES
// list when the server has none (not set up yet, offline, never set).
//
// The list is fetched on load and on every sign-in change, and remembered
// in this browser so the Locker knows it offline; each fetch that changes it
// fires "trollforces:nft-holders".

const KEY = "trollops:nft-holders";   // { token: username in lower case }

const client = () => window.TrollrunnerAccounts?.getClient?.() || null;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}
let holders = read();

/* The server's holder of `token` (lower case), or null when it has none. */
export function holderFromServer(token) {
  return holders[+token] || null;
}

/* Fetch the list. Fails quietly: what this browser knew stands. */
export async function refreshHolders() {
  const sb = client();
  if (!sb) return false;
  try {
    const { data, error } = await sb.rpc("troll_forces_nft_holders_list");
    if (error || !Array.isArray(data)) return false;
    const next = {};
    for (const r of data) if (r?.token > 0 && r.username) next[r.token] = String(r.username).toLowerCase();
    if (JSON.stringify(next) === JSON.stringify(holders)) return true;
    holders = next;
    try { localStorage.setItem(KEY, JSON.stringify(holders)); } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent("trollforces:nft-holders"));
    return true;
  } catch { return false; }
}

/* Give `token` to the account named `username` (troll_runner only: the
   server refuses anyone else). troll_runner's own name takes it back.
   Resolves { ok, username } or { ok: false, error } with a line to show. */
export async function setHolder(token, username) {
  const sb = client();
  if (!sb) return { ok: false, error: "Not connected. Try again in a moment." };
  try {
    const { data, error } = await sb.rpc("troll_forces_set_nft_holder", { p_token: +token, p_username: String(username || "").trim() });
    if (error) {
      const missing = /troll_forces_set_nft_holder|schema cache|does not exist/i.test(error.message || "");
      return { ok: false, error: missing ? "The server isn't set up yet: run troll_forces_nft_holders.sql in Supabase." : error.message };
    }
    await refreshHolders();
    return { ok: true, username: data?.username || username };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Try again." };
  }
}

window.addEventListener("trollrunner:auth-changed", () => { void refreshHolders(); });
void refreshHolders();
