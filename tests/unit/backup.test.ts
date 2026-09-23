import { beforeEach, describe, expect, test } from "bun:test";
import {
  ImportParseError,
  applyImport,
  createExport,
  exportFileName,
  parseImport,
} from "../../src/store/backup";
import { useClassRoom } from "../../src/store/useClassRoom";
import { placementKey, usePlacements } from "../../src/store/usePlacements";
import { useStudents } from "../../src/store/useStudents";
import { useUI } from "../../src/store/useUI";
import { resetStores } from "../helpers";

beforeEach(resetStores);

const rooms = () => useClassRoom.getState();
const classes = () => useStudents.getState();
const roomNames = () => Object.values(rooms().profiles).map((p) => p.name).sort();
const classNames = () => Object.values(classes().classes).map((c) => c.name).sort();

/** A room with a table, and a class of two incompatible students. */
function fill() {
  rooms().renameClass("Room A");
  rooms().addTable(1, 2);
  rooms().setBoard({ col: 1.5, span: 3 });
  classes().renameClass("Class A");
  classes().importStudents(["Alice", "Bob"]);
  const [alice, bob] = Object.values(classes().students);
  classes().saveStudent({ ...alice!, gender: "female", score: 4, frontRow: true, incompatible: [bob!.id] });
}

const errorOf = (text: string) => {
  try {
    parseImport(text);
  } catch (e) {
    return e instanceof ImportParseError ? e.code : e;
  }
  return null;
};

const roundTrip = (kind: "rooms" | "classes") => parseImport(JSON.stringify(createExport(kind)));

describe("createExport", () => {
  test("rooms: every layout, and nothing else", () => {
    fill();
    const file = createExport("rooms", new Date("2026-09-23T10:00:00Z"));
    expect(file).toMatchObject({ app: "class-placement", kind: "rooms", version: 3 });
    expect(file.exportedAt).toBe("2026-09-23T10:00:00.000Z");
    expect(file.state).toEqual({ profiles: rooms().profiles });
  });

  test("classes: every class and student, and no placement", () => {
    fill();
    usePlacements.getState().setShowMarks(false);
    const file = createExport("classes");
    expect(file).toMatchObject({ kind: "classes", version: 3 });
    expect(file.state).toEqual({ students: classes().students, classes: classes().classes });
    expect(JSON.stringify(file)).not.toContain("seats");
  });

  test("names the file after the kind and the day", () => {
    const day = new Date("2026-01-05T23:00:00Z");
    expect(exportFileName("rooms", day)).toBe("class-placement-rooms-2026-01-05.json");
    expect(exportFileName("classes", day)).toBe("class-placement-classes-2026-01-05.json");
  });
});

