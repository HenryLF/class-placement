import type { JSX } from "preact";
import f from "../../style/furniture.module.css";
import s from "./TableShape.module.css";

// A single-seat table, showing the seated student's name (`label`), or
// nothing when the seat is free. Width comes from `className` (the height
// follows the aspect ratio); other props (drag handlers, events) go to the
// outer element.
export default function TableShape({
  className = "",
  label,
  ...rest
}: JSX.HTMLAttributes<HTMLDivElement> & { label?: string }) {
  return (
    <div
      aria-label={label}
      {...rest}
      className={`${f.table} ${s.table} ${className}`}
    >
      {label !== undefined && (
        <span className={s.name} data-testid="seat-name">
          {label}
        </span>
      )}
    </div>
  );
}
