// Troll Forces — cosmetics: customise your trollface operator.
//
// First slot: the face. An expression (the classic grin, or the sad
// trollface from trolltruths.com) and a skin tint (the PFP builder's base
// colours; the ink stays black). Saved per browser, worn on the menu
// operator and your body in matches, and sent to everyone else on the
// state packet (`fc`), so the room sees what you picked. character.js owns
// the materials (faceMaterial / setFace); this file is the picks and the
// panel.

import { FACE_TINTS } from "./character.js?v=to-jn1";

const KEY = "trollops:cosmetics";

export const EXPRESSIONS = [
  { id: "grin", name: "Trollface", img: "../../images/wallpaper/trollface%20transparent.png" },
  { id: "sad", name: "Sad trollface", img: "./ui/trollface-sad.png" },
];
export const TINTS = [
  { id: "og", name: "OG" }, { id: "gold", name: "Gold" }, { id: "green", name: "Green" },
  { id: "blue", name: "Blue" }, { id: "pink", name: "Pink" }, { id: "purple", name: "Purple" },
  { id: "red", name: "Red" }, { id: "stone", name: "Stone" },
];
const EXPR_IDS = new Set(EXPRESSIONS.map((e) => e.id));
const TINT_IDS = new Set(TINTS.map((t) => t.id));

/* A face key off the wire or storage, or the default when it's not one we know. */
export function cleanFaceKey(key) {
  const [e, t] = String(key || "").split(":");
  return EXPR_IDS.has(e) && TINT_IDS.has(t) ? `${e}:${t}` : "grin:og";
}

export function loadCosmetics() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { face: cleanFaceKey(c.face) };
  } catch { return { face: "grin:og" }; }
}
function saveCosmetics(c) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;

/* The Cosmetics panel: expression cards and tint swatches. `onChange(face)`
   fires with the new key on every pick. */
export class CosmeticsPanel {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    this.state = loadCosmetics();
    if (!root) return;
    root.replaceChildren();
    const sec = (title, hint) => {
      const h = document.createElement("div");
      h.className = "to-pf-sublabel";
      h.textContent = title;
      root.appendChild(h);
      if (hint) {
        const p = document.createElement("p");
        p.className = "to-cos-hint";
        p.textContent = hint;
        root.appendChild(p);
      }
      const g = document.createElement("div");
      root.appendChild(g);
      return g;
    };
    this.exprBox = sec("Face", "Your trollface's expression. Everyone in the match sees it.");
    this.exprBox.className = "to-cos-faces";
    this.exprBox.setAttribute("role", "radiogroup");
    this.exprBox.setAttribute("aria-label", "Face");
    for (const e of EXPRESSIONS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-cos-face";
      b.dataset.expr = e.id;
      b.setAttribute("role", "radio");
      // The art multiplied over a tint-coloured silhouette of itself: the
      // white skin takes the tint, the black ink stays black.
      const url = new URL(e.img, import.meta.url).href;
      const thumb = document.createElement("span");
      thumb.className = "to-cos-thumb";
      thumb.style.setProperty("--art", `url("${url}")`);
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.draggable = false;
      thumb.appendChild(img);
      const name = document.createElement("span");
      name.textContent = e.name;
      b.append(thumb, name);
      b.addEventListener("click", () => this.set({ expr: e.id }));
      this.exprBox.appendChild(b);
    }
    this.tintBox = sec("Face colour", "Tints the skin; the ink stays black.");
    this.tintBox.className = "to-cos-tints";
    this.tintBox.setAttribute("role", "radiogroup");
    this.tintBox.setAttribute("aria-label", "Face colour");
    for (const t of TINTS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-cos-tint";
      b.dataset.tint = t.id;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", t.name);
      b.title = t.name;
      b.style.setProperty("--tint", hex(FACE_TINTS[t.id] ?? 0xffffff));
      const name = document.createElement("span");
      name.textContent = t.name;
      b.appendChild(name);
      b.addEventListener("click", () => this.set({ tint: t.id }));
      this.tintBox.appendChild(b);
    }
    this.paint();
  }

  get face() { return this.state.face; }

  set({ expr, tint }) {
    const [e0, t0] = this.state.face.split(":");
    this.state.face = cleanFaceKey(`${expr || e0}:${tint || t0}`);
    saveCosmetics(this.state);
    this.paint();
    this.onChange?.(this.state.face);
  }

  paint() {
    if (!this.root) return;
    const [e, t] = this.state.face.split(":");
    for (const b of this.exprBox.children) {
      const on = b.dataset.expr === e;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
      b.style.setProperty("--tint", hex(FACE_TINTS[t] ?? 0xffffff));
    }
    for (const b of this.tintBox.children) {
      const on = b.dataset.tint === t;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
    }
  }
}
