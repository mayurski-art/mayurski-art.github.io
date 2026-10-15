// Troll Forces — cosmetics: customise your trollface operator.
//
// First slot: the face. An expression (the classic grin, or the sad
// trollface from trolltruths.com); the trollface itself is always white
// (no face colours: user, 2026-10-08). Saved per browser, worn on the menu
// operator and your body in matches, and sent to everyone else on the
// state packet (`fc`), so the room sees what you picked. character.js owns
// the materials (faceMaterial / setFace); this file is the picks and the
// panel.

import { FACE_COVERINGS, coveringCanvas } from "./character.js?v=to-hb4-em1-fc1-wst-soc1-ww1c2f1m1u-gt1-gt2-bk1-cw1-zr10-bf1-sr1";
import { WRISTWEAR, watchThumb } from "./wristwear.js?v=ww1c2m1";
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
// Bodies: the stick troll, or a TROLLS NFT's look (blocky-body.js
// wearBlocky). A token's body is for its holder only: until the wallet
// check exists (TROLLS-TRAITS.md) each is locked to its holder's
// trollrunner.net account by username (`holder`), and nobody else, not
// even the owner, can put it on (user, 2026-10-15: #820 "should only be
// exclusively played by him only").
export const BODIES = [
  { id: "", name: "Stick troll", img: "../../images/wallpaper/trollface%20transparent.png" },
  { id: "trolls-1718", token: 1718, name: "TROLLS #1718", img: "./ui/trolls-1718.png", holder: "troll_runner" },
  { id: "trolls-820", token: 820, name: "TROLLS #820", img: "./ui/trolls-820.png", holder: "guccibeardd" },
];
/* The signed-in account's username, lower case ("" signed out). */
export function username() {
  return String(window.TrollrunnerAccounts?.getCachedProfile?.()?.username || "").toLowerCase();
}
/* Body id -> its TROLLS token (0 for the stick or an unknown id). */
export function bodyToken(id) {
  return BODIES.find((x) => x.id === id)?.token || 0;
}
/* May an account named `name` wear token #token's body? Checked for your
   own pick (canWearBody) and for every player on the wire (remote-players.js):
   a body shows on its holder only. */
export function holderOf(token) {
  return BODIES.find((x) => x.token === +token)?.holder || null;
}
export function mayWear(token, name) {
  const holder = holderOf(token);
  return !!holder && String(name || "").toLowerCase() === holder;
}
/* A TROLLS body brings its own head and face (the NFT's art), so the
   expression and the face covering come off while it's worn and can't go
   back on (user, 2026-10-12). The wrist isn't the head: it stays. */
const FACE_FREE = "grin";
const ownFace = (face) => {
  const w = String(face).split(":")[3] || "";
  return cleanFaceKey(`${FACE_FREE}:og::${w}`);
};

/* May the signed-in account wear body `id`? */
export function canWearBody(id) {
  const b = BODIES.find((x) => x.id === id);
  return !!b && (!b.holder || mayWear(b.token, username()));
}

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
    return { face: cleanFaceKey(c.face), body: BODIES.some((b) => b.id === c.body) ? c.body : "" };
  } catch { return { face: "grin:og", body: "" }; }
}
function saveCosmetics(c) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

/* The Cosmetics panel: body, expression, covering and wrist cards.
   `onChange(face)` fires with the new key on every face pick, `onBody(id)`
   with the body to wear (see `body`) on a body pick or a sign-in change. */
export class CosmeticsPanel {
  constructor(root, onChange, onBody) {
    this.root = root;
    this.onChange = onChange;
    this.onBody = onBody;
    this.state = loadCosmetics();
    if (!root) return;
    root.replaceChildren();
    // a locked body unlocks (or locks) as the account signs in (or out)
    // signing in or out can put a TROLLS body on or take it off, and the face with it
    window.addEventListener("trollrunner:auth-changed", () => { this.paint(); this.onBody?.(this.body); this.onChange?.(this.face); });
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
    this.bodyBox = sec("Body", "Wear a TROLLS NFT's look. Holders only.");
    this.bodyBox.className = "to-cos-faces";
    this.bodyBox.setAttribute("role", "radiogroup");
    this.bodyBox.setAttribute("aria-label", "Body");
    for (const bd of BODIES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-cos-face";
      b.dataset.body = bd.id;
      b.setAttribute("role", "radio");
      const url = new URL(bd.img, import.meta.url).href;
      const thumb = document.createElement("span");
      thumb.className = "to-cos-thumb";
      thumb.style.setProperty("--art", `url("${url}")`);
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.draggable = false;
      thumb.appendChild(img);
      const name = document.createElement("span");
      name.textContent = bd.name;
      b.append(thumb, name);
      b.addEventListener("click", () => { if (canWearBody(bd.id)) this.setBody(bd.id); });
      this.bodyBox.appendChild(b);
    }
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
      b.addEventListener("click", () => { if (!this.body) this.set({ expr: e.id }); });
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
      b.addEventListener("click", () => { if (!this.body) this.set({ cover: cv.id }); });
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

  /* The face you wear: the pick, or (a TROLLS body on) the plain face with
     only the wrist kept, since the body's own head covers the rest. */
  get face() { return this.body ? ownFace(this.state.face) : this.state.face; }
  /* The body to wear: the pick, if this account may wear it ("" the stick). */
  get body() { return canWearBody(this.state.body) ? this.state.body : ""; }

  setBody(id) {
    this.state.body = id;
    // a TROLLS body takes the face pieces off for good (pick them again after)
    if (this.body) this.state.face = ownFace(this.state.face);
    saveCosmetics(this.state);
    this.paint();
    this.onBody?.(this.body);
    this.onChange?.(this.face);
  }

  set({ expr, cover, wrist }) {
    if (this.body) { expr = undefined; cover = undefined; }   // the body's own head
    const [e0, , c0 = "", w0 = ""] = this.state.face.split(":");
    const c = cover ?? c0, w = wrist ?? w0;
    this.state.face = cleanFaceKey(`${expr || e0}:og:${c}:${w}`);
    saveCosmetics(this.state);
    this.paint();
    this.onChange?.(this.state.face);
  }

  paint() {
    if (!this.root) return;
    const body = this.body;
    for (const b of this.bodyBox.children) {
      const on = b.dataset.body === body;
      const locked = !canWearBody(b.dataset.body);
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
      b.setAttribute("aria-disabled", String(locked));
      b.title = locked ? "Locked: for the holder of this TROLLS NFT" : "";
    }
    // with a TROLLS body on, the face and covering cards are locked
    const face = this.face;
    const headLock = !!body;
    const lockNote = headLock ? "Off while you wear a TROLLS body: it has its own head" : "";
    this.exprBox.classList.toggle("is-locked", headLock);
    this.coverBox.classList.toggle("is-locked", headLock);
    const e = face.split(":")[0];
    for (const b of this.exprBox.children) {
      const on = !headLock && b.dataset.expr === e;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
      b.setAttribute("aria-disabled", String(headLock));
      b.title = lockNote;
    }
    const cover = face.split(":")[2] || "";
    for (const b of this.coverBox.children) {
      const on = !headLock && b.dataset.cover === cover;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
      b.setAttribute("aria-disabled", String(headLock));
      b.title = lockNote;
    }
    const wrist = this.state.face.split(":")[3] || "";
    for (const b of this.wristBox.children) {
      const on = b.dataset.wrist === wrist;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
    }
  }
}
