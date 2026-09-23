import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { Browser, Page } from "puppeteer-core";
import type { PlacementsStore } from "../../src/store/usePlacements";
import type { Student } from "../../src/store/useStudents";
import { center, clickText, launch, openApp, screenshot, stored } from "./browser";
import { startServer, type TestServer } from "./server";

let server: TestServer;
let browser: Browser;
let page: Page;

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
});

const cell = (r: number, c: number) => `[data-drop-id='cell:${r}:${c}']`;

function student(name: string, patch: Partial<Student> = {}): Student {
  return { id: name, name, gender: "other", score: null, frontRow: false, incompatible: [], ...patch };
}

/** Stores a room with tables at `cells` and a class of `students`, then reloads. */
async function seed(cells: [number, number][], students: Student[]) {
  await page.evaluate(
    (cells, students) => {
      const tables = cells.map(([row, col]) => ({ id: `t${row}-${col}`, row, col }));
      const room = { id: "room", name: "Room 1", rows: 4, cols: 4, tables, board: { col: 1, span: 2 } };
      localStorage.setItem(
        "class-placement",
        JSON.stringify({ version: 3, state: { profiles: { room }, currentId: "room" } }),
      );
      const cls = { id: "cls", name: "6B", studentIds: students.map((s) => s.id) };
      localStorage.setItem(
        "class-placement-students",
        JSON.stringify({
          version: 3,
          state: {
            students: Object.fromEntries(students.map((s) => [s.id, s])),
            classes: { cls },
            currentClassId: "cls",
          },
        }),
      );
    },
    cells,
    students,
  );
  await page.reload();
  await page.waitForSelector("aside");
  await clickText(page, "[role=tab]", "Placement");
}

/** Name shown on the table in each cell, e.g. { "0:1": "Alice" }. */
const namesByCell = () =>
  page.$$eval("[data-drop-id^='cell:']", (cells) =>
    Object.fromEntries(
      cells.flatMap((c) => {
        const name = c.querySelector("[data-testid='seat-name']")?.textContent;
        return name ? [[c.getAttribute("data-drop-id")!.slice(5), name]] : [];
      }),
    ),
  );

const placements = () => stored<PlacementsStore>(page, "class-placement-placements");

test("Place students shows every name on a table and saves the seating", async () => {
  await seed(
    [[0, 0], [0, 1], [2, 0], [2, 1]],
    ["Alice", "Bob", "Chloé", "Dan"].map((n) => student(n)),
  );
  expect(await page.$("[data-testid='seat-name']")).toBeNull();
  await page.click("[data-testid='place']");

  const names = await namesByCell();
  expect(Object.keys(names).sort()).toEqual(["0:0", "0:1", "2:0", "2:1"]);
  expect(Object.values(names).sort()).toEqual(["Alice", "Bob", "Chloé", "Dan"]);
  const saved = (await placements()).placements["room:cls"]!;
  expect(Object.keys(saved.seats)).toHaveLength(4);
  expect(await page.$eval("[data-testid='violations']", (p) => p.textContent)).toBe(
    "No constraint broken.",
  );
  await screenshot(page, "placement-room");

  // Survives a reload.
  await page.reload();
  await page.waitForSelector("aside");
  expect(await namesByCell()).toEqual(names);

  // Clear removes the names.
  await clickText(page, "[role=tab]", "Placement");
  await page.click("[data-testid='clear-placement']");
  expect(await page.$("[data-testid='seat-name']")).toBeNull();
});

test("dragging a seated table onto another swaps the two students", async () => {
  await seed([[0, 0], [0, 2]], [student("Alice"), student("Bob")]);
  await page.click("[data-testid='place']");
  const before = await namesByCell();

  const a = await center(page, `${cell(0, 0)} > div`);
  const b = await center(page, cell(0, 2));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();

  expect(await namesByCell()).toEqual({ "0:0": before["0:2"]!, "0:2": before["0:0"]! });
});

test("students without a table are listed", async () => {
  await seed([[0, 0], [2, 2]], [student("Alice"), student("Bob"), student("Chloé")]);
  await page.click("[data-testid='place']");
  expect(Object.keys(await namesByCell())).toHaveLength(2);
  const warning = await page.$eval("[data-testid='unplaced']", (p) => p.textContent!);
  expect(warning).toMatch(/^Not enough tables\. Not seated: (Alice|Bob|Chloé)\.$/);
});

