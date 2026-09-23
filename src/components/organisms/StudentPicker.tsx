import { useState } from "preact/hooks";
import { useT } from "../../i18n";
import {
  useClassesByStudent,
  useCurrentStudentClass,
  useStudents,
} from "../../store/useStudents";
import ui from "../../style/ui.module.css";
import { shortId } from "../../utils/ids";
import Modal, { ModalClose } from "../molecules/Modal";
import s from "./StudentPicker.module.css";

// Modal listing students from other classes, with their ID and classes,
// to add them to the loaded class.
export default function StudentPicker({ onClose }: { onClose: () => void }) {
  const t = useT();
  const students = useStudents((st) => st.students);
  const addToClass = useStudents((st) => st.addToClass);
  const cls = useCurrentStudentClass();
  const classesOf = useClassesByStudent();
  const [filter, setFilter] = useState("");

  const others = Object.values(students)
    .filter((st) => !cls.studentIds.includes(st.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const query = filter.trim().toLowerCase();
  const shown = query
    ? others.filter(
        (st) =>
          st.name.toLowerCase().includes(query) ||
          st.id.toLowerCase().includes(query.replace(/^#/, "")),
      )
    : others;

  return (
    <Modal title={t.students.addFromOther} onClose={onClose} className={s.wide}>
      {others.length === 0 ? (
        <p className={ui.hint}>{t.picker.empty}</p>
      ) : (
        <>
          <input
            type="search"
            autoFocus
            aria-label={t.picker.filter}
            placeholder={t.picker.filter}
            value={filter}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
          {shown.length === 0 ? (
            <p className={ui.hint}>{t.picker.noMatch}</p>
          ) : (
            <div className={s.scroll}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>{t.students.columns.name}</th>
                    <th>{t.students.columns.id}</th>
                    <th>{t.picker.classes}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((st) => (
                    <tr key={st.id} data-testid="picker-row">
                      <td>{st.name || t.common.unnamed}</td>
                      <td className={ui.id}>#{shortId(st.id)}</td>
                      <td className={s.classes} data-testid="picker-classes">
                        {(classesOf.get(st.id) ?? [])
                          .map((c) => c.name || t.common.unnamed)
                          .join(", ")}
                      </td>
                      <td>
                        <button
                          data-testid="picker-add"
                          onClick={() => addToClass(st.id)}
                        >
                          {t.picker.add}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <div className={ui.actions}>
        <span className={ui.spacer} />
        <ModalClose>{t.common.close}</ModalClose>
      </div>
    </Modal>
  );
}
