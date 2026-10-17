// Roblox Studio animation -> Troll Forces clip (characters/clips/<name>.json).
//
// The Studio place holds TF_Rig, a rig whose joints are the game skeleton's
// (characters/character.js buildHumanoid; joint parts named like rig.parts,
// 1 m = 4 studs, facing -Z like the game). An animation saved on it
// (TF_Rig/AnimSaves/<KeyframeSequence>) is sent here by a Luau snippet over
// HttpService (127.0.0.1 only) and written as a clip the game samples with
// characters/clips.js. Roblox and three.js are both right-handed, Y up,
// facing -Z, and CFrame.Angles(x, y, z) is three's Euler "XYZ", so a pose's
// rotation IS the game joint's local quaternion; positions only rescale.
//
//   node tools/troll-ops-roblox-anim.mjs serve [--port 5299]   wait for one POST, write the clip, exit
//   node tools/troll-ops-roblox-anim.mjs selftest              matrix -> quaternion round trips
//
// POST body (Luau HttpService:JSONEncode): { name, K, length, loop, meta,
//   keyframes: [{ t, markers: [names], poses: { joint: { cf: [x,y,z, R00..R22], w, ease, dir } } }] }
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/characters/clips");

/* Rotation matrix rows (CFrame:GetComponents order) -> [x, y, z, w]. */
export function quatFromRows(r00, r01, r02, r10, r11, r12, r20, r21, r22) {
  const tr = r00 + r11 + r22;
  let x, y, z, w;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s; x = (r21 - r12) * s; y = (r02 - r20) * s; z = (r10 - r01) * s;
  } else if (r00 > r11 && r00 > r22) {
    const s = 2 * Math.sqrt(1 + r00 - r11 - r22);
    w = (r21 - r12) / s; x = 0.25 * s; y = (r01 + r10) / s; z = (r02 + r20) / s;
  } else if (r11 > r22) {
    const s = 2 * Math.sqrt(1 + r11 - r00 - r22);
    w = (r02 - r20) / s; x = (r01 + r10) / s; y = 0.25 * s; z = (r12 + r21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + r22 - r00 - r11);
    w = (r10 - r01) / s; x = (r02 + r20) / s; y = (r12 + r21) / s; z = 0.25 * s;
  }
  const n = Math.hypot(x, y, z, w) || 1;
  return [x / n, y / n, z / n, w / n];
}

// Easing a segment uses: the style of the pose at its start (Roblox's rule).
const EASE = { Linear: 0, Constant: 1, Cubic: 2, CubicV2: 2, Elastic: 0, Bounce: 0 };
const DIR = { In: 0, Out: 1, InOut: 2 };
const r5 = (v) => Math.round(v * 1e5) / 1e5;

