import { useMemo } from "preact/hooks";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getT } from "../i18n";
import { removeProfile } from "./profiles";

export const GENDERS = ["female", "male", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export const SCORES = [1, 2, 3, 4, 5] as const;
export type Score = (typeof SCORES)[number];

/** `value` as a valid score, or null (no score). */
export function toScore(value: unknown): Score | null {
  return SCORES.includes(value as Score) ? (value as Score) : null;
}

export interface Student {
  id: string;
  name: string;
  gender: Gender;
  score: Score | null;
  // Should sit close to the whiteboard (e.g. eyesight).
  frontRow: boolean;
  // Ids of students this one shouldn't sit with. Always symmetric:
  // if A lists B, B lists A.
  incompatible: string[];
}

// A class is a list of references, so one student can be in several classes.
export interface StudentClass {
  id: string;
  name: string;
  studentIds: string[];
}

export interface StudentsStore {
  students: Record<string, Student>;
  classes: Record<string, StudentClass>;
  currentClassId: string;
}

export interface StudentsAction {
  // Classes
  newClass: (name?: string) => void;
  loadClass: (id: string) => void;
  renameClass: (name: string) => void;
  deleteClass: (id: string) => void;
  duplicateClass: (id: string) => void;
  // Students
  saveStudent: (student: Student) => void;
  updateStudent: (
    id: string,
    patch: Partial<Pick<Student, "name" | "gender" | "score" | "frontRow">>,
  ) => void;
  addToClass: (studentId: string) => void;
  removeFromClass: (studentId: string) => void;
  deleteStudent: (studentId: string) => void;
  importStudents: (names: string[]) => void;
}

/** A new, unsaved student. Save it with `saveStudent`. */
export function createStudent(): Student {
  return {
    id: crypto.randomUUID(),
    name: "",
    gender: "other",
    score: null,
    frontRow: false,
    incompatible: [],
  };
}

function createClass(name = getT().profile.defaultName): StudentClass {
  return { id: crypto.randomUUID(), name, studentIds: [] };
}

// Deletes students outright and scrubs them from every incompatibility list.
export function purge(students: Record<string, Student>, ids: Set<string>) {
  const next: Record<string, Student> = {};
  for (const st of Object.values(students)) {
    if (ids.has(st.id)) continue;
    next[st.id] = st.incompatible.some((i) => ids.has(i))
      ? { ...st, incompatible: st.incompatible.filter((i) => !ids.has(i)) }
      : st;
  }
  return next;
}

// Students that no longer belong to any class.
export function orphans(ids: string[], classes: Record<string, StudentClass>) {
  const used = new Set(Object.values(classes).flatMap((c) => c.studentIds));
  return new Set(ids.filter((id) => !used.has(id)));
}

/** Names from pasted text: one per line, trimmed, blank lines dropped. */
export function parseNames(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * Classes each student belongs to, in class-name order. Memberships are only
 * stored on the class side (`studentIds`); this is the reverse lookup.
 */
export function classesByStudent(classes: Record<string, StudentClass>) {
  const index = new Map<string, StudentClass[]>();
  const sorted = Object.values(classes).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const cls of sorted)
    for (const id of cls.studentIds) {
      const list = index.get(id);
      if (list) list.push(cls);
      else index.set(id, [cls]);
    }
  return index;
}

export function useClassesByStudent() {
  const classes = useStudents((s) => s.classes);
  return useMemo(() => classesByStudent(classes), [classes]);
}

/**
 * Makes incompatibility lists symmetric and drops links to students that no
 * longer exist. `saveStudent` keeps this true; this repairs stored data that
 * was edited by hand or written by an older version.
 */
export function repairIncompatibilities(students: Record<string, Student>) {
  const links = new Map<string, Set<string>>();
  for (const id of Object.keys(students)) links.set(id, new Set());
  for (const st of Object.values(students))
    for (const other of st.incompatible)
      if (other !== st.id && links.has(other)) {
        links.get(st.id)!.add(other);
        links.get(other)!.add(st.id);
      }

  const next: Record<string, Student> = {};
  for (const st of Object.values(students)) {
    const fixed = [...links.get(st.id)!];
    const same =
      fixed.length === st.incompatible.length &&
      fixed.every((id, i) => id === st.incompatible[i]);
    next[st.id] = same ? st : { ...st, incompatible: fixed };
  }
  return next;
}

const firstClass = createClass(getT().profile.firstName);

// Applies `fn` to the loaded class; returns the updated `classes`, or
// undefined when no class is loaded.
function updateCurrentClass(
  s: StudentsStore,
  fn: (cls: StudentClass) => StudentClass,
) {
  const cls = s.classes[s.currentClassId];
  return cls && { ...s.classes, [cls.id]: fn(cls) };
}

const addIds = (cls: StudentClass, ids: string[]): StudentClass => ({
  ...cls,
  studentIds: [...cls.studentIds, ...ids],
});

export const useStudents = create<StudentsStore & StudentsAction>()(
  persist(
    (set, get) => ({
      students: {},
      classes: { [firstClass.id]: firstClass },
      currentClassId: firstClass.id,

      newClass: (name) => {
        const cls = createClass(name);
        set((s) => ({
          classes: { ...s.classes, [cls.id]: cls },
          currentClassId: cls.id,
        }));
      },

      loadClass: (id) => {
        if (get().classes[id]) set({ currentClassId: id });
      },

      renameClass: (name) =>
        set((s) => {
          const classes = updateCurrentClass(s, (cls) => ({ ...cls, name }));
          return classes ? { classes } : s;
        }),

      deleteClass: (id) =>
        set((s) => {
          const removed = s.classes[id];
          if (!removed) return s;
          const { profiles: classes, currentId } = removeProfile(
            s.classes,
            id,
            s.currentClassId,
            createClass,
          );
          // Students only in this class go with it.
          const students = purge(
            s.students,
            orphans(removed.studentIds, classes),
          );
          return { students, classes, currentClassId: currentId };
        }),

      duplicateClass: (id) => {
        const src = get().classes[id];
        if (!src) return;
        // Same students, not copies of them: a student is shared by classes.
        const copy: StudentClass = {
          id: crypto.randomUUID(),
          name: getT().students.copyName(src.name),
          studentIds: [...src.studentIds],
        };
        set((s) => ({
          classes: { ...s.classes, [copy.id]: copy },
          currentClassId: copy.id,
        }));
      },

      saveStudent: (student) =>
        set((s) => {
          const prev = s.students[student.id];
          const incompatible = [...new Set(student.incompatible)].filter(
            (id) => id !== student.id && s.students[id],
          );
          const students = {
            ...s.students,
            [student.id]: { ...student, incompatible },
          };

          // Mirror incompatibility changes on the other students.
          const before = new Set(prev?.incompatible ?? []);
          const after = new Set(incompatible);
          for (const id of after) {
            const other = students[id]!;
            if (!before.has(id) && !other.incompatible.includes(student.id))
              students[id] = {
                ...other,
                incompatible: [...other.incompatible, student.id],
              };
          }
          for (const id of before) {
            const other = students[id];
            if (other && !after.has(id))
              students[id] = {
                ...other,
                incompatible: other.incompatible.filter((i) => i !== student.id),
              };
          }

          // A new student joins the loaded class.
          const classes = updateCurrentClass(s, (cls) =>
            cls.studentIds.includes(student.id) ? cls : addIds(cls, [student.id]),
          );
          return { students, classes: classes ?? s.classes };
        }),

      // Name, gender, score and front row, edited inline in the student list.
      updateStudent: (id, patch) =>
        set((s) => {
          const st = s.students[id];
          if (!st) return s;
          const next = { ...st, ...patch };
          if ("score" in patch) next.score = toScore(patch.score);
          if (patch.gender && !GENDERS.includes(patch.gender)) next.gender = st.gender;
          if ("frontRow" in patch) next.frontRow = patch.frontRow === true;
          return { students: { ...s.students, [id]: next } };
        }),

      addToClass: (studentId) =>
        set((s) => {
          const cls = s.classes[s.currentClassId];
          if (!cls || !s.students[studentId]) return s;
          if (cls.studentIds.includes(studentId)) return s;
          return { classes: updateCurrentClass(s, (c) => addIds(c, [studentId])) };
        }),

      removeFromClass: (studentId) =>
        set((s) => {
          const classes = updateCurrentClass(s, (cls) => ({
            ...cls,
            studentIds: cls.studentIds.filter((id) => id !== studentId),
          }));
          if (!classes) return s;
          // A student in no class at all is deleted.
          const students = purge(s.students, orphans([studentId], classes));
          return { classes, students };
        }),

      // Removes the student from every class, then deletes them.
      deleteStudent: (studentId) =>
        set((s) => {
          if (!s.students[studentId]) return s;
          const classes: Record<string, StudentClass> = {};
          for (const cls of Object.values(s.classes))
            classes[cls.id] = cls.studentIds.includes(studentId)
              ? { ...cls, studentIds: cls.studentIds.filter((id) => id !== studentId) }
              : cls;
          return { classes, students: purge(s.students, new Set([studentId])) };
        }),

      // One new student per name, appended to the loaded class in order.
      // Same names are kept apart: two students can share a name.
      importStudents: (names) =>
        set((s) => {
          const created = names
            .map((n) => n.trim())
            .filter((n) => n !== "")
            .map((name) => ({ ...createStudent(), name }));
          const classes = updateCurrentClass(s, (cls) =>
            addIds(cls, created.map((st) => st.id)),
          );
          if (!classes || created.length === 0) return s;
          const students = { ...s.students };
          for (const st of created) students[st.id] = st;
          return { students, classes };
        }),
    }),
    {
      name: "class-placement-students",
      version: 3,
      partialize: (s) => ({
        students: s.students,
        classes: s.classes,
        currentClassId: s.currentClassId,
      }),
      migrate: (persisted, version) => {
        const state = persisted as StudentsStore;
        // v1 scores were any number; they are now 1–5 or nothing.
        if (version < 2)
          for (const st of Object.values(state.students)) st.score = toScore(st.score);
        // v2 students had no front-row flag.
        if (version < 3)
          for (const st of Object.values(state.students)) st.frontRow ??= false;
        return state;
      },
      // Runs while loading saved data.
      merge: (persisted, current) => {
        const saved = persisted as Partial<StudentsStore>;
        return {
          ...current,
          ...saved,
          students: repairIncompatibilities(saved.students ?? current.students),
        };
      },
    },
  ),
);

export const useCurrentStudentClass = () =>
  useStudents((s) => s.classes[s.currentClassId]!);
