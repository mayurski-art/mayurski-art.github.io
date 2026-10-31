// Trollnite boot screen: the picture moves a little (user, 2026-10-31:
// "animate some stuff in the image"). The key art stays one webp per look
// (tools/troll-ops-loading-art.mjs); this lays light layers over it, placed
// from ui/boot/key-art-anchors.json, which the tool writes beside the art:
// the moon, each jack-o'-lantern and the plane, as shares of the picture's
// width and height (a radius as a share of its height).
//
//   stars    a canvas of twinkling points over the sky (both looks)
//   plane    the C-130 alone (ui/boot/plane[-halloween].webp), crossing the
//            sky where the picture had it (the picture itself has no plane)
//   drift    the whole picture and its layers zoom 3% while the screen is up
//   moon     the halo breathes            (Halloween)
//   glows    each lantern flickers on its own rhythm   (Halloween)
//   fog      two low banks drift across the slab        (Halloween)
//   bats     a line of bats crosses the moon every ~20 s (Halloween)
//
// Anchors go through the same object-fit: cover maths as the picture
// (object-position 50% 68%, style.css .to-boot-art img), so a glow stays on
// its pumpkin at any screen shape. Everything pauses under
// prefers-reduced-motion, Animations Off (body.tf-anim-off) and a hidden
// tab, and stops when the screen leaves. Design: docs/boot-key-art-two-looks.md.

const POS_Y = 0.68;   // the picture's object-position (style.css)
const SKY = 0.5;      // stars live above this share of the picture
const STARS = 150;

