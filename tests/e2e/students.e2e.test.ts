import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { Browser, ElementHandle, Page } from "puppeteer-core";
import type { Gender, StudentsStore } from "../../src/store/useStudents";
import { clickText, launch, openApp, screenshot, setLanguage, stored } from "./browser";
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
  await clickText(page, "[role=tab]", "Students");
});

const db = () => stored<StudentsStore>(page, "class-placement-students");
const idOf = async (name: string) =>
  Object.values((await db()).students).find((s) => s.name === name)!.id;
const classNamed = async (name: string) =>
  Object.values((await db()).classes).find((c) => c.name === name)!;
const dialogClosed = () =>
  page.waitForFunction(() => !document.querySelector("dialog[open]"));

/** The list row whose name field holds `name`. */
async function row(name: string): Promise<ElementHandle> {
  for (const tr of await page.$$("[data-testid='student-row']"))
    if (
      (await tr.$eval("[data-testid='student-name']", (i) => (i as HTMLInputElement).value)) ===
      name
    )
      return tr;
  throw new Error(`No row for ${name}`);
}

/** Adds a student through the list: New student, then type in the new row. */
async function addStudent(name: string, gender?: Gender, score?: number) {
  await page.click("[data-testid='new-student']");
  // The new row's name field is focused.
  await page.waitForFunction(
    () => (document.activeElement as HTMLElement | null)?.dataset.testid === "student-name",
  );
  await page.keyboard.type(name);
  await page.keyboard.press("Tab"); // commits the name (change event)
  const tr = await row(name);
  if (gender) await (await tr.$("[data-testid='student-gender']"))!.select(gender);
  if (score) await (await tr.$("[data-testid='student-score']"))!.select(String(score));
}

async function openDetails(name: string) {
  await (await (await row(name)).$("[data-testid='student-details']"))!.click();
  await page.waitForSelector("dialog[open]");
}

test("name, gender and score are edited in the list", async () => {
  await addStudent("Alice", "female", 4);
  const alice = (await db()).students[await idOf("Alice")]!;
  expect(alice.gender).toBe("female");
  expect(alice.score).toBe(4);

  // Clearing the score and renaming, still in the row.
  const tr = await row("Alice");
  await (await tr.$("[data-testid='student-score']"))!.select("");
  const input = (await tr.$("[data-testid='student-name']"))!;
  await input.click({ count: 3 });
  await page.keyboard.type("Alicia");
  const saved = (await db()).students[alice.id]!;
  expect(saved.score).toBeNull();
  expect(saved.name).toBe("Alicia");
});

test("score options are none and 1 to 5", async () => {
  await addStudent("Alice");
  const options = await page.$$eval("[data-testid='student-score'] option", (os) =>
    os.map((o) => (o as HTMLOptionElement).value),
  );
  expect(options).toEqual(["", "1", "2", "3", "4", "5"]);
});

test("new students keep their place while their name is typed", async () => {
  await addStudent("Zoe");
  await addStudent("Adam");
  const names = await page.$$eval("[data-testid='student-name']", (is) =>
    is.map((i) => (i as HTMLInputElement).value),
  );
  expect(names).toEqual(["Zoe", "Adam"]);
});

test("🔍 opens the incompatibilities, saved on both students", async () => {
  await addStudent("Alice");
  await addStudent("Bob");
  await openDetails("Alice");
  await page.select("[data-testid='add-incompatible']", await idOf("Bob"));
  await clickText(page, "dialog button", "Save");
  await dialogClosed();
  const { students } = await db();
  expect(students[await idOf("Alice")]!.incompatible).toEqual([await idOf("Bob")]);
  expect(students[await idOf("Bob")]!.incompatible).toEqual([await idOf("Alice")]);
  // The list shows the count under the name.
  expect(await (await row("Bob")).evaluate((tr) => tr.textContent)).toContain("⚠ 1");
});

