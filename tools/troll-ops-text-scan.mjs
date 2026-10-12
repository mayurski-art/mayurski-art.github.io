// Troll Forces: the measured no-text-overlap scan for game UI (user
// 2026-10-12: "Make sure in the game ui there isnt overlaping texts").
// Shared by the zombies tests; call it in every HUD state, desktop and phone.
//
//   import { textClash } from "./troll-ops-text-scan.mjs";
//   await textClash(page, check, "the break");

/* No text on top of other text, an icon or a touch control, and none cut
   short with "…". Measures the glyph boxes of every visible text node on
   screen (Range rects, not the containers), so a long label spilling out
   of its box counts. The test hooks' debug readout is left out. */
export async function textClash(page, check, when) {
  await new Promise((r) => setTimeout(r, 700)); // let the banner / feed entrances settle
  const res = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    const seen = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        if (e.id === "to-anim-debug") return false;
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false;
      }
      return true;
    };
    const label = (e) => {
      const name = e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase();
      return e.id ? `#${e.id}` : name;
    };
    // The ink, not the line box: Oswald's line box runs half an em past its
    // capitals, so two stacked labels' boxes cross while their letters don't.
    const ctx = document.createElement("canvas").getContext("2d");
    const ink = (el, text, r) => {
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(text);
      const box = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
      const k = box > 0 ? r.height / box : 1; // a scaled (animating) label
      const base = r.top + m.fontBoundingBoxAscent * k;
      return { left: r.left, right: r.right, top: base - m.actualBoundingBoxAscent * k, bottom: base + m.actualBoundingBoxDescent * k };
    };
    const items = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || !seen(n.parentElement)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
      items.push({ el: n.parentElement, what: `"${n.textContent.trim().slice(0, 18)}" ${label(n.parentElement)}`, r: ink(n.parentElement, n.textContent, r), text: true, world: !!n.parentElement.closest(".to-dmg-num, .zh-bars") });
    }
    for (const el of document.querySelectorAll(".zh-icon svg, .to-touch-btn, .to-touch-stick, canvas.to-minimap")) {
      if (!seen(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      items.push({ el, what: label(el), r, text: false });
    }
    const hits = [];
    const P = 2; // the text stroke can kiss
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (!a.text && !b.text) continue;
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // floating numbers live in the world and drift past the HUD; only
      // two of them on top of each other counts
      if (a.world !== b.world) continue;
      if (a.r.left < b.r.right - P && b.r.left < a.r.right - P && a.r.top < b.r.bottom - P && b.r.top < a.r.bottom - P) hits.push(`${a.what} x ${b.what}`);
    }
    const cut = [];
    for (const it of items) {
      if (!it.text) continue;
      const cs = getComputedStyle(it.el);
      if (cs.textOverflow === "ellipsis" && it.el.scrollWidth > it.el.clientWidth + 1) cut.push(it.what);
      // a card clips what spills out of it
      const card = it.el.closest(".zh-card")?.getBoundingClientRect();
      if (card && (it.r.top < card.top + 1 || it.r.bottom > card.bottom - 1 || it.r.left < card.left || it.r.right > card.right)) cut.push(it.what + " (out of its card)");
    }
    return { hits: [...new Set(hits)], cut: [...new Set(cut)], n: items.length };
  });
  check(res.hits.length === 0, `${when}: no text overlaps (${res.n} measured)`, res.hits.slice(0, 6).join(" | "));
  check(res.cut.length === 0, `${when}: no text cut short`, res.cut.join(" | "));
}
