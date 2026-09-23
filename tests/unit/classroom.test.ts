import { beforeEach, describe, expect, test } from "bun:test";
import {
  MAX_SIZE,
  useClassRoom,
  type ClassProfile,
} from "../../src/store/useClassRoom";
import { resetStores } from "../helpers";

const store = () => useClassRoom.getState();
const current = () => store().profiles[store().currentId]!;
const positions = () => current().tables.map((t) => `${t.row}:${t.col}`);

beforeEach(resetStores);

describe("tables", () => {
  test("addTable refuses occupied and out-of-grid cells", () => {
    store().addTable(0, 0);
    store().addTable(0, 0);
    store().addTable(-1, 0);
    store().addTable(0, current().cols);
    expect(positions()).toEqual(["0:0"]);
  });

  test("moveTable onto another table swaps them", () => {
    store().addTable(0, 0);
    store().addTable(1, 1);
    const [a, b] = current().tables;
    store().moveTable(a!.id, 1, 1);
    const byId = Object.fromEntries(
      current().tables.map((t) => [t.id, `${t.row}:${t.col}`]),
    );
    expect(byId[a!.id]).toBe("1:1");
    expect(byId[b!.id]).toBe("0:0");
  });

  test("removeTable and clearTables", () => {
    store().addTable(0, 0);
    store().addTable(0, 1);
    store().removeTable(current().tables[0]!.id);
    expect(positions()).toEqual(["0:1"]);
    store().clearTables();
    expect(positions()).toEqual([]);
  });
});

describe("setSize", () => {
  test("won't shrink past a placed table", () => {
    store().addTable(4, 6);
    store().setSize(2, 2);
    expect(current().rows).toBe(5);
    expect(current().cols).toBe(7);
  });

  test("stays within 1 and MAX_SIZE", () => {
    store().setSize(0, 999);
    expect(current().rows).toBe(1);
    expect(current().cols).toBe(MAX_SIZE);
  });
});

test("setBoard moves the whiteboard", () => {
  store().setBoard("bottom");
  expect(current().board).toBe("bottom");
});

test("migrating v1 data adds the whiteboard at the top", () => {
  const migrate = useClassRoom.persist.getOptions().migrate!;
  const v1 = {
    profiles: { p: { id: "p", name: "P", rows: 3, cols: 3, tables: [] } },
    currentId: "p",
  };
  const migrated = migrate(v1, 1) as { profiles: Record<string, ClassProfile> };
  expect(migrated.profiles.p!.board).toBe("top");
});

describe("layouts", () => {
  test("layouts are named as classrooms, not classes", () => {
    expect(store().profiles[store().currentId]!.name).toBe("My classroom");
    store().newClass();
    expect(store().profiles[store().currentId]!.name).toBe("New classroom");
  });

  test("deleteClass loads another layout, or a fresh one after the last", () => {
    const first = store().currentId;
    store().newClass("Second");
    const second = store().currentId;
    store().deleteClass(second);
    expect(store().currentId).toBe(first);
    expect(Object.keys(store().profiles)).toEqual([first]);

    store().deleteClass(first);
    const ids = Object.keys(store().profiles);
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(first);
    expect(store().currentId).toBe(ids[0]!);
  });
});
