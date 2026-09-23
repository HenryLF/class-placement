import type { JSX } from "preact";
import { useT } from "../../i18n";
import { SCORES, toScore, type Score } from "../../store/useStudents";

type Props = Omit<JSX.HTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  value: Score | null;
  onChange: (score: Score | null) => void;
};

// A select rather than a number input: a controlled number input loses a
// typed decimal point.
export default function ScoreSelect({ value, onChange, ...rest }: Props) {
  const t = useT();
  return (
    <select
      {...rest}
      value={value ?? ""}
      // "" (no score) becomes 0, which toScore turns into null.
      onChange={(e) => onChange(toScore(Number(e.currentTarget.value)))}
    >
      <option value="">{t.students.noScore}</option>
      {SCORES.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
