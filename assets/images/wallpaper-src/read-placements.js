// Single source of truth for object placement. world.html's APPS array is
// what actually drives the live click hotspot (see the island-hotspot loop
// in world.html), so the bake/vectorize scripts must read l/t/h/rot from
// there too — keeping a second hand-copied PLACEMENTS array in each script
// is exactly how the art and the click target drifted apart before.
//
// Usage: pass a map of { [app id]: highResSourcePath } for the handful of
// objects that have a separate high-res source image under wallpaper-src/
// (world.html's own `img` field points at the smaller web-optimized PNG).
// Only ids present in both APPS and the map are baked.
const fs = require('fs');
const path = require('path');

const repo = 'C:\\Users\\mayur\\OneDrive\\Documents\\GitHub\\mayurski-art.github.io';
const worldHtmlPath = path.join(repo, 'world.html');

function readApps() {
  const src = fs.readFileSync(worldHtmlPath, 'utf8');
  const start = src.indexOf('const APPS = [');
  if (start === -1) throw new Error('APPS array not found in world.html');
  const arrayStart = src.indexOf('[', start);
  let depth = 0, i = arrayStart;
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  const arrayText = src.slice(arrayStart, i);
  // Trusted local file (this repo's own source), evaluated the same way the
  // ?edit=1 editor's "Copy config" output is meant to be pasted back in —
  // not user input, safe to eval as a local dev tool.
  return new Function('return ' + arrayText)();
}

// Same filter world.html's own ?edit=1 editor uses to decide which APPS
// entries are real baked-in landmarks vs. old pixel-viewBox / windowed-app
// entries that don't apply here.
function loadPlacements(highResSrcById) {
  const apps = readApps();
  return apps
    .filter(a => a.img && typeof a.l === 'number' && a.l <= 100 && a.t <= 100 && highResSrcById[a.id])
    .map(a => ({
      id: a.id,
      src: highResSrcById[a.id],
      l: a.l, t: a.t, h: a.h, rot: a.rot || 0,
    }));
}

module.exports = { loadPlacements };
