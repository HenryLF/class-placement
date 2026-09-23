import { describe, expect, test } from "bun:test";
import { defaultBoard, type Board, type Table } from "../../src/store/useClassRoom";
import type { Gender, Score, Student } from "../../src/store/useStudents";
import {
  boardDistances,
  DEFAULT_OPTIONS,
  findViolations,
  neighborPairs,
  place,
  seededRandom,
  totalCost,
  type PlacementOptions,
  type Room,
} from "../../src/utils/placement";

const table = (row: number, col: number): Table => ({ id: `t${row}${col}`, row, col });
const row = (n: number) => Array.from({ length: n }, (_, c) => table(0, c));

function student(id: string, patch: Partial<Student> = {}): Student {
  return { id, name: id, gender: "other", score: null, frontRow: false, incompatible: [], ...patch };
}

/** `tables`, with the default whiteboard of a grid just wide enough. */
function roomOf(tables: Table[], board?: Board): Room {
  return { tables, board: board ?? defaultBoard(Math.max(1, ...tables.map((t) => t.col + 1))) };
}

const OFF = { enabled: false, weight: 1 } as const;
/** Only the given constraints enabled. */
function only(patch: Partial<PlacementOptions>): PlacementOptions {
  return {
    ...DEFAULT_OPTIONS,
    gender: OFF,
    incompatible: OFF,
    score: { ...OFF, rule: "spread" },
    front: OFF,
    frontRow: OFF,
    ...patch,
  };
}

const adjacent = (tables: Table[], seats: Record<string, string>, x: string, y: string) =>
  neighborPairs(tables, 0).some(
    (p) =>
      (seats[p.a] === x && seats[p.b] === y) || (seats[p.a] === y && seats[p.b] === x),
  );

describe("neighborPairs", () => {
  const grid = [table(0, 0), table(0, 1), table(1, 0), table(1, 1), table(3, 3)];

  test("side pairs weigh 1, diagonals take the option's weight", () => {
    const pairs = neighborPairs(grid, 0.5);
    const weight = (a: string, b: string) =>
      pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))?.weight;
    expect(pairs).toHaveLength(6);
    expect(weight("t00", "t01")).toBe(1);
    expect(weight("t00", "t10")).toBe(1);
    expect(weight("t00", "t11")).toBe(0.5);
    expect(weight("t01", "t10")).toBe(0.5);
  });

  test("no diagonals at weight 0, and far tables are never paired", () => {
    const pairs = neighborPairs(grid, 0);
    expect(pairs).toHaveLength(4);
    expect(pairs.some((p) => p.a === "t33" || p.b === "t33")).toBe(false);
  });

  test("(dr, dc) is the step from a to b", () => {
    for (const p of neighborPairs(grid, 1)) {
      const a = grid.find((t) => t.id === p.a)!;
      const b = grid.find((t) => t.id === p.b)!;
      expect([b.row - a.row, b.col - a.col]).toEqual([p.dr, p.dc]);
    }
  });
});

