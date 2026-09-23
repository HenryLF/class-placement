import { createContext, type ComponentChildren, type JSX } from "preact";
import { useContext, useEffect, useId, useRef } from "preact/hooks";
import ui from "../../style/ui.module.css";

const CloseContext = createContext<() => void>(() => {});

// Modal <dialog> with a title. Escape, a click on the backdrop and
// <ModalClose> close it; `onClose` runs after any of them.
//
// With `onSubmit`, the body is a <form>: submitting runs `onSubmit`, then
// closes. Forms keep a draft and commit it there, so closing any other way
// discards it.
export default function Modal({
  title,
  subtitle,
  onClose,
  onSubmit,
  className = "",
  children,
}: {
  title: ComponentChildren;
  // Under the title, e.g. an id.
  subtitle?: ComponentChildren;
  onClose: () => void;
  onSubmit?: () => void;
  // E.g. a different width.
  className?: string;
  children: ComponentChildren;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const close = () => dialog.current?.close();

  const content = (
    <>
      <div>
        <h2 id={titleId} className={ui.dialogTitle} data-testid="dialog-title">
          {title}
        </h2>
        {subtitle}
      </div>
      {children}
    </>
  );

  return (
    <dialog
      ref={dialog}
      className={`${ui.dialog} ${className}`}
      aria-labelledby={titleId}
      onClose={onClose}
      // The dialog has no padding, so a click on it is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <CloseContext.Provider value={close}>
        {onSubmit ? (
          <form
            className={ui.dialogBody}
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
              close();
            }}
          >
            {content}
          </form>
        ) : (
          <div className={ui.dialogBody}>{content}</div>
        )}
      </CloseContext.Provider>
    </dialog>
  );
}

/** A button that closes the enclosing <Modal>, after its own `onClick`. */
export function ModalClose({
  onClick,
  ...rest
}: Omit<JSX.HTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onClick?: () => void;
}) {
  const close = useContext(CloseContext);
  return (
    <button
      {...rest}
      type="button"
      onClick={() => {
        onClick?.();
        close();
      }}
    />
  );
}
