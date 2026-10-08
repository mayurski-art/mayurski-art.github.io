// The sniper scope, Black Ops 2 style: aimed all the way in, the gun goes
// and the screen is the scope: a round lens in black, darkening to its rim,
// a thin crosshair with thick posts from the left, right and bottom, and
// range ticks. Only for the variable-zoom scope (userData.scopeKey
// "scope8"); an ACOG stays a model you look through.
//
// It lives as the HUD's bottom layer, so it hides with the HUD (menus,
// death) and sits under the ammo and score.

const FADE_FROM = 0.78;              // adsT where the scope starts to cover
const HIDE_GUN_AT = 0.9;             // overlay strength that hides the gun

const CSS = `
.to-scope { position: absolute; inset: 0; pointer-events: none; overflow: hidden; opacity: 0; display: none; }
.to-scope-lens { position: absolute; left: 50%; top: 50%; width: min(98vh, 98vw); aspect-ratio: 1; transform: translate(-50%, -50%);
  border-radius: 50%; box-shadow: 0 0 0 100vmax #000;
  background: radial-gradient(circle, rgba(140,170,200,0.05) 0%, transparent 50%, rgba(0,0,0,0.45) 80%, rgba(0,0,0,0.95) 95%, #000 100%); }
.to-scope-lens svg { position: absolute; inset: 0; width: 100%; height: 100%; }
`;

function svg() {
  const ticks = [];
  for (let d = 8; d <= 32; d += 8) {
    for (const s of [-1, 1]) {
      ticks.push(`<line x1="${s * d}" y1="-1.6" x2="${s * d}" y2="1.6"/>`);
      ticks.push(`<line x1="-1.6" y1="${s * d}" x2="1.6" y2="${s * d}"/>`);
    }
  }
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true">
    <g stroke="#050505" stroke-linecap="butt" fill="none">
      <line x1="-100" y1="0" x2="100" y2="0" stroke-width="0.32"/>
      <line x1="0" y1="-100" x2="0" y2="100" stroke-width="0.32"/>
      <line x1="-100" y1="0" x2="-40" y2="0" stroke-width="2.4"/>
      <line x1="100" y1="0" x2="40" y2="0" stroke-width="2.4"/>
      <line x1="0" y1="100" x2="0" y2="40" stroke-width="2.4"/>
      <g stroke-width="0.32">${ticks.join("")}</g>
    </g>
    <circle r="99.4" fill="none" stroke="#000" stroke-width="1.2"/>
  </svg>`;
}

let root = null;
let hidGun = null;

function mount() {
  const hud = document.getElementById("to-hud");
  if (!hud) return null;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  root = document.createElement("div");
  root.className = "to-scope";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `<div class="to-scope-lens">${svg()}</div>`;
  hud.prepend(root);
  return root;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* Called once a frame by weapon-view.js after the gun and arms are posed.
   `firstPerson` is false in third person, the killcam and dead. Returns
   the overlay's strength, 0..1. */
export function updateSniperScope(mesh, arms, w, holdingGun, firstPerson) {
  const scoped = holdingGun && firstPerson && mesh?.userData.scopeKey === "scope8";
  const t = scoped ? clamp01((w.adsT - FADE_FROM) / (1 - FADE_FROM)) : 0;
  const k = t * t * (3 - 2 * t);
  if (k > 0 || root) {
    const el = root || mount();
    if (el) {
      el.style.display = k > 0 ? "block" : "none";
      el.style.opacity = k.toFixed(3);
    }
  }
  // Through the glass the gun and hands are gone; give them back after.
  if (k >= HIDE_GUN_AT && mesh) {
    if (hidGun !== mesh) { if (hidGun) hidGun.visible = true; hidGun = mesh; }
    mesh.visible = false;
    if (arms) arms.visible = false;
  } else if (hidGun) {
    hidGun.visible = holdingGun;
    hidGun = null;
  }
  return k;
}