test("🔍 opens the full student card, saved on Save", async () => {
  await addStudent("Alice", "female", 2);
  await openDetails("Alice");
  await screenshot(page, "student-card");
  // The card starts from the current values.
  expect(await page.$eval("[data-testid='card-score']", (s) => (s as HTMLSelectElement).value)).toBe("2");

  await page.$eval("[data-testid='card-name']", (i) => ((i as HTMLInputElement).value = ""));
  await page.type("[data-testid='card-name']", "Alicia");
  await page.select("[data-testid='card-gender']", "other");
  await page.select("[data-testid='card-score']", "5");
  // Nothing is saved before Save.
  expect((await db()).students[await idOf("Alice")]!.score).toBe(2);
  await clickText(page, "dialog button", "Save");
  await dialogClosed();

  const saved = (await db()).students[await idOf("Alicia")]!;
  expect(saved).toMatchObject({ name: "Alicia", gender: "other", score: 5 });
  // The list shows the new values.
  expect(
    await (await row("Alicia")).$eval("[data-testid='student-score']", (s) => (s as HTMLSelectElement).value),
  ).toBe("5");
});

test("Escape discards every change in the card", async () => {
  await addStudent("Alice");
  await addStudent("Bob");
  await openDetails("Alice");
  await page.type("[data-testid='card-name']", " changed");
  await page.select("[data-testid='card-score']", "3");
  await page.select("[data-testid='add-incompatible']", await idOf("Bob"));
  await page.keyboard.press("Escape");
  await dialogClosed();
  const alice = (await db()).students[await idOf("Alice")]!;
  expect(alice).toMatchObject({ name: "Alice", score: null, incompatible: [] });
});

async function clickDelete(name: string) {
  await (await (await row(name)).$("[data-testid='student-remove']"))!.click();
  await page.waitForSelector("dialog[open]");
}

test("🗑 on a student in one class offers a single Delete", async () => {
  await addStudent("Alice");
  await addStudent("Bob");
  const bob = await idOf("Bob");
  await clickDelete("Bob");
  expect(await page.$eval("[data-testid='dialog-title']", (h) => h.textContent)).toBe(
    'Delete Bob from "My class"?',
  );
  expect(await page.$("[data-testid='delete-from-class']")).toBeNull();
  await page.click("[data-testid='delete-student']");
  await dialogClosed();
  const { classes, currentClassId, students } = await db();
  expect(classes[currentClassId]!.studentIds).toEqual([await idOf("Alice")]);
  expect(students[bob]).toBeUndefined();
});

test("🗑 asks: this class only keeps the student elsewhere", async () => {
  await addStudent("Alice");
  const alice = await idOf("Alice");
  const original = (await db()).currentClassId;
  await page.click("[data-testid='duplicate-profile']");
  await clickDelete("Alice");
  expect(await page.$eval("[data-testid='dialog-title']", (h) => h.textContent)).toBe(
    'Delete Alice from "My class - Copy"?',
  );
  expect(await page.$eval("dialog", (d) => d.textContent)).toContain("Also in: My class.");
  await screenshot(page, "delete-student");
  await page.click("[data-testid='delete-from-class']");
  await dialogClosed();
  const { classes, currentClassId, students } = await db();
  expect(classes[currentClassId]!.studentIds).toEqual([]);
  expect(classes[original]!.studentIds).toEqual([alice]);
  expect(students[alice]).toBeDefined();
});

test("🗑 asks: all classes deletes the student everywhere", async () => {
  await addStudent("Alice");
  const alice = await idOf("Alice");
  await page.click("[data-testid='duplicate-profile']");
  await clickDelete("Alice");
  await page.click("[data-testid='delete-from-all']");
  await dialogClosed();
  const { classes, students } = await db();
  for (const cls of Object.values(classes)) expect(cls.studentIds).toEqual([]);
  expect(students[alice]).toBeUndefined();
});

test("🗑 then Cancel keeps the student", async () => {
  await addStudent("Alice");
  await clickDelete("Alice");
  await clickText(page, "dialog button", "Cancel");
  await dialogClosed();
  expect((await db()).students[await idOf("Alice")]).toBeDefined();
});

