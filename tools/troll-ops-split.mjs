// Troll Forces split tool: move a line range of game.js into its own module
// (the game.js split plan, phase 1 on). Run --dry first: it prints what the
// range exports, what stays in game.js, and every game.js link it needs.
// Needs acorn (npm i --no-save acorn, next to playwright in node_modules).
//
// Usage: node tools/troll-ops-split.mjs assets/games/troll-ops <startLine> <endLine> <dir/mod.js> <initName> <tag> [--dry]
//
// - Range bindings game.js still uses are exported and imported back,
//   unless game.js WRITES them: those declarations stay in game.js.
// - Range references to game.js bindings become `game.X`; game.js lists
//   them in its linkGame({...}) table (functions direct, the rest as
//   getters/setters, so nothing is read before it's declared).
// - Range references to imports are re-imported with the path adjusted.
// - Top-level statements that run at load (listeners, bindings) move into
//   `export function <initName>()`, called where the range used to be.
import fs from "node:fs";
import path from "node:path";
import * as acorn from "acorn";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const [gameDir, a, b, modRel, initName, tag] = args.filter((x) => x !== "--dry");
const A = +a, B = +b;
const gamePath = path.join(gameDir, "game.js");
const raw = fs.readFileSync(gamePath, "utf8");
const EOL = raw.includes("\r\n") ? "\r\n" : "\n";
const ast = acorn.parse(raw, { ecmaVersion: "latest", sourceType: "module", locations: true });
const die = (m) => { console.error("ERROR: " + m); process.exit(1); };

function patNames(p, out = []) {
  if (!p) return out;
  switch (p.type) {
    case "Identifier": out.push(p.name); break;
    case "ObjectPattern": for (const q of p.properties) patNames(q.type === "RestElement" ? q.argument : q.value, out); break;
    case "ArrayPattern": for (const q of p.elements) patNames(q, out); break;
    case "RestElement": patNames(p.argument, out); break;
    case "AssignmentPattern": patNames(p.left, out); break;
  }
  return out;
}

// ---- top-level statements and bindings
const top = new Map(); // name -> {stmt, kind, ...}
for (const s of ast.body) {
  const d = s.type === "ExportNamedDeclaration" && s.declaration ? s.declaration : s;
  if (d.type === "ImportDeclaration") for (const sp of d.specifiers) top.set(sp.local.name, { stmt: s, kind: "import", src: d.source.value, sp });
  else if (d.type === "FunctionDeclaration") top.set(d.id.name, { stmt: s, kind: "function" });
  else if (d.type === "ClassDeclaration") top.set(d.id.name, { stmt: s, kind: "class" });
  else if (d.type === "VariableDeclaration") for (const dc of d.declarations) for (const n of patNames(dc.id)) top.set(n, { stmt: s, kind: d.kind });
}
const inRangeLine = (l) => l >= A && l <= B;
const rangeStmts = ast.body.filter((s) => inRangeLine(s.loc.start.line));
for (const s of rangeStmts) if (!inRangeLine(s.loc.end.line)) die(`statement at ${s.loc.start.line} runs past ${B}`);
for (const s of ast.body) if (!inRangeLine(s.loc.start.line) && inRangeLine(s.loc.end.line)) die(`statement at ${s.loc.start.line} straddles ${A}`);
if (!rangeStmts.length) die("empty range");
const R0 = rangeStmts[0].start, R1 = rangeStmts[rangeStmts.length - 1].end;
const inR = (pos) => pos >= R0 && pos < R1;
const isRangeBinding = (n) => { const t = top.get(n); return t && inR(t.stmt.start); };

