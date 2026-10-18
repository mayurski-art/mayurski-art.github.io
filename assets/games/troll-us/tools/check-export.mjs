// Troll Us export check: node assets/games/troll-us/tools/check-export.mjs
// Compares the exported JSON with the counts Studio took in a separate pass (manifest.json) and sanity-checks
// what the web build relies on. Exits 1 on any mismatch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'export');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const map = load('map.json'), rig = load('rig.json'), hats = load('hats.json'), rules = load('rules.json');
const { counts } = load('manifest.json');

const fails = [];
const eq = (what, got, want) => { if (got !== want) fails.push(`${what}: ${got} in the export, ${want} in Studio`); };

const kinds = (nodes, k) => nodes.filter((n) => n.kind === k);
eq('map parts', kinds(map.nodes, 'part').length, counts.mapParts);
eq('map models', kinds(map.nodes, 'model').length, counts.mapModels);
eq('map lights', kinds(map.nodes, 'light').length, counts.mapLights);
eq('map signs', kinds(map.nodes, 'sign').length, counts.mapSigns);

// parts per top-level folder
const top = (i) => { let n = map.nodes[i]; while (n.parent != null) { i = n.parent; n = map.nodes[i]; } return n.name; };
const perFolder = {};
map.nodes.forEach((n, i) => { if (n.kind === 'part') perFolder[top(i)] = (perFolder[top(i)] || 0) + 1; });
for (const [f, c] of Object.entries(counts.folders)) eq(`parts in Map.${f}`, perFolder[f] || 0, c);

eq('rig parts', kinds(rig.nodes, 'part').length, counts.rigParts);
eq('rig joints', rig.joints.length, counts.rigJoints);
eq('hats', hats.hats.length, counts.hats);
for (const suit of rules.suits || []) if (!rules.suitColors?.[suit]) fails.push(`no colour for suit ${suit}`);
for (const h of hats.hats) if (!h.parts.length) fails.push(`hat ${h.name} has no parts`);

// every parent index points at a real node, and every part has a full frame
for (const [label, nodes] of [['map', map.nodes], ['rig', rig.nodes]]) {
  nodes.forEach((n, i) => {
    if (n.parent != null && !(n.parent >= 0 && n.parent < i)) fails.push(`${label} node ${i} (${n.name}) has a bad parent ${n.parent}`);
    if (n.kind === 'part' && (n.cf?.length !== 7 || n.size?.length !== 3)) fails.push(`${label} part ${i} (${n.name}) is missing its frame or size`);
  });
}

// what later steps read
const pads = map.nodes.filter((n) => n.attrs?.TaskId != null && n.kind === 'part' && n.attrs.Task);
if (pads.length !== 31) fails.push(`task pads: ${pads.length}, expected 31`);
const doorParts = map.nodes.filter((n) => n.attrs?.OpenCF && n.attrs?.ShutCF);
if (doorParts.length !== 120) fails.push(`door panels with open/shut frames: ${doorParts.length}, expected 120`);
for (const k of ['killRange', 'useRange', 'tasksPerPlayer', 'suits', 'fixPads', 'killCone', 'sounds', 'suitColors']) {
  if (rules[k] == null) fails.push(`rules.json has no ${k}`);
}

if (fails.length) { console.log(`FAIL (${fails.length})\n` + fails.join('\n')); process.exit(1); }
console.log(`ok: ${counts.mapParts} map parts in ${Object.keys(counts.folders).length} folders, ${counts.mapLights} lights, ${counts.mapSigns} signs, `
  + `rig ${counts.rigParts} parts / ${counts.rigJoints} joints, ${counts.hats} hats, ${pads.length} task pads, ${doorParts.length} door panels`);
