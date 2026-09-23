import type { ComponentChildren } from "preact";
import { useT } from "../../i18n";
import ui from "../../style/ui.module.css";
import Modal, { ModalClose } from "./Modal";

export interface Choice {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  testId?: string;
}

// Modal question with several answers, for when confirm()'s OK/Cancel isn't
// enough. Every answer, Cancel, Escape and the backdrop close it.
export default function ChoiceDialog({
  title,
  children,
  choices,
  onClose,
}: {
  title: string;
  children?: ComponentChildren;
  choices: Choice[];
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Modal title={title} onClose={onClose}>
      {children}
      {/* A row whose buttons stretch: when long labels wrap, every line
          still fills the width instead of leaving one button stranded. */}
      <div className={ui.row} data-testid="choice-buttons">
        {/* First, so Enter doesn't pick a destructive answer by default. */}
        <ModalClose autoFocus>{t.common.cancel}</ModalClose>
        {choices.map((c) => (
          <ModalClose
            key={c.label}
            data-testid={c.testId}
            className={c.danger ? ui.danger : undefined}
            onClick={c.onSelect}
          >
            {c.label}
          </ModalClose>
        ))}
      </div>
    </Modal>
  );
}