// ---- references (scope-resolved to top level)
const uses = []; // {name, node, write, shorthand, prop}
function collectDecls(body, names) {
  for (const s of body) {
    if (!s) continue;
    if (s.type === "VariableDeclaration") for (const dc of s.declarations) patNames(dc.id, names);
    else if (s.type === "FunctionDeclaration" || s.type === "ClassDeclaration") names.push(s.id.name);
  }
}
function walk(node, scopes, ctx = {}) {
  if (!node || typeof node.type !== "string") return;
  const free = (name) => { for (let i = scopes.length - 1; i >= 1; i--) if (scopes[i].has(name)) return false; return true; };
  switch (node.type) {
    case "Identifier":
      if (!ctx.decl && free(node.name)) uses.push({ name: node.name, node, write: !!ctx.write, shorthand: ctx.shorthand });
      return;
    case "MemberExpression": walk(node.object, scopes); if (node.computed) walk(node.property, scopes); return;
    case "Property":
      if (node.computed) walk(node.key, scopes);
      if (node.shorthand && node.value.type === "Identifier") walk(node.value, scopes, { ...ctx, shorthand: node });
      else if (node.shorthand) die(`shorthand with default at line ${node.loc.start.line}`);
      else walk(node.value, scopes, ctx);
      return;
    case "MethodDefinition": case "PropertyDefinition": if (node.computed) walk(node.key, scopes); walk(node.value, scopes); return;
    case "LabeledStatement": walk(node.body, scopes); return;
    case "BreakStatement": case "ContinueStatement": return;
    case "AssignmentExpression": walk(node.left, scopes, { write: true }); walk(node.right, scopes); return;
    case "UpdateExpression": walk(node.argument, scopes, { write: true }); return;
    case "VariableDeclarator": walkPattern(node.id, scopes, true); walk(node.init, scopes); return;
    case "ObjectPattern": for (const p of node.properties) walk(p, scopes, ctx); return;
    case "ArrayPattern": for (const p of node.elements) walk(p, scopes, ctx); return;
    case "AssignmentPattern": walk(node.left, scopes, ctx); walk(node.right, scopes); return;
    case "RestElement": walk(node.argument, scopes, ctx); return;
    case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression": {
      const names = ["arguments"];
      if (node.type === "FunctionExpression" && node.id) names.push(node.id.name);
      for (const p of node.params) patNames(p, names);
      if (node.body.type === "BlockStatement") collectDecls(node.body.body, names);
      const sc = [...scopes, new Set(names)];
      for (const p of node.params) walkPattern(p, sc, true);
      if (node.body.type === "BlockStatement") for (const s of node.body.body) walk(s, sc); else walk(node.body, sc);
      return;
    }
    case "ClassDeclaration": case "ClassExpression": {
      walk(node.superClass, scopes);
      walk(node.body, node.id && node.type === "ClassExpression" ? [...scopes, new Set([node.id.name])] : scopes);
      return;
    }
    case "BlockStatement": case "StaticBlock": {
      const names = []; collectDecls(node.body, names);
      const sc = [...scopes, new Set(names)];
      for (const s of node.body) walk(s, sc);
      return;
    }
    case "ForStatement": case "ForInStatement": case "ForOfStatement": {
      const names = []; const init = node.init || node.left;
      if (init && init.type === "VariableDeclaration") for (const dc of init.declarations) patNames(dc.id, names);
      const sc = [...scopes, new Set(names)];
      for (const k of ["init", "left", "test", "update", "right", "body"]) if (node[k]) walk(node[k], sc, k === "left" && node.left.type !== "VariableDeclaration" ? { write: true } : {});
      return;
    }
    case "CatchClause": walk(node.body, [...scopes, new Set(patNames(node.param))]); return;
    case "SwitchStatement": {
      walk(node.discriminant, scopes);
      const names = []; for (const c of node.cases) collectDecls(c.consequent, names);
      const sc = [...scopes, new Set(names)];
      for (const c of node.cases) { walk(c.test, sc); for (const s of c.consequent) walk(s, sc); }
      return;
    }
    case "ImportDeclaration": case "ExportAllDeclaration": return;
    case "ExportNamedDeclaration": if (node.declaration) walk(node.declaration, scopes); else for (const sp of node.specifiers) walk(sp.local, scopes); return;
  }
  for (const k in node) {
    if (k === "loc" || k === "type" || k === "start" || k === "end") continue;
    const v = node[k];
    if (Array.isArray(v)) for (const c of v) walk(c, scopes);
    else if (v && typeof v.type === "string") walk(v, scopes);
  }
}
// Walks a binding pattern: declared names are skipped (scope handles them),
// default-value expressions are walked as reads.
function walkPattern(p, sc, decl) {
  if (!p) return;
  if (p.type === "Identifier") return;
  if (p.type === "AssignmentPattern") { walkPattern(p.left, sc, decl); walk(p.right, sc); }
  else if (p.type === "ObjectPattern") for (const q of p.properties) { if (q.computed) walk(q.key, sc); walkPattern(q.type === "RestElement" ? q.argument : q.value, sc, decl); }
  else if (p.type === "ArrayPattern") for (const q of p.elements) walkPattern(q, sc, decl);
  else if (p.type === "RestElement") walkPattern(p.argument, sc, decl);
}
// top-level: every top-level name is "free" at scope depth 0
walk(ast, [new Set()]);

