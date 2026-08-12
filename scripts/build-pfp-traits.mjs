/*
  build-pfp-traits.mjs — regenerate the PFP Studio art + manifest.

  Source art is Swish's shared Drive folder (2048px RGBA PNGs, one folder
  per layer, numbered in z-order). Drive itself can't be the runtime source:
  hotlinked Drive images are unreliable in <img>, and a cross-origin layer
  taints the export canvas so Download PNG stops working. So the art is
  converted once and committed.

  1. Download the folder locally. The Drive UI's own "download folder" works;
     so does scraping the public listing, since every file is link-shared:
       curl -sL "https://drive.google.com/embeddedfolderview?id=<FOLDER_ID>#list"
     gives `flip-entry` blocks with `id="entry-<FILE_ID>"` + a title, and
       https://drive.google.com/uc?export=download&id=<FILE_ID>
     fetches each file anonymously. Recurse for subfolders.

  2. Run this (needs `npm i sharp` somewhere scratch — deliberately NOT a repo
     dependency, since the site itself stays build-step-free):
       node scripts/build-pfp-traits.mjs <rawDir> <repoRoot>

  Writes assets/pfp/<layer>/<slug>.webp (1024px) + thumb/<slug>.webp (160px)
  and regenerates assets/data/pfp-traits.json. That manifest is the single
  source of truth for layer order and trait names — pfp.html reads it at
  runtime and hardcodes nothing, so a new booster pack is a data change.

  To add a booster pack: drop its folder into <rawDir>, add its files to
  EXTRA below with the layer each one belongs to, re-run, commit.
*/
import sharp from 'sharp';
import { readdirSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname, basename } from 'path';

const RAW = process.argv[2];
const REPO = process.argv[3];
if (!RAW || !REPO) {
  console.error('usage: node scripts/build-pfp-traits.mjs <rawDir> <repoRoot>');
  process.exit(1);
}

const OUT = join(REPO, 'assets', 'pfp');
const FULL = 1024, THUMB = 160;

// Order here IS the z-order the page composites in.
const LAYERS = [
  { id: 'background', name: 'Background', dir: '1 - BACKGROUND' },
  { id: 'base',       name: 'Base',       dir: '2 - BASE' },
  { id: 'outfit',     name: 'Outfit',     dir: '3 - OUTFITS' },
  { id: 'headwear',   name: 'Headwear',   dir: '4 - HEADWEAR' },
  { id: 'accessory',  name: 'Accessory',  dir: '5 - ACCESSORIES' },
];

// Art that lives outside the numbered folders, so its layer is assigned by
// hand. `pack` surfaces as the orange badge in the picker.
const B1 = '0 - BOOSTER PACKS/BOOSTER 1 - June 25';
const B2 = '0 - BOOSTER PACKS/BOOSTER 2 - Happy July 4th';
const EXTRA = [
  ...['Blue','Dark','Green','Orange','Pink','Purple','Red','Sky','Solana','Teal','White','Yellow']
      .map(n => ({ src: `${B1}/Background/${n}.png`, layer: 'background', pack: 'Booster 1' })),
  ...['black','green','red','white']
      .map(c => ({ src: `${B1}/Boobs ${c}.png`, layer: 'outfit', pack: 'Booster 1' })),
  { src: `${B2}/Trump background.png`, layer: 'background', pack: 'Booster 2' },
  { src: `${B2}/Trump tshirt.png`,     layer: 'outfit',     pack: 'Booster 2' },
  { src: `${B2}/Trump hair.png`,       layer: 'headwear',   pack: 'Booster 2' },
  { src: `${B2}/UncleSam.png`,         layer: 'headwear',   pack: 'Booster 2', name: 'Uncle Sam' },
  { src: `${B2}/Hotdog.png`,           layer: 'accessory',  pack: 'Booster 2' },
  // Head-only / fully-composed art, filed under base so it still stacks on a
  // background rather than being unreachable.
  { src: 'JUST FACES/OFFICIAL LOGO FACE.png', layer: 'base', name: 'Logo face' },
  { src: 'NINJA FILES/NINJA PFP.png',         layer: 'base', name: 'Ninja' },
];

const slugify = s => s.toLowerCase().trim()
  .replace(/\.[a-z]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleOf = f => basename(f, extname(f)).trim();

const manifest = { version: 1, size: FULL, thumb: THUMB, layers: [] };
let bytesFull = 0, bytesThumb = 0, n = 0;

for (const L of LAYERS) {
  mkdirSync(join(OUT, L.id, 'thumb'), { recursive: true });

  const jobs = readdirSync(join(RAW, L.dir))
    .filter(f => /\.png$/i.test(f))
    .map(f => ({ src: `${L.dir}/${f}`, layer: L.id, pack: null }));
  for (const e of EXTRA.filter(e => e.layer === L.id)) jobs.push(e);

  const traits = [];
  const seen = new Set();
  for (const job of jobs) {
    const name = job.name || titleOf(job.src);
    let id = slugify(name);
    while (seen.has(id)) id += '-2';
    seen.add(id);

    const src = join(RAW, job.src);
    const big = await sharp(src).resize(FULL, FULL)
      .webp({ quality: 84, alphaQuality: 92, effort: 6 }).toBuffer();
    const sm = await sharp(src).resize(THUMB, THUMB)
      .webp({ quality: 80, alphaQuality: 88, effort: 6 }).toBuffer();
    writeFileSync(join(OUT, L.id, `${id}.webp`), big);
    writeFileSync(join(OUT, L.id, 'thumb', `${id}.webp`), sm);
    bytesFull += big.length; bytesThumb += sm.length; n++;

    const t = { id, name };
    if (job.pack) t.pack = job.pack;
    traits.push(t);
  }
  traits.sort((a, b) => a.name.localeCompare(b.name));
  manifest.layers.push({ id: L.id, name: L.name, traits });
  console.log(`${L.name.padEnd(12)} ${String(traits.length).padStart(3)} traits`);
}

mkdirSync(join(REPO, 'assets', 'data'), { recursive: true });
writeFileSync(join(REPO, 'assets', 'data', 'pfp-traits.json'),
  JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n${n} traits · full ${(bytesFull / 1048576).toFixed(1)} MB · ` +
  `thumb ${(bytesThumb / 1048576).toFixed(1)} MB · ` +
  `total ${((bytesFull + bytesThumb) / 1048576).toFixed(1)} MB`);
