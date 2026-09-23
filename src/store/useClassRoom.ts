import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getT } from "../i18n";
import { removeProfile } from "./profiles";

export const MIN_SIZE = 1;
export const MAX_SIZE = 30;

export interface Table {
  id: string;
  row: number;
  col: number;
}

export type BoardSide = "top" | "bottom";

export interface ClassProfile {
  id: string;
  name: string;
  rows: number;
  cols: number;
  tables: Table[];
  board: BoardSide;
}

export interface ClassRoomStore {
  // Every saved class, keyed by id. Persisted to localStorage.
  profiles: Record<string, ClassProfile>;
  currentId: string;
}

export interface ClassRoomAction {
  // Profiles
  newClass: (name?: string) => void;
  loadClass: (id: string) => void;
  renameClass: (name: string) => void;
  deleteClass: (id: string) => void;
  // Grid
  setSize: (rows: number, cols: number) => void;
  setBoard: (side: BoardSide) => void;
  // Tables
  addTable: (row: number, col: number) => void;
  moveTable: (id: string, row: number, col: number) => void;
  removeTable: (id: string) => void;
  clearTables: () => void;
}

function createProfile(name = getT().profile.room.new): ClassProfile {
  return { id: crypto.randomUUID(), name, rows: 9, cols: 9, tables: [], board: "top" };
}

function inBounds(p: ClassProfile, row: number, col: number) {
  return row >= 0 && col >= 0 && row < p.rows && col < p.cols;
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.floor(n) || min));

const firstProfile = createProfile(getT().profile.room.first);

export const useClassRoom = create<ClassRoomStore & ClassRoomAction>()(
  persist(
    (set, get) => {
      // Applies `fn` to the currently loaded profile.
      const updateCurrent = (fn: (p: ClassProfile) => ClassProfile) =>
        set((s) => {
          const current = s.profiles[s.currentId];
          if (!current) return s;
          return { profiles: { ...s.profiles, [current.id]: fn(current) } };
        });

      return {
        profiles: { [firstProfile.id]: firstProfile },
        currentId: firstProfile.id,

        newClass: (name) => {
          const profile = createProfile(name);
          set((s) => ({
            profiles: { ...s.profiles, [profile.id]: profile },
            currentId: profile.id,
          }));
        },

        loadClass: (id) => {
          if (get().profiles[id]) set({ currentId: id });
        },

        renameClass: (name) => updateCurrent((p) => ({ ...p, name })),

        deleteClass: (id) =>
          set((s) => removeProfile(s.profiles, id, s.currentId, createProfile)),

        setSize: (rows, cols) =>
          updateCurrent((p) => {
            // Never shrink the grid below a placed table.
            const minRows = Math.max(MIN_SIZE, ...p.tables.map((t) => t.row + 1));
            const minCols = Math.max(MIN_SIZE, ...p.tables.map((t) => t.col + 1));
            return {
              ...p,
              rows: clamp(rows, minRows, MAX_SIZE),
              cols: clamp(cols, minCols, MAX_SIZE),
            };
          }),

        setBoard: (board) => updateCurrent((p) => ({ ...p, board })),

        addTable: (row, col) =>
          updateCurrent((p) => {
            if (!inBounds(p, row, col)) return p;
            if (p.tables.some((t) => t.row === row && t.col === col)) return p;
            const table = { id: crypto.randomUUID(), row, col };
            return { ...p, tables: [...p.tables, table] };
          }),

        moveTable: (id, row, col) =>
          updateCurrent((p) => {
            const moving = p.tables.find((t) => t.id === id);
            if (!moving || !inBounds(p, row, col)) return p;
            // Dropping onto an occupied cell swaps the two tables.
            const tables = p.tables.map((t) => {
              if (t.id === id) return { ...t, row, col };
              if (t.row === row && t.col === col)
                return { ...t, row: moving.row, col: moving.col };
              return t;
            });
            return { ...p, tables };
          }),

        removeTable: (id) =>
          updateCurrent((p) => ({
            ...p,
            tables: p.tables.filter((t) => t.id !== id),
          })),

        clearTables: () => updateCurrent((p) => ({ ...p, tables: [] })),
      };
    },
    {
      name: "class-placement",
      version: 2,
      partialize: (s) => ({ profiles: s.profiles, currentId: s.currentId }),
      migrate: (persisted, version) => {
        const state = persisted as ClassRoomStore;
        // v1 profiles had no whiteboard.
        if (version < 2) {
          for (const p of Object.values(state.profiles)) p.board ??= "top";
        }
        return state;
      },
    },
  ),
);

export const useCurrentClass = () =>
  useClassRoom((s) => s.profiles[s.currentId]!);
