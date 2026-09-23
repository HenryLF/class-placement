import { beforeEach, describe, expect, test } from "bun:test";
import {
  placementKey,
  resolveSeating,
  usePlacements,
} from "../../src/store/usePlacements";
import type { Student } from "../../src/store/useStudents";
import { DEFAULT_OPTIONS } from "../../src/utils/placement";
import { resetStores } from "../helpers";

const store = () => usePlacements.getState();

beforeEach(resetStores);

describe("usePlacements", () => {
  test("saves one placement per room and class", () => {
    store().savePlacement({ roomId: "r1", classId: "c1", seats: { t1: "a" } });
    store().savePlacement({ roomId: "r1", classId: "c2", seats: { t1: "b" } });
    store().savePlacement({ roomId: "r1", classId: "c1", seats: { t2: "a" } });
    expect(Object.keys(store().placements).sort()).toEqual(["r1:c1", "r1:c2"]);
    expect(store().placements[placementKey("r1", "c1")]!.seats).toEqual({ t2: "a" });
  });

  test("clearPlacement removes only that room and class", () => {
    store().savePlacement({ roomId: "r1", classId: "c1", seats: {} });
    store().savePlacement({ roomId: "r2", classId: "c1", seats: {} });
    store().clearPlacement("r1", "c1");
    expect(Object.keys(store().placements)).toEqual(["r2:c1"]);
  });

  test("setOptions merges into the current options", () => {
    store().setOptions({ diagonal: 0 });
    store().setOptions({ gender: { enabled: false, weight: 1 } });
    expect(store().options).toEqual({
      ...DEFAULT_OPTIONS,
      diagonal: 0,
      gender: { enabled: false, weight: 1 },
    });
  });

  test("options and placements persist", () => {
    store().setOptions({ diagonal: 1 });
    store().savePlacement({ roomId: "r", classId: "c", seats: { t: "s" } });
    const saved = JSON.parse(localStorage.getItem("class-placement-placements")!);
    expect(saved.version).toBe(2);
    expect(saved.state.options.diagonal).toBe(1);
    expect(saved.state.placements["r:c"].seats).toEqual({ t: "s" });
  });

  test("toggleTable switches a table off and on, per room and class", () => {
    store().toggleTable("r", "c1", "t1");
    store().toggleTable("r", "c1", "t2");
    store().toggleTable("r", "c2", "t1");
    expect(store().disabledTables).toEqual({ "r:c1": ["t1", "t2"], "r:c2": ["t1"] });
    store().toggleTable("r", "c1", "t1");
    store().toggleTable("r", "c2", "t1");
    expect(store().disabledTables).toEqual({ "r:c1": ["t2"] });
  });

  test("clearing a placement keeps its switched-off tables", () => {
    store().toggleTable("r", "c", "t1");
    store().savePlacement({ roomId: "r", classId: "c", seats: { t2: "a" } });
    store().clearPlacement("r", "c");
    expect(store().disabledTables).toEqual({ "r:c": ["t1"] });
  });

  test("showMarks defaults to true and persists", () => {
    expect(store().showMarks).toBe(true);
    store().setShowMarks(false);
    const saved = JSON.parse(localStorage.getItem("class-placement-placements")!);
    expect(saved.state.showMarks).toBe(false);
  });

  test("v1 data loads with no switched-off tables and arrows shown", async () => {
    localStorage.setItem(
      "class-placement-placements",
      JSON.stringify({
        version: 1,
        state: {
          options: { gender: { enabled: false, weight: 1 } },
          placements: { "r:c": { roomId: "r", classId: "c", seats: { t: "s" } } },
        },
      }),
    );
    await usePlacements.persist.rehydrate();
    expect(store().disabledTables).toEqual({});
    expect(store().showMarks).toBe(true);
    expect(store().placements["r:c"]!.seats).toEqual({ t: "s" });
    // Constraints added since v1 get their defaults.
    expect(store().options.front).toEqual(DEFAULT_OPTIONS.front);
    expect(store().options.frontRow).toEqual(DEFAULT_OPTIONS.frontRow);
    expect(store().options.gender).toEqual({ enabled: false, weight: 1 });
  });

  test("loading partial options fills in the defaults", async () => {
    localStorage.setItem(
      "class-placement-placements",
      JSON.stringify({
        version: 1,
        state: { options: { score: { enabled: false } }, placements: {} },
      }),
    );
    await usePlacements.persist.rehydrate();
    expect(store().options).toEqual({
      ...DEFAULT_OPTIONS,
      score: { ...DEFAULT_OPTIONS.score, enabled: false },
    });
  });
});

describe("resolveSeating", () => {
  const st = (id: string): Student => ({
    id,
    name: id,
    gender: "other",
    score: null,
    frontRow: false,
    incompatible: [],
  });
  const tables = [
    { id: "t1", row: 0, col: 0 },
    { id: "t2", row: 0, col: 1 },
  ];

  test("drops removed tables and students who left the class", () => {
    const seats = { t1: "a", t2: "gone", t9: "b" };
    const { placed, seated, unplaced } = resolveSeating(seats, tables, [st("a"), st("b")]);
    expect(placed).toBe(true);
    expect([...seated].map(([t, s]) => [t, s.id])).toEqual([["t1", "a"]]);
    // b's table was removed, so b has no seat any more.
    expect(unplaced.map((s) => s.id)).toEqual(["b"]);
  });

  test("new class members are unplaced", () => {
    const { unplaced } = resolveSeating({ t1: "a" }, tables, [st("a"), st("new")]);
    expect(unplaced.map((s) => s.id)).toEqual(["new"]);
  });

  test("without a placement nothing is seated", () => {
    const { placed, seated } = resolveSeating(undefined, tables, [st("a")]);
    expect(placed).toBe(false);
    expect(seated.size).toBe(0);
  });
});
