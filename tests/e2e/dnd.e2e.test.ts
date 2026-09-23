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
  expect(await page.$("[aria-hidden] img")).not.toBeNull();
  expect(await page.$(trash)).not.toBeNull();
  await screenshot(page, "drag-preview");
  await page.mouse.up();
  expect(await page.$("[aria-hidden] img")).toBeNull();
  expect(await page.$(trash)).toBeNull();
  // Dropped outside any target: the table stays where it was.
  expect((await room()).tables).toEqual(["0:0"]);
});

test("the bin doesn't cover any cell", async () => {
  await page.click(cell(0, 0));
  const a = await center(page, `${cell(0, 0)} > div`);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 });
  const bin = (await (await page.$(trash))!.boundingBox())!;
  // Bottom-left cell of the default 9×9 grid.
  const corner = (await (await page.$(cell(8, 0)))!.boundingBox())!;
  await page.mouse.up();
  expect(bin.y).toBeGreaterThanOrEqual(corner.y + corner.height);
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

test("on a phone, the panel opens on top of the room instead of shrinking it", async () => {
  await page.setViewport({ width: 390, height: 800 });
  const width = async () =>
    (await (await page.$("[data-drop-id='board:top']"))!.boundingBox())!.width;
  const open = await width();
  const panel = (await (await page.$("aside"))!.boundingBox())!;
  expect(panel.width).toBe(390);
  await screenshot(page, "phone-pannel");
  await page.click("[data-testid='hide-pannel']");
  expect(await width()).toBe(open);
  await screenshot(page, "phone-room");
});
