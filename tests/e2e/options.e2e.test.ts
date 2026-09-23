import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser, ElementHandle, Page } from "puppeteer-core";
import type { ClassProfile } from "../../src/store/useClassRoom";
import { launch, openApp, screenshot, stored } from "./browser";
import { startServer, type TestServer } from "./server";

let server: TestServer;
let browser: Browser;
let page: Page;

// Chrome needs a normalized absolute path, for downloads and uploads alike.
const DOWNLOADS = resolve(import.meta.dir, "../../.e2e-screenshots/downloads");

beforeAll(async () => {
  server = await startServer();
  browser = await launch();
});
afterAll(async () => {
  await browser?.close();
  server?.stop();
});
beforeEach(async () => {
  await page?.close();
  page = await openApp(browser, server.url);
  await page.click("[data-testid='tab-options']");
});

const roomName = async () => {
  const s = await stored<{ profiles: Record<string, ClassProfile>; currentId: string }>(
    page,
    "class-placement",
  );
  return s.profiles[s.currentId]!.name;
};

async function renameRoom(name: string) {
  await page.click("[data-testid='tab-classroom']");
  const input = await page.$("aside section input[type=text]");
  await input!.click({ count: 3 });
  await input!.type(name);
  await page.click("[data-testid='tab-options']");
}

/** Clicks Export and returns the downloaded file's name and parsed content. */
async function exportFile() {
  rmSync(DOWNLOADS, { recursive: true, force: true });
  mkdirSync(DOWNLOADS, { recursive: true });
  const cdp = await browser.target().createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DOWNLOADS });
  await page.click("[data-testid='export']");
  for (let i = 0; i < 50; i++) {
    const done = readdirSync(DOWNLOADS).filter((f) => f.endsWith(".json"));
    if (done[0]) {
      const path = `${DOWNLOADS}/${done[0]}`;
      return { name: done[0], path, json: await Bun.file(path).json() };
    }
    await Bun.sleep(50);
  }
  throw new Error("No download");
}

async function importFile(path: string) {
  const input = (await page.$("[data-testid='import-file']")) as ElementHandle<HTMLInputElement>;
  await input.uploadFile(path);
  await page.waitForSelector("[data-testid='import-status']");
  return page.$eval("[data-testid='import-status']", (p) => p.textContent);
}

test("the language picker lives in the Options tab", async () => {
  expect(await page.$("aside header select")).toBeNull();
  await page.select("[data-testid='language']", "fr");
  expect(await page.$eval("[data-testid='tab-classroom']", (b) => b.textContent)).toBe("Salle");
  expect(await page.$eval("[data-testid='tab-options']", (b) => b.getAttribute("aria-label"))).toBe(
    "Options",
  );
});

test("the About section, last in the tab, says the data stays in the browser", async () => {
  const last = await page.$eval("aside > section:last-of-type", (s) => s.dataset.testid);
  expect(last).toBe("about");
  const text = await page.$eval("[data-testid='about']", (s) => s.textContent);
  expect(text).toContain("No data is collected");
  expect(text).toContain("Export as JSON");
  await page.select("[data-testid='language']", "fr");
  expect(await page.$eval("[data-testid='about'] h2", (h) => h.textContent)).toBe("À propos");
});

test("the ⚙ tab icon is larger than the tab labels, without a taller tab bar", async () => {
  const box = (id: string) =>
    page.$eval(`[data-testid='${id}']`, (b) => ({
      font: parseFloat(getComputedStyle(b).fontSize),
      height: b.getBoundingClientRect().height,
    }));
  const icon = await box("tab-options");
  const text = await box("tab-classroom");
  expect(icon.font).toBeGreaterThan(text.font * 1.4);
  expect(icon.height).toBe(text.height);
});

test("each theme changes the room, table and panel colors, and is remembered", async () => {
  await page.click("[data-drop-id='cell:0:0']");
  const table = () =>
    page.$eval("[data-testid='table']", (t) => {
      const s = getComputedStyle(t);
      return `${s.backgroundColor} ${s.borderColor}`;
    });
  // The room is the grid's parent; the panel shows #root's color.
  const room = () =>
    page.evaluate(
      () =>
        getComputedStyle(document.querySelector("[data-drop-id='cell:0:0']")!.parentElement!.parentElement!)
          .backgroundColor,
    );
  const panel = () =>
    page.evaluate(() => getComputedStyle(document.getElementById("root")!).backgroundColor);

  const rooms = new Set<string>();
  const panels = new Set<string>();
  const tables = new Set<string>();
  for (const theme of ["indigo", "light", "chalk"]) {
    await page.select("[data-testid='theme']", theme);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
    if (theme === "indigo") expect(await room()).not.toBe("rgb(255, 255, 255)");
    rooms.add(await room());
    panels.add(await panel());
    tables.add(await table());
    await screenshot(page, `theme-${theme}`);
  }
  expect([rooms.size, panels.size, tables.size]).toEqual([3, 3, 3]);

  await page.reload();
  await page.waitForSelector("aside");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("chalk");
  expect((await stored<{ theme: string }>(page, "class-placement-ui")).theme).toBe("chalk");
});

test("export downloads every store as JSON", async () => {
  await renameRoom("Room 12");
  await page.select("[data-testid='theme']", "light");
  const { name, json } = await exportFile();
  expect(name).toMatch(/^class-placement-\d{4}-\d{2}-\d{2}\.json$/);
  expect(json.app).toBe("class-placement");
  const room = json.data["class-placement"].state;
  expect(room.profiles[room.currentId].name).toBe("Room 12");
  expect(json.data["class-placement-ui"].state.theme).toBe("light");
});

test("import restores an export, replacing the current data", async () => {
  await renameRoom("Room 12");
  await page.select("[data-testid='theme']", "chalk");
  const { path } = await exportFile();

  // Start over, then change things the import must undo.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("aside");
  await renameRoom("Scratch");
  expect(await roomName()).toBe("Scratch");

  expect(await importFile(path)).toBe("Data imported.");
  expect(await roomName()).toBe("Room 12");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("chalk");
  await screenshot(page, "import-done");

  // Still there after a reload.
  await page.reload();
  await page.waitForSelector("aside");
  expect(await roomName()).toBe("Room 12");
});

test("a file that isn't an export is refused, and nothing changes", async () => {
  await renameRoom("Keep me");
  // A new file each time: Chrome can't re-read one rewritten after upload.
  mkdirSync(DOWNLOADS, { recursive: true });
  const notJson = `${DOWNLOADS}/not-json.json`;
  await Bun.write(notJson, "{ not json");
  expect(await importFile(notJson)).toBe("This file isn't valid JSON.");

  const broken = `${DOWNLOADS}/broken.json`;
  await Bun.write(broken, JSON.stringify({ app: "class-placement", data: { "class-placement": { state: {} } } }));
  expect(await importFile(broken)).toBe(
    'The file\'s "class-placement" data is damaged. Nothing was imported.',
  );
  expect(await roomName()).toBe("Keep me");
});

test("four tabs fit the panel at its minimum width", async () => {
  await page.setViewport({ width: 900, height: 800 });
  await screenshot(page, "options-narrow");
  const clipped = await page.$$eval("[role=tab]", (tabs) =>
    tabs.filter((t) => t.scrollWidth > t.clientWidth).map((t) => t.textContent),
  );
  expect(clipped).toEqual([]);
});
