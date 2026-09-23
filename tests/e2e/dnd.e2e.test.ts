import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { Browser, CDPSession, Page } from "puppeteer-core";
import type { ClassProfile } from "../../src/store/useClassRoom";
import { center, launch, openApp, screenshot, stored } from "./browser";
import { startServer, type TestServer } from "./server";

let server: TestServer;
let browser: Browser;
let page: Page;
let cdp: CDPSession;

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
  cdp = await page.createCDPSession();
});

const cell = (r: number, c: number) => `[data-drop-id='cell:${r}:${c}']`;
const room = async () => {
  const s = await stored<{ profiles: Record<string, ClassProfile>; currentId: string }>(
    page,
    "class-placement",
  );
  const p = s.profiles[s.currentId]!;
  return { tables: p.tables.map((t) => `${t.row}:${t.col}`).sort(), board: p.board };
};

async function mouseDrag(from: string, to: string) {
  const a = await center(page, from);
  const b = await center(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
  await page.mouse.up();
}

async function touchDrag(from: string, to: string) {
  const a = await center(page, from);
  const b = await center(page, to);
  const touch = (type: string, x?: number, y?: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type: type as "touchStart",
      touchPoints: x === undefined ? [] : [{ x, y: y! }],
    });
  await touch("touchStart", a.x, a.y);
  for (let i = 1; i <= 10; i++)
    await touch("touchMove", a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
  await touch("touchEnd");
}

const newTableTile = "[data-testid='new-table']";

test("mouse: drag a new table onto the grid", async () => {
  await mouseDrag(newTableTile, cell(1, 1));
  expect((await room()).tables).toEqual(["1:1"]);
  await screenshot(page, "room");
});

test("the drag preview shows the dragged item and goes away on drop", async () => {
  const a = await center(page, newTableTile);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x - 200, a.y + 50, { steps: 5 });
  expect(await page.$("[aria-hidden] img")).not.toBeNull();
  await screenshot(page, "drag-preview");
  await page.mouse.up();
  expect(await page.$("[aria-hidden] img")).toBeNull();
});

test("touch: add, move, then trash a table", async () => {
  await touchDrag(newTableTile, cell(0, 0));
  expect((await room()).tables).toEqual(["0:0"]);
  await touchDrag(`${cell(0, 0)} > div`, cell(2, 3));
  expect((await room()).tables).toEqual(["2:3"]);
  await touchDrag(`${cell(2, 3)} > div`, "[data-drop-id='trash']");
  expect((await room()).tables).toEqual([]);
});

test("a new table can't be dropped on an occupied cell", async () => {
  await mouseDrag(newTableTile, cell(0, 0));
  await mouseDrag(newTableTile, cell(0, 0));
  expect((await room()).tables).toEqual(["0:0"]);
});

test("touch: move the whiteboard to the bottom", async () => {
  await touchDrag("[data-drop-id='board:top'] > div", "[data-drop-id='board:bottom']");
  expect((await room()).board).toBe("bottom");
});

test("collapsing the panel gives the room the full width", async () => {
  const width = async () =>
    (await (await page.$("[data-drop-id='board:top']"))!.boundingBox())!.width;
  const open = await width();
  await page.click("[data-testid='hide-pannel']");
  expect(await page.$("aside")).toBeNull();
  expect(await width()).toBeGreaterThan(open);
  await page.click("[data-testid='show-pannel']");
  expect(await page.$("aside")).not.toBeNull();
});
