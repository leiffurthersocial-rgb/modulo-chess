// End-to-end engine verification in a real browser (Chromium via Playwright).
//
//   npm run build && npm start            # in one terminal
//   npm run verify:engine [-- http://localhost:3000]
//
// Requires Playwright (`npm i -D playwright && npx playwright install chromium`).
// Checks: cross-origin isolation, multi-threaded boot, MultiPV lines, rapid position
// changes, clean stop, full-game review of a PGN, single-threaded fallback when the
// page is not cross-origin isolated, and a move from the Stockfish opponent.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? ".verify";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const PGN = `[Event "Verification"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 (3... Bc5 4. c3 Nf6) 4. Nxe5 Qg5 5. Nxf7 Qxg2
6. Rf1 Qxe4+ 7. Be2 Nf3# 0-1`;

async function lines(page) {
  return page.locator('section:has(h3:text-is("Lines")) ol > li').count();
}

async function statusText(page) {
  return (await page.locator("p.mt-1\\.5").first().textContent()) ?? "";
}

async function main() {
  const browser = await chromium.launch();
  const errors = [];

  // ── 1. Multi-threaded engine, live analysis ────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${BASE}/engine`);
  await page.waitForLoadState("networkidle");
  const isolated = await page.evaluate(() => crossOriginIsolated && typeof SharedArrayBuffer !== "undefined");
  check("Page is cross-origin isolated (SharedArrayBuffer available)", isolated);

  const t0 = Date.now();
  await page
    .getByRole("switch", { name: /Analyze|Stop/ })
    .first()
    .click();
  await page.waitForFunction(() => document.querySelectorAll("section ol > li").length >= 3, null, {
    timeout: 30000,
  });
  check(
    "Engine boots and reports 3 MultiPV lines",
    (await lines(page)) === 3,
    `${Date.now() - t0} ms to first lines`,
  );
  const flavorText = await page.locator('section:has(h3:text-is("Lines")) header').textContent();
  check("Multi-threaded build selected", /multi-threaded/i.test(flavorText ?? ""), flavorText ?? "");
  await page.waitForTimeout(2500);
  const st = await statusText(page);
  const depth = Number(/Depth (\d+)/.exec(st)?.[1] ?? 0);
  check("Search deepens with nodes/sec reported", depth >= 12 && /n\/s/.test(st), st);
  const pv = await page.locator('section:has(h3:text-is("Lines")) ol > li').first().textContent();
  check(
    "Principal variation rendered in SAN",
    /1\.\s?(e4|d4|Nf3|c4)/.test(pv ?? ""),
    (pv ?? "").slice(0, 60),
  );
  await page.screenshot({ path: `${SHOTS}/desktop-engine.png` });

  // Rapid position changes: play moves via click-to-move, then scrub with arrow keys.
  const sq = (s) => page.locator(`[data-square="${s}"]`);
  for (const [a, b] of [
    ["e2", "e4"],
    ["e7", "e5"],
    ["g1", "f3"],
    ["b8", "c6"],
    ["f1", "b5"],
  ]) {
    await sq(a).click();
    await sq(b).click();
  }
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 12; i++) await page.keyboard.press(i % 3 === 2 ? "ArrowRight" : "ArrowLeft");
  await page.keyboard.press("End");
  await page.waitForTimeout(1500);
  const fenNow = await page.evaluate(
    () => document.querySelector("[aria-label='Move list'] [data-active]")?.textContent,
  );
  const lineAfter = await page.locator('section:has(h3:text-is("Lines")) ol > li').first().textContent();
  check(
    "Lines follow the latest position after rapid changes",
    fenNow === "Bb5" && /3…/.test(lineAfter ?? ""),
    `${fenNow} | ${(lineAfter ?? "").slice(0, 40)}`,
  );

  // Stop cleanly: status text must freeze.
  await page.getByRole("switch", { name: /Stop/ }).first().click();
  await page.waitForTimeout(300);
  const off1 = await page.locator("[role=main], main").first().textContent();
  await page.waitForTimeout(1200);
  const off2 = await page.locator("[role=main], main").first().textContent();
  const offText = await statusText(page);
  check("Stop halts analysis cleanly", off1 === off2 && /Engine is off/.test(offText), offText);

  // ── 2. Load a PGN in the Report tab: analysis + Elo estimate start automatically ──
  await page.goto(`${BASE}/analysis`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("PGN or FEN").filter({ visible: true }).fill(PGN);
  const r0 = Date.now();
  await page.getByRole("button", { name: "Analyse", exact: true }).filter({ visible: true }).click();
  await page.waitForSelector("[data-report-done]", { timeout: 120000 });
  const variationShown = await page
    .locator("[aria-label='Move list']")
    .filter({ visible: true })
    .textContent();
  check(
    "PGN with variations loaded into the move list",
    /Bc5/.test(variationShown ?? "") && /Nf3#/.test(variationShown ?? ""),
  );
  const quality = await page.locator('section:has(h3:text-is("Move quality"))').textContent();
  check(
    "Game report completes with move classifications",
    /Blunder/.test(quality ?? ""),
    `${Date.now() - r0} ms`,
  );
  const report = (await page.locator("[data-report-done]").textContent()) ?? "";
  const elos = [...report.matchAll(/Estimated Elo\s*(\d{3,4})/g)].map((m) => m[1]);
  check("Report estimates both players' Elo", elos.length === 2, elos.join(" / "));
  const moments = await page.locator('section:has(h3:text-is("Key moments")) li').count();
  check(
    "Key moments detected (white's 6. Rf1/7. Be2 sequence loses)",
    moments >= 1,
    `${moments} key moments`,
  );
  await page.screenshot({ path: `${SHOTS}/desktop-review.png` });

  // ── 3. Play vs Stockfish ────────────────────────────────────────────────
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^400/ }).filter({ visible: true }).click(); // lowest preset: exercises the weakened (sub-1320) engine
  await page
    .getByRole("button", { name: /^Play$/ })
    .filter({ visible: true })
    .click();
  // Drag and drop (pointer events) for the user's move.
  const box = async (s) => await sq(s).boundingBox();
  const from = await box("d2");
  const to = await box("d4");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelectorAll("[aria-label='Move list'] button[data-node]").length >= 2,
    null,
    { timeout: 20000 },
  );
  check("Drag-and-drop move accepted and a 400-Elo Stockfish replies", true);
  await page.screenshot({ path: `${SHOTS}/desktop-play.png` });

  // ── 3b. Keyboard-only move on the board ────────────────────────────────
  await page
    .getByRole("button", { name: /Abort game/ })
    .filter({ visible: true })
    .first()
    .click()
    .catch(() => {});
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("networkidle");
  await page.locator("[data-board]").focus();
  await page.keyboard.press("Enter"); // cursor starts on e2: pick up the pawn
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter"); // place on e4
  const kb = await page.locator("[aria-label='Move list']").filter({ visible: true }).textContent();
  check("Keyboard-only move (arrow keys + Enter)", /e4/.test(kb ?? ""), (kb ?? "").slice(0, 20));
  await ctx.close();

  // ── 3c. Quick Elo estimate: start, resign, get a rating ───────────────
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pe = await c.newPage();
    await pe.goto(`${BASE}/elo`);
    await pe.waitForLoadState("networkidle");
    await pe.getByRole("button", { name: "Start" }).first().click();
    await pe.getByRole("button", { name: /Resign/ }).click();
    await pe.waitForSelector("text=Estimated rating", { timeout: 60000 });
    const card = (await pe.locator("aside").textContent()) ?? "";
    const m = /Estimated rating\s*(\d+)/.exec(card);
    check("Quick Elo estimate produces a rating", Boolean(m), m ? `≈${m[1]}` : card.slice(0, 80));
    await c.close();
  }

  // ── 4. Single-threaded fallback without cross-origin isolation ─────────
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p2 = await ctx2.newPage();
  await p2.route("**/*", async (route) => {
    const req = route.request();
    if (req.resourceType() !== "document") return route.continue();
    const res = await route.fetch();
    const headers = { ...res.headers() };
    delete headers["cross-origin-embedder-policy"];
    delete headers["cross-origin-opener-policy"];
    return route.fulfill({ response: res, headers });
  });
  await p2.goto(`${BASE}/engine`);
  await p2.waitForLoadState("networkidle");
  const iso2 = await p2.evaluate(() => crossOriginIsolated);
  await p2
    .getByRole("switch", { name: /Analyze|Stop/ })
    .first()
    .click();
  await p2.waitForFunction(() => document.querySelectorAll("section ol > li").length >= 1, null, {
    timeout: 30000,
  });
  const flavor2 = await p2.locator('section:has(h3:text-is("Lines")) header').textContent();
  check(
    "Falls back to single-threaded WASM without SharedArrayBuffer",
    !iso2 && /single-threaded/.test(flavor2 ?? ""),
    flavor2 ?? "",
  );
  await ctx2.close();

  // ── 5. Mobile layout ────────────────────────────────────────────────────
  const ctx3 = await browser.newContext({ ...require("playwright").devices["iPhone 13"] });
  const p3 = await ctx3.newPage();
  await p3.goto(`${BASE}/`);
  await p3.waitForTimeout(500);
  await p3.screenshot({ path: `${SHOTS}/mobile.png` });
  const overflow = await p3.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("Mobile layout has no horizontal overflow", !overflow);
  await ctx3.close();

  const relevantErrors = errors.filter((e) => !/favicon/i.test(e));
  check("No uncaught page errors", relevantErrors.length === 0, relevantErrors.slice(0, 3).join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ${SHOTS}/`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
