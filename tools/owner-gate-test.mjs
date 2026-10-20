// Owner gate test: Grin Sabers and Troll Us stay shut to a signed-out
// visitor and to any other account, open for troll_runner, and only
// troll_runner sees them in the home Arcade menu. The accounts script is
// stubbed (no network); ?gate turns the gate on for localhost.
//   node tools/owner-gate-test.mjs
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5233;
const server = spawn(process.execPath, [path.join(ROOT, "tools/static-serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
let fails = 0;
const check = (name, ok, info = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${info ? `  (${info})` : ""}`); };

const stub = (user) => `window.TrollrunnerAccounts = {
  getSession: async () => ${user ? `({ username: ${JSON.stringify(user)} })` : "null"},
  getCachedProfile: () => ${user ? `({ username: ${JSON.stringify(user)} })` : "null"},
};`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
async function open(url, user, real = false) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (!real && /\/assets\/js\/troll-accounts\.js/.test(u)) return route.fulfill({ contentType: "text/javascript", body: stub(user) });
    if (u.startsWith(`http://localhost:${PORT}/`) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    return route.abort();
  });
  await page.goto(`http://localhost:${PORT}/${url}`, { waitUntil: "domcontentloaded" });
  return { page, errors };
}

const GAMES = [
  { page: "sabers.html", name: "Grin Sabers" },
  { page: "trollus.html", name: "Troll Us" },
];
for (const g of GAMES) {
  for (const [who, user, real] of [["signed out", null], ["another account", "some_troll"], ["accounts script down", null, true]]) {
    const { page } = await open(`${g.page}?gate&debug`, user, real);
    const card = await page.waitForSelector("#owner-gate", { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);
    const text = card ? await card.innerText() : "";
    const loaded = await page.evaluate(() => performance.getEntriesByType("resource").some((r) => /grin-sabers\/game\.js|troll-us\/web\/main\.js/.test(r.name)));
    check(`${g.name}: ${who} gets the locked card`, !!card && /Not open yet/.test(text) && text.includes(g.name), text.replace(/\s+/g, " "));
    check(`${g.name}: ${who} never loads the game module`, !loaded);
    await page.close();
  }
  const { page, errors } = await open(`${g.page}?gate&debug`, "troll_runner");
  await page.waitForFunction(() => performance.getEntriesByType("resource").some((r) => /grin-sabers\/game\.js|troll-us\/web\/main\.js/.test(r.name)), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => ({ gate: !!document.querySelector("#owner-gate"), gs: !!window.__gs, tu: document.querySelector("#tu-status")?.textContent ?? null }));
  check(`${g.name}: troll_runner gets the game`, !st.gate && (g.page === "sabers.html" ? st.gs : !/Could not load/.test(st.tu || "")), JSON.stringify(st));
  check(`${g.name}: no page errors for troll_runner`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await page.close();
}

for (const [who, user, want] of [["signed out", null, false], ["troll_runner", "troll_runner", true]]) {
  const { page } = await open("?open=arcade", user);
  await page.waitForTimeout(2500);
  const text = await page.locator("#home-menu").innerText();
  const has = /Grin Sabers/i.test(text) || /Troll Us/i.test(text);
  check(`home Arcade, ${who}: ${want ? "lists" : "hides"} both games`, has === want && /Troll Kombat/i.test(text), text.replace(/\s+/g, " ").slice(0, 160));
  await page.close();
}
{
  const { page } = await open("games.html", null);
  const html = await page.content();
  check("games hub has no Grin Sabers / Troll Us card", !/href="(sabers|trollus)"/.test(html) && !/Grin Sabers|Troll Us/.test(html));
  await page.close();
}
await browser.close();
server.kill();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
