// Troll Us export receiver: node assets/games/troll-us/tools/receive-export.mjs
// Studio's exporter (studio/export.luau) POSTs each file here; this writes it to assets/games/troll-us/export/.
// Only the known file names are accepted, and only from this machine.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || 5291);
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'export');
const FILES = new Set(['map.json', 'rig.json', 'hats.json', 'rules.json', 'manifest.json']);
fs.mkdirSync(OUT, { recursive: true });

http.createServer((req, res) => {
  const name = decodeURIComponent((req.url || '').replace(/^\/export\//, ''));
  if (req.method !== 'POST' || !FILES.has(name)) { res.writeHead(404); res.end('no'); return; }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    try {
      // keys sorted (Roblox writes them in any order) and one node per line, so a re-export diffs cleanly
      const data = JSON.parse(body);
      const sorted = (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v);
      const text = JSON.stringify(data, sorted, 0)
        .replace(/\},\{/g, '},\n{').replace(/\[\{/g, '[\n{');
      fs.writeFileSync(path.join(OUT, name), text + '\n');
      console.log(`${name}  ${(text.length / 1024).toFixed(1)} KB`);
      res.writeHead(200); res.end('ok');
    } catch (e) {
      console.error(name, e.message);
      res.writeHead(400); res.end('bad json');
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`troll-us export receiver on ${PORT} -> ${OUT}`));
