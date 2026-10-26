// Troll Forces after-action blueprint: the MAP tab of the after-action report
// (modes/after-action.js). A drafting sheet of the map you just played, with
// the match drawn on it.
//
// The sheet (drawn once per size, kept off screen):
//   - the level itself, traced from a top-down render (view/blueprint-capture.js):
//     outlines, creases, contours, height tone; small maps cut like a floor
//     plan, the walls the cut slices through hatched solid (poché);
//     before the capture lands, or without WebGL, the colliders drafted as blocks;
//   - a metre grid, a double border with dimension ticks along two sides,
//     crop marks, a north arrow and a scale bar, a faint vignette.
// The match (redrawn on every change):
//   - kills (diamonds, numbered in order, a white rim for a headshot), deaths
//     (a struck circle), assists (rings), each kill and death with the line of
//     the shot and an arrowhead on the end that landed;
//   - or a heat view of the same spots;
//   - filter chips, a timeline to scrub or play the match back, and a card
//     with the details of the mark under the pointer.
// Pure drawing and DOM: everything comes in through `d` and setCapture().

const COL = { kill: "#7fe066", death: "#ff6b5c", assist: "#f5b82e" };
const INK = "rgba(205,232,255,";        // the linework, with an alpha appended
const PLAY_MS = 5000;                   // the whole match, played back

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* `host`: an empty element. `d`: { mapName, modeName, arena, colliders,
   events, counts, seconds, weaponName(id) }. Returns { draw, setCapture }. */