// ---- classify
const topUses = uses.filter((u) => top.has(u.name));
const outsideUses = topUses.filter((u) => !inR(u.node.start) && isRangeBinding(u.name));
const insideUses = topUses.filter((u) => inR(u.node.start) && !isRangeBinding(u.name));
if (uses.some((u) => inR(u.node.start) && u.name === "game")) die("range already uses an identifier named game");

const writtenOutside = new Set(outsideUses.filter((u) => u.write).map((u) => u.name));
// Declarations that must stay in game.js (written outside the range).
const stayStmts = new Set();
for (const n of writtenOutside) {
  const st = top.get(n).stmt;
  const names = st.type === "VariableDeclaration" ? st.declarations.flatMap((d) => patNames(d.id)) : [n];
  for (const m of names) if (!writtenOutside.has(m) && outsideUses.some((u) => u.name === m)) {
    // a sibling declarator game.js only reads: it can stay too
  }
  if (st.type === "VariableDeclaration") for (const d of st.declarations) if (d.init && /Function|Class/.test(d.init.type)) die(`stay decl ${n} has a function init`);
  stayStmts.add(st);
}
const stayNames = new Set([...stayStmts].flatMap((st) => st.type === "VariableDeclaration" ? st.declarations.flatMap((d) => patNames(d.id)) : [st.id.name]));
// Range uses of stay names become links too.
const linkUses = topUses.filter((u) => inR(u.node.start) && !inStay(u.node.start) && (!isRangeBinding(u.name) || stayNames.has(u.name)) && top.get(u.name).kind !== "import");
function inStay(pos) { for (const st of stayStmts) if (pos >= st.start && pos < st.end) return true; return false; }
// stay declarations' initializers must not use moved range bindings
// (a moved const, function or class is fine: it comes back as an import, and
// imports are live before game.js's first line runs; a moved let is not)
const stayReads = new Set();
for (const st of stayStmts) for (const u of topUses) if (u.node.start >= st.start && u.node.start < st.end && isRangeBinding(u.name) && !stayNames.has(u.name)) {
  if (top.get(u.name).kind === "let" || top.get(u.name).kind === "var") die(`kept decl at ${st.loc.start.line} uses moved ${u.name}`);
  stayReads.add(u.name);
}

const exportNames = new Set([...outsideUses.filter((u) => !stayNames.has(u.name)).map((u) => u.name), ...stayReads]);
const linkNames = new Map(); // name -> {kind, write}
for (const u of linkUses) {
  const r = linkNames.get(u.name) || { kind: top.get(u.name).kind, write: false };
  if (u.write) r.write = true;
  linkNames.set(u.name, r);
}
for (const [n, r] of linkNames) if (r.write && (r.kind === "const" || r.kind === "function" || r.kind === "class")) die(`range writes ${r.kind} ${n}`);
const importUses = topUses.filter((u) => inR(u.node.start) && !inStay(u.node.start) && top.get(u.name).kind === "import");
const importNames = new Set(importUses.map((u) => u.name));

