import { beforeEach, describe, expect, test } from "bun:test";
import {
  classesByStudent,
  createStudent,
  parseNames,
  repairIncompatibilities,
  toScore,
  useStudents,
  type Student,
} from "../../src/store/useStudents";
import { resetStores } from "../helpers";

const store = () => useStudents.getState();
const current = () => store().classes[store().currentClassId]!;

/** Saves a student into the loaded class and returns it. */
function add(name: string, patch: Partial<Student> = {}) {
  const st = { ...createStudent(), name, ...patch };
  store().saveStudent(st);
  return st;
}

beforeEach(resetStores);

describe("saveStudent", () => {
  test("adds a new student to the loaded class", () => {
    const alice = add("Alice");
    expect(current().studentIds).toEqual([alice.id]);
    expect(store().students[alice.id]!.name).toBe("Alice");
  });

  test("mirrors an added incompatibility on the other student", () => {
    const alice = add("Alice");
    const bob = add("Bob", { incompatible: [alice.id] });
    expect(store().students[alice.id]!.incompatible).toEqual([bob.id]);
  });

  test("mirrors a removed incompatibility", () => {
    const alice = add("Alice");
    const bob = add("Bob", { incompatible: [alice.id] });
    store().saveStudent({ ...store().students[bob.id]!, incompatible: [] });
    expect(store().students[alice.id]!.incompatible).toEqual([]);
  });

  test("drops self-references, duplicates and unknown ids", () => {
    const alice = add("Alice");
    const bob = add("Bob", {
      incompatible: [alice.id, alice.id, "missing"],
    });
    store().saveStudent({
      ...store().students[bob.id]!,
      incompatible: [bob.id, alice.id],
    });
    expect(store().students[bob.id]!.incompatible).toEqual([alice.id]);
  });
});

describe("updateStudent", () => {
  test("changes name, gender and score only", () => {
    const alice = add("Alice");
    const bob = add("Bob", { incompatible: [alice.id] });
    store().updateStudent(bob.id, { name: "Bobby", gender: "male", score: 3 });
    const saved = store().students[bob.id]!;
    expect(saved).toMatchObject({ name: "Bobby", gender: "male", score: 3 });
    expect(saved.incompatible).toEqual([alice.id]);
  });

  test("rejects scores outside 1–5 and unknown genders", () => {
    const alice = add("Alice", { gender: "female", score: 2 });
    store().updateStudent(alice.id, { score: 7 as never, gender: "x" as never });
    expect(store().students[alice.id]).toMatchObject({ gender: "female", score: null });
  });

  test("sets the front-row flag, as a boolean", () => {
    const alice = add("Alice");
    expect(alice.frontRow).toBe(false);
    store().updateStudent(alice.id, { frontRow: true });
    expect(store().students[alice.id]!.frontRow).toBe(true);
    store().updateStudent(alice.id, { frontRow: "yes" as never });
    expect(store().students[alice.id]!.frontRow).toBe(false);
  });

  test("ignores unknown students", () => {
    const before = store().students;
    store().updateStudent("missing", { name: "Ghost" });
    expect(store().students).toBe(before);
  });
});

test("toScore keeps whole numbers from 1 to 5 only", () => {
  expect([1, 5, 0, 6, 2.5, "3", null, undefined].map(toScore)).toEqual([
    1, 5, null, null, null, null, null, null,
  ]);
});

describe("removeFromClass", () => {
  test("deletes a student in no other class and scrubs their links", () => {
    const alice = add("Alice");
    const bob = add("Bob", { incompatible: [alice.id] });
    store().removeFromClass(bob.id);
    expect(store().students[bob.id]).toBeUndefined();
    expect(store().students[alice.id]!.incompatible).toEqual([]);
  });

  test("keeps a student who is still in another class", () => {
    const alice = add("Alice");
    const first = store().currentClassId;
    store().duplicateClass(first);
    store().removeFromClass(alice.id);
    expect(store().students[alice.id]).toBeDefined();
    expect(store().classes[first]!.studentIds).toEqual([alice.id]);
  });
});

describe("deleteStudent", () => {
  test("removes the student from every class and scrubs their links", () => {
    const alice = add("Alice");
    const bob = add("Bob", { incompatible: [alice.id] });
    const first = store().currentClassId;
    store().duplicateClass(first);
    store().deleteStudent(bob.id);

    expect(store().students[bob.id]).toBeUndefined();
    expect(store().students[alice.id]!.incompatible).toEqual([]);
    for (const cls of Object.values(store().classes))
      expect(cls.studentIds).toEqual([alice.id]);
  });

  test("leaves classes without the student untouched", () => {
    const alice = add("Alice");
    const first = store().classes[store().currentClassId]!;
    store().newClass();
    const bob = add("Bob");
    store().deleteStudent(bob.id);
    expect(store().classes[first.id]).toBe(first);
    expect(store().students[alice.id]).toBeDefined();
  });
});

describe("importing names", () => {
  test("parseNames keeps one trimmed name per non-blank line", () => {
    expect(parseNames("  Alice \n\nBob\r\n   \nAlice\n")).toEqual([
      "Alice",
      "Bob",
      "Alice",
    ]);
    expect(parseNames("")).toEqual([]);
  });

  test("importStudents appends one new student per name, in order", () => {
    const existing = add("Zoe");
    store().importStudents([{ name: "Alice" }, { name: " Bob " }, { name: "" }, { name: "Alice" }]);
    const ids = current().studentIds;
    expect(ids[0]).toBe(existing.id);
    const names = ids.slice(1).map((id) => store().students[id]!.name);
    // Same names stay separate students.
    expect(names).toEqual(["Alice", "Bob", "Alice"]);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids.slice(1))
      expect(store().students[id]).toMatchObject({
        gender: "other",
        score: null,
        incompatible: [],
      });
  });

  test("importing nothing changes nothing", () => {
    const before = useStudents.getState();
    store().importStudents([{ name: "" }, { name: "  " }]);
    expect(useStudents.getState().students).toBe(before.students);
    expect(useStudents.getState().classes).toBe(before.classes);
  });
});

