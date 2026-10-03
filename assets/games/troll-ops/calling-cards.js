// Troll Forces calling cards + clan tags (prestige phase 4, design doc
// "Troll Forces: Prestige + Profile Card"). The wide banner behind your name
// on the profile card, and the up-to-4-character tag shown as `[TRLL] name`
// on the card, the scoreboard and name tags.
//
// Stored in public.troll_forces_card, written only by troll_forces_set_card()
// (assets/supabase/troll_forces_card.sql), which re-checks the clan tag and
// that the card is one you may wear. Keep CARDS and cleanClan() in step with
// it. Guests keep nothing, so they wear the default card and no tag.

import { prestigeUnlocked } from "./progression.js?v=umb1";

const ART = (file) => new URL(`./ui/cards/${file}`, import.meta.url).href;

/* Free starters, cut from the $TROLL banners (@swish art). Phase 5 adds the
   prestige reward cards here with `prestige: n` (and to the SQL). */
export const CARDS = [
  { id: "hitman", name: "Hitman", src: ART("hitman.jpg"), desc: "Red room, one hammer, no witnesses." },
  { id: "blade", name: "Blade", src: ART("blade.jpg"), desc: "Sheathed. For now." },
  { id: "overcharge", name: "Overcharge", src: ART("overcharge.jpg"), desc: "Running on pure static." },
  { id: "main-event", name: "Main Event", src: ART("main-event.jpg"), desc: "Walkout lights, title on the line." },
  { id: "ambush", name: "Ambush", src: ART("ambush.jpg"), desc: "You never saw the grin coming." },
  { id: "brute", name: "Brute", src: ART("brute.jpg"), desc: "Doesn't walk. Lands." },
];
export const DEFAULT_CARD = "hitman";

export function cardById(id) {
  return CARDS.find((c) => c.id === id) || CARDS.find((c) => c.id === DEFAULT_CARD);
}

/* Starters are open to anyone signed in; reward cards need their prestige
   (prestigeUnlocked keeps the owner open). */
export function cardUnlocked(card) {
  return !card?.prestige || prestigeUnlocked(card.prestige);
}

/* Upper case, letters and numbers only, 4 at most. Same rule as the SQL. */
export function cleanClan(s) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}
const BLOCKED = /(NIG|FAG|KKK|NAZI|HTLR|CUNT|RAPE)/;
export function clanAllowed(tag) {
  return !BLOCKED.test(tag);
}

/* `[TRLL] name`, or just the name with no tag. */
export function withClan(name, clan) {
  const tag = cleanClan(clan);
  return tag ? `[${tag}] ${name}` : name;
}

function accounts() { return window.TrollrunnerAccounts; }
function myId() {
  const p = accounts()?.getCachedProfile?.();
  return p?.id || p?.userId || null;
}

const mine = { clan: "", card: DEFAULT_CARD };
let mineFor = null;
const cache = new Map();   // userId -> { at, value }

async function readCard(userId) {
  const sb = accounts()?.getClient?.();
  if (!sb || !userId) return null;
  const { data, error } = await sb.from("troll_forces_card").select("clan, card").eq("user_id", userId).maybeSingle();
  if (error) return null;
  return { clan: cleanClan(data?.clan), card: cardById(data?.card).id };
}

/* Your card, once per sign-in. */
async function loadMine() {
  const id = myId();
  if (id === mineFor) return;
  mineFor = id;
  Object.assign(mine, { clan: "", card: DEFAULT_CARD });
  const got = id ? await readCard(id) : null;
  if (mineFor !== id) return;
  if (got) Object.assign(mine, got);
  window.dispatchEvent(new CustomEvent("trollforces:card-changed"));
}
window.addEventListener("trollrunner:auth-changed", () => void loadMine());
void loadMine();

export function getMyCard() {
  return myId() ? { ...mine } : { clan: "", card: DEFAULT_CARD };
}

/* Save your clan tag and/or card. Resolves to the saved pair, or throws the
   server's reason (a locked card, a bad tag, the SQL not run yet). */
export async function saveMyCard({ clan = mine.clan, card = mine.card } = {}) {
  const sb = accounts()?.getClient?.();
  if (!sb || !myId()) throw new Error("Sign in to set your card.");
  const tag = cleanClan(clan);
  if (!clanAllowed(tag)) throw new Error("Pick another clan tag.");
  if (!cardUnlocked(cardById(card))) throw new Error("That calling card is locked.");
  const { data, error } = await sb.rpc("troll_forces_set_card", { p_clan: tag, p_card: card });
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message || "") ? "Cards aren't switched on yet." : error.message || "Couldn't save.");
  mine.clan = cleanClan(data?.clan ?? tag);
  mine.card = cardById(data?.card ?? card).id;
  cache.set(myId(), { at: performance.now(), value: { ...mine } });
  window.dispatchEvent(new CustomEvent("trollforces:card-changed"));
  return { ...mine };
}

/* Anyone's card (default card, no tag when they've never set one). */
export async function fetchCard(userId) {
  if (!userId) return { clan: "", card: DEFAULT_CARD };
  if (userId === myId()) return getMyCard();
  const hit = cache.get(userId);
  if (hit && performance.now() - hit.at < 30000) return hit.value;
  const value = (await readCard(userId)) || { clan: "", card: DEFAULT_CARD };
  cache.set(userId, { at: performance.now(), value });
  return value;
}
