import { useState } from "preact/hooks";
import { useT } from "../../i18n";
import {
  parseNames,
  useCurrentStudentClass,
  useStudents,
} from "../../store/useStudents";
import ui from "../../style/ui.module.css";
import Modal, { ModalClose } from "../molecules/Modal";
import s from "./ImportStudentsDialog.module.css";

// Modal creating one student per line of pasted names, in the loaded class.
export default function ImportStudentsDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const cls = useCurrentStudentClass();
  const importStudents = useStudents((st) => st.importStudents);
  const [text, setText] = useState("");
  const names = parseNames(text);

  return (
    <Modal
      title={t.importStudents.title}
      onClose={onClose}
      onSubmit={() => importStudents(names.map((name) => ({ name })))}
    >
      <label className={ui.field}>
        {t.importStudents.label}
        <textarea
          className={s.names}
          data-testid="import-names"
          rows={10}
          autoFocus
          placeholder={t.importStudents.placeholder}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
      </label>
      <p className={ui.hint} data-testid="import-summary" aria-live="polite">
        {t.importStudents.summary(names.length, cls.name || t.common.unnamed)}
      </p>
      <div className={ui.actions}>
        <span className={ui.spacer} />
        <ModalClose>{t.common.cancel}</ModalClose>
        <button
          type="submit"
          className={ui.primary}
          data-testid="import-submit"
          disabled={names.length === 0}
        >
          {t.importStudents.import}
        </button>
      </div>
    </Modal>
  );
}
