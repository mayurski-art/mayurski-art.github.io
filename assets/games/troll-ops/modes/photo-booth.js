/* Socialize: the photo booth (user, 2026-10-27: "the photo booth should
   actually work and users should be able to enter inside of it"). A map
   lists its booths (MAPS[id].booths: Undergrin's two Fotoautomats,
   maps/undergrin.js UG_BOOTHS): the floor inside, the camera in the back
   wall and where it looks. Stand inside, hold X: onto the footprints facing
   the lens, a 3-2-1 countdown, four
   flashes, and each one renders the booth from its own camera, you in it
   (your body shown for the shot even in first person, the arms hidden),
   whoever squeezed in with you too. The four frames come back as a strip
   in the booth's cream card with the station's name and the date: save it
   as a PNG or close it. Local only: nobody else sees your flashes. */

import * as THREE from "three";
import { rpExtras } from "./social-rp.js?v=rp1-si1-gj1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-wf1-rp2-wf2-tc1-tc2-ls1-rp3-rr1-op1-ld1-an1-zf1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-tb1-ut1-is1-tg1-tw1-arw1-su1-tcs1-kb0-kb1-kb2-kb3-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-tcs2-mg1-kb12-tm2-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb2-jb3-jb4-jb5-jb6-sp1-hh1-yb1-chg1-kbt1-gb1-gb2-gb3-rh1-ls4-gb4-gb5-gb6-gb7-gb8-gb9-tb2-pd2-ci6-kbb1-kbb2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-sam1-tfp1-tfp2-tfp3-rl1-tfp4-tfp7-tfb8-aar2-tfm2-rfx1-rfx2-rfx3-lz1-rr2-ret1-ret2-mrg1-hgb3-rm1-kzf1-fp2-lk1-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-mrc1-fr1-hgb5-hgb6-hgb8-hgb9-rt2-mmd1-rd1-fd1-rx1-hgo1-hje1-ng1-ng2-hwl1-p416-lmg1-wb1-mt2-sk1-hb4-jx2-jx3-jx4-jx5-mb1-mb2-gc1-nft33-nfh1";
import { showWaveBanner } from "../core/hud.js?v=cr1-si1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dc2-dc3-rp2-ls1-rp3-rr1-ld1-rt1-ld2-ld3-ut1-gf1-tg1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mg1-tx1-sp1-chg1-kbt1-gb1-rh1-ci6-pm1-kbk2-zw1-sam1-tfp7-tfb8-ss1-ss2-ss3-tfm2-rfx1-rfx2-lz1-ret1-ret2-mrg1-ugb1-ug1-ugm1-mrc1-hgb6-hgb8-tw1-rt2-fd1-ars1-mrg3-p416-wb1-mt2-sk1-hb4-lu1-mb1-mb2-gc1-bt1-nft33-nfh1";
import { game } from "../core/state.js?v=st1";

const SHOTS = 4;
const COUNT_S = 3;          // the countdown before the first flash
const GAP_S = 1.4;          // between flashes
const FW = 360, FH = 450;   // a frame, px
const FONT = "Bahnschrift, 'DIN Alternate', 'DIN Condensed', 'Roboto Condensed', 'Arial Narrow', Arial, sans-serif";

let run = null;             // { b, t, shots: [canvas], next }
let ui = null;              // the overlay's elements
let rt = null, cam = null;

const booths = () => (game.isSocial() ? game.builtMap?.map?.booths || [] : []);
const inside = (b, p) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && Math.abs(p.y - b.floor) < 0.7;
const boothAt = (p) => booths().find((b) => inside(b, p)) || null;

rpExtras.push(() => {
  if (!game.isSocial() || !game.player.alive || stripOpen()) return null;
  const b = boothAt(game.move.pos);
  if (!b) return null;
  if (run) return { key: "booth-busy", info: true, label: "Look at the camera" };
  return { key: `booth-${b.id}`, label: "Take four photos", busy: "Get ready…", ctx: "Photos", time: 0.4, done: () => start(b) };
});

function start(b) {
  // onto the footprints, facing the lens (walked in, you'd stop at the
  // back wall with the camera inside your head)
  if (b.spot) {
    game.move.pos.set(b.spot[0], b.spot[1], b.spot[2]);
    game.move.velocity?.set(0, 0, 0);
    if (Number.isFinite(b.yaw)) { game.look.yaw = b.yaw; game.look.pitch = 0; }
  }
  run = { b, t: 0, shots: [], next: COUNT_S };
  overlay();
  ui.count.textContent = String(COUNT_S);
  ui.count.style.opacity = "1";
  showWaveBanner("Look at the camera", 1500);
}

/* Each frame, from view/player-update.js (Socialize only). */
export function updatePhotoBooth(dt) {
  if (!run) return;
  if (!game.player.alive || !inside(run.b, game.move.pos)) { cancel(); return; }
  run.t += dt;
  const left = run.next - run.t;
  if (run.shots.length === 0 && left > 0) ui.count.textContent = String(Math.ceil(left));
  else ui.count.style.opacity = "0";
  if (run.t >= run.next) {
    flash();
    const shot = capture(run.b);
    if (shot) run.shots.push(shot);
    run.next += GAP_S;
    if (run.shots.length >= SHOTS || !shot) {
      const shots = run.shots;
      run = null;
      if (shots.length) showStrip(strip(shots));
    }
  }
}

export const photoBoothBusy = () => !!run;

function cancel() {
  run = null;
  if (ui) ui.count.style.opacity = "0";
}