test("a constraint that can't be kept is marked on both tables and counted", async () => {
  await seed(
    [[1, 1], [1, 2]],
    [student("Alice", { incompatible: ["Bob"] }), student("Bob", { incompatible: ["Alice"] })],
  );
  await page.click("[data-testid='place']");

  const marks = (sel: string) =>
    page.$$eval(`${sel} [data-violation]`, (ms) => ms.map((m) => m.getAttribute("data-violation")));
  expect(await marks(cell(1, 1))).toEqual(["incompatible"]);
  expect(await marks(cell(1, 2))).toEqual(["incompatible"]);
  expect(await page.$eval("[data-testid='violations']", (u) => u.textContent)).toBe(
    "1 incompatible pair",
  );
  // The arrows sit between the two tables and point at each other.
  const [left, right] = await page.$$eval("[data-violation]", (ms) =>
    ms.map((m) => m.getBoundingClientRect().x),
  );
  const [c1, c2] = [await center(page, cell(1, 1)), await center(page, cell(1, 2))];
  expect(left!).toBeGreaterThan(c1.x);
  expect(right!).toBeLessThan(c2.x);
  await screenshot(page, "placement-violation");

  // Turning the constraint off removes the marks.
  await page.click("[data-testid='opt-incompatible']");
  expect(await page.$("[data-violation]")).toBeNull();
  expect(await page.$eval("[data-testid='opt-incompatible-weight']", (s) => (s as HTMLSelectElement).disabled)).toBe(true);
  expect((await placements()).options.incompatible.enabled).toBe(false);
});

test("options are saved", async () => {
  await seed([[0, 0]], [student("Alice")]);
  await page.select("[data-testid='opt-score-rule']", "pairMean");
  await page.select("[data-testid='opt-diagonal']", "0");
  await page.select("[data-testid='opt-gender-weight']", "16");
  const { options } = await placements();
  expect(options.score.rule).toBe("pairMean");
  expect(options.diagonal).toBe(0);
  expect(options.gender.weight).toBe(16);
});

test("each constraint's ⓘ button explains it in a modal", async () => {
  await seed([[0, 0]], [student("Alice")]);
  const title = () => page.$eval("[data-testid='dialog-title']", (h) => h.textContent);
  const open = () => page.$$eval("dialog[open]", (d) => d.length);
  for (const [kind, name] of <[string, string][]>[
    ["gender", "Alternate genders"],
    ["incompatible", "Separate incompatible students"],
    ["score", "Balance scores"],
    ["front", "Fill the front first"],
    ["frontRow", "Front-row students near the board"],
    ["diagonal", "Diagonal neighbors"],
  ]) {
    expect(await page.$eval(`[data-testid='info-${kind}']`, (b) => b.ariaLabel)).toBe(
      `About "${name}"`,
    );
    await page.click(`[data-testid='info-${kind}']`);
    expect(await title()).toBe(name);
    const text = await page.$eval("[data-testid='info-body']", (b) => b.textContent);
    expect(text!.length).toBeGreaterThan(100);
    // Constraints with a weight explain the weights; the diagonal has none.
    expect(text!.includes("×16")).toBe(kind !== "diagonal");
    if (kind === "score") {
      expect(text).toContain("Spread strong and weak:");
      await screenshot(page, "placement-info");
    }
    await page.click("[data-testid='info-close']");
    expect(await open()).toBe(0);
  }
  // Clicks in the modals never reached the options.
  expect(await page.$eval("[data-testid='opt-diagonal']", (s) => (s as HTMLSelectElement).value)).toBe("0.5");
});

test("Place is disabled with a hint when there is nothing to place", async () => {
  await seed([], [student("Alice")]);
  expect(await page.$eval("[data-testid='place']", (b) => (b as HTMLButtonElement).disabled)).toBe(true);
  await seed([[0, 0]], []);
  expect(await page.$eval("[data-testid='place']", (b) => (b as HTMLButtonElement).disabled)).toBe(true);
});