export function mountBootMotion(root, { art, base, v }) {
  const img = art?.querySelector("img");
  if (!img) return { setLook() {}, stop() {} };
  const stage = document.createElement("div");
  stage.className = "to-boot-stage";
  stage.setAttribute("aria-hidden", "true");
  art.after(stage);
  const stars = document.createElement("canvas");
  stars.className = "to-boot-stars";
  const plane = document.createElement("img");
  plane.className = "to-boot-plane";
  plane.alt = "";
  plane.decoding = "async";
  const moon = el("div", "to-boot-moon");
  const fog = [el("div", "to-boot-fog is-a"), el("div", "to-boot-fog is-b")];
  const bats = el("div", "to-boot-bats");
  bats.innerHTML = Array.from({ length: 6 }, (_, i) => `<svg class="to-boot-bat" style="--i:${i}" viewBox="0 0 48 24"><path d="M24 11c-2-5-6-8-11-8 2 2 3 4 2 7-3-2-7-2-11 0 4 1 7 3 8 7 3-1 6 0 8 3l2 3h4l2-3c2-3 5-4 8-3 1-4 4-6 8-7-4-2-8-2-11 0-1-3 0-5 2-7-5 0-9 3-11 8z"/></svg>`).join("");
  const glows = [];
  stage.append(stars, plane, moon, ...fog, bats);

  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("tf-anim-off");
  let anchors = null, spooky = false, box = null, raf = 0, stopped = false, pts = [];
  const t0 = performance.now();

  fetch(`${base}/key-art-anchors.json?v=${v}`).then((r) => (r.ok ? r.json() : null)).then((j) => { anchors = j; place(); }).catch(() => {});
  img.addEventListener("load", place);
  addEventListener("resize", place);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  new MutationObserver(() => { if (stopped) return; stage.classList.toggle("is-still", still()); tick(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  /* The picture's box inside the screen (object-fit: cover), from the file
     the browser picked (the tall one upright, the wide one sideways). */
  function measure() {
    const W = root.clientWidth, H = root.clientHeight, w = img.naturalWidth, h = img.naturalHeight;
    if (!W || !H || !w || !h) return null;
    const s = Math.max(W / w, H / h), dw = w * s, dh = h * s;
    return { x: (W - dw) / 2, y: (H - dh) * POS_Y, w: dw, h: dh, W, H, frame: h > w ? "tall" : "wide" };
  }
  const px = (a) => ({ x: box.x + a.x * box.w, y: box.y + a.y * box.h, r: a.r * box.h });
  function place() {
    if (stopped) return;
    box = measure();
    if (!box) return;
    const A = anchors?.[spooky ? "halloween" : "normal"]?.[box.frame] || null;
    // the drift, in step with the picture's own (both start from the same moment)
    const since = `-${((performance.now() - t0) / 1000).toFixed(2)}s`;
    img.style.animationDelay = since;
    stage.style.animationDelay = since;
    stage.style.transformOrigin = img.style.transformOrigin = `50% ${POS_Y * 100}%`;
    stage.classList.toggle("is-still", still());
    stage.classList.toggle("is-halloween", spooky);
    // stars: a fresh field for this box (sized to the screen, DPR capped at 2)
    const dpr = Math.min(2, devicePixelRatio || 1);
    stars.width = Math.round(box.W * dpr); stars.height = Math.round(box.H * dpr);
    stars.style.width = `${box.W}px`; stars.style.height = `${box.H}px`;
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    pts = Array.from({ length: STARS }, () => ({ x: box.x + rnd() * box.w, y: box.y + rnd() * box.h * SKY, s: 0.6 + rnd() * 1.3, p: rnd() * 6.28, f: 0.4 + rnd() * 1.4 }));
    // the plane: across the sky at the picture's height for it
    const pl = A?.plane;
    plane.hidden = !pl;
    if (pl) {
      const q = px(pl), w = q.r * 2 * 1.05;
      plane.src = `${base}/plane${spooky ? "-halloween" : ""}.webp?v=${v}`;
      Object.assign(plane.style, { width: `${w}px`, left: `${-w}px`, top: `${q.y - w / 4}px` });
      plane.style.setProperty("--run", `${box.W + w * 2}px`);
    }
    // Halloween's layers
    const m = spooky && A?.moon ? px(A.moon) : null;
    moon.hidden = !m;
    bats.hidden = !m;
    if (m) {
      const d = m.r * 7;
      Object.assign(moon.style, { width: `${d}px`, height: `${d}px`, left: `${m.x - d / 2}px`, top: `${m.y - d / 2}px` });
      const bw = Math.max(90, m.r * 3);
      Object.assign(bats.style, { width: `${bw}px`, left: `${m.x - bw / 2}px`, top: `${m.y - m.r * 0.6}px` });
      bats.style.setProperty("--run", `${Math.max(box.W * 0.6, m.r * 10)}px`);
    }
    for (const g of glows) g.remove();
    glows.length = 0;
    if (spooky && A?.jacks) for (const j of A.jacks) {
      const q = px(j), d = q.r * 7, g = el("div", "to-boot-glow");
      Object.assign(g.style, { width: `${d}px`, height: `${d}px`, left: `${q.x - d / 2}px`, top: `${q.y - q.r * 0.3 - d / 2}px` });
      g.dataset.phase = String(Math.random() * 100);
      stage.append(g);
      glows.push(g);
    }
    for (const [i, f] of fog.entries()) {
      f.hidden = !spooky;
      if (!spooky) continue;
      const fw = box.w * (1.1 + i * 0.3), fh = box.h * 0.1;
      Object.assign(f.style, { width: `${fw}px`, height: `${fh}px`, left: `${box.x - fw * 0.2}px`, top: `${box.y + box.h * (0.7 + i * 0.09)}px` });
      f.style.setProperty("--run", `${box.w * 0.18}px`);
    }
    tick();
  }

  /* The per-frame part: the stars' twinkle and the lanterns' flicker, a
     few times a second, never while still, hidden or stopped. */
  let last = 0;
  function tick() {
    cancelAnimationFrame(raf);
    if (stopped || !box || document.hidden || still()) { if (box && !stopped) drawStars(0); return; }
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    if (now - last < 70) return;
    last = now;
    drawStars(now / 1000);
    for (const g of glows) {
      const t = now / 1000 + +g.dataset.phase;
      g.style.opacity = (0.72 + 0.16 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 17.1) + 0.04 * Math.sin(t * 41)).toFixed(3);
    }
  }
  function drawStars(t) {
    const c = stars.getContext("2d");
    if (!c) return;
    const dpr = stars.width / box.W;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, box.W, box.H);
    c.fillStyle = "#fff";
    for (const s of pts) {
      const a = t ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.f * 2 + s.p)) : 0.6;
      c.globalAlpha = a * 0.9;
      c.beginPath(); c.arc(s.x, s.y, s.s, 0, 6.283); c.fill();
    }
    c.globalAlpha = 1;
  }
  function el(tag, cls) { const e = document.createElement(tag); e.className = cls; return e; }

  return {
    setLook(on) { spooky = !!on; place(); },
    stop() { stopped = true; cancelAnimationFrame(raf); stage.remove(); },
  };
}
