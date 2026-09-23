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

// The target is located once the drag has started: the bin only exists then.
async function mouseDrag(from: string, to: string) {
  const a = await center(page, from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 10);
  const b = await center(page, to);
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
  await page.mouse.up();
}

async function touchDrag(from: string, to: string) {
  const a = await center(page, from);
  const touch = (type: string, x?: number, y?: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type: type as "touchStart",
      touchPoints: x === undefined ? [] : [{ x, y: y! }],
    });
  await touch("touchStart", a.x, a.y);
  await touch("touchMove", a.x + 10, a.y + 10);
  const b = await center(page, to);
  for (let i = 1; i <= 10; i++)
    await touch("touchMove", a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
  await touch("touchEnd");
}

const trash = "[data-testid='trash']";

test("clicking an empty cell adds a table; clicking it again toggles it", async () => {
  await page.click(cell(1, 1));
  expect((await room()).tables).toEqual(["1:1"]);
  await page.click(`${cell(1, 1)} > div`);
  expect((await room()).tables).toEqual(["1:1"]);
  expect(await page.$(`${cell(1, 1)} [data-off]`)).not.toBeNull();
  await screenshot(page, "room");
});

test("the bin and the drag preview only show while a table is dragged", async () => {
  await page.click(cell(0, 0));
  expect(await page.$(trash)).toBeNull();
  const a = await center(page, `${cell(0, 0)} > div`);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  // Over the panel, which isn't a drop target.
  await page.mouse.move(1100, a.y + 50, { steps: 5 });
  expect(await page.$("[aria-hidden] > div")).not.toBeNull();
  expect(await page.$(trash)).not.toBeNull();
  await screenshot(page, "drag-preview");
  await page.mouse.up();
  expect(await page.$("[aria-hidden] > div")).toBeNull();
  expect(await page.$(trash)).toBeNull();
  // Dropped outside any target: the table stays where it was.
  expect((await room()).tables).toEqual(["0:0"]);
});

test("the bin sits in the whiteboard row, above every cell", async () => {
  await page.click(cell(1, 0));
  const a = await center(page, `${cell(1, 0)} > div`);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 });
  const bin = (await (await page.$(trash))!.boundingBox())!;
  const first = (await (await page.$(cell(0, 0)))!.boundingBox())!;
  await page.mouse.up();
  expect(bin.y + bin.height).toBeLessThanOrEqual(first.y);
});

test("touch: add, move, then trash a table", async () => {
  const c = await center(page, cell(0, 0));
  await page.touchscreen.tap(c.x, c.y);
  expect((await room()).tables).toEqual(["0:0"]);
  await touchDrag(`${cell(0, 0)} > div`, cell(2, 3));
  expect((await room()).tables).toEqual(["2:3"]);
  await touchDrag(`${cell(2, 3)} > div`, trash);
  expect((await room()).tables).toEqual([]);
});

test("dropping a table on an empty cell doesn't add another one", async () => {
  await page.click(cell(0, 0));
  await mouseDrag(`${cell(0, 0)} > div`, cell(0, 2));
  expect((await room()).tables).toEqual(["0:2"]);
});

const board = "[data-testid='whiteboard']";
const box = async (selector: string) => (await (await page.$(selector))!.boundingBox())!;

test("the whiteboard row is a third of a cell's height, above the grid", async () => {
  await page.evaluate(() => {
    const room = { id: "r", name: "R", rows: 3, cols: 3, tables: [], board: { col: 1, span: 1 } };
    localStorage.setItem(
      "class-placement",
      JSON.stringify({ version: 3, state: { profiles: { r: room }, currentId: "r" } }),
    );
  });
  await page.reload();
  await page.waitForSelector(board);
  const b = await box(board);
  const c = await box(cell(0, 1));
  expect(b.y + b.height).toBeLessThan(c.y);
  expect(Math.abs(b.height - c.height / 3)).toBeLessThan(2);
  expect(Math.abs(b.x - c.x)).toBeLessThan(2);
  expect(Math.abs(b.width - c.width)).toBeLessThan(2);
  await screenshot(page, "whiteboard");
});

// Drags from `from` by `dx` pixels, sideways.
async function slide(from: string, dx: number) {
  const a = await center(page, from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + dx, a.y, { steps: 8 });
  await page.mouse.up();
}

test("the whiteboard moves sideways and resizes, lined up with the columns", async () => {
  const col = async (c: number) => box(cell(0, c));
  const step = (await col(1)).x - (await col(0)).x;
  // The default 9-column room: centered over columns 2 to 6.
  expect(Math.abs((await box(board)).x - (await col(2)).x)).toBeLessThan(2);

  await slide(board, 2 * step);
  expect((await room()).board).toEqual({ col: 4, span: 5 });
  // Its edges match the cells below.
  const b = await box(board);
  expect(Math.abs(b.x - (await col(4)).x)).toBeLessThan(2);
  const last = await col(8);
  expect(Math.abs(b.x + b.width - (last.x + last.width))).toBeLessThan(2);

  await slide("[data-testid='board-left']", -1.5 * step);
  expect((await room()).board).toEqual({ col: 2.5, span: 6.5 });
  await slide("[data-testid='board-right']", -3 * step);
  expect((await room()).board).toEqual({ col: 2.5, span: 3.5 });
  // Past the room's edge: stops there.
  await slide(board, -20 * step);
  expect((await room()).board).toEqual({ col: 0, span: 3.5 });
});

test("touch: move the whiteboard", async () => {
  const step = (await box(cell(0, 1))).x - (await box(cell(0, 0))).x;
  const a = await center(page, board);
  const touch = (type: string, x?: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type: type as "touchStart",
      touchPoints: x === undefined ? [] : [{ x, y: a.y }],
    });
  await touch("touchStart", a.x);
  for (let i = 1; i <= 10; i++) await touch("touchMove", a.x - (step * i) / 10);
  await touch("touchEnd");
  expect((await room()).board).toEqual({ col: 1, span: 5 });
});

test("Escape cancels a whiteboard drag", async () => {
  const a = await center(page, board);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 200, a.y, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  // Nothing was saved.
  expect(await stored(page, "class-placement")).toBeUndefined();
  // The board is shown back where it was saved.
  expect(Math.abs((await box(board)).x - (await box(cell(0, 2))).x)).toBeLessThan(2);
});

test("collapsing the panel gives the room the full width", async () => {
  const width = async () =>
    (await (await page.$("[data-testid='whiteboard']"))!.boundingBox())!.width;
  const open = await width();
  await page.click("[data-testid='hide-pannel']");
  expect(await page.$("aside")).toBeNull();
  expect(await width()).toBeGreaterThan(open);
  await page.click("[data-testid='show-pannel']");
  expect(await page.$("aside")).not.toBeNull();
});

test("on a phone, the panel opens on top of the room instead of shrinking it", async () => {
  await page.setViewport({ width: 390, height: 800 });
  const width = async () =>
    (await (await page.$("[data-testid='whiteboard']"))!.boundingBox())!.width;
  const open = await width();
  const panel = (await (await page.$("aside"))!.boundingBox())!;
  expect(panel.width).toBe(390);
  await screenshot(page, "phone-pannel");
  await page.click("[data-testid='hide-pannel']");
  expect(await width()).toBe(open);
  await screenshot(page, "phone-room");
});
