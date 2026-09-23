import { beforeEach, describe, expect, test } from "bun:test";
import {
  defaultBoard,
  dragBoard,
  fitBoard,
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

describe("whiteboard", () => {
  test("starts centered over about 60% of the room", () => {
    expect(current().board).toEqual({ col: 2, span: 5 });
    expect(defaultBoard(3)).toEqual({ col: 1, span: 1 });
    expect(defaultBoard(10)).toEqual({ col: 2, span: 6 });
  });

  test("setBoard saves it snapped to half columns, inside the grid", () => {
    store().setBoard({ col: 3.3, span: 2.8 });
    expect(current().board).toEqual({ col: 3.5, span: 3 });
    store().setBoard({ col: 8, span: 4 });
    expect(current().board).toEqual({ col: 5, span: 4 });
    store().setBoard({ col: -2, span: 0.2 });
    expect(current().board).toEqual({ col: 0, span: 1 });
    store().setBoard({ col: 0, span: 99 });
    expect(current().board).toEqual({ col: 0, span: 9 });
  });

  test("setSize keeps it inside a narrower grid", () => {
    store().setBoard({ col: 5, span: 4 });
    store().setSize(9, 6);
    expect(current().board).toEqual({ col: 2, span: 4 });
    store().setSize(9, 3);
    expect(current().board).toEqual({ col: 0, span: 3 });
    // A wider grid leaves it where it is.
    store().setSize(9, 12);
    expect(current().board).toEqual({ col: 0, span: 3 });
  });

  test("dragBoard moves it, or one edge while the other stays", () => {
    const b = { col: 2, span: 4 };
    expect(dragBoard(b, "move", 1.2, 9)).toEqual({ col: 3, span: 4 });
    expect(dragBoard(b, "move", 10, 9)).toEqual({ col: 5, span: 4 });
    expect(dragBoard(b, "right", 1.5, 9)).toEqual({ col: 2, span: 5.5 });
    expect(dragBoard(b, "right", 10, 9)).toEqual({ col: 2, span: 7 });
    expect(dragBoard(b, "right", -10, 9)).toEqual({ col: 2, span: 1 });
    expect(dragBoard(b, "left", -0.5, 9)).toEqual({ col: 1.5, span: 4.5 });
    expect(dragBoard(b, "left", -10, 9)).toEqual({ col: 0, span: 6 });
    // The right edge stays at 6 however far the left one goes.
    expect(dragBoard(b, "left", 10, 9)).toEqual({ col: 5, span: 1 });
  });

  test("fitBoard is a no-op on a board that already fits", () => {
    expect(fitBoard({ col: 1.5, span: 2.5 }, 9)).toEqual({ col: 1.5, span: 2.5 });
  });
});

describe("migration", () => {
  const migrate = useClassRoom.persist.getOptions().migrate!;
  type State = { profiles: Record<string, ClassProfile> };

  test("v1 data (no whiteboard) gets the default one", () => {
    const v1 = {
      profiles: { p: { id: "p", name: "P", rows: 3, cols: 3, tables: [{ id: "t", row: 0, col: 1 }] } },
      currentId: "p",
    };
    const migrated = migrate(v1, 1) as State;
    expect(migrated.profiles.p!.board).toEqual(defaultBoard(3));
    expect(migrated.profiles.p!.tables).toEqual([{ id: "t", row: 0, col: 1 }]);
  });

  test("v2 rooms with the whiteboard at the bottom are flipped", () => {
    const tables = [
      { id: "front", row: 3, col: 0 },
      { id: "back", row: 0, col: 2 },
    ];
    const v2 = {
      profiles: {
        bottom: { id: "bottom", name: "B", rows: 4, cols: 5, tables, board: "bottom" },
        top: { id: "top", name: "T", rows: 4, cols: 5, tables, board: "top" },
      },
      currentId: "bottom",
    };
    const { profiles } = migrate(structuredClone(v2), 2) as State;
    expect(profiles.bottom!.tables).toEqual([
      { id: "front", row: 0, col: 0 },
      { id: "back", row: 3, col: 2 },
    ]);
    expect(profiles.top!.tables).toEqual(tables);
    for (const p of Object.values(profiles)) expect(p.board).toEqual({ col: 1, span: 3 });
  });

  test("stored v2 data is migrated on load", async () => {
    localStorage.setItem(
      "class-placement",
      JSON.stringify({
        version: 2,
        state: {
          profiles: { r: { id: "r", name: "R", rows: 2, cols: 2, tables: [{ id: "t", row: 1, col: 0 }], board: "bottom" } },
          currentId: "r",
        },
      }),
    );
    await useClassRoom.persist.rehydrate();
    expect(current().tables).toEqual([{ id: "t", row: 0, col: 0 }]);
    expect(current().board).toEqual({ col: 0, span: 2 });
  });
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
