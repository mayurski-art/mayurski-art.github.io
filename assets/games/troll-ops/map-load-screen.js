/* Map loading screen, Black Ops 2 style (user, 2026-10-03): between Find
   Match and the countdown, a full-bleed snapshot of the map, its name and
   blurb, a loading bar and a random tip. It stays up for as long as the
   map takes to build and warm (map-preload.js) and, online, until everyone
   in the room has loaded too. game.js drives it; this file is only the UI.

   createMapLoadScreen(host) -> { show(mapInfo), setMap(mapInfo), progress(p),
   status(text), hide(), isOpen }. mapInfo: { id, name, blurb, mode }. */

/* Map shots (user, 2026-10-03: "highest quality", sized to the device).
   tools/troll-ops-map-previews.mjs renders each map at 4K through the
   game's own post chain and encodes this width ladder. The <img> gets them
   all as a srcset and the browser picks the smallest one that still covers
   its slot in real device pixels (DPR included): a phone pulls ~120 KB, a
   4K screen the full 3840. */
export const MAP_SHOTS = new Set(["culdegrin", "depot", "dustbowl", "grinbeach", "grinleria", "grinsite", "hollowgrin", "undergrin"]);
const SHOT_WIDTHS = [640, 1280, 1920, 2560, 3840];
const shotFile = (id, w) => `assets/games/troll-ops/ui/maps/${id}-${w}.webp?v=hq1`;
const shotSrcset = (id) => SHOT_WIDTHS.map((w) => `${shotFile(id, w)} ${w}w`).join(", ");
// The loading screen's shot: object-fit cover at scale(1.04), so it spans the
// width on a wide screen and the height (times 16/9) on a tall one.
const FULL_SIZES = "(max-aspect-ratio: 16/9) calc(104vh * 16 / 9), 104vw";

/* Point an <img> at a map's shot. `sizes` is how wide it shows (CSS px).
   Returns false (and hides it) for a map with no shot. */
export function setMapShot(img, id, sizes = FULL_SIZES) {
  if (!MAP_SHOTS.has(id)) { img.hidden = true; return false; }
  const set = shotSrcset(id);
  if (img.getAttribute("srcset") !== set) {
    img.sizes = sizes;   // before srcset, so the first pick already uses it
    img.srcset = set;
    img.src = shotFile(id, 1920);
  }
  img.hidden = false;
  return true;
}

/* Same, as markup, for lists built with innerHTML (the map vote). */
export const mapShotAttrs = (id, sizes) =>
  `src="${shotFile(id, 1920)}" srcset="${shotSrcset(id)}" sizes="${sizes}"`;

const TIPS = [
  "Hold G to cook a grenade. Let go when it's spicy.",
  "F throws your tactical. In Search & Destroy, hold F on a site to plant or defuse.",
  "V is melee. Rude, but it works.",
  "T inspects your gun. Purely for the drip.",
  "B flips to third person, so you can admire the fit.",
  "Q aims down sights too, if your right mouse button is busy.",
  "Hold X for the emote wheel. Taunt responsibly.",
  "Press Enter to chat with the room.",
  "Chain kills to earn scorestreaks. Pick your three under Scorestreaks.",
  "Build your loadouts in Create a Class before you drop in.",
  "Your profile card lives in Barracks. Make it embarrassing.",
  "Laptop running hot? Switch Animations off at the bottom right of the menu.",
  "Graphics on Auto trades effects for frames before it trades sharpness.",
  "Pin your city on the Troll Map and show up on the planet.",
  "Want your friends only? A Private Match code keeps the room to yourselves.",
  "Headshots hit harder. Aim for the grin.",
  "Settings > Gloves swaps your hands for something tactical.",
  "Max out your rank and you can prestige. Bragging rights included.",
  "Zombies doesn't stop coming. Neither should you.",
  "Bored of guns? The Arcade has more ways to troll.",
];