export function convert(body) {
  const K = body.K || 4;
  const kfs = [...body.keyframes].sort((a, b) => a.t - b.t);
  const names = new Set();
  for (const k of kfs) for (const [n, p] of Object.entries(k.poses)) if (p.w > 0) names.add(n);
  const warn = [];
  const joints = {};
  for (const n of names) {
    const q = [], p = [], ease = [];
    let moves = false, eased = false;
    let prev = null;
    for (const k of kfs) {
      // A keyframe without this pose holds the last one (Roblox does the same).
      const pose = k.poses[n]?.w > 0 ? k.poses[n] : prev;
      prev = pose;
      const c = pose ? pose.cf : [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
      let qq = quatFromRows(...c.slice(3));
      // Keep neighbours in one hemisphere so slerp takes the short way.
      if (q.length >= 4 && qq[0] * q[q.length - 4] + qq[1] * q[q.length - 3] + qq[2] * q[q.length - 2] + qq[3] * q[q.length - 1] < 0) qq = qq.map((v) => -v);
      q.push(...qq.map(r5));
      p.push(r5(c[0] / K), r5(c[1] / K), r5(c[2] / K));
      if (Math.abs(c[0]) + Math.abs(c[1]) + Math.abs(c[2]) > 1e-6) moves = true;
      const style = pose?.ease ?? "Linear";
      if (!(style in EASE)) warn.push(`${n}: easing ${style} played as Linear`);
      else if (style === "Elastic" || style === "Bounce") warn.push(`${n}: easing ${style} played as Linear`);
      const e = (EASE[style] ?? 0) * 3 + (DIR[pose?.dir] ?? 0);
      if (e !== 0) eased = true;
      ease.push(e);
    }
    joints[n] = { q };
    if (moves) joints[n].p = p;
    if (eased) joints[n].ease = ease;
  }
  const markers = [];
  for (const k of kfs) for (const m of k.markers || []) markers.push({ t: r5(k.t), name: m });
  return {
    clip: {
      name: body.name,
      source: `Roblox Studio TF_Rig/AnimSaves/${body.source || body.name}`,
      meta: body.meta || "",
      length: r5(body.length ?? kfs[kfs.length - 1].t),
      loop: !!body.loop,
      times: kfs.map((k) => r5(k.t)),
      markers,
      joints,
    },
    warn: [...new Set(warn)],
  };
}

function selftest() {
  // Euler XYZ (three's default, = CFrame.Angles) -> rows -> quaternion, against
  // the direct quaternion product qx * qy * qz.
  const mul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  const axis = (i, t) => { const v = [0, 0, 0, Math.cos(t / 2)]; v[i] = Math.sin(t / 2); return v; };
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const [x, y, z] = [0, 1, 2].map(() => (Math.random() - 0.5) * 2 * Math.PI);
    const want = mul(mul(axis(0, x), axis(1, y)), axis(2, z));
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    // R = Rx * Ry * Rz
    const rows = [
      cy * cz, -cy * sz, sy,
      sx * sy * cz + cx * sz, -sx * sy * sz + cx * cz, -sx * cy,
      -cx * sy * cz + sx * sz, cx * sy * sz + sx * cz, cx * cy,
    ];
    const got = quatFromRows(...rows);
    const dot = Math.abs(got.reduce((s, v, k) => s + v * want[k], 0));
    worst = Math.max(worst, 2 * Math.acos(Math.min(1, dot)));
  }
  const deg = (worst * 180) / Math.PI;
  console.log(`selftest: worst round-trip error ${deg.toExponential(2)} deg over 2000 random poses`);
  if (deg > 1) { console.error("FAIL: over 1 degree"); process.exit(1); }
  console.log("PASS");
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "selftest") selftest();
else if (cmd === "serve") {
  const port = +(rest[rest.indexOf("--port") + 1] || 0) || 5299;
  const server = http.createServer((req, res) => {
    if (req.method !== "POST") { res.writeHead(405); return res.end(); }
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        const body = JSON.parse(data);
        if (!/^[a-z0-9-]+$/.test(body.name || "")) throw new Error(`bad clip name "${body.name}" (a-z 0-9 -)`);
        const { clip, warn } = convert(body);
        fs.mkdirSync(OUT, { recursive: true });
        const file = path.join(OUT, `${clip.name}.json`);
        fs.writeFileSync(file, JSON.stringify(clip) + "\n");
        const msg = `wrote ${path.relative(ROOT, file)}: ${clip.times.length} keys, ${Object.keys(clip.joints).length} joints, ${clip.length} s, ${fs.statSync(file).size} bytes`;
        console.log(msg);
        for (const w of warn) console.log(`  warning: ${w}`);
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(msg);
        server.close();
      } catch (e) {
        console.error(e.message);
        res.writeHead(400);
        res.end(e.message);
      }
    });
  });
  server.listen(port, "127.0.0.1", () => console.log(`waiting for Studio on http://127.0.0.1:${port}/anim`));
} else {
  console.error("usage: node tools/troll-ops-roblox-anim.mjs serve [--port 5299] | selftest");
  process.exit(2);
}