describe("classes", () => {
  test("classes are named as classes, not classrooms", () => {
    expect(current().name).toBe("My class");
    store().newClass();
    expect(current().name).toBe("New class");
  });

  test("duplicateClass shares the same students and loads the copy", () => {
    const alice = add("Alice");
    const bob = add("Bob");
    const original = current();
    store().duplicateClass(original.id);

    const copy = current();
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe(`${original.name} - Copy`);
    expect(copy.studentIds).toEqual([alice.id, bob.id]);
    // Shared, not cloned: no new student records.
    expect(Object.keys(store().students)).toHaveLength(2);
  });

  test("deleteClass deletes students found only in it", () => {
    const alice = add("Alice");
    const first = store().currentClassId;
    store().newClass();
    const bob = add("Bob");
    store().addToClass(alice.id);

    store().deleteClass(first);
    expect(store().students[alice.id]).toBeDefined(); // also in class 2
    expect(store().students[bob.id]).toBeDefined();

    store().newClass();
    const carl = add("Carl");
    store().deleteClass(store().currentClassId);
    expect(store().students[carl.id]).toBeUndefined();
  });

  test("deleting the last class creates a fresh one", () => {
    const only = store().currentClassId;
    store().deleteClass(only);
    const ids = Object.keys(store().classes);
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(only);
    expect(store().currentClassId).toBe(ids[0]!);
  });

  test("addToClass ignores unknown and already-present students", () => {
    const alice = add("Alice");
    store().addToClass(alice.id);
    store().addToClass("missing");
    expect(current().studentIds).toEqual([alice.id]);
  });
});

describe("classesByStudent", () => {
  test("lists each student's classes sorted by name", () => {
    const alice = add("Alice");
    const bob = add("Bob");
    store().renameClass("B class");
    store().newClass("A class");
    store().addToClass(alice.id);

    const index = classesByStudent(store().classes);
    expect(index.get(alice.id)!.map((c) => c.name)).toEqual([
      "A class",
      "B class",
    ]);
    expect(index.get(bob.id)!.map((c) => c.name)).toEqual(["B class"]);
    expect(index.get("missing")).toBeUndefined();
  });
});

describe("repairIncompatibilities", () => {
  const student = (id: string, incompatible: string[]): Student => ({
    id,
    name: id,
    gender: "other",
    score: null,
    frontRow: false,
    incompatible,
  });

  test("makes one-sided links symmetric", () => {
    const fixed = repairIncompatibilities({
      a: student("a", ["b"]),
      b: student("b", []),
    });
    expect(fixed.a!.incompatible).toEqual(["b"]);
    expect(fixed.b!.incompatible).toEqual(["a"]);
  });

  test("drops links to missing students and to itself", () => {
    const fixed = repairIncompatibilities({ a: student("a", ["a", "gone"]) });
    expect(fixed.a!.incompatible).toEqual([]);
  });

  test("keeps unchanged students as the same object", () => {
    const a = student("a", ["b"]);
    const b = student("b", ["a"]);
    const fixed = repairIncompatibilities({ a, b });
    expect(fixed.a).toBe(a);
    expect(fixed.b).toBe(b);
  });

  test("v1 scores outside 1–5 are cleared when loaded", async () => {
    localStorage.setItem(
      "class-placement-students",
      JSON.stringify({
        version: 1,
        state: {
          students: {
            a: { ...student("a", []), score: 15.5 },
            b: { ...student("b", []), score: 4 },
          },
          classes: { c: { id: "c", name: "C", studentIds: ["a", "b"] } },
          currentClassId: "c",
        },
      }),
    );
    await useStudents.persist.rehydrate();
    expect(store().students.a!.score).toBeNull();
    expect(store().students.b!.score).toBe(4);
  });

  test("v2 students load as not front row", async () => {
    const { frontRow: _, ...old } = student("a", []);
    localStorage.setItem(
      "class-placement-students",
      JSON.stringify({
        version: 2,
        state: {
          students: { a: old },
          classes: { c: { id: "c", name: "C", studentIds: ["a"] } },
          currentClassId: "c",
        },
      }),
    );
    await useStudents.persist.rehydrate();
    expect(store().students.a!.frontRow).toBe(false);
  });

  test("runs when saved data is loaded", async () => {
    localStorage.setItem(
      "class-placement-students",
      JSON.stringify({
        version: 1,
        state: {
          students: { a: student("a", ["b"]), b: student("b", []) },
          classes: { c: { id: "c", name: "C", studentIds: ["a", "b"] } },
          currentClassId: "c",
        },
      }),
    );
    await useStudents.persist.rehydrate();
    expect(store().students.b!.incompatible).toEqual(["a"]);
  });
});

describe("the loaded class", () => {
  test("renameClass renames only the loaded class", () => {
    const first = store().currentClassId;
    store().newClass("Other");
    store().renameClass("Renamed");
    expect(current().name).toBe("Renamed");
    expect(store().classes[first]!.name).not.toBe("Renamed");
  });

  test("saving a student again doesn't add them to the class twice", () => {
    const alice = add("Alice");
    store().saveStudent({ ...alice, name: "Alicia" });
    expect(current().studentIds).toEqual([alice.id]);
  });
});
