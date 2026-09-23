import { useState } from "preact/hooks";
import { useT } from "../../i18n";
import {
  createStudent,
  useCurrentStudentClass,
  useStudents,
} from "../../store/useStudents";
import ui from "../../style/ui.module.css";
import ProfilePicker from "../molecules/ProfilePicker";
import DeleteStudentDialog from "../organisms/DeleteStudentDialog";
import ImportStudentsDialog from "../organisms/ImportStudentsDialog";
import StudentCard from "../organisms/StudentCard";
import StudentPicker from "../organisms/StudentPicker";
import StudentTable from "../organisms/StudentTable";

export default function StudentsTab() {
  const t = useT();
  const classes = useStudents((st) => st.classes);
  const currentClassId = useStudents((st) => st.currentClassId);
  const newClass = useStudents((st) => st.newClass);
  const loadClass = useStudents((st) => st.loadClass);
  const renameClass = useStudents((st) => st.renameClass);
  const deleteClass = useStudents((st) => st.deleteClass);
  const duplicateClass = useStudents((st) => st.duplicateClass);
  // Student whose details (incompatibilities) popup is open.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Student whose delete question is open.
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <>
      <ProfilePicker
        heading={t.profile.class.heading}
        newLabel={t.profile.class.new}
        profiles={classes}
        currentId={currentClassId}
        onLoad={loadClass}
        onRename={renameClass}
        onNew={newClass}
        onDelete={deleteClass}
        onDuplicate={duplicateClass}
        deleteConfirm={t.students.deleteClassConfirm}
      />
      <StudentsSection onDetails={setDetailId} onDelete={setDeleteId} />
      {detailId && (
        <StudentCard
          key={detailId}
          studentId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
      {deleteId && (
        <DeleteStudentDialog
          key={deleteId}
          studentId={deleteId}
          onClose={() => setDeleteId(null)}
        />
      )}
    </>
  );
}

function StudentsSection({
  onDetails,
  onDelete,
}: {
  onDetails: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const cls = useCurrentStudentClass();
  const students = useStudents((st) => st.students);
  const saveStudent = useStudents((st) => st.saveStudent);
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Class order, not sorted by name: sorting would move a row while its
  // name is being typed.
  const members = cls.studentIds
    .map((id) => students[id])
    .filter((st) => st !== undefined);
  const hasOthers = Object.keys(students).length > members.length;

  return (
    <section className={ui.section}>
      <h2>{t.students.heading(members.length)}</h2>
      <button
        data-testid="new-student"
        onClick={() => {
          const student = createStudent();
          saveStudent(student);
          setFocusId(student.id);
        }}
      >
        + {t.students.newStudent}
      </button>
      <div className={ui.row}>
        {hasOthers && (
          <button data-testid="add-from-other" onClick={() => setPicking(true)}>
            + {t.students.addFromOther}
          </button>
        )}
        <button data-testid="add-multiple" onClick={() => setImporting(true)}>
          + {t.students.addMultiple}
        </button>
      </div>
      {picking && <StudentPicker onClose={() => setPicking(false)} />}
      {importing && <ImportStudentsDialog onClose={() => setImporting(false)} />}
      {members.length === 0 ? (
        <p className={ui.hint}>{t.students.empty}</p>
      ) : (
        <StudentTable
          students={members}
          focusId={focusId}
          onDetails={onDetails}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}