describe("place", () => {
  const students = ["a", "b", "c", "d"].map((id) => student(id));

  test("with no constraint, seats everyone once and leaves extra tables empty", () => {
    const tables = row(6);
    const { seats, unplaced } = place(roomOf(tables), students, only({}), seededRandom(1));
    expect(Object.values(seats).sort()).toEqual(["a", "b", "c", "d"]);
    expect(Object.keys(seats).every((id) => tables.some((t) => t.id === id))).toBe(true);
    expect(unplaced).toEqual([]);
  });

  test("with too few tables, fills them all and reports the rest", () => {
    for (const options of [only({}), DEFAULT_OPTIONS]) {
      const { seats, unplaced } = place(roomOf(row(3)), students, options, seededRandom(2));
      expect(Object.keys(seats)).toHaveLength(3);
      expect(unplaced).toHaveLength(1);
      expect([...Object.values(seats), ...unplaced].sort()).toEqual(["a", "b", "c", "d"]);
    }
  });

  test("handles an empty class and an empty room", () => {
    expect(place(roomOf(row(3)), [], DEFAULT_OPTIONS)).toEqual({ seats: {}, unplaced: [] });
    expect(place(roomOf([]), students, DEFAULT_OPTIONS).unplaced).toHaveLength(4);
  });

  test("keeps incompatible students apart when the room allows it", () => {
    const group = [
      student("a", { incompatible: ["b"] }),
      student("b", { incompatible: ["a"] }),
      student("c"),
    ];
    const tables = row(3);
    const options = only({ incompatible: { enabled: true, weight: 1 } });
    for (let seed = 0; seed < 20; seed++) {
      const { seats } = place(roomOf(tables), group, options, seededRandom(seed));
      expect(adjacent(tables, seats, "a", "b")).toBe(false);
    }
  });

  test("uses empty tables to separate incompatible students", () => {
    const group = [student("a", { incompatible: ["b"] }), student("b", { incompatible: ["a"] })];
    const tables = row(3);
    const options = only({ incompatible: { enabled: true, weight: 1 } });
    for (let seed = 0; seed < 10; seed++) {
      const { seats } = place(roomOf(tables), group, options, seededRandom(seed));
      expect(seats).toEqual({ t00: expect.any(String), t02: expect.any(String) });
    }
  });

  test("alternates genders; 'other' is never a violation", () => {
    const g = (id: string, gender: Gender) => student(id, { gender });
    const group = [g("f1", "female"), g("f2", "female"), g("m1", "male"), g("m2", "male")];
    const tables = row(4);
    const options = only({ gender: { enabled: true, weight: 1 } });
    for (let seed = 0; seed < 10; seed++) {
      const { seats } = place(roomOf(tables), group, options, seededRandom(seed));
      expect(findViolations(roomOf(tables), group, seats, options)).toEqual([]);
    }
    const others = [g("x", "other"), g("y", "other")];
    const seats = { t00: "x", t01: "y" };
    expect(findViolations(roomOf(row(2)), others, seats, options)).toEqual([]);
    expect(totalCost(roomOf(row(2)), others, seats, options)).toBe(0);
  });

  // Two separate pairs of tables: which students share a pair is all that matters.
  const pairs = [table(0, 0), table(0, 1), table(5, 0), table(5, 1)];
  const scored = (...scores: (Score | null)[]) =>
    scores.map((score, i) => student(`s${i}`, { score }));
  const partnerOf = (seats: Record<string, string>, id: string) => {
    const at = Object.keys(seats).find((t) => seats[t] === id)!;
    const other = { t00: "t01", t01: "t00", t50: "t51", t51: "t50" }[at]!;
    return seats[other];
  };

  test("pairMean pairs the strongest with the weakest student", () => {
    const group = scored(5, 1, 3, 3);
    const options = only({ score: { enabled: true, weight: 1, rule: "pairMean" } });
    for (let seed = 0; seed < 10; seed++) {
      const { seats } = place(roomOf(pairs), group, options, seededRandom(seed));
      expect(partnerOf(seats, "s0")).toBe("s1");
    }
  });

  test("spread is indifferent to strong next to average", () => {
    const group = scored(5, 1, 3, 3);
    const options = only({ score: { enabled: true, weight: 1, rule: "spread" } });
    const tutoring = { t00: "s0", t01: "s1", t50: "s2", t51: "s3" };
    const mixed = { t00: "s0", t01: "s2", t50: "s1", t51: "s3" };
    expect(totalCost(roomOf(pairs), group, tutoring, options)).toBe(0);
    expect(totalCost(roomOf(pairs), group, mixed, options)).toBe(0);
    const pairMean = { ...options, score: { ...options.score, rule: "pairMean" as const } };
    expect(totalCost(roomOf(pairs), group, mixed, pairMean)).toBeGreaterThan(0);
  });

  test("both score rules split two strong and two weak students", () => {
    const group = scored(5, 5, 1, 1);
    for (const rule of ["spread", "pairMean"] as const) {
      const options = only({ score: { enabled: true, weight: 1, rule } });
      for (let seed = 0; seed < 10; seed++) {
        const { seats } = place(roomOf(pairs), group, options, seededRandom(seed));
        expect(["s2", "s3"]).toContain(partnerOf(seats, "s0")!);
      }
    }
  });

  test("students with no score cost nothing and don't move the mean", () => {
    const options = only({ score: { enabled: true, weight: 1, rule: "spread" } });
    // Without the nulls, the mean is 3: 5 and 5 are both above it.
    const group = scored(5, 5, 1, null, null, null);
    const tables = row(2);
    expect(totalCost(roomOf(tables), group, { t00: "s3", t01: "s4" }, options)).toBe(0);
    expect(totalCost(roomOf(tables), group, { t00: "s0", t01: "s3" }, options)).toBe(0);
    expect(totalCost(roomOf(tables), group, { t00: "s0", t01: "s1" }, options)).toBeGreaterThan(0);
  });

  test("the same seed gives the same seating", () => {
    const group = scored(5, 4, 3, 2, 1);
    const a = place(roomOf(row(6)), group, DEFAULT_OPTIONS, seededRandom(42));
    const b = place(roomOf(row(6)), group, DEFAULT_OPTIONS, seededRandom(42));
    expect(a).toEqual(b);
  });

  test("reaches the brute-force optimum on small rooms", () => {
    const tables = [table(0, 0), table(0, 1), table(0, 2), table(1, 0), table(1, 1), table(1, 2)];
    const genders: Gender[] = ["female", "male", "other"];
    for (let seed = 0; seed < 15; seed++) {
      const random = seededRandom(1000 + seed);
      const n = 4 + Math.floor(random() * 3); // 4 to 6 students
      const group = Array.from({ length: n }, (_, i) =>
        student(`s${i}`, {
          gender: genders[Math.floor(random() * 3)]!,
          score: (1 + Math.floor(random() * 5)) as Score,
        }),
      );
      // A couple of symmetric incompatibilities.
      for (let k = 0; k < 2; k++) {
        const [x, y] = [group[Math.floor(random() * n)]!, group[Math.floor(random() * n)]!];
        if (x !== y && !x.incompatible.includes(y.id)) {
          x.incompatible.push(y.id);
          y.incompatible.push(x.id);
        }
      }
      const options = { ...DEFAULT_OPTIONS, diagonal: 0.5 as const };
      const best = bruteForce(tables, group, options);
      const { seats } = place(roomOf(tables), group, options, seededRandom(seed));
      expect(totalCost(roomOf(tables), group, seats, options)).toBeCloseTo(best, 9);
    }
  });
});

