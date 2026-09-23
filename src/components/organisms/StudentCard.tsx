import { useEffect, useState } from "preact/hooks";
import { useT } from "../../i18n";
import {
  useCurrentStudentClass,
  useStudents,
  type Student,
} from "../../store/useStudents";
import ui from "../../style/ui.module.css";
import GenderSelect from "../atoms/GenderSelect";
import ScoreSelect from "../atoms/ScoreSelect";
import Modal, { ModalClose } from "../molecules/Modal";
import s from "./StudentCard.module.css";

// Modal editing every field of a student (the list edits name, gender and
// score too). Changes are kept in a draft until Save.
export default function StudentCard({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const t = useT();
  const students = useStudents((st) => st.students);
  const saveStudent = useStudents((st) => st.saveStudent);
  const cls = useCurrentStudentClass();
  const student = students[studentId];
  const [draft, setDraft] = useState<Student | undefined>(student);

  // Removed (e.g. from another tab) while open.
  useEffect(() => {
    if (!student) onClose();
  }, [student]);
  if (!student || !draft) return null;

  const cols = t.students.columns;
  const update = (patch: Partial<Student>) =>
    setDraft((d) => d && { ...d, ...patch });
  const { incompatible } = draft;
  const setIncompatible = (fn: (list: string[]) => string[]) =>
    update({ incompatible: fn(incompatible) });
  const nameOf = (id: string) => students[id]?.name || t.common.unnamed;

  // Incompatibilities are picked among classmates.
  const candidates = cls.studentIds
    .filter((id) => id !== studentId && !incompatible.includes(id))
    .map((id) => students[id])
    .filter((st) => st !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
  const listed = incompatible.filter((id) => students[id]);

  return (
    <Modal
      title={draft.name.trim() || t.common.unnamed}
      subtitle={
        <span className={ui.id} data-testid="student-full-id">
          {cols.id} {studentId}
        </span>
      }
      onClose={onClose}
      onSubmit={() => saveStudent({ ...draft, name: draft.name.trim() })}
    >
      <label className={ui.field}>
        {cols.name}
        <input
          type="text"
          data-testid="card-name"
          placeholder={cols.name}
          value={draft.name}
          onInput={(e) => update({ name: e.currentTarget.value })}
        />
      </label>

      <div className={ui.row}>
        <label className={ui.field}>
          {cols.gender}
          <GenderSelect
            data-testid="card-gender"
            value={draft.gender}
            onChange={(gender) => update({ gender })}
          />
        </label>
        <label className={ui.field}>
          {cols.score}
          <ScoreSelect
            data-testid="card-score"
            value={draft.score}
            onChange={(score) => update({ score })}
          />
        </label>
      </div>

      <label className={s.check}>
        <input
          type="checkbox"
          data-testid="card-front-row"
          checked={draft.frontRow}
          onChange={(e) => update({ frontRow: e.currentTarget.checked })}
        />
        {t.card.frontRow}
      </label>

      <fieldset className={s.incompatible}>
        <legend>{t.card.incompatible}</legend>
        {listed.length === 0 ? (
          <p className={ui.hint}>{t.card.none}</p>
        ) : (
          <ul className={s.chips}>
            {listed.map((id) => (
              <li key={id} className={s.chip}>
                <span>{nameOf(id)}</span>
                <button
                  type="button"
                  aria-label={t.card.removeIncompatible(nameOf(id))}
                  onClick={() => setIncompatible((l) => l.filter((i) => i !== id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {candidates.length > 0 && (
          <select
            data-testid="add-incompatible"
            aria-label={t.card.addIncompatible}
            value=""
            onChange={(e) => {
              const id = e.currentTarget.value;
              if (id) setIncompatible((l) => [...l, id]);
            }}
          >
            <option value="">{t.card.addIncompatible}</option>
            {candidates.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name || t.common.unnamed}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      <div className={ui.actions}>
        <span className={ui.spacer} />
        <ModalClose>{t.common.cancel}</ModalClose>
        <button type="submit" className={ui.primary}>
          {t.common.save}
        </button>
      </div>
    </Modal>
  );
}
