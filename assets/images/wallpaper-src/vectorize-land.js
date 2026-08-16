const sharp = require('sharp');
const potrace = require('potrace');
const path = require('path');
const repo = 'C:\\Users\\mayur\\OneDrive\\Documents\\GitHub\\mayurski-art.github.io';
const land = path.join(repo, 'assets', 'images', 'wallpaper', 'trollrunner-island-land.png');

const COLORS = 24; // palette size to quantize down to before tracing each

function traceOne(maskPng, hexColor) {
  return new Promise((resolve, reject) => {
    const tracer = new potrace.Potrace();
    tracer.setParameters({
      threshold: 128,
      blackOnWhite: false, // my masks use 255 = "trace this", potrace defaults to treating dark as foreground
      color: hexColor,
      background: 'transparent',
      turdSize: 12,        // drop speckles smaller than this many px
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

  // Quantize to a small flat palette first (this is what makes each color
  // region traceable as one clean shape instead of thousands of
  // near-duplicate anti-aliased shades).
  const quantized = await sharp(land)
    .png({ palette: true, colors: COLORS, dither: 0 })
    .toBuffer();

  const { data, info } = await sharp(quantized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels; // 4 (RGBA)

  const colorMap = new Map(); // 'r,g,b' -> pixel count
  for (let i = 0; i < data.length; i += channels) {
    const a = data[i + 3];
    if (a < 128) continue; // treat as transparent background
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  // Merge near-duplicate colors (subtle gradient shading quantizes into
  // several barely-different tones, and potrace burns huge path complexity
  // tracing the jagged boundary between two colors nobody can tell apart).
  // Greedy: walk colors largest-area first, snap anything within threshold
  // of an already-kept color onto it instead of keeping it separate.
  const MERGE_DIST = 20; // euclidean distance in RGB space
  const byArea = [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ rgb: key.split(',').map(Number), count }));

  const kept = [];
  const remap = new Map(); // 'r,g,b' (original) -> kept rgb array
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
  console.log('distinct colors after quantization:', byArea.length, '-> merged to', colors.length);

  // Precompute each pixel's merged-color index once (fast lookup during
  // mask building) instead of re-parsing the remap Map per pixel per color.
  const colorIndexByKey = new Map(colors.map((rgb, idx) => [rgb.join(','), idx]));
  const pixelIndex = new Int16Array(W * H).fill(-1);
  for (let p = 0, i = 0; p < data.length; p += channels, i++) {
    const a = data[p + 3];
    if (a < 128) continue;
    const origKey = `${data[p]},${data[p + 1]},${data[p + 2]}`;
    const mergedRgb = remap.get(origKey);
    pixelIndex[i] = colorIndexByKey.get(mergedRgb.join(','));
  }

  const pathTags = [];
  for (let idx = 0; idx < colors.length; idx++) {
    const [r, g, b] = colors[idx];
    const maskRaw = Buffer.alloc(W * H);
    for (let i = 0; i < pixelIndex.length; i++) {
      maskRaw[i] = pixelIndex[i] === idx ? 255 : 0;
    }
    const maskPng = await sharp(maskRaw, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toBuffer();

    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    const pathTag = await traceOne(maskPng, hex);
    console.log(hex, 'bytes=' + pathTag.length);
    pathTags.push(pathTag);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${pathTags.join('\n')}\n</svg>`;
  require('fs').writeFileSync('trollrunner-island-land.svg', svg);
  console.log('done, svg bytes:', svg.length);
})();