test("the list and the popup show the student's ID", async () => {
  await addStudent("Alice");
  await screenshot(page, "student-table");
  const id = await idOf("Alice");
  const shown = await page.$eval("[data-testid='student-id']", (e) => e.textContent);
  expect(shown).toBe(`#${id.slice(0, 8)}`);
  await openDetails("Alice");
  const full = await page.$eval("[data-testid='student-full-id']", (e) => e.textContent);
  expect(full).toContain(id);
});

test("Copy duplicates a class with the same, shared students", async () => {
  await addStudent("Alice", undefined, 2);
  await addStudent("Bob");
  await page.click("[data-testid='duplicate-profile']");

  const original = await classNamed("My class");
  const copy = await classNamed("My class - Copy");
  expect((await db()).currentClassId).toBe(copy.id);
  expect(copy.studentIds).toEqual(original.studentIds);

  // Editing Alice in the copy edits the one shared student.
  await (await (await row("Alice")).$("[data-testid='student-score']"))!.select("5");
  await page.select("aside section select", original.id);
  expect(
    await (await row("Alice")).$eval(
      "[data-testid='student-score']",
      (s) => (s as HTMLSelectElement).value,
    ),
  ).toBe("5");

  // Deleting the original keeps students who are still in the copy.
  await clickText(page, "aside button", "Delete");
  expect((await db()).students[await idOf("Alice")]).toBeDefined();
});

test("adding from another class shows each student's ID and classes", async () => {
  await addStudent("Alice");
  await addStudent("Bob");
  await page.click("[data-testid='duplicate-profile']");
  await clickText(page, "aside button", "New class");

  await page.click("[data-testid='add-from-other']");
  await page.waitForSelector("dialog[open]");
  await screenshot(page, "student-picker");

  const rows = () =>
    page.$$eval("[data-testid='picker-row']", (trs) =>
      trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent)),
    );
  const alice = await idOf("Alice");
  expect((await rows())[0]).toEqual([
    "Alice",
    `#${alice.slice(0, 8)}`,
    "My class, My class - Copy",
    "Add",
  ]);

  // Filtering by ID keeps only the match.
  await page.type("dialog input[type=search]", alice.slice(0, 6));
  expect((await rows()).map((r) => r[0])).toEqual(["Alice"]);

  await page.click("[data-testid='picker-add']");
  expect(await rows()).toEqual([]);
  await page.keyboard.press("Escape");
  await dialogClosed();
  const current = (await db()).classes[(await db()).currentClassId]!;
  expect(current.studentIds).toEqual([alice]);
});

test("one-sided incompatibilities are repaired on load", async () => {
  await addStudent("Alice");
  await addStudent("Bob");
  const [alice, bob] = [await idOf("Alice"), await idOf("Bob")];
  await page.evaluate(
    (a, b) => {
      const raw = JSON.parse(localStorage.getItem("class-placement-students")!);
      raw.state.students[a].incompatible = [b];
      localStorage.setItem("class-placement-students", JSON.stringify(raw));
    },
    alice,
    bob,
  );
  await page.reload();
  await page.waitForSelector("aside");
  // The repair happens in memory on load; any write persists it.
  await clickText(page, "[role=tab]", "Students");
  await addStudent("Carl");
  expect((await db()).students[bob]!.incompatible).toEqual([alice]);
});

