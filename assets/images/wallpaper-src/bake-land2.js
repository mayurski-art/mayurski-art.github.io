const sharp = require('sharp');
const path = require('path');
const { loadPlacements } = require('./read-placements');
const repo = 'C:\\Users\\mayur\\OneDrive\\Documents\\GitHub\\mayurski-art.github.io';
const land = path.join(repo, 'assets', 'images', 'wallpaper', 'trollrunner-island-land.png');
const terminal = path.join(repo, 'assets', 'images', 'wallpaper', 'obj-terminal.png');
const stickers = path.join(repo, 'assets', 'images', 'wallpaper', 'obj-stickers.png');
const finance = path.join(repo, 'assets', 'images', 'wallpaper', 'obj-finances.png');

// l/t/h/rot now come straight from world.html's APPS array (the same data
// that drives the live click hotspot) instead of a hand-copied duplicate —
// see read-placements.js. Add new ids to this map as new landmarks are
// baked; positions themselves are never edited here.
const PLACEMENTS = loadPlacements({
  terminal: terminal,
  stickers: stickers,
  finance: finance,
});

(async () => {
  const landMeta = await sharp(land).metadata();
  const W = landMeta.width, H = landMeta.height;

  const composites = [];
  for (const p of PLACEMENTS) {
    let img = sharp(p.src);
    const meta = await img.metadata();
    const targetH = Math.round((p.h / 100) * H);
    const scale = targetH / meta.height;
    const targetW = Math.round(meta.width * scale);
    let resized = sharp(p.src).resize({ width: targetW, height: targetH });
    if (p.rot) resized = resized.rotate(p.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    const buf = await resized.png().toBuffer();
    const rm = await sharp(buf).metadata();

    const anchorX = (p.l / 100) * W;
    const anchorY = (p.t / 100) * H;
    // Rotation grows the canvas outward evenly, so the original bottom-
    // center ground-contact point is still at (rm.width/2, targetH + rot pad/2)
    // roughly — close enough at these small angles to anchor by the new
    // bounding box's bottom-center.
    const left = Math.round(anchorX - rm.width / 2);
    const top = Math.round(anchorY - rm.height);
    composites.push({ input: buf, left, top });
    console.log(p.src, '->', { targetW, targetH, left, top, rmW: rm.width, rmH: rm.height });
  }

  await sharp(land).composite(composites).png().toFile('trollrunner-island-land-baked2.png');
  console.log('done');
})();
