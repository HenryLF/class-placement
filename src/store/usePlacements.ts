import { useMemo } from "preact/hooks";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_OPTIONS,
  findViolations,
  type PlacementOptions,
} from "../utils/placement";
import { useCurrentClass, type Table } from "./useClassRoom";
import { useCurrentStudentClass, useStudents, type Student } from "./useStudents";

// Seats of one student class in one room layout. Kept apart from both, so
// rooms and classes stay independent.
export interface Placement {
  roomId: string;
  classId: string;
  // Table id → student id.
  seats: Record<string, string>;
}

export interface PlacementsStore {
  options: PlacementOptions;
  // Keyed by placementKey(roomId, classId).
  placements: Record<string, Placement>;
  // Tables nobody may sit at, per placementKey(roomId, classId). Kept apart
  // from `placements` so clearing a placement keeps them.
  disabledTables: Record<string, string[]>;
  // Show violation arrows on the tables.
  showMarks: boolean;
}

export interface PlacementsAction {
  setOptions: (patch: Partial<PlacementOptions>) => void;
  savePlacement: (placement: Placement) => void;
  clearPlacement: (roomId: string, classId: string) => void;
  toggleTable: (roomId: string, classId: string, tableId: string) => void;
  setShowMarks: (show: boolean) => void;
}

export const placementKey = (roomId: string, classId: string) => `${roomId}:${classId}`;

/** Saved options over the defaults, so options added later get a value. */
export function withDefaults(saved: Partial<PlacementOptions> = {}): PlacementOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...saved,
    gender: { ...DEFAULT_OPTIONS.gender, ...saved.gender },
    incompatible: { ...DEFAULT_OPTIONS.incompatible, ...saved.incompatible },
    score: { ...DEFAULT_OPTIONS.score, ...saved.score },
    front: { ...DEFAULT_OPTIONS.front, ...saved.front },
    frontRow: { ...DEFAULT_OPTIONS.frontRow, ...saved.frontRow },
  };
}

export const usePlacements = create<PlacementsStore & PlacementsAction>()(
  persist(
    (set) => ({
      options: DEFAULT_OPTIONS,
      placements: {},
      disabledTables: {},
      showMarks: true,

      setOptions: (patch) => set((s) => ({ options: { ...s.options, ...patch } })),

      savePlacement: (p) =>
        set((s) => ({
          placements: { ...s.placements, [placementKey(p.roomId, p.classId)]: p },
        })),

      clearPlacement: (roomId, classId) =>
        set((s) => {
          const placements = { ...s.placements };
          delete placements[placementKey(roomId, classId)];
          return { placements };
        }),

      toggleTable: (roomId, classId, tableId) =>
        set((s) => {
          const key = placementKey(roomId, classId);
          const off = s.disabledTables[key] ?? [];
          const next = off.includes(tableId)
            ? off.filter((id) => id !== tableId)
            : [...off, tableId];
          const disabledTables = { ...s.disabledTables, [key]: next };
          if (next.length === 0) delete disabledTables[key];
          return { disabledTables };
        }),

      setShowMarks: (showMarks) => set({ showMarks }),
    }),
    {
      name: "class-placement-placements",
      version: 2,
      partialize: (s) => ({
        options: s.options,
        placements: s.placements,
        disabledTables: s.disabledTables,
        showMarks: s.showMarks,
      }),
      migrate: (persisted, version) => {
        const state = persisted as PlacementsStore;
        // v1 had no disabled tables and always showed the arrows.
        if (version < 2) {
          state.disabledTables ??= {};
          state.showMarks ??= true;
        }
        return state;
      },
      merge: (persisted, current) => {
        const saved = persisted as Partial<PlacementsStore>;
        return { ...current, ...saved, options: withDefaults(saved.options) };
      },
    },
  ),
);

export interface Seating {
  // Whether this room + class has a saved placement.
  placed: boolean;
  // Table id → student, for tables and students that still exist.
  seated: Map<string, Student>;
  // Class members without a seat (only meaningful when `placed`).
  unplaced: Student[];
}

/**
 * A saved placement against the room and class as they are now: tables
 * removed since, and students who left the class, are dropped. Students who
 * joined the class since are unplaced.
 */
export function resolveSeating(
  seats: Record<string, string> | undefined,
  tables: Table[],
  members: Student[],
): Seating {
  const byId = new Map(members.map((s) => [s.id, s]));
  const seated = new Map<string, Student>();
  for (const t of tables) {
    const st = byId.get(seats?.[t.id] ?? "");
    if (st) seated.set(t.id, st);
  }
  const taken = new Set([...seated.values()].map((s) => s.id));
  return {
    placed: seats !== undefined,
    seated,
    unplaced: members.filter((s) => !taken.has(s.id)),
  };
}

const NONE: string[] = [];

/**
 * The loaded class's seating in the loaded room, with its violations.
 * `room` is the layout without the disabled tables: what placement uses.
 */
export function useSeating() {
  const layout = useCurrentClass();
  const cls = useCurrentStudentClass();
  const students = useStudents((s) => s.students);
  const options = usePlacements((s) => s.options);
  const key = placementKey(layout.id, cls.id);
  const placement = usePlacements((s) => s.placements[key]);
  const off = usePlacements((s) => s.disabledTables[key] ?? NONE);

  return useMemo(() => {
    const members = cls.studentIds
      .map((id) => students[id])
      .filter((st) => st !== undefined);
    const disabled = new Set(off);
    const room = { ...layout, tables: layout.tables.filter((t) => !disabled.has(t.id)) };
    const seating = resolveSeating(placement?.seats, room.tables, members);
    const seats: Record<string, string> = {};
    for (const [table, st] of seating.seated) seats[table] = st.id;
    const violations = findViolations(room, members, seats, options);
    return { ...seating, room, disabled, members, violations };
  }, [layout, cls, students, options, placement, off]);
}
