// The crowd's human bodies (docs/KB-HUMANS.md phase 1): every
// models/ppl-*.glb is what the body driver needs. One skinned mesh, one
// material on one atlas, the game_engine bones the cop driver follows
// (cop-bodies.js FOLLOW, the limbs, every finger), skin weights on, feet on
// y = 0, a person's height, and inside the crowd's budget.
//
// Usage: node tools/troll-ops-people-glb-test.mjs [look ...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/games/troll-ops/models");
const LOOKS = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(DIR).filter((f) => /^ppl-.+\.glb$/.test(f)).map((f) => f.slice(4, -4));
const BUDGET = { kb: 720, tris: 8500 };
const BONES = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"];
for (const s of ["l", "r"]) {
  BONES.push(`clavicle_${s}`, `upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`, `thigh_${s}`, `calf_${s}`, `foot_${s}`);
  for (const f of ["thumb", "index", "middle", "ring", "pinky"]) for (const n of [1, 2, 3]) BONES.push(`${f}_0${n}_${s}`);
}

function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const len = b.readUInt32LE(12);
  return { json: JSON.parse(b.subarray(20, 20 + len).toString("utf8")), bytes: b.length };
}

let fails = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) fails++; };

if (!LOOKS.length) check(false, "some ppl-*.glb to test");
for (const look of LOOKS) {
  const file = path.join(DIR, `ppl-${look}.glb`);
  if (!fs.existsSync(file)) { check(false, `${look}: ppl-${look}.glb exists`); continue; }
  const { json: g, bytes } = readGlb(file);
  const meshes = g.meshes || [];
  const prims = meshes.flatMap((m) => m.primitives);
  check(meshes.length === 1 && prims.length === 1, `${look}: one mesh, one primitive (${meshes.length}/${prims.length})`);
  check((g.materials || []).length === 1 && (g.images || []).length === 1, `${look}: one material on one atlas`);
  check((g.skins || []).length === 1, `${look}: skinned`);
  const names = new Set((g.skins?.[0]?.joints || []).map((j) => g.nodes[j].name));
  const missing = BONES.filter((n) => !names.has(n));
  check(!missing.length, `${look}: the driver's bones (${names.size} joints${missing.length ? `, missing ${missing.slice(0, 6).join(" ")}` : ""})`);
  const p = prims[0] || { attributes: {} };
  check(p.attributes.JOINTS_0 != null && p.attributes.WEIGHTS_0 != null, `${look}: skin weights`);
  const pos = g.accessors[p.attributes.POSITION] || { min: [0, 0, 0], max: [0, 0, 0] };
  check(Math.abs(pos.min[1]) < 0.03, `${look}: feet on y = 0 (min y ${pos.min[1].toFixed(3)})`);
  const h = pos.max[1] - pos.min[1];
  check(h > 1.45 && h < 2.0, `${look}: a person's height (${h.toFixed(2)} m)`);
  check(pos.max[2] - pos.min[2] < 0.6 && pos.max[0] - pos.min[0] < 1.9, `${look}: rest pose, nothing stray (${(pos.max[0] - pos.min[0]).toFixed(2)} x ${(pos.max[2] - pos.min[2]).toFixed(2)} m)`);
  const tris = (g.accessors[p.indices]?.count || 0) / 3;
  check(tris <= BUDGET.tris, `${look}: ${tris} tris (budget ${BUDGET.tris})`);
  check(bytes / 1024 <= BUDGET.kb, `${look}: ${Math.round(bytes / 1024)} KB (budget ${BUDGET.kb})`);
}
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
