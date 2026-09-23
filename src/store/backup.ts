// Export and import of everything the app keeps in localStorage, as one
// JSON file.
import { useI18n } from "../i18n";
import { useClassRoom } from "./useClassRoom";
import { usePlacements } from "./usePlacements";
import { useStudents } from "./useStudents";
import { useUI } from "./useUI";

export const STORAGE_KEYS = [
  "class-placement",
  "class-placement-students",
  "class-placement-placements",
  "class-placement-ui",
  "class-placement-lang",
] as const;
export type StorageKey = (typeof STORAGE_KEYS)[number];

// Each key's persisted JSON ({ state, version }), parsed.
export type BackupData = Partial<Record<StorageKey, unknown>>;

export interface Backup {
  app: "class-placement";
  format: 1;
  exportedAt: string;
  data: BackupData;
}

export function createBackup(storage: Storage = localStorage, now = new Date()): Backup {
  const data: BackupData = {};
  for (const key of STORAGE_KEYS) {
    const raw = storage.getItem(key);
    if (raw !== null) data[key] = JSON.parse(raw);
  }
  return { app: "class-placement", format: 1, exportedAt: now.toISOString(), data };
}

/** File name for a backup, e.g. "class-placement-2026-09-23.json". */
export const backupFileName = (now = new Date()) =>
  `class-placement-${now.toISOString().slice(0, 10)}.json`;

export type BackupError = "invalid" | "notBackup" | "empty" | "broken";

export class BackupParseError extends Error {
  constructor(
    readonly code: BackupError,
    readonly key?: StorageKey,
  ) {
    super(key ? `${code}: ${key}` : code);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// The loaded profile must exist, or the app has nothing to show.
function checkState(key: StorageKey, state: Record<string, unknown>) {
  if (key === "class-placement")
    return isObject(state.profiles) && typeof state.currentId === "string" &&
      isObject(state.profiles[state.currentId]);
  if (key === "class-placement-students")
    return isObject(state.students) && isObject(state.classes) &&
      typeof state.currentClassId === "string" && isObject(state.classes[state.currentClassId]);
  return true;
}

/**
 * The data of an exported file. Throws a BackupParseError when the text isn't
 * an export, or when a store's data is missing what the app needs to start.
 * Unknown keys are ignored.
 */
export function parseBackup(text: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupParseError("invalid");
  }
  if (!isObject(parsed) || parsed.app !== "class-placement" || !isObject(parsed.data))
    throw new BackupParseError("notBackup");

  const data: BackupData = {};
  for (const key of STORAGE_KEYS) {
    const entry = parsed.data[key];
    if (entry === undefined) continue;
    if (!isObject(entry) || !isObject(entry.state) || !checkState(key, entry.state))
      throw new BackupParseError("broken", key);
    data[key] = entry;
  }
  if (Object.keys(data).length === 0) throw new BackupParseError("empty");
  return data;
}

const STORES = [useClassRoom, useStudents, usePlacements, useUI, useI18n] as const;

/**
 * Replaces all stored data with `data` and reloads every store from it.
 * Keys missing from `data` go back to their defaults.
 */
export function restoreBackup(data: BackupData) {
  // Resetting a store writes its defaults to storage, so reset first, then
  // write the imported data, then load it.
  for (const store of STORES) {
    // Each store's own type; the union can't be called directly.
    const s = store as unknown as typeof useUI;
    s.setState(s.getInitialState(), true);
  }
  for (const key of STORAGE_KEYS) {
    const entry = data[key];
    if (entry === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(entry));
  }
  for (const store of STORES) void store.persist.rehydrate();
}
