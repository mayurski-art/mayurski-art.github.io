// Owner gate test: Grin Sabers and Troll Us send a signed-out visitor or
// any other account back home, open for troll_runner, and show greyed out
// (not clickable) in the home Arcade menu and the games hub for everyone
// else. The accounts script is stubbed (no network); ?gate turns the gate
// on for localhost.
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
const GAME_JS = /grin-sabers\/game\.js|troll-us\/web\/main\.js/;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
async function open(url, user, real = false) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const gameLoads = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (GAME_JS.test(u)) gameLoads.push(u);
    if (!real && /\/assets\/js\/troll-accounts\.js/.test(u)) return route.fulfill({ contentType: "text/javascript", body: stub(user) });
    if (u.startsWith(`http://localhost:${PORT}/`) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    return route.abort();
  });
  await page.goto(`http://localhost:${PORT}/${url}`, { waitUntil: "domcontentloaded" });
  return { page, errors, gameLoads };
}

for (const g of [{ page: "sabers.html", name: "Grin Sabers" }, { page: "trollus.html", name: "Troll Us" }]) {
  for (const [who, user, real] of [["signed out", null], ["another account", "some_troll"], ["accounts script down", null, true]]) {
    const { page, gameLoads } = await open(`${g.page}?gate&debug`, user, real);
    const home = await page.waitForURL((u) => u.pathname === "/", { timeout: 15000 }).then(() => true, () => false);
    await page.waitForTimeout(1000);
    check(`${g.name}: ${who} is sent home`, home, page.url());
    check(`${g.name}: ${who} never loads the game module`, gameLoads.length === 0, gameLoads.join(" "));
    await page.close();
  }
  const { page, errors } = await open(`${g.page}?gate&debug`, "troll_runner");
  await page.waitForFunction((re) => performance.getEntriesByType("resource").some((r) => new RegExp(re).test(r.name)), GAME_JS.source, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => ({ path: location.pathname, gs: !!window.__gs, tu: document.querySelector("#tu-status")?.textContent ?? null }));
  check(`${g.name}: troll_runner gets the game`, st.path.includes(g.page) && (g.page === "sabers.html" ? st.gs : !/Could not load/.test(st.tu || "")), JSON.stringify(st));
  check(`${g.name}: no page errors for troll_runner`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await page.close();
}

for (const [who, user, want] of [["signed out", null, false], ["troll_runner", "troll_runner", true]]) {
  const { page } = await open("?open=arcade", user);
  await page.waitForTimeout(2500);
  const text = await page.locator("#home-menu").innerText();
  const rows = await page.evaluate(() => ["a-sabers", "a-trollus"].map((id) => document.querySelector(`#home-menu [data-id="${id}"]`)?.getAttribute("aria-disabled") || "open"));
  check(`home Arcade, ${who}: both games listed, ${want ? "clickable" : "greyed out"}`, /Grin Sabers/i.test(text) && /Troll Us/i.test(text) && rows.every((r) => (r === "open") === want), rows.join(","));
  if (!want) {
    await page.click('#home-menu [data-id="a-sabers"]', { force: true });
    await page.click('#home-menu [data-id="a-sabers"]', { force: true });
    await page.waitForTimeout(800);
    check("home Arcade, signed out: clicking Grin Sabers goes nowhere", !/sabers/.test(page.url()), page.url());
  }
  await page.close();
}
{
  const { page } = await open("games.html", null);
  await page.waitForTimeout(800);
  const html = await page.content();
  const cards = await page.evaluate(() => [...document.querySelectorAll(".hub-card")]
    .filter((c) => /Grin Sabers|Troll Us/.test(c.querySelector("h3")?.textContent || ""))
    .map((c) => c.classList.contains("is-locked") && !c.querySelector("a.hub-card-play")));
  check("games hub shows both cards locked, no play link", cards.length === 2 && cards.every(Boolean) && !/href="(sabers|trollus)"/.test(html), JSON.stringify(cards));
  await page.close();
}
await browser.close();
server.kill();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
