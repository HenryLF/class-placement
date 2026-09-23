// Seating algorithm: puts a class's students on a room's tables. Pure: no
// store or storage access, so it can be tested directly.
import type { Board, Table } from "../store/useClassRoom";
import type { Student } from "../store/useStudents";

export const WEIGHTS = [1, 4, 16] as const;
export type Weight = (typeof WEIGHTS)[number];

export const DIAGONALS = [0, 0.25, 0.5, 1] as const;
export type Diagonal = (typeof DIAGONALS)[number];

// "spread": avoid two strong (or two weak) students side by side.
// "pairMean": each pair of neighbors should average to the class mean.
export const SCORE_RULES = ["spread", "pairMean"] as const;
export type ScoreRule = (typeof SCORE_RULES)[number];

export interface Constraint {
  enabled: boolean;
  weight: Weight;
}

export interface PlacementOptions {
  gender: Constraint;
  incompatible: Constraint;
  score: Constraint & { rule: ScoreRule };
  // Fill the tables closest to the whiteboard first.
  front: Constraint;
  // Seat students marked "front row" close to the whiteboard.
  frontRow: Constraint;
  // Weight of a diagonal neighbor; side neighbors weigh 1.
  diagonal: Diagonal;
}

export const DEFAULT_OPTIONS: PlacementOptions = {
  gender: { enabled: true, weight: 4 },
  incompatible: { enabled: true, weight: 16 },
  score: { enabled: true, weight: 4, rule: "spread" },
  front: { enabled: true, weight: 4 },
  frontRow: { enabled: true, weight: 16 },
  diagonal: 0.5,
};

/** What the algorithm needs from a room layout (a ClassProfile fits). */
export interface Room {
  tables: Table[];
  board: Board;
}

/**
 * Distance from each table to the nearest point of the whiteboard (above
 * the grid), in cells: 0 in the first row facing it, growing toward the
 * back and the sides.
 */
export function boardDistances(room: Room): Map<string, number> {
  const { col, span } = room.board;
  const middle = col + span / 2;
  return new Map(
    room.tables.map((t) => {
      // Sideways gap between the table's center and the board's closest edge.
      const side = Math.max(0, Math.abs(t.col + 0.5 - middle) - span / 2);
      return [t.id, Math.hypot(t.row + 1, side) - 1];
    }),
  );
}

// Board distances scaled to [0, 1) over the room's tables. Even the farthest
// seat stays below 1, the cost of not being seated at all.
function normalizedDistances(room: Room): Map<string, number> {
  const dist = boardDistances(room);
  const max = Math.max(0, ...dist.values());
  for (const [id, d] of dist) dist.set(id, d / (max + 1));
  return dist;
}

type Step = -1 | 0 | 1;

/** Two adjacent tables; (dr, dc) is the step from `a` to `b`. */
export interface Neighbor {
  a: string;
  b: string;
  weight: number;
  dr: Step;
  dc: Step;
}

