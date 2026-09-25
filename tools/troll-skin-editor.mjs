// Troll Ops skin editor: serves tools/troll-skin-editor.html and saves what
// you set there. Save writes that skin's crops back into
// assets/games/troll-ops/skins.js and writes its freshly baked atlas and
// picker thumbnail to assets/games/troll-ops/skins/ — no separate bake step.
//
// Usage: node tools/troll-skin-editor.mjs [port]   then open the URL it prints.
// Local only: it listens on 127.0.0.1 and writes files in this checkout.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKINS_JS = path.join(ROOT, "assets/games/troll-ops/skins.js");
const OUT = path.join(ROOT, "assets/games/troll-ops/skins");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const PARTS = ["upper", "lower", "handguard", "stock", "grip", "mag"];

const num = (v) => String(Math.round(v * 1000) / 1000);
const str = (v) => JSON.stringify(String(v));

/* One crop as source: [cx, cy, zoom] plus rot/flip only when they're set. */
function cropSrc(c) {
  const [cx, cy, zoom, rot = 0, flip = 0] = c;
  const out = [cx, cy, zoom].map(num);
  if (rot || flip) out.push(num(rot));
  if (flip) out.push("1");
  return `[${out.join(", ")}]`;
}

/* Rewrite one skin's crops in skins.js, leaving every
   other line (and every other skin) exactly as it was. */
function writeSkin({ id, crops }) {
  const raw = fs.readFileSync(SKINS_JS, "utf8");
  const crlf = raw.includes("\r\n");
  let s = raw.replace(/\r\n/g, "\n");
  const at = s.indexOf(`id: ${str(id)},`);
  if (at < 0) throw new Error(`no skin ${id}`);
  const start = s.lastIndexOf("\n  {\n", at) + 1;
  const end = s.indexOf("\n  },", at);
  let block = s.slice(start, end);

  const cropLines = PARTS.map((k) => `      ${k}: ${cropSrc(crops[k])},`).join("\n");
  block = block.replace(/    crops: \{[\s\S]*?\n    \},/, `    crops: {\n${cropLines}\n    },`);

  // Skins are the banner alone now: no emblem, no rollmark.
  block = block.replace(/\n    emblem: .*/, "").replace(/\n    rollmark: .*/, "");

  s = s.slice(0, start) + block + s.slice(end);
  fs.writeFileSync(SKINS_JS, crlf ? s.replace(/\n/g, "\r\n") : s);
}

function writeImage(file, dataUrl) {
  if (!/^data:image\/jpeg;base64,/.test(dataUrl)) throw new Error("expected a jpeg");
  if (!/^[a-z0-9-]+\.jpg$/.test(file)) throw new Error("bad file name");
  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  fs.writeFileSync(path.join(OUT, file), buf);
  return buf.length;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/save") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 20e6) req.destroy(); });
    req.on("end", () => {
      try {
        const m = JSON.parse(body);
        if (!/^[a-z0-9-]+$/.test(m.id)) throw new Error("bad id");
        writeSkin(m);
        const a = writeImage(`${m.id}.jpg`, m.jpg), t = writeImage(`${m.id}-thumb.jpg`, m.thumb);
        console.log(`saved ${m.id}: skins.js + atlas ${(a / 1024).toFixed(0)} KB + thumb ${(t / 1024).toFixed(0)} KB`);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.log("save failed:", e.message);
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  // Never cached: a reload after a save has to see the new skins.js.
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
});

/* Start on the asked-for port (5174 by default); if something already has
   it — usually an editor left running in another terminal — say so and take
   the next free one rather than dying with EADDRINUSE. */
const wanted = Number(process.argv[2]) || 5174;
let tryPort = wanted;
server.on("error", (e) => {
  if (e.code === "EADDRINUSE" && tryPort < wanted + 20) {
    console.log(`Port ${tryPort} is busy (another editor still running?), trying ${tryPort + 1}.`);
    server.listen(++tryPort, "127.0.0.1");
  } else {
    console.error(e.message);
    process.exit(1);
  }
});
server.on("listening", () => {
  console.log(`Skin editor: http://127.0.0.1:${server.address().port}/tools/troll-skin-editor.html`);
  console.log("Save writes skins.js and the skin's atlas + thumbnail. Ctrl+C to stop.");
});
server.listen(tryPort, "127.0.0.1");
