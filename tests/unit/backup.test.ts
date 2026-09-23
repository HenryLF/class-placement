import { beforeEach, describe, expect, test } from "bun:test";
import { useI18n } from "../../src/i18n";
import {
  BackupParseError,
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  type BackupData,
} from "../../src/store/backup";
import { useClassRoom } from "../../src/store/useClassRoom";
import { usePlacements } from "../../src/store/usePlacements";
import { useStudents } from "../../src/store/useStudents";
import { useUI } from "../../src/store/useUI";
import { resetStores } from "../helpers";

beforeEach(resetStores);

/** Some data in every store, persisted. */
function fill() {
  useClassRoom.getState().renameClass("Room A");
  useClassRoom.getState().addTable(0, 0);
  useStudents.getState().importStudents(["Alice", "Bob"]);
  usePlacements.getState().setShowMarks(false);
  useUI.getState().setTheme("chalk");
  useI18n.getState().setLang("fr");
}

const errorOf = (text: string) => {
  try {
    parseBackup(text);
  } catch (e) {
    return e instanceof BackupParseError ? [e.code, e.key] : e;
  }
  return null;
};

describe("createBackup", () => {
  test("holds every stored key, parsed, with the date", () => {
    fill();
    const now = new Date("2026-09-23T10:00:00Z");
    const backup = createBackup(localStorage, now);
    expect(backup.app).toBe("class-placement");
    expect(backup.exportedAt).toBe("2026-09-23T10:00:00.000Z");
    expect(Object.keys(backup.data).sort()).toEqual([
      "class-placement",
      "class-placement-lang",
      "class-placement-placements",
      "class-placement-students",
      "class-placement-ui",
    ]);
    expect(backup.data["class-placement-lang"]).toEqual(
      JSON.parse(localStorage.getItem("class-placement-lang")!),
    );
  });

  test("leaves out keys that were never stored, and unrelated keys", () => {
    // resetStores() leaves every store's defaults in storage.
    localStorage.clear();
    localStorage.setItem("other-app", "{}");
    useUI.getState().setTheme("light");
    expect(Object.keys(createBackup().data)).toEqual(["class-placement-ui"]);
  });

  test("names the file after the day", () => {
    expect(backupFileName(new Date("2026-01-05T23:00:00Z"))).toBe("class-placement-2026-01-05.json");
  });
});

describe("parseBackup", () => {
  test("accepts its own export", () => {
    fill();
    const backup = createBackup();
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup.data);
  });

  test("rejects text that isn't JSON, or isn't an export", () => {
    expect(errorOf("{nope")).toEqual(["invalid", undefined]);
    expect(errorOf("[]")).toEqual(["notBackup", undefined]);
    expect(errorOf(JSON.stringify({ app: "other", data: {} }))).toEqual(["notBackup", undefined]);
    expect(errorOf(JSON.stringify({ app: "class-placement" }))).toEqual(["notBackup", undefined]);
  });

  test("rejects an export with nothing the app knows", () => {
    const text = JSON.stringify({ app: "class-placement", data: { other: { state: {} } } });
    expect(errorOf(text)).toEqual(["empty", undefined]);
  });

  test("rejects a store whose loaded profile is missing", () => {
    const room = { state: { profiles: {}, currentId: "gone" }, version: 2 };
    const text = JSON.stringify({ app: "class-placement", data: { "class-placement": room } });
    expect(errorOf(text)).toEqual(["broken", "class-placement"]);
    const students = { state: { students: {}, classes: { c: {} }, currentClassId: "x" } };
    expect(
      errorOf(JSON.stringify({ app: "class-placement", data: { "class-placement-students": students } })),
    ).toEqual(["broken", "class-placement-students"]);
    expect(
      errorOf(JSON.stringify({ app: "class-placement", data: { "class-placement-ui": "dark" } })),
    ).toEqual(["broken", "class-placement-ui"]);
  });
});

describe("restoreBackup", () => {
  test("brings back every store from an export", () => {
    fill();
    const data = parseBackup(JSON.stringify(createBackup()));
    resetStores();
    expect(useClassRoom.getState().profiles[useClassRoom.getState().currentId]!.name).toBe("My classroom");

    restoreBackup(data);
    const room = useClassRoom.getState();
    expect(room.profiles[room.currentId]!.name).toBe("Room A");
    expect(room.profiles[room.currentId]!.tables).toHaveLength(1);
    expect(Object.values(useStudents.getState().students).map((s) => s.name).sort()).toEqual([
      "Alice",
      "Bob",
    ]);
    expect(usePlacements.getState().showMarks).toBe(false);
    expect(useUI.getState().theme).toBe("chalk");
    expect(useI18n.getState().lang).toBe("fr");
    // And storage holds the imported data.
    expect(JSON.parse(localStorage.getItem("class-placement-ui")!).state.theme).toBe("chalk");
  });

  test("stores missing from the file go back to their defaults", () => {
    fill();
    const data: BackupData = {
      "class-placement-ui": { state: { pannelOpen: false, theme: "light" }, version: 0 },
    };
    restoreBackup(data);
    expect(useUI.getState()).toMatchObject({ pannelOpen: false, theme: "light" });
    expect(useI18n.getState().lang).toBe("en");
    expect(Object.keys(useStudents.getState().students)).toEqual([]);
    expect(usePlacements.getState().showMarks).toBe(true);
    expect(localStorage.getItem("class-placement-lang")).toBeNull();
  });

  test("old data in an export is migrated on import", () => {
    const old = {
      version: 2,
      state: {
        students: { a: { id: "a", name: "Ann", gender: "other", score: 3, incompatible: [] } },
        classes: { c: { id: "c", name: "C", studentIds: ["a"] } },
        currentClassId: "c",
      },
    };
    restoreBackup(parseBackup(JSON.stringify({ app: "class-placement", data: { "class-placement-students": old } })));
    expect(useStudents.getState().students.a!.frontRow).toBe(false);
  });
});

test("setTheme accepts known themes only, and sets <html data-theme>", () => {
  expect(useUI.getState().theme).toBe("indigo");
  useUI.getState().setTheme("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  useUI.getState().setTheme("neon" as never);
  expect(useUI.getState().theme).toBe("indigo");
});