// Lowest cost over every way of seating `students` on `tables`.
function bruteForce(tables: Table[], students: Student[], options: PlacementOptions) {
  let best = Infinity;
  const seats: Record<string, string> = {};
  const used = new Set<string>();
  const go = (i: number) => {
    if (i === tables.length) {
      if (used.size === students.length)
        best = Math.min(best, totalCost(roomOf(tables), students, seats, options));
      return;
    }
    const id = tables[i]!.id;
    // Leave this table empty only if enough tables remain for the others.
    if (tables.length - i > students.length - used.size) go(i + 1);
    for (const st of students)
      if (!used.has(st.id)) {
        used.add(st.id);
        seats[id] = st.id;
        go(i + 1);
        delete seats[id];
        used.delete(st.id);
      }
  };
  go(0);
  return best;
}

describe("findViolations", () => {
  const tables = [table(0, 0), table(0, 1), table(1, 1)];
  const group = [
    student("a", { gender: "female", score: 5, incompatible: ["b"] }),
    student("b", { gender: "female", score: 5, incompatible: ["a"] }),
    student("c", { gender: "male", score: 1 }),
    student("d", { gender: "male", score: 1 }),
  ];
  const seats = { t00: "a", t01: "b", t11: "c" };

  test("lists each broken constraint with its direction", () => {
    const found = findViolations(roomOf(tables), group, seats, DEFAULT_OPTIONS);
    const summary = found.map((v) => `${v.kind} ${v.a}>${v.b} ${v.dr},${v.dc}`).sort();
    expect(summary).toEqual([
      "gender t00>t01 0,1",
      "incompatible t00>t01 0,1",
      "score t00>t01 0,1",
    ]);
  });

  test("reports only enabled constraints", () => {
    const found = findViolations(roomOf(tables), group, seats, only({ gender: { enabled: true, weight: 1 } }));
    expect(found.map((v) => v.kind)).toEqual(["gender"]);
  });

  test("counts diagonals only when they have a weight", () => {
    const diag = [table(0, 0), table(1, 1)];
    const both = { t00: "a", t11: "b" };
    expect(findViolations(roomOf(diag), group, both, { ...DEFAULT_OPTIONS, diagonal: 0 })).toEqual([]);
    const found = findViolations(roomOf(diag), group, both, { ...DEFAULT_OPTIONS, diagonal: 0.25 });
    expect(found.map((v) => [v.dr, v.dc])).toEqual([[1, 1], [1, 1], [1, 1]]);
  });

  test("a score violation needs both students 1 point from the mean on the same side", () => {
    const options = only({ score: { enabled: true, weight: 1, rule: "spread" } });
    // Mean 3: 4 and 4 count, 4 and 3 don't.
    const mids = [student("x", { score: 4 }), student("y", { score: 4 }), student("z", { score: 2 }), student("w", { score: 2 }), student("m", { score: 3 })];
    expect(findViolations(roomOf(row(2)), mids, { t00: "x", t01: "y" }, options)).toHaveLength(1);
    expect(findViolations(roomOf(row(2)), mids, { t00: "x", t01: "m" }, options)).toEqual([]);
    expect(findViolations(roomOf(row(2)), mids, { t00: "x", t01: "z" }, options)).toEqual([]);
  });
});