const CSS = `
.to-mapload{position:absolute;inset:0;z-index:40;overflow:hidden;background:#050302;color:#f3ece4;font-family:"DM Sans",sans-serif;pointer-events:auto}
.to-mapload[hidden]{display:none}
.to-mapload-shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.04);filter:saturate(1.05) contrast(1.05)}
.to-mapload-shot[hidden]{display:none}
.to-mapload-blank{position:absolute;inset:0;background:radial-gradient(120% 90% at 70% 30%,#3a1606 0%,#140703 45%,#050302 100%)}
.to-mapload-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,3,2,.55) 0%,rgba(5,3,2,0) 26%,rgba(5,3,2,0) 48%,rgba(5,3,2,.88) 78%,rgba(5,3,2,.97) 100%),linear-gradient(90deg,rgba(5,3,2,.55),rgba(5,3,2,0) 55%)}
.to-mapload-mode{position:absolute;left:clamp(16px,6vw,96px);top:clamp(16px,5vh,40px);margin:0;font:600 14px/1 Oswald,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#ff8a1f;text-shadow:0 2px 10px rgba(0,0,0,.9)}
.to-mapload-info{margin-bottom:clamp(12px,3vh,26px)}
.to-mapload-name{margin:0;font:600 clamp(36px,7vw,76px)/.95 Oswald,sans-serif;letter-spacing:.02em;text-transform:uppercase;text-shadow:0 3px 18px rgba(0,0,0,.9)}
.to-mapload-blurb{margin:10px 0 0;max-width:560px;font-size:15px;line-height:1.4;color:#e2d6c8;text-shadow:0 1px 8px rgba(0,0,0,.9)}
.to-mapload-blurb:empty{display:none}
.to-mapload-foot{position:absolute;left:clamp(16px,6vw,96px);right:clamp(16px,6vw,96px);bottom:clamp(16px,5vh,40px)}
.to-mapload-tip{margin:0 0 16px;max-width:720px;font-size:14px;line-height:1.4;color:#e2d6c8}
.to-mapload-tip b{margin-right:8px;font:600 12px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#ffd27a}
.to-mapload-row{display:flex;align-items:center;gap:14px}
.to-mapload-bar{flex:1;height:6px;border-radius:3px;overflow:hidden;background:rgba(243,236,228,.16)}
.to-mapload-bar i{display:block;height:100%;width:calc(var(--p,0)*100%);border-radius:3px;background:linear-gradient(90deg,#ff6a00,#ff8a1f 60%,#ffd27a);transition:width .25s ease}
.to-mapload-pct{min-width:44px;text-align:right;font:13px "DM Mono",monospace;color:#f3ece4}
.to-mapload-status{margin:8px 0 0;font:12px "DM Mono",monospace;color:#c9b8a6}
@media (max-height:480px){.to-mapload-blurb{display:none}.to-mapload-tip{margin-bottom:10px;font-size:13px}}
@media (prefers-reduced-motion:reduce){.to-mapload-bar i{transition:none}}
body.tf-anim-off .to-mapload-bar i{transition:none}
`;

export function createMapLoadScreen(host) {
  if (!document.getElementById("to-mapload-css")) {
    const st = document.createElement("style");
    st.id = "to-mapload-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const root = document.createElement("div");
  root.className = "to-mapload";
  root.id = "to-mapload";
  root.hidden = true;
  root.setAttribute("role", "status");
  root.innerHTML = `<div class="to-mapload-blank"></div><img class="to-mapload-shot" alt="" hidden>
    <div class="to-mapload-shade"></div>
    <p class="to-mapload-mode"></p>
    <div class="to-mapload-foot">
      <div class="to-mapload-info"><h2 class="to-mapload-name"></h2><p class="to-mapload-blurb"></p></div>
      <p class="to-mapload-tip"><b>Tip</b><span></span></p>
      <div class="to-mapload-row"><div class="to-mapload-bar" role="progressbar" aria-label="Loading map" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><span class="to-mapload-pct">0%</span></div>
      <p class="to-mapload-status" aria-live="polite"></p>
    </div>`;
  host.appendChild(root);
  const q = (s) => root.querySelector(s);
  const img = q(".to-mapload-shot"), bar = q(".to-mapload-bar"), pct = q(".to-mapload-pct");
  let shown = 0;
  let lastTip = -1;

  function setMap({ id, name, blurb, mode } = {}) {
    q(".to-mapload-mode").textContent = mode || "";
    q(".to-mapload-name").textContent = name || "";
    q(".to-mapload-blurb").textContent = blurb || "";
    setMapShot(img, id);
  }
  function progress(p) {
    // Never run backwards: a second map pass (the room switched maps) or a
    // later phase starting low shouldn't make the bar jump back.
    shown = Math.max(shown, Math.min(1, Math.max(0, p || 0)));
    q(".to-mapload-bar i").style.setProperty("--p", shown);
    const n = Math.round(shown * 100);
    pct.textContent = `${n}%`;
    bar.setAttribute("aria-valuenow", String(n));
  }
  return {
    get isOpen() { return !root.hidden; },
    setMap,
    progress,
    status(t) { q(".to-mapload-status").textContent = t || ""; },
    show(info) {
      shown = 0;
      progress(0);
      let i;
      do { i = Math.floor(Math.random() * TIPS.length); } while (TIPS.length > 1 && i === lastTip);
      lastTip = i;
      q(".to-mapload-tip span").textContent = TIPS[i];
      setMap(info);
      root.hidden = false;
      document.body.classList.add("to-mapload-on");
    },
    hide() { root.hidden = true; document.body.classList.remove("to-mapload-on"); },
  };
}
