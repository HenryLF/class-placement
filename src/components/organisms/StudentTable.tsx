import { useEffect, useRef, useState } from "preact/hooks";
import { useT } from "../../i18n";
import { useStudents, type Student } from "../../store/useStudents";
import ui from "../../style/ui.module.css";
import { shortId } from "../../utils/ids";
import { byName } from "../../utils/names";
import GenderSelect from "../atoms/GenderSelect";
import ScoreSelect from "../atoms/ScoreSelect";
import s from "./StudentTable.module.css";

// Students of the loaded class, by name. Name, gender and score are edited in
// place and saved as you type; 🔍 opens the full student card, 🗑 asks how to
// delete the student.
export default function StudentTable({
  students,
  focusId,
  onDetails,
  onDelete,
}: {
  students: Student[];
  // Student whose name field gets focus when it appears (a new student).
  focusId: string | null;
  onDetails: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const cols = t.students.columns;
  const rows = useStableSort(students);

  return (
    <table className={`${ui.table} ${s.table}`} {...rows.holdProps}>
      <thead>
        <tr>
          <th>{cols.name}</th>
          <th>{cols.gender}</th>
          <th>{cols.score}</th>
          <th aria-label={cols.actions} />
        </tr>
      </thead>
      <tbody>
        {rows.sorted.map((st) => (
          <StudentRow
            key={st.id}
            student={st}
            focus={st.id === focusId}
            onDetails={() => onDetails(st.id)}
            onDelete={() => onDelete(st.id)}
          />
        ))}
      </tbody>
    </table>
  );
}

/**
 * `students` by name, except that the order is held while the pointer is over
 * the table or focus is in it: a row never moves while its name is typed, or
 * under a click. It re-sorts once the user moves away. Students added
 * meanwhile go at the end.
 */
function useStableSort(students: Student[]) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const order = useRef<string[]>([]);

  const byId = new Map(students.map((st) => [st.id, st]));
  let sorted = [...students].sort(byName);
  if (hovered || focused) {
    const held = order.current.filter((id) => byId.has(id));
    const known = new Set(held);
    sorted = [...held.map((id) => byId.get(id)!), ...sorted.filter((st) => !known.has(st.id))];
  }
  order.current = sorted.map((st) => st.id);

  const holdProps = {
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => setHovered(false),
    onFocusCapture: () => setFocused(true),
    onBlurCapture: (e: FocusEvent) =>
      setFocused((e.currentTarget as Node).contains(e.relatedTarget as Node | null)),
  };
  return { sorted, holdProps };
}

function StudentRow({
  student: st,
  focus,
  onDetails,
  onDelete,
}: {
  student: Student;
  focus: boolean;
  onDetails: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const cols = t.students.columns;
  const updateStudent = useStudents((store) => store.updateStudent);
  const nameInput = useRef<HTMLInputElement>(null);
  const label = st.name || t.common.unnamed;

  useEffect(() => {
    if (focus) nameInput.current?.focus();
  }, [focus]);

  return (
    <tr data-testid="student-row">
      <td className={s.name}>
        <input
          ref={nameInput}
          type="text"
          data-testid="student-name"
          aria-label={cols.name}
          placeholder={cols.name}
          value={st.name}
          onInput={(e) => updateStudent(st.id, { name: e.currentTarget.value })}
          // Not onChange: preact/compat (loaded through zustand) turns it into
          // onInput, which would trim a space as soon as it's typed.
          onBlur={(e) =>
            updateStudent(st.id, { name: e.currentTarget.value.trim() })
          }
        />
        <span className={`${ui.id} ${s.meta}`}>
          <span data-testid="student-id">#{shortId(st.id)}</span>
          {st.frontRow && (
            <span className={s.front} data-testid="front-row-badge">
              {t.students.frontRowBadge}
            </span>
          )}
          {st.incompatible.length > 0 && (
            <span className={s.warn}>
              {t.students.incompatibleCount(st.incompatible.length)}
            </span>
          )}
        </span>
      </td>
      <td>
        <GenderSelect
          short
          data-testid="student-gender"
          aria-label={cols.gender}
          value={st.gender}
          onChange={(gender) => updateStudent(st.id, { gender })}
        />
      </td>
      <td>
        <ScoreSelect
          data-testid="student-score"
          aria-label={cols.score}
          value={st.score}
          onChange={(score) => updateStudent(st.id, { score })}
        />
      </td>
      <td className={s.actions}>
        <button
          data-testid="student-details"
          aria-label={t.students.details(label)}
          onClick={onDetails}
        >
          🔍
        </button>
        <button
          data-testid="student-remove"
          aria-label={t.students.remove(label)}
          onClick={onDelete}
        >
          🗑
        </button>
      </td>
    </tr>
  );
}
