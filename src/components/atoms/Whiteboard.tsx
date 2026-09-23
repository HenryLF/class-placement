import type { JSX } from "preact";
import { useT } from "../../i18n";
import f from "../../style/furniture.module.css";

// The whiteboard. Size comes from `className`; other props go to the element.
export default function Whiteboard({
  className = "",
  ...rest
}: JSX.HTMLAttributes<HTMLDivElement>) {
  const t = useT();
  return (
    <div {...rest} className={`${f.board} ${className}`}>
      {t.classroom.whiteboard}
    </div>
  );
}
