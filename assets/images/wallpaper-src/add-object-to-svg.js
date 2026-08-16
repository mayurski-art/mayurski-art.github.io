// Embeds one more full-detail raster object into the existing land SVG
// without re-tracing the terrain — same placement math as
// vectorize-land2.js's PLACEMENTS loop, just appended to an already-built
// file instead of generated alongside the trace.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const repo = 'C:\\Users\\mayur\\OneDrive\\Documents\\GitHub\\mayurski-art.github.io';
const landSvgPath = path.join(repo, 'assets', 'images', 'wallpaper', 'trollrunner-island-land.svg');
const objPath = path.join(repo, 'assets', 'images', 'wallpaper-src', 'trollrunner.obj-finances.png');

const PLACEMENT = { l: 19, t: 30, h: 13, rot: -3 };

(async () => {
  const svgText = fs.readFileSync(landSvgPath, 'utf8');
  const widthMatch = svgText.match(/width="(\d+)"/);
  const heightMatch = svgText.match(/height="(\d+)"/);
  const W = Number(widthMatch[1]), H = Number(heightMatch[1]);

  const objMeta = await sharp(objPath).metadata();
  const targetH = (PLACEMENT.h / 100) * H;
  const scale = targetH / objMeta.height;
  const anchorX = (PLACEMENT.l / 100) * W;
  const anchorY = (PLACEMENT.t / 100) * H;
  const b64 = fs.readFileSync(objPath).toString('base64');

  const objectTag =
    `<g transform="translate(${anchorX},${anchorY}) rotate(${PLACEMENT.rot || 0}) scale(${scale})">` +
    `<image href="data:image/png;base64,${b64}" x="${-objMeta.width / 2}" y="${-objMeta.height}" width="${objMeta.width}" height="${objMeta.height}"/>` +
    `</g>`;

  const updated = svgText.replace('</svg>', `${objectTag}\n</svg>`);
  fs.writeFileSync('trollrunner-island-land-with-finance.svg', updated);
  console.log('done, new size:', updated.length, 'placement:', { anchorX, anchorY, scale, targetH });
})();
