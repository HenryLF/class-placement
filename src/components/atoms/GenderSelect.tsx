import type { HTMLAttributes } from "preact";
import { useT } from "../../i18n";
import { GENDERS, type Gender } from "../../store/useStudents";

type Props = Omit<HTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  value: Gender;
  onChange: (gender: Gender) => void;
  // One-letter labels, for tight spaces; the full name stays readable by
  // screen readers.
  short?: boolean;
};

export default function GenderSelect({ value, onChange, short, ...rest }: Props) {
  const t = useT();
  return (
    <select
      {...rest}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value as Gender)}
    >
      {GENDERS.map((g) => (
        <option key={g} value={g} aria-label={short ? t.students.genders[g] : undefined}>
          {(short ? t.students.gendersShort : t.students.genders)[g]}
        </option>
      ))}
    </select>
  );
}
