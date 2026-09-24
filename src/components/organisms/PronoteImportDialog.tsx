import { useMemo, useRef, useState } from "preact/hooks";
import { useT } from "../../i18n";
import {
  matchImport,
  useClassesByStudent,
  useCurrentStudentClass,
  useStudents,
  type ImportMatch,
  type NewStudent,
} from "../../store/useStudents";
import ui from "../../style/ui.module.css";
import { decodeText, parsePronote, PronoteParseError } from "../../utils/pronote";
import Modal, { ModalClose } from "../molecules/Modal";
import s from "./PronoteImportDialog.module.css";

// One imported name, with what the user chose to do with it.
interface Row extends ImportMatch {
  index: number;
  // Id of the stored student to join, or "" to create a new one.
  join: string;
}

// Modal importing a Pronote CSV export into the loaded class: pick the file,
// check the preview, import. Students already in the class are skipped, so
// importing the same export twice adds nothing. A name that matches a
// student saved in another class is a possible duplicate: the user says
// whether it is the same person (joined, keeping the stored record) or a
// new student.
export default function PronoteImportDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const cls = useCurrentStudentClass();
  const students = useStudents((st) => st.students);
  const importStudents = useStudents((st) => st.importStudents);
  const addToClass = useStudents((st) => st.addToClass);
  const classesOf = useClassesByStudent();
  const file = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<NewStudent[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Answers given so far, by row; the others keep their default.
  const [choices, setChoices] = useState<Record<number, string>>({});

  const matched = useMemo(
    () => matchImport(parsed, students, cls.studentIds),
    [parsed, students, cls],
  );
  // A duplicate is joined unless the user says otherwise: the same name in
  // another class is far more often the same person than a namesake.
  const rows: Row[] = matched
    .map((m, index) => ({ ...m, index, join: choices[index] ?? m.matches[0]?.id ?? "" }))
    .filter((r) => !r.inClass);
  const duplicates = rows.filter((r) => r.matches.length > 0);
  const joined = rows.filter((r) => r.join !== "");
  const added = rows.filter((r) => r.join === "");
  const skipped = matched.filter((m) => m.inClass).length;

  const read = async (f: File) => {
    setParsed([]);
    setChoices({});
    setError(null);
    let bytes: ArrayBuffer;
    try {
      bytes = await f.arrayBuffer();
    } catch {
      // E.g. the file was moved or deleted after being picked.
      setError(t.pronote.errors.unreadable);
      return;
    }
    try {
      setParsed(parsePronote(decodeText(bytes)));
    } catch (e) {
      if (!(e instanceof PronoteParseError)) throw e;
      setError(t.pronote.errors[e.code]);
    }
  };

  const classesLabel = (id: string) =>
    (classesOf.get(id) ?? []).map((c) => c.name || t.common.unnamed).join(", ");

  return (
    <Modal
      title={t.students.importPronote}
      onClose={onClose}
      onSubmit={() => {
        for (const r of joined) addToClass(r.join);
        importStudents(added.map((r) => r.entry));
      }}
    >
      <p className={ui.hint}>{t.pronote.hint}</p>
      <button type="button" data-testid="pronote-choose" onClick={() => file.current?.click()}>
        {t.pronote.choose}
      </button>
      <input
        ref={file}
        type="file"
        accept=".csv,text/csv"
        className={ui.fileInput}
        data-testid="pronote-file"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          // Cleared so picking the same file again still fires a change.
          e.currentTarget.value = "";
          if (f) void read(f);
        }}
      />
      {error && (
        <p className={ui.error} data-testid="pronote-error" role="alert">
          {error}
        </p>
      )}
      {parsed.length > 0 && (
        <>
          <p className={ui.hint} data-testid="import-summary" aria-live="polite">
            {t.importStudents.summary(added.length, cls.name || t.common.unnamed)}
            {joined.length > 0 && ` ${t.pronote.joined(joined.length)}`}
            {skipped > 0 && ` ${t.pronote.skipped(skipped)}`}
          </p>
          {duplicates.length > 0 && (
            <div data-testid="pronote-duplicates">
              <h3 className={s.subhead}>{t.pronote.duplicatesHeading(duplicates.length)}</h3>
              <p className={ui.hint}>{t.pronote.duplicatesHint}</p>
              <div className={s.preview}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>{t.students.columns.name}</th>
                      <th>{t.pronote.duplicateColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.map((r) => (
                      <tr key={r.index} data-testid="pronote-duplicate">
                        <td>{r.entry.name}</td>
                        <td>
                          <select
                            data-testid="pronote-choice"
                            aria-label={t.pronote.duplicateChoice(r.entry.name)}
                            value={r.join}
                            onChange={(e) =>
                              setChoices((c) => ({ ...c, [r.index]: e.currentTarget.value }))
                            }
                          >
                            {r.matches.map((st) => (
                              <option key={st.id} value={st.id}>
                                {t.pronote.joinOption(classesLabel(st.id))}
                              </option>
                            ))}
                            <option value="">{t.pronote.createOption}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {added.length > 0 && (
            <div>
              {/* Told apart from the duplicates above, which also create a
                  student when the answer is "a different student". */}
              {duplicates.length > 0 && (
                <h3 className={s.subhead}>{t.pronote.newHeading(added.length)}</h3>
              )}
              <div className={s.preview}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>{t.students.columns.name}</th>
                      <th>{t.students.columns.gender}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {added.map((r) => (
                      <tr key={r.index} data-testid="pronote-row">
                        <td>{r.entry.name}</td>
                        <td>{t.students.genders[r.entry.gender ?? "other"]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      <div className={ui.actions}>
        <span className={ui.spacer} />
        <ModalClose>{t.common.cancel}</ModalClose>
        <button
          type="submit"
          className={ui.primary}
          data-testid="import-submit"
          disabled={added.length + joined.length === 0}
        >
          {t.importStudents.import}
        </button>
      </div>
    </Modal>
  );
}