// Offsets that reach each unordered pair of cells exactly once.
const FORWARD: [Step, Step][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

interface IndexPair {
  i: number;
  j: number;
  weight: number;
  dr: Step;
  dc: Step;
}

function indexPairs(tables: Table[], diagonal: number): IndexPair[] {
  const at = new Map(tables.map((t, i) => [`${t.row}:${t.col}`, i]));
  const pairs: IndexPair[] = [];
  tables.forEach((t, i) => {
    for (const [dr, dc] of FORWARD) {
      const weight = dr !== 0 && dc !== 0 ? diagonal : 1;
      const j = at.get(`${t.row + dr}:${t.col + dc}`);
      if (weight > 0 && j !== undefined) pairs.push({ i, j, weight, dr, dc });
    }
  });
  return pairs;
}

/** Every pair of adjacent tables: 4 sides, plus diagonals unless `diagonal` is 0. */
export function neighborPairs(tables: Table[], diagonal: number): Neighbor[] {
  return indexPairs(tables, diagonal).map(({ i, j, weight, dr, dc }) => ({
    a: tables[i]!.id,
    b: tables[j]!.id,
    weight,
    dr,
    dc,
  }));
}

export interface CostContext {
  options: PlacementOptions;
  // Mean score of the students who have one.
  mean: number;
  // Square of the largest distance to the mean; 0 turns score costs off.
  spread2: number;
}

export function costContext(
  students: Student[],
  options: PlacementOptions,
): CostContext {
  const scores = students.flatMap((s) => (s.score === null ? [] : [s.score]));
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const spread = Math.max(0, ...scores.map((s) => Math.abs(s - mean)));
  return { options, mean, spread2: spread * spread };
}

const incompatible = (x: Student, y: Student) =>
  x.incompatible.includes(y.id) || y.incompatible.includes(x.id);

// "other" is neutral: only female–female and male–male pairs count.
const sameGender = (x: Student, y: Student) =>
  x.gender === y.gender && x.gender !== "other";

/** Cost of `x` and `y` sitting next to each other, before the pair's weight. */
export function pairCost(
  x: Student | undefined,
  y: Student | undefined,
  ctx: CostContext,
): number {
  if (!x || !y) return 0;
  const { gender, incompatible: inc, score } = ctx.options;
  let cost = 0;
  if (inc.enabled && incompatible(x, y)) cost += inc.weight;
  if (gender.enabled && sameGender(x, y)) cost += gender.weight;
  if (score.enabled && x.score !== null && y.score !== null && ctx.spread2 > 0) {
    const a = x.score - ctx.mean;
    const b = y.score - ctx.mean;
    const raw = score.rule === "spread" ? Math.max(0, a * b) : ((a + b) / 2) ** 2;
    // Normalized to [0, 1] so the weights compare across constraints.
    cost += (score.weight * raw) / ctx.spread2;
  }
  return cost;
}

const anyEnabled = (o: PlacementOptions) =>
  o.gender.enabled ||
  o.incompatible.enabled ||
  o.score.enabled ||
  o.front.enabled ||
  o.frontRow.enabled;

/**
 * Weight of a student's distance to the whiteboard: its cost is this times
 * the normalized distance (1 when unplaced).
 */
export function seatWeight(st: Student, options: PlacementOptions): number {
  const { front, frontRow } = options;
  return (
    (front.enabled ? front.weight : 0) +
    (frontRow.enabled && st.frontRow ? frontRow.weight : 0)
  );
}

/**
 * Cost of a seating: every neighbor pair's weighted cost, plus each
 * student's distance to the whiteboard. Students missing from `seats`
 * count as unplaced.
 */
export function totalCost(
  room: Room,
  students: Student[],
  seats: Record<string, string>,
  options: PlacementOptions,
): number {
  const ctx = costContext(students, options);
  const byId = new Map(students.map((s) => [s.id, s]));
  let total = 0;
  for (const p of neighborPairs(room.tables, options.diagonal)) {
    const x = byId.get(seats[p.a] ?? "");
    const y = byId.get(seats[p.b] ?? "");
    total += p.weight * pairCost(x, y, ctx);
  }
  const dist = normalizedDistances(room);
  const tableOf = new Map(Object.entries(seats).map(([t, st]) => [st, t]));
  for (const st of students) {
    const table = tableOf.get(st.id);
    total += seatWeight(st, options) * (table === undefined ? 1 : dist.get(table) ?? 1);
  }
  return total;
}

export interface PlacementResult {
  // Table id → student id.
  seats: Record<string, string>;
  // Students left without a table, when there are more students than tables.
  unplaced: string[];
}

/**
 * Seats `students` on `tables`, minimizing the enabled constraints' cost
 * with simulated annealing. With no constraint enabled, seats at random.
 */
export function place(
  room: Room,
  students: Student[],
  options: PlacementOptions,
  random: () => number = Math.random,
): PlacementResult {
  const { tables } = room;
  const n = students.length;
  // Slots past the last table are "unplaced": they have no neighbors.
  const slots = Math.max(tables.length, n);
  const seat = Array.from({ length: slots }, (_, i) => (i < n ? i : -1));
  shuffle(seat, random);

  if (anyEnabled(options) && n > 0) anneal(seat, room, students, options, random);

  const result: PlacementResult = { seats: {}, unplaced: [] };
  seat.forEach((st, slot) => {
    if (st < 0) return;
    const id = students[st]!.id;
    const table = tables[slot];
    if (table) result.seats[table.id] = id;
    else result.unplaced.push(id);
  });
  return result;
}

function shuffle<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}

