import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { useT } from "../../i18n";
import s from "./InfoButton.module.css";
import Modal, { ModalClose } from "./Modal";

// ⓘ button that opens an explanation in a <Modal>. `title` is the modal's
// title and, prefixed with "About", the button's accessible name unless
// `label` is given.
export default function InfoButton({
  title,
  testId,
  icon = "ⓘ",
  label,
  children,
}: {
  title: string;
  testId?: string;
  icon?: ComponentChildren;
  label?: string;
  children: ComponentChildren;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        aria-label={label ?? t.common.about(title)}
        onClick={() => setOpen(true)}
      >
        {icon}
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className={s.body} data-testid="info-body">
            {children}
          </div>
          <ModalClose autoFocus data-testid="info-close">
            {t.common.close}
          </ModalClose>
        </Modal>
      )}
    </>
  );
}
