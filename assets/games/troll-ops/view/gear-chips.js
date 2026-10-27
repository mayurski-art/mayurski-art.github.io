// Troll Forces — the gear chips bottom-left: pictures, not words.
//
// Each chip shows its item as an icon rendered from the game's own model
// (gear-icons/<id>.png, made by tools/troll-ops-gear-icons.mjs), one icon per
// one carried, side by side (user: "if users have or grab multiple frags or
// smokes etc. stack them next to each other clearly visible"), and the key
// that uses it on the device in play (user: "keep the associated keybind"):
// a keyboard key, the pad's button by its family's name (RB / R1 / R), none
// on touch, where the chips are hidden and the touch buttons do the job.
// The item's name stays on the chip as its accessible name and tooltip.
//
// weapons.js updateGearHud and royale.js updateRoyaleGear say what's
// carried; the keycaps follow the device on their own (a pad coming or
// going, or another family's pad, swaps them within a quarter second).

import { game } from "../core/state.js?v=st1";
import { padButtonName } from "../menu/controller-layout.js?v=cl7-pd1-or1-pd2";

const ICON_TAG = "gi1";
/* Every item with a picture: the melee weapons (gear.js MELEE_DEFS), the
   throwables (THROWABLE_DEFS), the Cope Plate and the Hopium. */
export const GEAR_ICON_IDS = ["keyboard", "trollsaber", "reaper", "chainsaw", "knuckles", "halo", "bat", "shovel",
  "frag", "flash", "smoke", "emp", "plate", "heal"];
const HAS_ICON = new Set(GEAR_ICON_IDS);
export const gearIconUrl = (id) => new URL(`../gear-icons/${id}.png?v=${ICON_TAG}`, import.meta.url).href;

/* Each chip's key: [keyboard, pad button index | glyph]. The throwable chip
   takes its kind's bumper (LB tactical, RB lethal, gamepad.js); G throws
   whichever you brought (keyboard-mouse.js). */
const KEYS = {
  melee: ["V", 11],
  lethal: ["G", 5],
  tactical: ["G", 4],
  plates: ["4", "↑"],
  heals: ["5", "↓"],
};
const PAD_WORDS = { "↑": "D-pad up", "↓": "D-pad down" };

/* Draw a chip: `slot` (a KEYS name), `id` (the icon), `name`, `count`
   (null: one picture, no stack, e.g. the melee weapon). An empty chip keeps
   one faded picture so you can still see what it's for. */
export function setGearChip(el, { slot, id, name, count = null }) {
  if (!el) return;
  const n = count == null ? 1 : Math.max(0, count | 0);
  const sig = `${id}|${name}|${count}`;
  if (el.dataset.gear !== sig) {
    el.dataset.gear = sig;
    el.dataset.slot = slot;
    let row = el.querySelector(".to-gear-icons");
    if (!row) {
      row = document.createElement("span");
      row.className = "to-gear-icons";
      el.append(row);
    }
    const label = count == null ? name : `${name} ×${n}`;
    const pics = HAS_ICON.has(id) ? Math.max(1, n) : 0;
    row.replaceChildren();
    for (let i = 0; i < pics; i++) {
      const img = document.createElement("img");
      img.src = gearIconUrl(id);
      img.className = "to-gear-icon" + (n === 0 ? " is-ghost" : "");
      img.width = img.height = 128;
      img.draggable = false;
      img.decoding = "async";
      img.alt = i === 0 ? label : "";   // one name for the stack, not one per picture
      row.append(img);
    }
    if (!pics) {
      // nothing drawn for it yet (a hero's own weapon): the word, as before
      const word = document.createElement("span");
      word.className = "to-gear-word";
      word.textContent = count == null ? name : `${name} ${n}`;
      row.append(word);
    }
    el.classList.toggle("is-empty", count != null && n <= 0);
    if (el.tagName === "BUTTON") {
      el.dataset.base ||= el.getAttribute("aria-label") || name;
      el.setAttribute("aria-label", `${el.dataset.base} (${n} left)`);
    } else {
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", label);
    }
    el.title = label;
    delete el.dataset.input;   // redraw the keycap's title with the new name
  }
  refreshKey(el);
  ensureWatch();
}

function inputKind() {
  if (game.gamepadState?.connected) return `pad:${padButtonName(5)}`;   // the family shows in its bumper's name
  return game.isTouch ? "touch" : "keys";
}

function refreshKey(el) {
  const kind = inputKind();
  if (el.dataset.input === kind) return;
  el.dataset.input = kind;
  const [key, pad] = KEYS[el.dataset.slot] || [];
  let cap = el.querySelector(":scope > b");
  if (!cap) { cap = document.createElement("b"); cap.setAttribute("aria-hidden", "true"); el.prepend(cap); }
  const onPad = kind.startsWith("pad");
  const glyph = onPad ? (typeof pad === "number" ? padButtonName(pad) : pad) : key;
  cap.hidden = kind === "touch" || !glyph;
  cap.textContent = glyph || "";
  cap.title = onPad ? (PAD_WORDS[glyph] || glyph) : `Key ${key}`;
}

/* The device can change under a chip that isn't redrawn (a pad plugged in
   mid-match, the stubbed pad in the tests): a light check, 4 times a second,
   while the page is visible. */
let watching = false;
function ensureWatch() {
  if (watching) return;
  watching = true;
  setInterval(() => {
    if (document.hidden) return;
    for (const el of document.querySelectorAll(".to-gear-chip[data-slot]")) refreshKey(el);
  }, 250);
}
