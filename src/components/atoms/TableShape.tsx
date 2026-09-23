import user from "@assets/user.png";
import type { JSX } from "preact";
import { useT } from "../../i18n";
import f from "../../style/furniture.module.css";
import s from "./TableShape.module.css";

// A single-seat table, showing the seated student's name (`label`) or an
// empty-seat icon. Size comes from `className`; other props (drag handlers,
// events) go to the outer element.
export default function TableShape({
  className = "",
  label,
  ...rest
}: JSX.HTMLAttributes<HTMLDivElement> & { label?: string }) {
  const t = useT();
  return (
    <div
      aria-label={label}
      {...rest}
      className={`${f.wood} ${s.table} ${label !== undefined ? s.seated : ""} ${className}`}
    >
      {label !== undefined ? (
        <span className={s.name} data-testid="seat-name">
          {label}
        </span>
      ) : (
        <img src={user} alt={t.tables.alt} draggable={false} />
      )}
    </div>
  );
}