/* The booth's camera, rendered off screen with your own body in shot. */
function capture(b) {
  const r = game.renderer, scene = game.scene;
  if (!r || !scene) return null;
  try {
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(FW, FH, { depthBuffer: true });
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      cam = new THREE.PerspectiveCamera(62, FW / FH, 0.05, 80);
    }
    cam.position.set(...b.cam);
    cam.lookAt(...b.look);
    cam.updateMatrixWorld();
    const rig = game.localRig?.root;
    const rigVis = rig?.visible, camVis = game.camera.visible;
    if (rig) rig.visible = true;
    game.camera.visible = false;          // the first-person arms ride the camera
    const prev = r.getRenderTarget();
    r.setRenderTarget(rt);
    r.clear();
    r.render(scene, cam);
    const px = new Uint8Array(FW * FH * 4);
    r.readRenderTargetPixels(rt, 0, 0, FW, FH, px);
    r.setRenderTarget(prev);
    if (rig) rig.visible = rigVis;
    game.camera.visible = camVis;
    const cv = document.createElement("canvas");
    cv.width = FW; cv.height = FH;
    const g = cv.getContext("2d");
    const img = g.createImageData(FW, FH);
    for (let y = 0; y < FH; y++) img.data.set(px.subarray((FH - 1 - y) * FW * 4, (FH - y) * FW * 4), y * FW * 4);
    // the booth's look: a little warmth and contrast, a soft vignette
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const k = (v) => Math.max(0, Math.min(255, (v - 128) * 1.12 + 132));
      d[i] = k(d[i] * 1.04); d[i + 1] = k(d[i + 1]); d[i + 2] = k(d[i + 2] * 0.93); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const v = g.createRadialGradient(FW / 2, FH / 2, FH * 0.3, FW / 2, FH / 2, FH * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = v;
    g.fillRect(0, 0, FW, FH);
    return cv;
  } catch (e) {
    console.warn("photo booth:", e);
    return null;
  }
}

/* The strip: the frames down a cream card, the station's name and the date under them. */
function strip(shots) {
  const S = 0.8, w = Math.round(FW * S), h = Math.round(FH * S), m = 22, gap = 14, foot = 64;
  const cv = document.createElement("canvas");
  cv.width = w + 2 * m;
  cv.height = m + shots.length * (h + gap) - gap + foot;
  const g = cv.getContext("2d");
  g.fillStyle = "#f3ead2";
  g.fillRect(0, 0, cv.width, cv.height);
  shots.forEach((s, i) => {
    const y = m + i * (h + gap);
    g.fillStyle = "#1b1b1b";
    g.fillRect(m - 2, y - 2, w + 4, h + 4);
    g.drawImage(s, m, y, w, h);
  });
  const name = game.builtMap?.map?.name || "Undergrin";
  const d = new Date();
  const date = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  g.fillStyle = "#1b1b1b";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 22px ${FONT}`;
  g.fillText(`Fotoautomat · ${name}`, cv.width / 2, cv.height - foot / 2 - 9);
  g.font = `500 15px ${FONT}`;
  g.fillText(date, cv.width / 2, cv.height - foot / 2 + 14);
  return cv;
}

/* ---- the overlay: the countdown, the flash, the strip */

function overlay() {
  if (ui) return;
  const root = document.createElement("div");
  root.id = "photo-booth";
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:60;font-family:" + FONT;
  const count = document.createElement("div");
  count.style.cssText = "position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font-size:min(22vw,180px);font-weight:800;color:#fff;" +
    "text-shadow:0 4px 24px rgba(0,0,0,.6);opacity:0;transition:opacity .15s";
  const fl = document.createElement("div");
  fl.style.cssText = "position:absolute;inset:0;background:#fff;opacity:0";
  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "Your photo strip");
  card.style.cssText = "position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:18px;flex-direction:column;" +
    "background:rgba(10,12,18,.72);pointer-events:auto";
  const img = document.createElement("img");
  img.alt = "Your photo strip: four photos from the booth";
  img.style.cssText = "max-height:calc(100vh - 120px);max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,.6);transform:rotate(-1.5deg)";
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:12px";
  const btn = (label, primary) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = `font:700 16px ${FONT};padding:10px 22px;border-radius:10px;border:0;cursor:pointer;` +
      (primary ? "background:#ffd23f;color:#111" : "background:rgba(255,255,255,.14);color:#fff");
    return b;
  };
  const save = btn("Save photo", true), close = btn("Close", false);
  row.append(save, close);
  card.append(img, row);
  root.append(fl, count, card);
  document.body.append(root);
  save.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = img.src;
    a.download = `troll-forces-fotoautomat-${Date.now()}.png`;
    a.click();
  });
  close.addEventListener("click", () => {
    hideStrip();
    try { game.renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch { /* not focused */ }
  });
  ui = { root, count, fl, card, img, save, close };
}

function flash() {
  ui.fl.style.transition = "none";
  ui.fl.style.opacity = "0.95";
  requestAnimationFrame(() => {
    ui.fl.style.transition = "opacity .45s ease-out";
    ui.fl.style.opacity = "0";
  });
}

function showStrip(cv) {
  overlay();
  ui.img.src = cv.toDataURL("image/png");
  ui.card.style.display = "flex";
  try { document.exitPointerLock?.(); } catch { /* not locked */ }
  ui.save.focus();
}

function hideStrip() {
  if (ui) ui.card.style.display = "none";
}

export const stripOpen = () => !!ui && ui.card.style.display === "flex";

/* For tools/troll-ops-photo-booth-test.mjs. */
export const photoBoothDebug = { booths, boothAt, start, capture, strip, showStrip, hideStrip, get run() { return run; } };
