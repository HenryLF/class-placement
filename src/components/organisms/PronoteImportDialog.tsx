import { useRef, useState } from "preact/hooks";
import { useT } from "../../i18n";
import {
  useCurrentStudentClass,
  useStudents,
  type NewStudent,
} from "../../store/useStudents";
import ui from "../../style/ui.module.css";
import { sameName } from "../../utils/names";
import { decodeText, parsePronote, PronoteParseError } from "../../utils/pronote";
import Modal, { ModalClose } from "../molecules/Modal";
import s from "./PronoteImportDialog.module.css";

// Modal importing a Pronote CSV export into the loaded class: pick the file,
// check the preview, import. Students already in the class are skipped, so
// importing the same export twice adds nothing.
export default function PronoteImportDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const cls = useCurrentStudentClass();
  const students = useStudents((st) => st.students);
  const importStudents = useStudents((st) => st.importStudents);
  const file = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<NewStudent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const existing = cls.studentIds.flatMap((id) => students[id]?.name ?? []);
  const added = parsed.filter((p) => !existing.some((name) => sameName(name, p.name)));
  const skipped = parsed.length - added.length;

  const read = async (f: File) => {
    setParsed([]);
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

  return (
    <Modal
      title={t.students.importPronote}
      onClose={onClose}
      onSubmit={() => importStudents(added)}
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
            {skipped > 0 && ` ${t.pronote.skipped(skipped)}`}
          </p>
          <div className={s.preview}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>{t.students.columns.name}</th>
                  <th>{t.students.columns.gender}</th>
                </tr>
              </thead>
              <tbody>
                {added.map((p, i) => (
                  <tr key={i} data-testid="pronote-row">
                    <td>{p.name}</td>
                    <td>{t.students.genders[p.gender ?? "other"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className={ui.actions}>
        <span className={ui.spacer} />
        <ModalClose>{t.common.cancel}</ModalClose>
        <button
          type="submit"
          className={ui.primary}
          data-testid="import-submit"
          disabled={added.length === 0}
        >
          {t.importStudents.import}
        </button>
      </div>
    </Modal>
  );
}
