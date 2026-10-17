// Receives a Roblox Studio body's parts as OBJ + PNG, for
// tools/troll-ops-roblox-body.mjs (which cuts them into the game's kit pieces).
// Studio's side (Luau over HttpService, 127.0.0.1 only) reads each MeshPart's
// mesh and texture with AssetService (CreateEditableMeshAsync /
// CreateEditableImageAsync) and POSTs:
//   /obj?name=torso           the OBJ text (studs, feet at y 0, facing -Z)
//   /png?name=torso&w=&h=     the texture as base64 raw RGBA, top row first
//   /done                     stop
//
//   node tools/troll-ops-roblox-receive.mjs <out dir> [--port 5296]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const pi = args.indexOf("--port");
const PORT = pi >= 0 ? +args.splice(pi, 2)[1] : 5296;
const OUT = args[0];
if (!OUT) { console.error("usage: troll-ops-roblox-receive.mjs <out dir> [--port 5296]"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(w, h, rgba) {
  const rows = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(rows, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const name = (url.searchParams.get("name") || "").replace(/[^a-z0-9_-]/gi, "_");
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      if (url.pathname === "/obj") {
        fs.writeFileSync(path.join(OUT, name + ".obj"), body);
        console.log(`${name}.obj  ${body.split("\n").filter((l) => l.startsWith("f ")).length} faces`);
      } else if (url.pathname === "/png") {
        const w = +url.searchParams.get("w"), h = +url.searchParams.get("h");
        const raw = Buffer.from(body, "base64");
        if (raw.length !== w * h * 4) throw new Error(`${name}: ${raw.length} bytes, want ${w * h * 4}`);
        fs.writeFileSync(path.join(OUT, name + ".png"), png(w, h, raw));
        console.log(`${name}.png  ${w}x${h}`);
      } else if (url.pathname === "/done") {
        console.log("done");
        res.end("bye");
        setTimeout(() => process.exit(0), 100);
        return;
      }
      res.end("ok");
    } catch (e) {
      console.error(e.message);
      res.writeHead(400);
      res.end(e.message);
    }
  });
});
server.listen(PORT, "127.0.0.1", () => console.log(`waiting for Studio on http://127.0.0.1:${PORT}`));