// Improves `seat` (slot → student index, -1 = empty) in place.
function anneal(
  seat: number[],
  room: Room,
  students: Student[],
  options: PlacementOptions,
  random: () => number,
) {
  const { tables } = room;
  const n = students.length;
  const slots = seat.length;
  if (slots < 2) return;
  const ctx = costContext(students, options);

  // Distance cost of a seat: normalized board distance, 1 when unplaced.
  const dist = normalizedDistances(room);
  const far = Array.from({ length: slots }, (_, i) => {
    const t = tables[i];
    return t ? dist.get(t.id)! : 1;
  });
  const coef = students.map((st) => seatWeight(st, options));

  // Symmetric student × student cost matrix.
  const cost = new Float64Array(n * n);
  let maxCost = 0;
  for (let u = 0; u < n; u++)
    for (let v = u + 1; v < n; v++) {
      const c = pairCost(students[u], students[v], ctx);
      cost[u * n + v] = cost[v * n + u] = c;
      maxCost = Math.max(maxCost, c);
    }
  maxCost = Math.max(maxCost, ...coef);
  if (maxCost === 0) return;

  const adj: { slot: number; weight: number }[][] = Array.from({ length: slots }, () => []);
  for (const { i, j, weight } of indexPairs(tables, options.diagonal)) {
    adj[i]!.push({ slot: j, weight });
    adj[j]!.push({ slot: i, weight });
  }

  // Cost of the edges around `slot` if student `u` sat there, plus u's
  // distance cost there.
  const local = (slot: number, u: number) => {
    if (u < 0) return 0;
    let c = coef[u]! * far[slot]!;
    for (const { slot: o, weight } of adj[slot]!) {
      const v = seat[o]!;
      if (v >= 0) c += weight * cost[u * n + v]!;
    }
    return c;
  };

  const pos = new Array<number>(n);
  seat.forEach((u, slot) => u >= 0 && (pos[u] = slot));
  // `local` counts each edge from both ends, and each seat cost once.
  let current = 0;
  for (let slot = 0; slot < slots; slot++) {
    const u = seat[slot]!;
    if (u >= 0) current += (local(slot, u) + coef[u]! * far[slot]!) / 2;
  }
  let best = current;
  let bestSeat = [...seat];

  const iterations = Math.max(20_000, 400 * slots);
  const t0 = maxCost;
  const cooling = Math.pow(1e-4, 1 / iterations);
  let temp = t0;

  for (let it = 0; it < iterations && best > 0; it++, temp *= cooling) {
    // Move a random student to a random other slot, swapping with whoever
    // (or nothing) is there.
    const u = Math.floor(random() * n);
    const p = pos[u]!;
    let q = Math.floor(random() * (slots - 1));
    if (q >= p) q++;
    const v = seat[q]!;

    // An edge between p and q is counted twice on both sides, and the
    // matrix is symmetric, so it cancels out of the delta.
    const before = local(p, u) + local(q, v);
    seat[p] = v;
    seat[q] = u;
    const delta = local(p, v) + local(q, u) - before;

    if (delta <= 0 || random() < Math.exp(-delta / temp)) {
      pos[u] = q;
      if (v >= 0) pos[v] = p;
      current += delta;
      if (current < best - 1e-9) {
        best = current;
        bestSeat = [...seat];
      }
    } else {
      seat[p] = u;
      seat[q] = v;
    }
  }
  bestSeat.forEach((u, slot) => (seat[slot] = u));
}

export const VIOLATION_KINDS = ["incompatible", "gender", "score", "frontRow"] as const;
export type ViolationKind = (typeof VIOLATION_KINDS)[number];

/**
 * A broken constraint between the students on tables `a` and `b`, (dr, dc)
 * being the step from a to b. A "frontRow" violation involves one table:
 * `b` is absent and (dr, dc) points toward the whiteboard.
 */
export interface Violation {
  kind: ViolationKind;
  a: string;
  b?: string;
  dr: Step;
  dc: Step;
}

/**
 * Constraints broken by a seating, for the enabled constraints only. A score
 * violation is two neighbors on the same side of the mean, each at least 1
 * point from it (two strong, or two weak, students side by side), whatever
 * the score rule. A front-row student is misplaced when a table closer to
 * the whiteboard is empty or holds a student who isn't front row.
 */
export function findViolations(
  room: Room,
  students: Student[],
  seats: Record<string, string>,
  options: PlacementOptions,
): Violation[] {
  const { mean } = costContext(students, options);
  const byId = new Map(students.map((s) => [s.id, s]));
  const found: Violation[] = [];
  for (const { a, b, dr, dc } of neighborPairs(room.tables, options.diagonal)) {
    const x = byId.get(seats[a] ?? "");
    const y = byId.get(seats[b] ?? "");
    if (!x || !y) continue;
    const add = (kind: ViolationKind) => found.push({ kind, a, b, dr, dc });
    if (options.incompatible.enabled && incompatible(x, y)) add("incompatible");
    if (options.gender.enabled && sameGender(x, y)) add("gender");
    if (options.score.enabled && x.score !== null && y.score !== null) {
      const da = x.score - mean;
      const db = y.score - mean;
      if (da * db > 0 && Math.abs(da) >= 1 && Math.abs(db) >= 1) add("score");
    }
  }

  if (options.frontRow.enabled) {
    const dist = boardDistances(room);
    const front = (t: Table) => byId.get(seats[t.id] ?? "")?.frontRow === true;
    // Closest table that a front-row student could take instead.
    const free = Math.min(
      ...room.tables.filter((t) => !front(t)).map((t) => dist.get(t.id)!),
    );
    for (const t of room.tables)
      if (front(t) && dist.get(t.id)! > free + 1e-9)
        found.push({ kind: "frontRow", a: t.id, dr: -1, dc: 0 });
  }
  return found;
}

/** Deterministic random numbers in [0, 1) (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
