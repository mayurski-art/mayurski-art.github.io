// Troll Forces — cosmetics: customise your trollface operator.
//
// First slot: the face. An expression (the classic grin, or the sad
// trollface from trolltruths.com); the trollface itself is always white
// (no face colours: user, 2026-10-08). Saved per browser, worn on the menu
// operator and your body in matches, and sent to everyone else on the
// state packet (`fc`), so the room sees what you picked. character.js owns
// the materials (faceMaterial / setFace); this file is the picks and the
// panel.

import { FACE_COVERINGS, coveringCanvas } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1";
import { WRISTWEAR, watchThumb } from "./wristwear.js?v=ww1c2";

const KEY = "trollops:cosmetics";

export const EXPRESSIONS = [
  { id: "grin", name: "Trollface", img: "../../images/wallpaper/trollface%20transparent.png" },
  { id: "sad", name: "Sad trollface", img: "./ui/trollface-sad.png" },
];
// Face coverings (character.js FACE_COVERINGS): worn over the lower face.
export const COVERINGS = [
  { id: "", name: "None" },
  { id: "bandana-blue", name: "Blue bandana" },
  { id: "bandana-red", name: "Red bandana" },
  { id: "bandana-black", name: "Black bandana" },
  { id: "bandana-green", name: "Green bandana" },
];
// Wristwear (wristwear.js WRISTWEAR): a watch on the left wrist.
export const WRISTS = [{ id: "", name: "None" }, ...Object.entries(WRISTWEAR).map(([id, w]) => ({ id, name: w.name }))];
const EXPR_IDS = new Set(EXPRESSIONS.map((e) => e.id));

/* A face key off the wire or storage, or the default when it's not one we
   know: "expression:og", plus ":covering" when one's worn, plus ":wrist"
   when a watch is (the covering part left empty without one:
   "grin:og::rolex-gold"). The second part was a face colour once; any old
   one reads as "og". */
export function cleanFaceKey(key) {
  const [e, , c, w] = String(key || "").split(":");
  if (!EXPR_IDS.has(e)) return "grin:og";
  const cover = FACE_COVERINGS[c] ? c : "";
  const wrist = WRISTWEAR[w] ? w : "";
  return `${e}:og${cover || wrist ? `:${cover}` : ""}${wrist ? `:${wrist}` : ""}`;
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

/* The Cosmetics panel: expression, covering and wrist cards. `onChange(face)`
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
    this.coverBox = sec("Face covering", "Tie something over the grin. It still shows through.");
    this.coverBox.className = "to-cos-faces";
    this.coverBox.setAttribute("role", "radiogroup");
    this.coverBox.setAttribute("aria-label", "Face covering");
    const art = new Image();
    art.src = new URL(EXPRESSIONS[0].img, import.meta.url).href;
    for (const cv of COVERINGS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-cos-face";
      b.dataset.cover = cv.id;
      b.setAttribute("role", "radio");
      const thumb = document.createElement("span");
      thumb.className = "to-cos-thumb";
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      // the face with this covering on it, drawn once the art has loaded
      const draw = () => {
        const c = document.createElement("canvas");
        c.width = 800; c.height = 730;
        const g = c.getContext("2d");
        g.drawImage(art, 0, 0, 800, 730);
        if (cv.id) g.drawImage(coveringCanvas(cv.id, art), 0, 0);
        img.src = c.toDataURL();
        thumb.style.setProperty("--art", `url("${img.src}")`);
      };
      if (art.complete && art.naturalWidth) draw(); else art.addEventListener("load", draw);
      thumb.appendChild(img);
      const name = document.createElement("span");
      name.textContent = cv.name;
      b.append(thumb, name);
      b.addEventListener("click", () => this.set({ cover: cv.id }));
      this.coverBox.appendChild(b);
    }
    this.wristBox = sec("Wrist", "Something on the left wrist. Shows in your own hands too.");
    this.wristBox.className = "to-cos-faces";
    this.wristBox.setAttribute("role", "radiogroup");
    this.wristBox.setAttribute("aria-label", "Wrist");
    for (const wr of WRISTS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-cos-face";
      b.dataset.wrist = wr.id;
      b.setAttribute("role", "radio");
      const thumb = document.createElement("span");
      thumb.className = "to-cos-thumb";
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.src = wr.id ? watchThumb(wr.id) : art.src;
      thumb.style.setProperty("--art", `url("${img.src}")`);
      thumb.appendChild(img);
      const name = document.createElement("span");
      name.textContent = wr.name;
      b.append(thumb, name);
      b.addEventListener("click", () => this.set({ wrist: wr.id }));
      this.wristBox.appendChild(b);
    }
    this.paint();
  }

  get face() { return this.state.face; }

  set({ expr, cover, wrist }) {
    const [e0, , c0 = "", w0 = ""] = this.state.face.split(":");
    const c = cover ?? c0, w = wrist ?? w0;
    this.state.face = cleanFaceKey(`${expr || e0}:og:${c}:${w}`);
    saveCosmetics(this.state);
    this.paint();
    this.onChange?.(this.state.face);
  }

  paint() {
    if (!this.root) return;
    const e = this.state.face.split(":")[0];
    for (const b of this.exprBox.children) {
      const on = b.dataset.expr === e;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
    }
    const cover = this.state.face.split(":")[2] || "";
    for (const b of this.coverBox.children) {
      const on = b.dataset.cover === cover;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
    }
    const wrist = this.state.face.split(":")[3] || "";
    for (const b of this.wristBox.children) {
      const on = b.dataset.wrist === wrist;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
    }
  }
}
