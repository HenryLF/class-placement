import { useT } from "../../i18n";
import {
  useClassesByStudent,
  useCurrentStudentClass,
  useStudents,
} from "../../store/useStudents";
import ui from "../../style/ui.module.css";
import ChoiceDialog, { type Choice } from "../molecules/ChoiceDialog";

// Asks whether to remove a student from the loaded class only, or to delete
// them from every class. With no other class, both mean the same: one Delete.
export default function DeleteStudentDialog({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const t = useT();
  const student = useStudents((st) => st.students[studentId]);
  const removeFromClass = useStudents((st) => st.removeFromClass);
  const deleteStudent = useStudents((st) => st.deleteStudent);
  const cls = useCurrentStudentClass();
  const others = (useClassesByStudent().get(studentId) ?? []).filter(
    (c) => c.id !== cls.id,
  );
  if (!student) return null;

  const name = student.name || t.common.unnamed;
  const choices: Choice[] =
    others.length === 0
      ? [
          {
            label: t.common.delete,
            onSelect: () => deleteStudent(studentId),
            danger: true,
            testId: "delete-student",
          },
        ]
      : [
          {
            label: t.deleteStudent.fromClass,
            onSelect: () => removeFromClass(studentId),
            testId: "delete-from-class",
          },
          {
            label: t.deleteStudent.fromAll,
            onSelect: () => deleteStudent(studentId),
            danger: true,
            testId: "delete-from-all",
          },
        ];

  return (
    <ChoiceDialog
      title={t.deleteStudent.title(name, cls.name || t.common.unnamed)}
      choices={choices}
      onClose={onClose}
    >
      <p className={ui.hint}>
        {others.length === 0
          ? t.deleteStudent.onlyHere
          : t.deleteStudent.alsoIn(
              others.map((c) => c.name || t.common.unnamed).join(", "),
            )}
      </p>
    </ChoiceDialog>
  );
}