export function mountBlueprint(host, d) {
  const events = (d.events || []).map((e, i) => ({ ...e, i }));
  let n = 0;
  for (const e of events) if (e.kind === "kill") e.n = ++n;
  const end = Math.max(1, d.seconds || 0, ...events.map((e) => e.t || 0));
  const st = { show: { kill: true, death: true, assist: true, lines: true }, heat: false, t: end, hover: null, playing: 0 };
  let capture = d.capture || null;
  let sheet = null, sheetKey = "";

  host.innerHTML = `
    <div class="to-bp-tools">
      <div class="to-bp-chips" role="group" aria-label="Show on the map">
        <button type="button" class="to-bp-chip is-kill" data-k="kill" aria-pressed="true"><i></i>Kills <b>${d.counts.kill}</b></button>
        <button type="button" class="to-bp-chip is-death" data-k="death" aria-pressed="true"><i></i>Deaths <b>${d.counts.death}</b></button>
        <button type="button" class="to-bp-chip is-assist" data-k="assist" aria-pressed="true"><i></i>Assists <b>${d.counts.assist}</b></button>
        <button type="button" class="to-bp-chip is-lines" data-k="lines" aria-pressed="true"><i></i>Shot lines</button>
      </div>
      <button type="button" class="to-bp-chip is-heat" data-heat aria-pressed="false">Heat</button>
    </div>
    <div class="to-bp-sheet">
      <canvas class="to-aar-blueprint" aria-label="Plan of ${esc(d.mapName)} with where your kills, deaths and assists happened"></canvas>
      <div class="to-bp-tip" hidden></div>
    </div>
    <div class="to-bp-time">
      <button type="button" class="to-bp-play" aria-label="Play the match back">▶</button>
      <input type="range" class="to-bp-scrub" min="0" max="${Math.ceil(end)}" step="1" value="${Math.ceil(end)}" aria-label="Match time">
      <output class="to-bp-clock">${clock(end)}</output>
    </div>
    <div class="to-bp-block" aria-hidden="true">
      <div><span>Plan</span><b>${esc(d.mapName || "—")}</b></div>
      <div><span>Mode</span><b>${esc(d.modeName || "—")}</b></div>
      <div class="to-bp-cutcell"><span>Section</span><b class="to-bp-cut">Aerial</b></div>
      <div><span>Sheet</span><b>AAR-01</b></div>
    </div>`;

  const canvas = host.querySelector("canvas");
  const tip = host.querySelector(".to-bp-tip");
  const scrub = host.querySelector(".to-bp-scrub");
  const clockOut = host.querySelector(".to-bp-clock");
  const play = host.querySelector(".to-bp-play");

  for (const b of host.querySelectorAll(".to-bp-chip[data-k]")) {
    b.addEventListener("click", () => {
      st.show[b.dataset.k] = !st.show[b.dataset.k];
      b.setAttribute("aria-pressed", String(st.show[b.dataset.k]));
      draw();
    });
  }
  host.querySelector("[data-heat]").addEventListener("click", (e) => {
    st.heat = !st.heat;
    e.currentTarget.setAttribute("aria-pressed", String(st.heat));
    draw();
  });
  scrub.addEventListener("input", () => { stopPlay(); st.t = Number(scrub.value); draw(); });
  play.addEventListener("click", () => {
    if (st.playing) { stopPlay(); return; }
    const from = st.t >= end ? 0 : st.t;
    const t0 = performance.now() - (from / end) * PLAY_MS;
    play.textContent = "❚❚"; play.setAttribute("aria-label", "Pause");
    const tick = (now) => {
      st.t = Math.min(end, ((now - t0) / PLAY_MS) * end);
      scrub.value = String(Math.round(st.t));
      draw();
      st.playing = st.t < end ? requestAnimationFrame(tick) : (stopPlay(), 0);
    };
    st.playing = requestAnimationFrame(tick);
  });
  function stopPlay() {
    if (st.playing) cancelAnimationFrame(st.playing);
    st.playing = 0;
    play.textContent = "▶"; play.setAttribute("aria-label", "Play the match back");
  }

  canvas.addEventListener("pointermove", (ev) => {
    const r = canvas.getBoundingClientRect();
    const hit = nearest(ev.clientX - r.left, ev.clientY - r.top);
    if (hit !== st.hover) { st.hover = hit; draw(); }
    showTip(hit, ev.clientX - r.left, ev.clientY - r.top, r.width);
  });
  canvas.addEventListener("pointerleave", () => { st.hover = null; tip.hidden = true; draw(); });
  // The sheet follows its box (a scrollbar arriving, a phone turning).
  if (window.ResizeObserver) new ResizeObserver(() => { if (canvas.isConnected && Math.round(canvas.clientWidth) !== S) draw(); }).observe(canvas);

  /* ------------------------------------------------------------ geometry */

  let S = 0, M = 0, inner = 0;           // css px: sheet, margin, drawing square
  const bounds = () => {
    if (capture?.bounds) return capture.bounds;
    const A = d.arena;
    const span = Math.max(A.maxX - A.minX, A.maxZ - A.minZ) * 1.04;
    return { minX: (A.minX + A.maxX) / 2 - span / 2, minZ: (A.minZ + A.maxZ) / 2 - span / 2, span };
  };
  const P = (x, z) => {
    const b = bounds();
    return [M + ((x - b.minX) / b.span) * inner, M + ((z - b.minZ) / b.span) * inner];
  };
  const visible = (e) => st.show[e.kind] && (e.t || 0) <= st.t + 1e-6;

  function nearest(px, py) {
    let best = null, bd = 14 * 14;
    for (const e of events) {
      if (!visible(e)) continue;
      const [x, y] = P(e.x, e.z);
      const dd = (x - px) ** 2 + (y - py) ** 2;
      if (dd < bd) { bd = dd; best = e; }
    }
    return best;
  }

  function showTip(e, px, py, w) {
    if (!e) { tip.hidden = true; return; }
    const what = e.kind === "kill" ? `Kill ${e.n}` : e.kind === "death" ? "Death" : "Assist";
    const gun = e.weapon ? d.weaponName(e.weapon) : "";
    const extra = e.kind === "kill" && e.head ? "Headshot" : "";
    const range = e.from ? `${Math.round(Math.hypot(e.x - e.from.x, e.z - e.from.z))} m` : "";
    tip.innerHTML = `<b class="is-${e.kind}">${what}</b><span>${clock(e.t)}</span>`
      + (gun ? `<em>${esc(e.kind === "death" ? `by ${gun}` : gun)}</em>` : "")
      + [extra, range].filter(Boolean).map((s) => `<small>${esc(s)}</small>`).join("");
    tip.hidden = false;
    tip.style.left = `${Math.min(px + 14, w - tip.offsetWidth - 6)}px`;
    tip.style.top = `${Math.max(6, py - tip.offsetHeight - 10)}px`;
  }

  /* ------------------------------------------------------------ the sheet */

  function buildSheet(dpr) {
    const c = document.createElement("canvas");
    c.width = Math.round(S * dpr); c.height = Math.round(S * dpr);
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = bounds();
    const mPerPx = b.span / inner;

    // paper
    const bg = g.createRadialGradient(S * 0.5, S * 0.45, S * 0.1, S * 0.5, S * 0.5, S * 0.75);
    bg.addColorStop(0, "#0e2846"); bg.addColorStop(1, "#06111f");
    g.fillStyle = bg; g.fillRect(0, 0, S, S);

    // the level
    g.save();
    g.beginPath(); g.rect(M, M, inner, inner); g.clip();
    if (capture?.canvas) {
      g.imageSmoothingQuality = "high";
      g.drawImage(capture.canvas, M, M, inner, inner);
    } else {
      draftColliders(g);
    }
    // cut walls: solid, hatched
    if (capture?.cuts?.length) hatch(g, capture.cuts);
    // island coast and water, over the trace
    if (d.arena.edge) outline(g, d.arena.edge, null, INK + ".55)", [5, 3]);
    if (d.arena.wade) outline(g, d.arena.wade, "rgba(70,150,255,.16)", "rgba(140,200,255,.5)", null);

    // grid: fine every 5 m (10 m on a big map), strong every 25 / 50
    const fine = b.span > 140 ? 10 : 5, strong = fine * 5;
    for (let m = Math.ceil(b.minX / fine) * fine; m <= b.minX + b.span; m += fine) {
      const [x] = P(m, 0);
      g.strokeStyle = m % strong === 0 ? INK + ".16)" : INK + ".06)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(Math.round(x) + .5, M); g.lineTo(Math.round(x) + .5, M + inner); g.stroke();
    }
    for (let m = Math.ceil(b.minZ / fine) * fine; m <= b.minZ + b.span; m += fine) {
      const [, y] = P(0, m);
      g.strokeStyle = m % strong === 0 ? INK + ".16)" : INK + ".06)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(M, Math.round(y) + .5); g.lineTo(M + inner, Math.round(y) + .5); g.stroke();
    }
    // vignette
    const v = g.createRadialGradient(S / 2, S / 2, inner * 0.35, S / 2, S / 2, inner * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(2,8,18,.45)");
    g.fillStyle = v; g.fillRect(M, M, inner, inner);
    g.restore();

    // border: a heavy line and a hairline inside it
    g.strokeStyle = INK + ".85)"; g.lineWidth = 1.6; g.strokeRect(M - .5, M - .5, inner + 1, inner + 1);
    g.strokeStyle = INK + ".35)"; g.lineWidth = 1; g.strokeRect(M - 4.5, M - 4.5, inner + 9, inner + 9);

    // dimension ticks: top and left, labelled every strong line
    g.font = "500 9px 'DM Mono', monospace"; g.fillStyle = INK + ".7)"; g.strokeStyle = INK + ".6)";
    g.textAlign = "center"; g.textBaseline = "bottom";
    for (let m = Math.ceil(b.minX / fine) * fine; m <= b.minX + b.span; m += fine) {
      const [x] = P(m, 0), big = m % strong === 0;
      g.beginPath(); g.moveTo(x, M - 4); g.lineTo(x, M - (big ? 10 : 7)); g.stroke();
      if (big && x > M + 14 && x < M + inner - 14) g.fillText(`${m}`, x, M - 11);
    }
    g.textAlign = "right"; g.textBaseline = "middle";
    for (let m = Math.ceil(b.minZ / fine) * fine; m <= b.minZ + b.span; m += fine) {
      const [, y] = P(0, m), big = m % strong === 0;
      g.beginPath(); g.moveTo(M - 4, y); g.lineTo(M - (big ? 10 : 7), y); g.stroke();
      if (big && y > M + 10 && y < M + inner - 10) g.fillText(`${m}`, M - 12, y);
    }
    // crop marks
    g.strokeStyle = INK + ".5)"; g.lineWidth = 1;
    for (const [cx, cy, sx, sy] of [[M - 4, M - 4, -1, -1], [M + inner + 4, M - 4, 1, -1], [M - 4, M + inner + 4, -1, 1], [M + inner + 4, M + inner + 4, 1, 1]]) {
      g.beginPath(); g.moveTo(cx + sx * 3, cy); g.lineTo(cx + sx * 9, cy); g.moveTo(cx, cy + sy * 3); g.lineTo(cx, cy + sy * 9); g.stroke();
    }

    northArrow(g, M + inner - 26, M + 28);
    scaleBar(g, M + 12, M + inner - 16, mPerPx);
    return c;
  }

  function outline(g, pts, fill, stroke, dash) {
    g.beginPath();
    pts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    g.setLineDash(dash || []); g.strokeStyle = stroke; g.lineWidth = 1.3; g.stroke(); g.setLineDash([]);
  }

  /* No trace yet: the colliders as drafted blocks, taller ones brighter. */
  function draftColliders(g) {
    const cs = (d.colliders || []).filter((c) => c.min.y <= 1.6);
    for (const c of cs) {
      const [x0, y0] = P(c.min.x, c.min.z), [x1, y1] = P(c.max.x, c.max.z);
      const w = Math.max(1.5, x1 - x0), h = Math.max(1.5, y1 - y0);
      const tall = Math.min(1, (c.max.y - c.min.y) / 6);
      g.fillStyle = `rgba(120,180,240,${0.08 + tall * 0.16})`; g.fillRect(x0, y0, w, h);
      g.strokeStyle = INK + `${0.45 + tall * 0.4})`; g.lineWidth = 1; g.strokeRect(x0 + .5, y0 + .5, w - 1, h - 1);
    }
    hatch(g, cs.filter((c) => c.max.y - c.min.y > 2));
  }

  /* Poché: what the plan's cut slices through, filled and hatched at 45°. */
  function hatch(g, boxes) {
    g.save();
    g.beginPath();
    for (const c of boxes) {
      const [x0, y0] = P(c.min.x, c.min.z), [x1, y1] = P(c.max.x, c.max.z);
      g.rect(x0, y0, Math.max(1.5, x1 - x0), Math.max(1.5, y1 - y0));
    }
    g.fillStyle = "rgba(170,215,255,.20)"; g.fill();
    g.strokeStyle = INK + ".85)"; g.lineWidth = 1; g.stroke();
    g.clip();
    g.strokeStyle = INK + ".42)"; g.lineWidth = 1;
    g.beginPath();
    for (let k = -S; k < S * 2; k += 5) { g.moveTo(k, 0); g.lineTo(k - S, S); }
    g.stroke();
    g.restore();
  }

  function northArrow(g, x, y) {
    g.save();
    g.translate(x, y);
    g.fillStyle = "rgba(6,17,31,.6)"; g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK + ".7)"; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.strokeStyle = INK + ".25)"; g.stroke();
    // the needle: north half solid, south half open
    g.beginPath(); g.moveTo(0, -13); g.lineTo(5, 2); g.lineTo(0, -1); g.closePath(); g.fillStyle = INK + ".95)"; g.fill();
    g.beginPath(); g.moveTo(0, -13); g.lineTo(-5, 2); g.lineTo(0, -1); g.closePath(); g.fillStyle = INK + ".45)"; g.fill();
    g.beginPath(); g.moveTo(0, 13); g.lineTo(5, 2); g.lineTo(-5, 2); g.closePath(); g.strokeStyle = INK + ".6)"; g.stroke();
    g.font = "700 9px Oswald, sans-serif"; g.fillStyle = INK + ".95)"; g.textAlign = "center"; g.textBaseline = "bottom";
    g.fillText("N", 0, -18);
    g.restore();
  }

  /* A bar of a round length about a sixth of the sheet, split in alternating cells. */
  function scaleBar(g, x, y, mPerPx) {
    const want = (inner / 6) * mPerPx;
    const len = [5, 10, 20, 25, 50, 100, 200].reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
    const px = len / mPerPx, cells = 4;
    g.fillStyle = "rgba(6,17,31,.6)"; g.fillRect(x - 6, y - 18, px + 34, 26);
    for (let i = 0; i < cells; i++) {
      g.fillStyle = i % 2 ? "rgba(6,17,31,.9)" : INK + ".9)";
      g.fillRect(x + (px / cells) * i, y - 3, px / cells, 5);
    }
    g.strokeStyle = INK + ".9)"; g.lineWidth = 1; g.strokeRect(x + .5, y - 2.5, px, 5);
    g.font = "500 9px 'DM Mono', monospace"; g.fillStyle = INK + ".85)"; g.textBaseline = "bottom";
    g.textAlign = "left"; g.fillText("0", x - 1, y - 5);
    g.textAlign = "center"; g.fillText(`${len} m`, x + px, y - 5);
  }

  /* ------------------------------------------------------------ the match */

  function drawMatch(g) {
    const shown = events.filter(visible);
    if (st.heat) { heat(g, shown); return; }

    // shot lines under the marks
    if (st.show.lines) {
      for (const e of shown) {
        if (!e.from || e.kind === "assist") continue;
        const [ax, ay] = P(e.from.x, e.from.z), [bx, by] = P(e.x, e.z);
        const col = e.kind === "death" ? "255,107,92" : "127,224,102";
        const lit = st.hover === e;
        g.strokeStyle = `rgba(${col},${lit ? 0.95 : 0.5})`; g.lineWidth = lit ? 1.8 : 1.1;
        g.setLineDash([4, 3]);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.setLineDash([]);
        // the shooter's end: a small open circle; the arrowhead stops short of the mark
        g.beginPath(); g.arc(ax, ay, 2.5, 0, Math.PI * 2); g.stroke();
        const ang = Math.atan2(by - ay, bx - ax), L = Math.hypot(bx - ax, by - ay);
        if (L > 16) {
          const tx = bx - Math.cos(ang) * 8, ty = by - Math.sin(ang) * 8;
          g.fillStyle = `rgba(${col},${lit ? 1 : 0.75})`;
          g.beginPath();
          g.moveTo(tx, ty);
          g.lineTo(tx - Math.cos(ang - 0.45) * 6, ty - Math.sin(ang - 0.45) * 6);
          g.lineTo(tx - Math.cos(ang + 0.45) * 6, ty - Math.sin(ang + 0.45) * 6);
          g.closePath(); g.fill();
        }
      }
    }

    // the marks, newest on top, with a soft glow
    for (const e of shown) {
      const [x, y] = P(e.x, e.z);
      const lit = st.hover === e;
      const r = lit ? 7.5 : 5.5;
      g.save();
      g.shadowColor = COL[e.kind]; g.shadowBlur = lit ? 14 : 8;
      if (e.kind === "kill") {
        g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
        g.fillStyle = COL.kill; g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = e.head ? "#ffffff" : "rgba(6,17,31,.85)"; g.lineWidth = e.head ? 1.6 : 1; g.stroke();
      } else if (e.kind === "death") {
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = "rgba(60,10,8,.85)"; g.fill();
        g.strokeStyle = COL.death; g.lineWidth = 1.8; g.stroke();
        g.shadowBlur = 0;
        const k = r * 0.55;
        g.beginPath(); g.moveTo(x - k, y - k); g.lineTo(x + k, y + k); g.moveTo(x + k, y - k); g.lineTo(x - k, y + k); g.stroke();
      } else {
        g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2);
        g.strokeStyle = COL.assist; g.lineWidth = 2; g.stroke();
        g.shadowBlur = 0;
        g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fillStyle = COL.assist; g.fill();
      }
      g.restore();
      // kill order, in a small tag above the right shoulder of the mark
      if (e.kind === "kill" && (lit || shown.length <= 40)) {
        const label = String(e.n);
        g.font = "700 9px 'DM Mono', monospace";
        const w = g.measureText(label).width + 6;
        const lx = x + 6, ly = y - 13;
        g.fillStyle = "rgba(6,17,31,.85)"; g.fillRect(lx, ly, w, 11);
        g.strokeStyle = "rgba(127,224,102,.7)"; g.lineWidth = 1; g.strokeRect(lx + .5, ly + .5, w - 1, 10);
        g.fillStyle = "#c9f5b9"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(label, lx + 3, ly + 6);
      }
    }
  }

  function heat(g, shown) {
    g.save();
    g.beginPath(); g.rect(M, M, inner, inner); g.clip();
    g.globalCompositeOperation = "lighter";
    const R = Math.max(22, inner * 0.09);
    for (const e of shown) {
      const [x, y] = P(e.x, e.z);
      const rgb = e.kind === "kill" ? "110,235,80" : e.kind === "death" ? "255,80,60" : "255,190,40";
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${rgb},.7)`); gr.addColorStop(0.45, `rgba(${rgb},.28)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
    }
    g.restore();
  }

  /* ------------------------------------------------------------ draw */

  function draw() {
    const css = Math.round(canvas.clientWidth);
    if (!css) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    S = css; M = Math.max(22, Math.round(S * 0.055)); inner = S - M * 2;
    const key = `${S}:${dpr}:${capture ? 1 : 0}`;
    if (key !== sheetKey) { sheet = buildSheet(dpr); sheetKey = key; }
    if (canvas.width !== Math.round(S * dpr)) { canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr); }
    const g = canvas.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(sheet, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMatch(g);
    clockOut.textContent = clock(st.t);
  }

  function setCapture(bp) {
    if (!bp) return;
    capture = bp;
    const cut = host.querySelector(".to-bp-cut");
    if (cut) cut.textContent = bp.cut != null ? `Cut +${(bp.cut - bp.floor).toFixed(1)} m` : "Aerial";
    sheetKey = "";
    draw();
  }

  return { draw, setCapture, state: st, hasCapture: () => !!capture };
}