test("the student list fits the panel at its minimum width", async () => {
  // 30vw is below the panel's 320px minimum here.
  await page.setViewport({ width: 900, height: 800 });
  await addStudent("Alexandra-Marie", "female", 3);
  await screenshot(page, "student-table-narrow");
  const overflow = await page.$eval("[data-testid='student-row']", (tr) => {
    const section = tr.closest("section")!;
    return section.scrollWidth - section.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the delete question's buttons fill every line, even in French", async () => {
  await setLanguage(page, "fr", "tab-students");
  await addStudent("Oumar");
  await page.click("[data-testid='duplicate-profile']");
  await clickDelete("Oumar");
  await screenshot(page, "delete-student-fr");
  expect(await page.$eval("[data-testid='dialog-title']", (h) => h.textContent)).toBe(
    "Supprimer Oumar de «\u00a0My class - Copie\u00a0»\u00a0?",
  );

  // Group the buttons by line; each line must end at the row's right edge.
  const gaps = await page.$eval("[data-testid='choice-buttons']", (row) => {
    const right = row.getBoundingClientRect().right;
    const lines = new Map<number, number>();
    for (const b of row.querySelectorAll("button")) {
      const r = b.getBoundingClientRect();
      lines.set(Math.round(r.top), Math.max(lines.get(Math.round(r.top)) ?? 0, r.right));
    }
    return [...lines.values()].map((end) => Math.round(right - end));
  });
  expect(gaps.length).toBeGreaterThan(1); // the French labels do wrap here
  for (const gap of gaps) expect(gap).toBe(0);
});

test("Add multiple imports one student per line into the class", async () => {
  await addStudent("Zoe");
  await page.click("[data-testid='add-multiple']");
  await page.waitForSelector("dialog[open]");
  const summary = () => page.$eval("[data-testid='import-summary']", (p) => p.textContent);
  const submit = () =>
    page.$eval("[data-testid='import-submit']", (b) => (b as HTMLButtonElement).disabled);

  // Dialog titles keep their case (section headings are uppercase).
  expect(
    await page.$eval("[data-testid='dialog-title']", (h) => getComputedStyle(h).textTransform),
  ).toBe("none");
  expect(await summary()).toBe('Creating 0 new students in "My class".');
  expect(await submit()).toBe(true);

  // The text area has focus; blank lines and spaces are ignored.
  await page.keyboard.type("Alice Martin\n\n  Bob Dupont  \nChloé");
  expect(await summary()).toBe('Creating 3 new students in "My class".');
  expect(await submit()).toBe(false);
  await screenshot(page, "import-students");

  await page.click("[data-testid='import-submit']");
  await dialogClosed();
  const names = await page.$$eval("[data-testid='student-name']", (is) =>
    is.map((i) => (i as HTMLInputElement).value),
  );
  expect(names).toEqual(["Zoe", "Alice Martin", "Bob Dupont", "Chloé"]);
});

test("the import summary is singular for one student, and in French", async () => {
  await page.click("[data-testid='add-multiple']");
  await page.waitForSelector("dialog[open]");
  await page.keyboard.type("Alice");
  expect(await page.$eval("[data-testid='import-summary']", (p) => p.textContent)).toBe(
    'Creating 1 new student in "My class".',
  );
  await page.keyboard.press("Escape");
  await dialogClosed();
  // Escape imports nothing.
  expect(await page.$$("[data-testid='student-row']")).toHaveLength(0);

  await setLanguage(page, "fr", "tab-students");
  await page.click("[data-testid='add-multiple']");
  await page.waitForSelector("dialog[open]");
  await page.keyboard.type("Alice\nBob");
  expect(await page.$eval("[data-testid='import-summary']", (p) => p.textContent)).toBe(
    "Création de 2 nouveaux élèves dans «\u00a0My class\u00a0».",
  );
});

test("a click on the backdrop closes a dialog and discards its draft", async () => {
  await addStudent("Alice");
  await openDetails("Alice");
  await page.select("[data-testid='card-score']", "4");
  // Top-left corner of the viewport: outside the dialog box.
  await page.mouse.click(5, 5);
  await dialogClosed();
  expect((await db()).students[await idOf("Alice")]!.score).toBeNull();
});

test("Cancel closes a form dialog without saving", async () => {
  await addStudent("Alice");
  await openDetails("Alice");
  await page.select("[data-testid='card-score']", "4");
  await clickText(page, "dialog button", "Cancel");
  await dialogClosed();
  expect((await db()).students[await idOf("Alice")]!.score).toBeNull();
});

test("a click inside a dialog doesn't close it", async () => {
  await page.click("[data-testid='add-multiple']");
  await page.waitForSelector("dialog[open]");
  await page.click("[data-testid='dialog-title']");
  expect(await page.$("dialog[open]")).not.toBeNull();
});

test("every dialog is labelled by its own title", async () => {
  await addStudent("Alice");
  await openDetails("Alice");
  const label = await page.$eval("dialog[open]", (d) =>
    document.getElementById(d.getAttribute("aria-labelledby")!)?.textContent,
  );
  expect(label).toBe("Alice");
});
