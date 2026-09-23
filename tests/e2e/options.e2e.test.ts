import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser, ElementHandle, Page } from "puppeteer-core";
import type { ClassProfile } from "../../src/store/useClassRoom";
import type { StudentsStore } from "../../src/store/useStudents";
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

/** Clicks an export button and returns the downloaded file's name and parsed content. */
async function exportFile(kind: "rooms" | "classes") {
  rmSync(DOWNLOADS, { recursive: true, force: true });
  mkdirSync(DOWNLOADS, { recursive: true });
  const cdp = await browser.target().createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DOWNLOADS });
  await page.click(`[data-testid='export-${kind}']`);
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
  expect(await page.$eval("[data-testid='tab-classroom']", (b) => b.textContent)).toBe(
    "Salle de Cours",
  );
  expect(await page.$eval("[data-testid='tab-options']", (b) => b.getAttribute("aria-label"))).toBe(
    "Options",
  );
});

test("the About section, last in the tab, says the data stays in the browser", async () => {
  const last = await page.$eval("aside > section:last-of-type", (s) => s.dataset.testid);
  expect(last).toBe("about");
  const text = await page.$eval("[data-testid='about']", (s) => s.textContent);
  expect(text).toContain("No data is collected");
  expect(text).toContain("Import from JSON");
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

const roomNames = async () => {
  const s = await stored<{ profiles: Record<string, ClassProfile> }>(page, "class-placement");
  return Object.values(s.profiles).map((p) => p.name).sort();
};
const classNames = async () => {
  const s = await stored<StudentsStore>(page, "class-placement-students");
  return Object.values(s.classes).map((c) => c.name).sort();
};

test("rooms and classes export to separate files, without placements", async () => {
  await renameRoom("Room 12");
  await page.click("[data-testid='tab-options']");
  await screenshot(page, "backup-section");

  const rooms = await exportFile("rooms");
  expect(rooms!.name).toMatch(/^class-placement-rooms-\d{4}-\d{2}-\d{2}\.json$/);
  expect(rooms!.json).toMatchObject({ app: "class-placement", kind: "rooms" });
  expect(Object.values(rooms!.json.state.profiles).map((p) => (p as ClassProfile).name)).toEqual([
    "Room 12",
  ]);

  const classes = await exportFile("classes");
  expect(classes!.name).toMatch(/^class-placement-classes-/);
  expect(Object.keys(classes!.json.state).sort()).toEqual(["classes", "students"]);
});

test("importing adds the file's rooms or classes next to the existing ones", async () => {
  await renameRoom("Room 12");
  const rooms = await exportFile("rooms");
  const classes = await exportFile("classes");
  // Keep copies: the next export clears the downloads folder.
  const roomsPath = resolve(DOWNLOADS, "../rooms.json");
  const classesPath = resolve(DOWNLOADS, "../classes.json");
  await Bun.write(roomsPath, JSON.stringify(rooms!.json));
  await Bun.write(classesPath, JSON.stringify(classes!.json));
  await renameRoom("Scratch");

  expect(await importFile(roomsPath)).toBe("1 classroom added.");
  expect(await roomNames()).toEqual(["Room 12", "Scratch"]);
  // The imported room is loaded.
  expect(await roomName()).toBe("Room 12");

  expect(await importFile(classesPath)).toBe("1 class added.");
  expect(await classNames()).toEqual(["My class", "My class"]);
  expect(await roomNames()).toEqual(["Room 12", "Scratch"]);
  await screenshot(page, "import-done");

  // Still there after a reload.
  await page.reload();
  await page.waitForSelector("aside");
  expect(await roomNames()).toEqual(["Room 12", "Scratch"]);
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
  expect(await importFile(broken)).toBe("This file's data is damaged. Nothing was imported.");
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

test("the ? button next to ✕ opens a short tutorial, in the UI language", async () => {
  // Beside the close button, even at the panel's minimum width.
  await page.setViewport({ width: 900, height: 800 });
  const help = (await (await page.$("[data-testid='help']"))!.boundingBox())!;
  const close = (await (await page.$("[data-testid='hide-pannel']"))!.boundingBox())!;
  expect(help.x + help.width).toBeLessThanOrEqual(close.x);
  expect(Math.abs(help.y - close.y)).toBeLessThan(2);
  expect(await page.$eval("[data-testid='help']", (b) => b.getAttribute("aria-label"))).toBe("Help");

  await page.click("[data-testid='help']");
  await page.waitForSelector("dialog[open]");
  expect(await page.$eval("[data-testid='dialog-title']", (h) => h.textContent)).toBe(
    "How to use Class Placement",
  );
  const steps = await page.$$eval("[data-testid='help-step'] strong", (s) => s.map((e) => e.textContent));
  expect(steps).toEqual([
    "Draw the classroom",
    "Enter the class",
    "Place the students",
    "Adjust by hand",
    "Show it",
  ]);
  // The whole tutorial is readable without scrolling the page.
  const dialog = (await (await page.$("dialog[open]"))!.boundingBox())!;
  expect(dialog.y + dialog.height).toBeLessThanOrEqual(800);
  await screenshot(page, "help");
  await page.click("[data-testid='info-close']");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));

  await page.select("[data-testid='language']", "fr");
  await page.click("[data-testid='help']");
  await page.waitForSelector("dialog[open]");
  expect(await page.$eval("[data-testid='dialog-title']", (h) => h.textContent)).toBe(
    "Utiliser Class Placement",
  );
});