// ---- build the module text
const modDir = path.dirname(modRel);
const depth = modDir === "." ? 0 : modDir.split(/[\\/]/).length;
const fixSrc = (s) => (s.startsWith("./") || s.startsWith("../")) ? path.posix.join(...Array(depth).fill(".."), s).replace(/^(?!\.)/, "./") : s;
const byStmt = new Map();
for (const n of importNames) { const t = top.get(n); (byStmt.get(t.stmt) || byStmt.set(t.stmt, []).get(t.stmt)).push(t.sp); }
const importLines = [];
for (const [st, sps] of byStmt) {
  const def = sps.find((s) => s.type === "ImportDefaultSpecifier");
  const ns = sps.find((s) => s.type === "ImportNamespaceSpecifier");
  const named = sps.filter((s) => s.type === "ImportSpecifier").map((s) => s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`);
  const parts = [];
  if (def) parts.push(def.local.name);
  if (ns) parts.push(`* as ${ns.local.name}`);
  if (named.length) parts.push(`{ ${named.join(", ")} }`);
  importLines.push(`import ${parts.join(", ")} from "${fixSrc(st.source.value)}";`);
}
importLines.push(`import { game } from "${fixSrc("./core/state.js?v=" + stateTag())}";`);
function stateTag() { const m = raw.match(/["']\.\/core\/state\.js\?v=([^"']+)["']/); return m ? m[1] : "st1"; }

// Rewrites within the range text.
const edits = []; // {start,end,text}
for (const u of linkUses) {
  if (u.shorthand) edits.push({ start: u.shorthand.start, end: u.shorthand.end, text: `${u.name}: game.${u.name}` });
  else edits.push({ start: u.node.start, end: u.node.end, text: `game.${u.name}` });
}
function applyEdits(text, base, list) {
  const es = list.filter((e) => e.start >= base && e.end <= base + text.length).sort((x, y) => y.start - x.start);
  for (const e of es) text = text.slice(0, e.start - base) + e.text + text.slice(e.end - base);
  return text;
}
// Statement text including the leading comments/blank lines since the previous statement.
const pieces = [];
let cursor = R0;
// leading comment lines right above the first statement belong to it
const lineOff = (n) => { let o = 0; for (let i = 1; i < n; i++) o = raw.indexOf("\n", o) + 1; return o; };
const OFF_A = lineOff(A), OFF_B1 = lineOff(B + 1);
cursor = OFF_A;
const commentsAbove = (st) => st.start; // statements are taken with the gap before them
for (const st of rangeStmts) {
  const gap = raw.slice(cursor, st.start);
  // a comment after the statement on its own last line belongs to it
  const eol = raw.indexOf("\n", st.end);
  const rest = raw.slice(st.end, eol < 0 ? raw.length : eol).replace(/\r$/, "");
  const end = /^[ \t]*(\/\/.*|\/\*.*\*\/[ \t]*)?$/.test(rest) ? st.end + rest.length : st.end;
  pieces.push({ st, gap, text: raw.slice(st.start, end), end });
  cursor = end;
}
const tail = raw.slice(cursor, OFF_B1); // trailing comments inside the range

const isDecl = (st) => /^(FunctionDeclaration|ClassDeclaration|VariableDeclaration)$/.test(st.type);
const usesGameAtLoad = (st) => {
  // a link use inside this statement but not inside a nested function
  const fns = []; (function f(n) { if (!n || typeof n.type !== "string") return; if (/Function/.test(n.type) && n !== st) { fns.push([n.start, n.end]); return; } for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(f); else if (v && typeof v.type === "string" && k !== "loc") f(v); } })(st);
  return linkUses.some((u) => u.node.start >= st.start && u.node.end <= st.end && !fns.some(([s, e]) => u.node.start >= s && u.node.end <= e));
};
const modBody = [], initBody = [], keptInGame = [];
for (const p of pieces) {
  let text = applyEdits(p.text, p.st.start, edits);
  if (stayStmts.has(p.st)) { keptInGame.push(p.gap + p.text); continue; }
  if (!isDecl(p.st)) { initBody.push(p.gap.replace(/^\r?\n/, "") + text); continue; }
  if (p.st.type === "VariableDeclaration" && usesGameAtLoad(p.st)) {
    // declare at module level, assign in init
    const names = p.st.declarations.map((d) => { if (d.id.type !== "Identifier") die(`destructured load-time decl at ${p.st.loc.start.line}`); return d.id.name; });
    const exp = names.some((n) => exportNames.has(n)) ? "export " : "";
    modBody.push(`${p.gap}${exp}let ${names.join(", ")};`);
    const assigns = p.st.declarations.filter((d) => d.init).map((d) => `${d.id.name} = ${applyEdits(raw.slice(d.init.start, d.init.end), d.init.start, edits)};`);
    initBody.push(p.gap.replace(/^\r?\n/, "") + assigns.join(EOL));
    continue;
  }
  const names = p.st.type === "VariableDeclaration" ? p.st.declarations.flatMap((d) => patNames(d.id)) : [p.st.id.name];
  if (names.some((n) => exportNames.has(n))) text = "export " + text;
  modBody.push(p.gap + text);
}
const indent = (s) => s.split(/\r?\n/).map((l) => l.length ? "  " + l : l).join(EOL);
let mod = importLines.join(EOL) + EOL + EOL + modBody.join("").replace(/^(\r?\n)+/, "") + tail.replace(/\s+$/, "") + EOL;
if (initBody.length) mod += EOL + `/* What used to run at load in game.js: called from game.js where this code was. */` + EOL + `export function ${initName}() {` + EOL + indent(initBody.join(EOL).replace(/\s+$/, "")) + EOL + "}" + EOL;
mod = mod.replace(/\r?\n/g, EOL);

// ---- game.js edits
let g = raw;
// 1. replace the range
const callInit = initBody.length ? `${initName}();` : "";
const body = [keptInGame.join("").replace(/^(\r?\n)+/, ""), callInit].filter(Boolean).join(EOL);
const replacement = body ? EOL + body + EOL + EOL : "";
g = g.slice(0, OFF_A) + replacement + g.slice(OFF_B1);
// 2. import the module
const lastImport = ast.body.filter((s) => s.type === "ImportDeclaration").pop();
const impNames = [...exportNames].sort();
if (initBody.length) impNames.push(initName);
const impLine = `import { ${impNames.join(", ")} } from "./${modRel.replace(/\\/g, "/")}?v=${tag}";`;
g = g.slice(0, lastImport.end) + EOL + impLine + g.slice(lastImport.end);
// 3. link table
const linkEntries = [...linkNames].sort(([x], [y]) => x.localeCompare(y)).map(([n, r]) =>
  r.kind === "function" || r.kind === "class" ? `${n},` :
  r.write ? `get ${n}() { return ${n}; }, set ${n}(v) { ${n} = v; },` : `get ${n}() { return ${n}; },`);
const LINK_OPEN = "linkGame({";
if (!g.includes(LINK_OPEN)) {
  const at = g.indexOf(impLine) + impLine.length;
  const block = [
    "",
    `import { game, linkGame } from "./core/state.js?v=${stateTag()}";`,
    "/* What the split-out modules reach back into game.js for (see core/state.js).",
    "   Functions go in as they are; everything else as a getter, so nothing is",
    "   read before game.js declares it. game.js only ever gets smaller: an",
    "   entry leaves this list when the thing it names moves out. */",
    "linkGame({",
    "});",
  ].join(EOL);
  g = g.slice(0, at) + block + g.slice(at);
}
{
  const open = g.indexOf(LINK_OPEN) + LINK_OPEN.length;
  const close = g.indexOf(EOL + "});", open);
  const existing = g.slice(open, close).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // One entry per name; a new entry with a setter replaces a getter-only one
  // (an earlier move only read the name, this one writes it).
  const nameOf = (l) => (l.match(/^(?:get |set )?([\w$]+)/) || [])[1];
  const byName = new Map(existing.map((l) => [nameOf(l), l]));
  for (const e of linkEntries) {
    const old = byName.get(nameOf(e));
    if (!old || (e.includes(" set ") && !old.includes(" set "))) byName.set(nameOf(e), e);
  }
  const merged = [...byName.values()]
    .sort((x, y) => x.match(/^(?:get |set )?([\w$]+)/)[1].localeCompare(y.match(/^(?:get |set )?([\w$]+)/)[1]));
  g = g.slice(0, open) + EOL + merged.map((l) => "  " + l).join(EOL) + g.slice(close);
}
g = g.replace(/\r?\n/g, EOL);

console.log(`module: ${modRel}  (${mod.split(/\r?\n/).length} lines)`);
console.log(`exports to game.js (${exportNames.size}): ${[...exportNames].sort().join(", ")}`);
console.log(`kept in game.js (written there): ${[...stayNames].join(", ") || "-"}`);
console.log(`links (${linkNames.size}): ${[...linkNames].map(([n, r]) => n + (r.write ? "*" : "")).join(", ")}`);
console.log(`imports: ${[...importNames].join(", ")}`);
console.log(`init statements: ${initBody.length}`);
if (!DRY) {
  fs.mkdirSync(path.join(gameDir, modDir), { recursive: true });
  fs.writeFileSync(path.join(gameDir, modRel), mod);
  fs.writeFileSync(gamePath, g);
  console.log(`game.js: ${raw.split("\n").length} -> ${g.split("\n").length} lines`);
}
