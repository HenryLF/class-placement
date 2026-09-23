import type { JSX } from "preact";
import { useT } from "../../i18n";
import f from "../../style/furniture.module.css";

// The whiteboard. Size comes from `className`; `children` go after its label,
// other props to the element.
export default function Whiteboard({
  className = "",
  children,
  ...rest
}: JSX.HTMLAttributes<HTMLDivElement>) {
  const t = useT();
  return (
    <div {...rest} className={`${f.board} ${className}`}>
      {t.classroom.whiteboard}
      {children}
    </div>
  );
}
