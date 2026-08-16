const sharp = require('sharp');
const potrace = require('potrace');
const fs = require('fs');
const path = require('path');
const { loadPlacements } = require('./read-placements');
const repo = 'C:\\Users\\mayur\\OneDrive\\Documents\\GitHub\\mayurski-art.github.io';
// Bare terrain only, no objects baked in — the whole point is to keep the
// color budget away from small detailed objects that don't vectorize well.
const land = path.join(repo, 'assets', 'images', 'wallpaper-src', 'trollrunner.land_base.png');
const terminal = path.join(repo, 'assets', 'images', 'wallpaper-src', 'trollrunner.terminal.png');
const stickers = 'obj-stickers-warped2.png'; // already has the real sticker warped on, made earlier
const finance = path.join(repo, 'assets', 'images', 'wallpaper-src', 'trollrunner.obj-finances.png');

const COLORS = 24;
const MERGE_DIST = 20;

// Objects are embedded as raster <image> layers (full color/gradient
// detail preserved) inside the vector SVG, positioned with the same
// l/t/h/rot recipe as the old pixel-bake — just expressed as an SVG
// transform instead of composited pixels. l/t/h/rot come straight from
// world.html's APPS array (the same data behind the live click hotspot)
// instead of a hand-copied duplicate — see read-placements.js. Add new ids
// here as new landmarks are baked; positions themselves are never edited
// in this file.
const PLACEMENTS = loadPlacements({
  terminal: terminal,
  stickers: stickers,
  finance: finance,
});

function traceOne(maskPng, hexColor) {
  return new Promise((resolve, reject) => {
    const tracer = new potrace.Potrace();
    tracer.setParameters({
      threshold: 128,
      blackOnWhite: false,
      color: hexColor,
      background: 'transparent',
      turdSize: 12,
      optTolerance: 0.6,
    });
    tracer.loadImage(maskPng, err => {
      if (err) return reject(err);
      resolve(tracer.getPathTag());
    });
  });
}

(async () => {
  const meta = await sharp(land).metadata();
  const W = meta.width, H = meta.height;

  const quantized = await sharp(land).png({ palette: true, colors: COLORS, dither: 0 }).toBuffer();
  const { data, info } = await sharp(quantized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  const colorMap = new Map();
  for (let i = 0; i < data.length; i += channels) {
    const a = data[i + 3];
    if (a < 128) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  const byArea = [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ rgb: key.split(',').map(Number), count }));

  const kept = [];
  const remap = new Map();
  for (const c of byArea) {
    const match = kept.find(k => {
      const [r, g, b] = k.rgb;
      return Math.hypot(r - c.rgb[0], g - c.rgb[1], b - c.rgb[2]) < MERGE_DIST;
    });
    if (match) {
      match.count += c.count;
      remap.set(c.rgb.join(','), match.rgb);
    } else {
      kept.push({ rgb: c.rgb, count: c.count });
      remap.set(c.rgb.join(','), c.rgb);
    }
  }

  const colors = kept.sort((a, b) => b.count - a.count).map(k => k.rgb);
  console.log('terrain colors:', byArea.length, '-> merged to', colors.length);

  const colorIndexByKey = new Map(colors.map((rgb, idx) => [rgb.join(','), idx]));
  const pixelIndex = new Int16Array(W * H).fill(-1);
  for (let p = 0, i = 0; p < data.length; p += channels, i++) {
    const a = data[p + 3];
    if (a < 128) continue;
    const origKey = `${data[p]},${data[p + 1]},${data[p + 2]}`;
    pixelIndex[i] = colorIndexByKey.get(remap.get(origKey).join(','));
  }

  const pathTags = [];
  for (let idx = 0; idx < colors.length; idx++) {
    const [r, g, b] = colors[idx];
    const maskRaw = Buffer.alloc(W * H);
    for (let i = 0; i < pixelIndex.length; i++) maskRaw[i] = pixelIndex[i] === idx ? 255 : 0;
    const maskPng = await sharp(maskRaw, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    const pathTag = await traceOne(maskPng, hex);
    console.log(hex, 'bytes=' + pathTag.length);
    pathTags.push(pathTag);
  }

  // Embed each object as a full-detail raster <image>, transformed the same
  // way the old pixel-bake positioned it: scaled to its target height (% of
  // island box), rotated, anchored bottom-center at its l/t ground point.
  const objectTags = [];
  for (const p of PLACEMENTS) {
    const objMeta = await sharp(p.src).metadata();
    const targetH = (p.h / 100) * H;
    const scale = targetH / objMeta.height;
    const anchorX = (p.l / 100) * W;
    const anchorY = (p.t / 100) * H;
    const b64 = fs.readFileSync(p.src).toString('base64');
    const mime = p.src.toLowerCase().endsWith('.png') || true ? 'image/png' : 'image/png';
    // Order: translate to the ground anchor, rotate, scale, then shift by
    // half the (unscaled) image size so the image's own bottom-center sits
    // at the origin before the translate/rotate/scale chain moves it into
    // place — SVG applies transforms right-to-left.
    objectTags.push(
      `<g transform="translate(${anchorX},${anchorY}) rotate(${p.rot || 0}) scale(${scale})">` +
      `<image href="data:${mime};base64,${b64}" x="${-objMeta.width / 2}" y="${-objMeta.height}" width="${objMeta.width}" height="${objMeta.height}"/>` +
      `</g>`
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${pathTags.join('\n')}\n${objectTags.join('\n')}\n</svg>`;
  fs.writeFileSync('trollrunner-island-land-v2.svg', svg);
  console.log('done, svg bytes:', svg.length);
})();
