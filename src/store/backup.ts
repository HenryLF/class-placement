// Export and import of room layouts, and of classes with their students, as
// separate JSON files. Placements aren't exported: each one ties a room to a
// class, so it means nothing once either is imported on its own.
import {
  defaultBoard,
  fitBoard,
  MAX_SIZE,
  MIN_SIZE,
  useClassRoom,
  type ClassProfile,
  type Table,
} from "./useClassRoom";
import {
  GENDERS,
  orphans,
  purge,
  repairIncompatibilities,
  toScore,
  useStudents,
  type Student,
  type StudentClass,
} from "./useStudents";

export type ExportKind = "rooms" | "classes";

export interface ExportFile {
  app: "class-placement";
  format: 2;
  kind: ExportKind;
  exportedAt: string;
  // The store's persist version, so old files go through its `migrate`.
  version: number;
  state: unknown;
}

// Format 1 exported every localStorage key; these two hold rooms and classes.
const LEGACY_KEYS: Record<string, ExportKind> = {
  "class-placement": "rooms",
  "class-placement-students": "classes",
};

const persistOf = (kind: ExportKind) =>
  (kind === "rooms" ? useClassRoom : useStudents).persist.getOptions();

export function createExport(kind: ExportKind, now = new Date()): ExportFile {
  const state =
    kind === "rooms"
      ? { profiles: useClassRoom.getState().profiles }
      : { students: useStudents.getState().students, classes: useStudents.getState().classes };
  return {
    app: "class-placement",
    format: 2,
    kind,
    exportedAt: now.toISOString(),
    version: persistOf(kind).version ?? 0,
    state,
  };
}

/** File name for an export, e.g. "class-placement-rooms-2026-09-23.json". */
export const exportFileName = (kind: ExportKind, now = new Date()) =>
  `class-placement-${kind}-${now.toISOString().slice(0, 10)}.json`;

export type ImportError = "invalid" | "notBackup" | "empty" | "broken";

export class ImportParseError extends Error {
  constructor(readonly code: ImportError) {
    super(code);
  }
}

/** What a file adds, with fresh ids so it never clashes with existing data. */
export interface Imported {
  rooms: ClassProfile[];
  classes: StudentClass[];
  students: Student[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === "string" ? v : "");

const isSize = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= MIN_SIZE && (v as number) <= MAX_SIZE;

function toRoom(v: unknown): ClassProfile {
  if (!isObject(v) || !Array.isArray(v.tables) || !isSize(v.rows) || !isSize(v.cols))
    throw new ImportParseError("broken");
  const { rows, cols } = v;
  // Out-of-grid and stacked tables are dropped.
  const cells = new Set<string>();
  const tables: Table[] = [];
  for (const t of v.tables) {
    if (!isObject(t) || !Number.isInteger(t.row) || !Number.isInteger(t.col)) continue;
    const row = t.row as number;
    const col = t.col as number;
    const cell = `${row}:${col}`;
    if (row < 0 || col < 0 || row >= rows || col >= cols || cells.has(cell)) continue;
    cells.add(cell);
    tables.push({ id: crypto.randomUUID(), row, col });
  }
  const b = v.board;
  const board =
    isObject(b) && Number.isFinite(b.col) && Number.isFinite(b.span)
      ? fitBoard({ col: b.col as number, span: b.span as number }, cols)
      : defaultBoard(cols);
  return { id: crypto.randomUUID(), name: str(v.name), rows, cols, tables, board };
}

function toRooms(state: Record<string, unknown>) {
  if (!isObject(state.profiles)) throw new ImportParseError("broken");
  return Object.values(state.profiles).map(toRoom);
}

function toClasses(state: Record<string, unknown>) {
  if (!isObject(state.students) || !isObject(state.classes))
    throw new ImportParseError("broken");
  const raw = Object.values(state.students);
  const newId = new Map<string, string>();
  for (const st of raw) {
    if (!isObject(st) || typeof st.id !== "string") throw new ImportParseError("broken");
    newId.set(st.id, crypto.randomUUID());
  }
  const mapIds = (ids: unknown) =>
    Array.isArray(ids)
      ? [...new Set(ids.flatMap((id) => newId.get(id as string) ?? []))]
      : [];

  let students: Record<string, Student> = {};
  for (const st of raw as Record<string, unknown>[]) {
    const id = newId.get(st.id as string)!;
    students[id] = {
      id,
      name: str(st.name),
      gender: GENDERS.includes(st.gender as Student["gender"])
        ? (st.gender as Student["gender"])
        : "other",
      score: toScore(st.score),
      frontRow: st.frontRow === true,
      incompatible: mapIds(st.incompatible),
    };
  }
  const classes: Record<string, StudentClass> = {};
  for (const cls of Object.values(state.classes)) {
    if (!isObject(cls) || !Array.isArray(cls.studentIds)) throw new ImportParseError("broken");
    const id = crypto.randomUUID();
    classes[id] = { id, name: str(cls.name), studentIds: mapIds(cls.studentIds) };
  }
  // Same rules as the store: no orphans, symmetric incompatibilities.
  students = repairIncompatibilities(purge(students, orphans(Object.keys(students), classes)));
  return { classes: Object.values(classes), students: Object.values(students) };
}

// One store's slice, migrated to the current shape, then checked.
function read(imported: Imported, kind: ExportKind, version: unknown, state: unknown) {
  if (!isObject(state)) throw new ImportParseError("broken");
  const migrate = persistOf(kind).migrate;
  const current = persistOf(kind).version ?? 0;
  const v = typeof version === "number" ? version : 0;
  // Our migrations are synchronous and edit the state in place. They trust
  // the shape, so a damaged file can make them throw.
  if (migrate && v < current)
    try {
      void migrate(state, v);
    } catch {
      throw new ImportParseError("broken");
    }
  if (kind === "rooms") imported.rooms.push(...toRooms(state));
  else Object.assign(imported, toClasses(state));
}

/**
 * The rooms and classes in an exported file, ready to add. Also reads the
 * all-in-one exports of older versions. Throws an ImportParseError when the
 * text isn't an export or its data is damaged.
 */
export function parseImport(text: string): Imported {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportParseError("invalid");
  }
  if (!isObject(parsed) || parsed.app !== "class-placement")
    throw new ImportParseError("notBackup");

  const imported: Imported = { rooms: [], classes: [], students: [] };
  if (parsed.kind === "rooms" || parsed.kind === "classes")
    read(imported, parsed.kind, parsed.version, parsed.state);
  else if (isObject(parsed.data))
    for (const [key, kind] of Object.entries(LEGACY_KEYS)) {
      const entry = parsed.data[key];
      if (entry === undefined) continue;
      if (!isObject(entry)) throw new ImportParseError("broken");
      read(imported, kind, entry.version, entry.state);
    }
  else throw new ImportParseError("notBackup");

  if (imported.rooms.length === 0 && imported.classes.length === 0)
    throw new ImportParseError("empty");
  return imported;
}

/** Adds the imported rooms and classes next to the existing ones. */
export function applyImport({ rooms, classes, students }: Imported) {
  if (rooms.length > 0) useClassRoom.getState().addRooms(rooms);
  if (classes.length > 0) useStudents.getState().addClasses(classes, students);
}
