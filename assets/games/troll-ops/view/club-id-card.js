/* Trolling Loud's door: the ID you hold up to the bouncer (modes/club-entry.js).

   User, 2026-10-08, with the reference (refs/club-id-ref.jpg, the McLovin-
   style "HAWAII" trollface licence): "I very much like how this looks. Can
   we follow this structure." Same layout: a photo on sky blue with a barcode
   and three bold address lines under it on the left; the big blue state
   name, the number, DOB / EXP, the HT WT HAIR EYES SEX CTY row, the ISSUE
   DATE CLASS RESTR ENDORSE row and a signature on the right, a rainbow arc
   across it all. The details are yours (name, picture, clan); the rest is
   the joke. It's a prop, never an age check (CLUB-ENTRY.md).

   renderClubId(d) is the card's markup for the screen (d: profile-card.js
   myCardData()); drawMiniLicence(ctx, w, h) paints the small one other
   players see in your hand and the bouncer's. */

const TROLL_ART = new URL("../../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
const safeImg = (u) => (/^(https:|data:image\/|blob:|\/|\.\.?\/)/.test(String(u || "")) ? String(u) : "");

/* Bars of a barcode as a CSS gradient, the same for the same name. */
function barcode(seed) {
  let x = 0, h = seed || 1;
  const stops = [];
  while (x < 100) {
    h = Math.imul(h ^ (h >>> 13), 1103515245) + 12345 >>> 0;
    const bar = 0.5 + (h % 4) * 0.45, gap = 0.45 + ((h >>> 4) % 3) * 0.4;
    stops.push(`#111 ${x.toFixed(2)}%`, `#111 ${(x + bar).toFixed(2)}%`, `transparent ${(x + bar).toFixed(2)}%`, `transparent ${(x + bar + gap).toFixed(2)}%`);
    x += bar + gap;
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

const pad2 = (n) => String(n).padStart(2, "0");
const usDate = (d) => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;

export function renderClubId(d) {
  injectIdCss();
  const name = String(d.name || "Guest troll");
  const h = hash(name);
  const photo = safeImg(d.avatarUrl);
  const number = d.owner ? "69 - 69 - 80085" : `69 - 69 - ${String(10000 + (h % 90000))}`;
  const handle = name.replace(/\s+/g, "").toUpperCase();
  const clan = String(d.clan || "").replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase();
  const field = (k, v) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`;
  return `<article class="club-id${d.owner ? " is-owner" : ""}" aria-label="${esc(name)}'s ID card">`
    + `<div class="club-id-rainbow" aria-hidden="true"></div>`
    + `<div class="club-id-left">`
    + `<div class="club-id-photo${photo ? "" : " is-troll"}"><img src="${esc(photo || TROLL_ART)}" alt=""></div>`
    + `<div class="club-id-barcode" style="background-image:${barcode(h)}" aria-hidden="true"></div>`
    + `<address class="club-id-addr">${esc(handle)}.TROLL<br>420 BLAZE ST<br>HONOLULU HI&nbsp; 69420</address>`
    + `</div>`
    + `<div class="club-id-right">`
    + `<header class="club-id-head"><b class="club-id-state">HAWAII</b><span class="club-id-tag">TROLLING<br>LOUD</span></header>`
    + `<p class="club-id-num"><span>NUMBER</span> ${number}</p>`
    + `<p class="club-id-dates"><span>DOB</span> <b>09/19/2008</b> <span>EXP</span> <b>04/20/2028</b></p>`
    + `<dl class="club-id-stats">${field("HT", "6 - 7")}${field("WT", "260")}${field("HAIR", "BRO")}${field("EYES", "BRO")}${field("SEX", "yes")}${field("CTY", "0")}</dl>`
    + `<dl class="club-id-class">${field("ISSUE DATE", usDate(new Date()))}${field("CLASS", "$")}${field("RESTR", "")}${field("ENDORSE", clan)}</dl>`
    + `<p class="club-id-sig" aria-hidden="true">${esc(name)}</p>`
    + `</div>`
    + `</article>`;
}

function injectIdCss() {
  if (document.getElementById("club-id-css")) return;
  const s = document.createElement("style");
  s.id = "club-id-css";
  // Sizes are in cqw (the card's own width), so it reads the same on a phone.
  s.textContent = `
.club-id { container-type: inline-size; position: relative; aspect-ratio: 1.6; display: grid; grid-template-columns: 34% 1fr; gap: 0 3cqw;
  padding: 3.2cqw 3.6cqw 3cqw; border-radius: 3.6cqw; overflow: hidden; color: #111; text-align: left;
  background: #f4f4f1 radial-gradient(rgba(0,0,0,.035) 1px, transparent 1.4px) 0 0 / 3px 3px;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); font-family: "Segoe UI", Arial, sans-serif; }
.club-id-rainbow { position: absolute; inset: 0; pointer-events: none; opacity: .66; filter: blur(.3cqw);
  /* the top of a big arc just under the number, falling away to the right
     edge (its left half is behind the photo, as on the reference) */
  /* fitted to the reference: the red edge at 22% down by the photo, 37% at
     three quarters across, 55% at the right edge */
  background: radial-gradient(ellipse 98.5% 128% at 25% 150%, transparent 90%, #9d8ae0 91%, #72b8e8 92.6%, #8fd17a 94.2%,
    #f2dc6a 95.8%, #f3a35c 97.4%, #e86a6a 99%, transparent 100.2%);
  -webkit-mask-image: linear-gradient(90deg, transparent 34%, #000 40%); mask-image: linear-gradient(90deg, transparent 34%, #000 40%); }
.club-id-left, .club-id-right { position: relative; display: flex; flex-direction: column; min-width: 0; }
.club-id-photo { aspect-ratio: 1; border-radius: .8cqw; overflow: hidden;
  /* sky blue, mottled (the colour goes last: before the images it voids the whole rule) */
  background: radial-gradient(ellipse at 30% 25%, rgba(255,255,255,.5), transparent 55%), radial-gradient(ellipse at 75% 80%, #4aa3dc, transparent 60%), #7cc4ef; }
.club-id-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.club-id-photo.is-troll img { object-fit: contain; transform: translateY(6%) scale(.92); filter: drop-shadow(.4cqw .4cqw 0 rgba(0,0,0,.18)); }
.club-id-barcode { height: 7cqw; margin: 2.2cqw 0 1.6cqw; }
.club-id-addr { font-style: normal; font-weight: 800; font-size: 3.05cqw; line-height: 1.32; letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.club-id-head { display: flex; align-items: center; gap: 2cqw; }
.club-id-state { font-family: "Arial Black", Impact, sans-serif; font-weight: 900; font-size: 11.5cqw; line-height: .9; color: #1238c4; letter-spacing: -.02em;
  text-shadow: .5cqw .5cqw 0 #0a1440; }
.club-id.is-owner .club-id-state { color: #d8a52c; text-shadow: .5cqw .5cqw 0 #3a2806; }
.club-id-tag { font-family: "Arial Narrow", "Roboto Condensed", Arial, sans-serif; font-weight: 700; font-size: 3.6cqw; line-height: 1.05; color: #1238c4; }
.club-id-num { margin: 2.6cqw 0 0; font-size: 4.6cqw; letter-spacing: .02em; white-space: nowrap; }
.club-id-num span, .club-id-dates span { font-weight: 800; font-size: 2.7cqw; margin-right: 1cqw; }
.club-id-dates { margin: 2.2cqw 0 0; font-size: 2.7cqw; white-space: nowrap; }
.club-id-dates b { font-family: "Arial Narrow", Arial, sans-serif; font-size: 5.6cqw; font-weight: 800; letter-spacing: -.02em; margin-right: 2.4cqw; }
.club-id dl { display: grid; margin: 1.2cqw 0 0; }
.club-id dl div { min-width: 0; }
.club-id dt { font-size: 2.6cqw; line-height: 1.2; }
.club-id dd { margin: 0; font-family: "Arial Narrow", Arial, sans-serif; font-weight: 700; font-size: 2.9cqw; min-height: 1.2em; }
.club-id-stats { grid-template-columns: repeat(6, 1fr); text-align: center; }
.club-id-class { grid-template-columns: 1.5fr 1fr 1fr 1.3fr; margin-top: 1.6cqw !important; }
.club-id-class dt { font-weight: 800; font-size: 2.7cqw; letter-spacing: .03em; }
.club-id-sig { margin: auto 0 0 4cqw; font-family: "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive; font-size: 4.6cqw; line-height: 1;
  transform: rotate(-3deg); white-space: nowrap; overflow: hidden; }
`;
  document.head.appendChild(s);
}

/* The small one in a hand (128 x 80 canvas): white card, blue photo square
   with a pale face, the blue state bar, a rainbow arc, a barcode, text lines. */
export function drawMiniLicence(g, w = 128, h = 80) {
  g.fillStyle = "#f4f4f1"; g.fillRect(0, 0, w, h);
  // the arc
  g.lineWidth = 3;
  ["#9d8ae0", "#72b8e8", "#8fd17a", "#f2dc6a", "#f3a35c", "#e86a6a"].forEach((c, i) => {   // violet inside, red out
    g.strokeStyle = c; g.globalAlpha = 0.6;
    g.beginPath(); g.ellipse(w * 0.25, h * 1.5, w * 0.9 + i * 3, h * 1.18 + i * 3, 0, Math.PI, Math.PI * 2); g.stroke();
  });
  g.globalAlpha = 1;
  // photo
  g.fillStyle = "#7cc4ef"; g.fillRect(5, 5, 38, 38);
  g.fillStyle = "#fbfbf8"; g.beginPath(); g.ellipse(24, 23, 12, 11, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#111"; g.lineWidth = 1.5; g.beginPath(); g.arc(24, 24, 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  // barcode
  g.fillStyle = "#111";
  for (let x = 6, i = 0; x < 42; i++) { const b = 1 + (i * 7 % 3) * 0.6; g.fillRect(x, 47, b, 9); x += b + 1 + (i * 5 % 2); }
  // address
  for (const [y, l] of [[61, 30], [67, 24], [73, 32]]) g.fillRect(6, y, l, 3);
  // the state name, the lines on the right
  g.fillStyle = "#1238c4"; g.font = "900 15px Arial Black, Impact, sans-serif"; g.textBaseline = "top"; g.fillText("HAWAII", 48, 5);
  g.fillStyle = "#222";
  for (const [y, l] of [[26, 58], [36, 46], [46, 70], [56, 60], [66, 34]]) g.fillRect(48, y, l, 3);
  // the rounded edge
  g.globalCompositeOperation = "destination-in";
  g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, h, 8) : g.rect(0, 0, w, h); g.fill();
  g.globalCompositeOperation = "source-over";
}
