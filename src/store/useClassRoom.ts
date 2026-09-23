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

/**
 * The whiteboard, in its own row above the grid: its left edge and width,
 * in columns. Moved and resized in half-column steps.
 */
export interface Board {
  col: number;
  span: number;
}

export type BoardHandle = "move" | "left" | "right";

const BOARD_STEP = 0.5;
const snap = (n: number) => Math.round(n / BOARD_STEP) * BOARD_STEP;

/** Centered, about 60% of the room's width. */
export function defaultBoard(cols: number): Board {
  const margin = Math.round(cols * 0.2);
  return { col: margin, span: cols - 2 * margin };
}

/** Snapped to half columns, at least one column wide, inside the grid. */
export function fitBoard({ col, span }: Board, cols: number): Board {
  const width = Math.min(cols, Math.max(1, snap(span)));
  return { col: Math.min(cols - width, Math.max(0, snap(col))), span: width };
}

/**
 * The board after dragging `handle` by `delta` columns: "move" slides it,
 * "left" and "right" move that edge while the other one stays put.
 */
export function dragBoard(board: Board, handle: BoardHandle, delta: number, cols: number): Board {
  const { col, span } = board;
  if (handle === "move") return fitBoard({ col: col + delta, span }, cols);
  if (handle === "right")
    return { col, span: Math.min(cols - col, Math.max(1, snap(span + delta))) };
  const right = col + span;
  const left = Math.min(right - 1, Math.max(0, snap(col + delta)));
  return { col: left, span: right - left };
}

export interface ClassProfile {
  id: string;
  name: string;
  rows: number;
  cols: number;
  tables: Table[];
  board: Board;
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
  // Adds layouts (with ids unused so far) and loads the first.
  addRooms: (rooms: ClassProfile[]) => void;
  // Grid
  setSize: (rows: number, cols: number) => void;
  setBoard: (board: Board) => void;
  // Tables
  addTable: (row: number, col: number) => void;
  moveTable: (id: string, row: number, col: number) => void;
  removeTable: (id: string) => void;
  clearTables: () => void;
}

function createProfile(name = getT().profile.room.new): ClassProfile {
  return { id: crypto.randomUUID(), name, rows: 9, cols: 9, tables: [], board: defaultBoard(9) };
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

        addRooms: (rooms) => {
          if (!rooms[0]) return;
          const profiles = { ...get().profiles };
          for (const room of rooms) profiles[room.id] = room;
          set({ profiles, currentId: rooms[0].id });
        },

        setSize: (rows, cols) =>
          updateCurrent((p) => {
            // Never shrink the grid below a placed table.
            const minRows = Math.max(MIN_SIZE, ...p.tables.map((t) => t.row + 1));
            const minCols = Math.max(MIN_SIZE, ...p.tables.map((t) => t.col + 1));
            const newCols = clamp(cols, minCols, MAX_SIZE);
            return {
              ...p,
              rows: clamp(rows, minRows, MAX_SIZE),
              cols: newCols,
              board: fitBoard(p.board, newCols),
            };
          }),

        setBoard: (board) => updateCurrent((p) => ({ ...p, board: fitBoard(board, p.cols) })),

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
      version: 3,
      partialize: (s) => ({ profiles: s.profiles, currentId: s.currentId }),
      migrate: (persisted, version) => {
        const state = persisted as ClassRoomStore;
        // v1 had no whiteboard (it went on top); v2 put it on the "top" or
        // "bottom" side. It is now always on top: a room that had it at the
        // bottom is flipped, so every table keeps its place facing it.
        if (version < 3) {
          for (const p of Object.values(state.profiles)) {
            const side: unknown = p.board;
            if (side === "bottom")
              p.tables = p.tables.map((t) => ({ ...t, row: p.rows - 1 - t.row }));
            p.board = defaultBoard(p.cols);
          }
        }
        return state;
      },
    },
  ),
);

export const useCurrentClass = () =>
  useClassRoom((s) => s.profiles[s.currentId]!);