test("the Placement tab fits the panel at its minimum width", async () => {
  await page.setViewport({ width: 900, height: 800 });
  await seed([[0, 0], [0, 1]], [student("Alexandra-Marie", { gender: "female" }), student("Béatrice", { gender: "female" }), student("Chloé")]);
  await page.click("[data-testid='place']");
  await screenshot(page, "placement-tab-narrow");
  const overflow = await page.$$eval("aside section", (sections) =>
    Math.max(...sections.map((s) => s.scrollWidth - s.clientWidth)),
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a full block of same-gender students marks every side and corner", async () => {
  const cells: [number, number][] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push([r, c]);
  await seed(cells, cells.map((_, i) => student(`Student ${i + 1}`, { gender: "female" })));
  await page.click("[data-testid='place']");
  await screenshot(page, "placement-gender-block");
  // The middle table has 4 side and 4 diagonal neighbors (½ weight by default).
  expect(await page.$$eval(`${cell(1, 1)} [data-violation=gender]`, (m) => m.length)).toBe(8);
  expect(await page.$$eval(`${cell(0, 0)} [data-violation=gender]`, (m) => m.length)).toBe(3);
  expect(await page.$eval("[data-testid='violations']", (u) => u.textContent)).toBe(
    "20 same-gender pairs",
  );
});

const tableIn = (r: number, c: number) => `${cell(r, c)} [data-testid='table']`;
const isOff = (r: number, c: number) =>
  page.$eval(tableIn(r, c), (t) => t.hasAttribute("data-off"));

test("clicking a table switches it off for this placement, and back on", async () => {
  await seed([[0, 0], [0, 2]], [student("Alice"), student("Bob")]);
  await page.click(tableIn(0, 0));
  expect(await isOff(0, 0)).toBe(true);
  expect((await placements()).disabledTables).toEqual({ "room:cls": ["t0-0"] });
  expect(await page.$eval("[data-testid='disabled-hint']", (p) => p.textContent)).toMatch(
    /^1 table is switched off/,
  );

  // Nobody is seated there; the other student is listed as unplaced.
  await page.click("[data-testid='place']");
  expect(Object.keys(await namesByCell())).toEqual(["0:2"]);
  expect(await page.$("[data-testid='unplaced']")).not.toBeNull();
  await screenshot(page, "placement-table-off");

  await page.click(tableIn(0, 0));
  expect(await isOff(0, 0)).toBe(false);
  expect((await placements()).disabledTables).toEqual({});
});

test("dragging a table doesn't switch it, and double-click no longer deletes", async () => {
  await seed([[0, 0]], [student("Alice")]);
  const a = await center(page, tableIn(0, 0));
  const b = await center(page, cell(2, 2));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  // Back onto its own cell: the browser fires a click on the table.
  await page.mouse.move(a.x, a.y, { steps: 10 });
  await page.mouse.up();
  expect(await isOff(0, 0)).toBe(false);

  await page.click(tableIn(0, 0), { count: 2 });
  expect(await page.$$eval("[data-testid='table']", (ts) => ts.length)).toBe(1);
});

test("the arrows can be hidden", async () => {
  await seed([[0, 0], [0, 1]], [student("Ann", { gender: "female" }), student("Bea", { gender: "female" })]);
  await page.click("[data-testid='place']");
  expect(await page.$$eval("[data-violation]", (m) => m.length)).toBe(2);
  await page.click("[data-testid='show-marks']");
  expect(await page.$("[data-violation]")).toBeNull();
  // The summary stays.
  expect(await page.$eval("[data-testid='violations']", (u) => u.textContent)).toBe(
    "1 same-gender pair",
  );
  expect((await placements()).showMarks).toBe(false);
});

test("a front-row student sits at the front, and is marked when moved back", async () => {
  await seed([[0, 0], [1, 0], [2, 0]], [student("Ann"), student("Bea", { frontRow: true }), student("Cy")]);
  await page.click("[data-testid='place']");
  expect((await namesByCell())["0:0"]).toBe("Bea");
  expect(await page.$("[data-violation]")).toBeNull();

  // Swap Bea with the student behind: the arrow points at the board.
  const a = await center(page, tableIn(0, 0));
  const b = await center(page, cell(2, 0));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  expect(await page.$$eval(`${cell(2, 0)} [data-violation=frontRow]`, (m) => m.length)).toBe(1);
  expect(await page.$eval("[data-testid='violations']", (u) => u.textContent)).toBe(
    "1 front-row student not at the front",
  );
  await screenshot(page, "placement-front-row");
});

test("the front-row flag is set in the student card and shown in the list", async () => {
  await seed([[0, 0]], [student("Ann")]);
  await clickText(page, "[role=tab]", "Students");
  expect(await page.$("[data-testid='front-row-badge']")).toBeNull();
  await page.click("[data-testid='student-details']");
  await page.waitForSelector("dialog[open]");
  await page.click("[data-testid='card-front-row']");
  await clickText(page, "dialog button", "Save");
  await page.waitForSelector("[data-testid='front-row-badge']");
  const saved = await stored<{ students: Record<string, Student> }>(page, "class-placement-students");
  expect(saved.students.Ann!.frontRow).toBe(true);
});