describe("whiteboard distance", () => {
  const grid = (rows: number, cols: number) => {
    const tables: Table[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tables.push(table(r, c));
    return tables;
  };

  test("is 0 facing the board and grows to the back and sides", () => {
    const d = boardDistances(roomOf(grid(3, 3)));
    expect(d.get("t01")).toBe(0);
    // The default board of a 3-wide room covers the middle column.
    expect(d.get("t00")).toBeCloseTo(Math.hypot(1, 0.5) - 1);
    expect(d.get("t00")).toBe(d.get("t02")!);
    expect(d.get("t11")).toBe(1);
    expect(d.get("t21")).toBe(2);
    expect(d.get("t00")!).toBeLessThan(d.get("t11")!);
  });

  test("is measured to the board's nearest point", () => {
    // A board over columns 0 to 2 of a 4-wide row.
    const d = boardDistances(roomOf(grid(2, 4), { col: 0, span: 2 }));
    expect(d.get("t00")).toBe(0);
    expect(d.get("t01")).toBe(0);
    expect(d.get("t10")).toBe(1);
    // Column 2's center is half a column past the board's right edge.
    expect(d.get("t02")).toBeCloseTo(Math.hypot(1, 0.5) - 1);
    expect(d.get("t03")).toBeCloseTo(Math.hypot(1, 1.5) - 1);
  });

  const front = only({ front: { enabled: true, weight: 1 } });

  test("'fill the front first' seats students at the front middle", () => {
    const group = ["a", "b"].map((id) => student(id));
    for (let seed = 0; seed < 10; seed++) {
      const { seats } = place(roomOf(grid(3, 3)), group, front, seededRandom(seed));
      // The front middle, then either front corner.
      expect(Object.keys(seats)).toContain("t01");
      expect(Object.keys(seats).every((id) => id.startsWith("t0"))).toBe(true);
    }
  });

  test("a single student goes to the front too", () => {
    // Board moved over the right-hand column.
    const { seats } = place(roomOf(grid(3, 3), { col: 2, span: 1 }), [student("a")], front, seededRandom(3));
    expect(seats).toEqual({ t02: "a" });
  });

  const frontRow = only({ frontRow: { enabled: true, weight: 1 } });
  const column = [table(0, 0), table(1, 0), table(2, 0)];

  test("front-row students take the seats closest to the board", () => {
    const group = [student("a"), student("b", { frontRow: true }), student("c")];
    for (let seed = 0; seed < 10; seed++) {
      const { seats } = place(roomOf(column), group, frontRow, seededRandom(seed));
      expect(seats.t00).toBe("b");
    }
  });

  test("a front-row student is seated first when tables run out", () => {
    const group = [student("a"), student("b", { frontRow: true }), student("c")];
    for (let seed = 0; seed < 10; seed++) {
      const { unplaced } = place(roomOf(row(2)), group, frontRow, seededRandom(seed));
      expect(unplaced).not.toContain("b");
    }
  });

  test("being unplaced costs more than the farthest seat", () => {
    const group = [student("a", { frontRow: true })];
    expect(totalCost(roomOf(column), group, { t00: "a" }, frontRow)).toBe(0);
    // Distances 0, 1, 2, scaled by 1 / (2 + 1).
    expect(totalCost(roomOf(column), group, { t20: "a" }, frontRow)).toBeCloseTo(2 / 3);
    expect(totalCost(roomOf(column), group, {}, frontRow)).toBe(1);
  });

  test("a front-row student behind a free or ordinary seat is a violation", () => {
    const group = [student("a"), student("b", { frontRow: true }), student("c", { frontRow: true })];
    // b is behind a (not front row): violation, pointing at the board.
    expect(findViolations(roomOf(column), group, { t00: "a", t10: "b" }, frontRow)).toEqual([
      { kind: "frontRow", a: "t10", dr: -1, dc: 0 },
    ]);
    // Behind an empty table.
    expect(findViolations(roomOf(column), group, { t10: "b" }, frontRow)).toHaveLength(1);
    // Behind another front-row student only: fine.
    expect(findViolations(roomOf(column), group, { t00: "c", t10: "b", t20: "a" }, frontRow)).toEqual([]);
    // Next to the board rather than facing it: the table facing it is closer.
    const side = [table(0, 0), table(0, 1)];
    const moved = findViolations(roomOf(side, { col: 1, span: 1 }), group, { t00: "b" }, frontRow);
    expect(moved).toEqual([{ kind: "frontRow", a: "t00", dr: -1, dc: 0 }]);
    // Off: nothing.
    expect(findViolations(roomOf(column), group, { t10: "b" }, only({}))).toEqual([]);
  });
});