describe("importing", () => {
  test("rooms are added next to the existing ones, with new ids, and loaded", () => {
    fill();
    const before = rooms().profiles;
    const imported = roundTrip("rooms");
    applyImport(imported);
    expect(roomNames()).toEqual(["Room A", "Room A"]);
    const added = rooms().profiles[rooms().currentId]!;
    expect(before[added.id]).toBeUndefined();
    expect(added).toMatchObject({ name: "Room A", rows: 9, cols: 9, board: { col: 1.5, span: 3 } });
    expect(added.tables.map((t) => [t.row, t.col])).toEqual([[1, 2]]);
    // Classes are untouched.
    expect(classNames()).toEqual(["Class A"]);
  });

  test("classes come with their students, as new records, and keep incompatibilities", () => {
    fill();
    const before = classes().students;
    applyImport(roundTrip("classes"));
    expect(classNames()).toEqual(["Class A", "Class A"]);
    const cls = classes().classes[classes().currentClassId]!;
    const [alice, bob] = cls.studentIds.map((id) => classes().students[id]!);
    expect(before[alice!.id]).toBeUndefined();
    expect(alice).toMatchObject({ name: "Alice", gender: "female", score: 4, frontRow: true });
    expect(alice!.incompatible).toEqual([bob!.id]);
    expect(bob!.incompatible).toEqual([alice!.id]);
    expect(Object.keys(classes().students)).toHaveLength(4);
    expect(roomNames()).toEqual(["Room A"]);
  });

  test("a student shared by two classes stays shared", () => {
    fill();
    classes().duplicateClass(classes().currentClassId);
    const { classes: added, students } = roundTrip("classes");
    expect(students).toHaveLength(2);
    expect(added[0]!.studentIds).toEqual(added[1]!.studentIds);
  });

  test("existing placements survive an import", () => {
    fill();
    const key = placementKey(rooms().currentId, classes().currentClassId);
    const [student] = Object.keys(classes().students);
    const [table] = rooms().profiles[rooms().currentId]!.tables;
    usePlacements.getState().savePlacement({
      roomId: rooms().currentId,
      classId: classes().currentClassId,
      seats: { [table!.id]: student! },
    });
    applyImport(roundTrip("rooms"));
    applyImport(roundTrip("classes"));
    expect(usePlacements.getState().placements[key]!.seats).toEqual({ [table!.id]: student! });
  });

  test("damaged fields are repaired, damaged structure is refused", () => {
    const file = (state: unknown, kind = "classes", version = 3) =>
      JSON.stringify({ app: "class-placement", format: 2, kind, version, state });
    const { students, classes: added } = parseImport(
      file({
        students: {
          a: { id: "a", name: "Ann", gender: "robot", score: 9, incompatible: ["a", "b", "gone"] },
          b: { id: "b", name: "Ben", incompatible: [] },
          lost: { id: "lost", name: "In no class" },
        },
        classes: { c: { name: "C", studentIds: ["a", "b", "b", "gone"] } },
      }),
    );
    expect(added[0]!.studentIds).toHaveLength(2);
    expect(students.map((s) => [s.name, s.gender, s.score, s.incompatible.length])).toEqual([
      ["Ann", "other", null, 1],
      ["Ben", "other", null, 1],
    ]);

    const [room] = parseImport(
      file({ profiles: { r: { rows: 2, cols: 2, tables: [{ row: 0, col: 0 }, { row: 0, col: 0 }, { row: 5, col: 0 }] } } }, "rooms", 2),
    ).rooms;
    expect(room!.tables).toHaveLength(1);

    expect(errorOf(file({ profiles: { r: { rows: 0, cols: 2, tables: [] } } }, "rooms", 2))).toBe("broken");
    expect(errorOf(file({ students: { a: "Ann" }, classes: {} }))).toBe("broken");
    expect(errorOf(file({ students: {}, classes: { c: { name: "C" } } }))).toBe("broken");
    expect(errorOf(file({ profiles: { r: null } }, "rooms", 1))).toBe("broken");
  });

  test("old data in a file is migrated", () => {
    const old = { profiles: { r: { id: "r", name: "Old", rows: 2, cols: 2, tables: [] } } };
    const text = JSON.stringify({ app: "class-placement", format: 2, kind: "rooms", version: 1, state: old });
    expect(parseImport(text).rooms[0]!.board).toEqual({ col: 0, span: 2 });

    // v2: a room with the whiteboard at the bottom is flipped.
    const v2 = { profiles: { r: { ...old.profiles.r, tables: [{ row: 1, col: 0 }], board: "bottom" } } };
    const [room] = parseImport(JSON.stringify({ app: "class-placement", format: 2, kind: "rooms", version: 2, state: v2 })).rooms;
    expect(room!.tables.map((t) => [t.row, t.col])).toEqual([[0, 0]]);
  });

  test("an imported whiteboard is kept inside its grid, or reset when damaged", () => {
    const board = (b: unknown) => {
      const state = { profiles: { r: { rows: 2, cols: 4, tables: [], board: b } } };
      const text = JSON.stringify({ app: "class-placement", format: 2, kind: "rooms", version: 3, state });
      return parseImport(text).rooms[0]!.board;
    };
    expect(board({ col: 1, span: 2 })).toEqual({ col: 1, span: 2 });
    expect(board({ col: 3.2, span: 9 })).toEqual({ col: 0, span: 4 });
    // Damaged: centered, as in a new room.
    expect(board({ col: "0", span: 1 })).toEqual({ col: 1, span: 2 });
    expect(board(undefined)).toEqual({ col: 1, span: 2 });
  });

  test("the all-in-one exports of older versions add their rooms and classes", () => {
    fill();
    const data = {
      "class-placement": { state: { ...createExport("rooms").state as object, currentId: "x" }, version: 2 },
      "class-placement-students": {
        state: {
          students: { a: { id: "a", name: "Ann", gender: "other", score: 3, incompatible: [] } },
          classes: { c: { id: "c", name: "Old class", studentIds: ["a"] } },
          currentClassId: "c",
        },
        version: 2,
      },
      "class-placement-ui": { state: { theme: "light" }, version: 0 },
    };
    applyImport(parseImport(JSON.stringify({ app: "class-placement", format: 1, data })));
    expect(roomNames()).toEqual(["Room A", "Room A"]);
    expect(classNames()).toEqual(["Class A", "Old class"]);
    expect(classes().students[classes().classes[classes().currentClassId]!.studentIds[0]!]!.frontRow).toBe(false);
    // Settings aren't imported.
    expect(useUI.getState().theme).toBe("indigo");
  });

  test("rejects text that isn't JSON, isn't an export, or holds nothing", () => {
    expect(errorOf("{nope")).toBe("invalid");
    expect(errorOf("[]")).toBe("notBackup");
    expect(errorOf(JSON.stringify({ app: "other", kind: "rooms" }))).toBe("notBackup");
    expect(errorOf(JSON.stringify({ app: "class-placement" }))).toBe("notBackup");
    expect(errorOf(JSON.stringify({ app: "class-placement", data: { "class-placement-ui": {} } }))).toBe("empty");
    expect(errorOf(JSON.stringify({ app: "class-placement", kind: "rooms", version: 2, state: { profiles: {} } }))).toBe("empty");
  });
});

test("setTheme accepts known themes only, and sets <html data-theme>", () => {
  expect(useUI.getState().theme).toBe("indigo");
  useUI.getState().setTheme("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  useUI.getState().setTheme("neon" as never);
  expect(useUI.getState().theme).toBe("indigo");
});
