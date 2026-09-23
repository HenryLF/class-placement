import type { ComponentChildren } from "preact";
import { useT } from "../../i18n";
import { useCurrentClass } from "../../store/useClassRoom";
import { usePlacements, useSeating } from "../../store/usePlacements";
import { useCurrentStudentClass } from "../../store/useStudents";
import ui from "../../style/ui.module.css";
import InfoButton from "../molecules/InfoButton";
import {
  DIAGONALS,
  place,
  SCORE_RULES,
  VIOLATION_KINDS,
  WEIGHTS,
  type Diagonal,
  type PlacementOptions,
  type ScoreRule,
  type ViolationKind,
  type Weight,
} from "../../utils/placement";
import s from "./PlacementTab.module.css";

const WEIGHT_KEYS = { 1: "low", 4: "medium", 16: "high" } as const;
const DIAGONAL_KEYS = { 0: "off", 0.25: "quarter", 0.5: "half", 1: "full" } as const;

export default function PlacementTab() {
  return (
    <>
      <ConstraintsSection />
      <PlaceSection />
    </>
  );
}

type ConstraintKind = "gender" | "incompatible" | "score" | "front" | "frontRow";

const hasMarks = (kind: ConstraintKind): kind is ViolationKind =>
  (VIOLATION_KINDS as readonly string[]).includes(kind);

/**
 * Color of a constraint's arrows on the tables; doubles as their legend.
 * Constraints without arrows get an empty one, to keep labels aligned.
 */
function Swatch({ kind }: { kind: ConstraintKind }) {
  const color = hasMarks(kind) ? `var(--violation-${kind})` : "transparent";
  return <span className={s.swatch} style={{ background: color }} />;
}

function ConstraintsSection() {
  const t = useT();
  const options = usePlacements((st) => st.options);
  const setOptions = usePlacements((st) => st.setOptions);

  return (
    <section className={ui.section}>
      <h2>{t.placement.constraintsHeading}</h2>
      <ConstraintRow kind="gender" label={t.placement.gender} />
      <ConstraintRow kind="incompatible" label={t.placement.incompatible} />
      <ConstraintRow kind="score" label={t.placement.score}>
        <div className={s.rule}>
          <select
            data-testid="opt-score-rule"
            aria-label={t.placement.rule}
            disabled={!options.score.enabled}
            value={options.score.rule}
            onChange={(e) =>
              setOptions({
                score: { ...options.score, rule: e.currentTarget.value as ScoreRule },
              })
            }
          >
            {SCORE_RULES.map((r) => (
              <option key={r} value={r}>
                {t.placement.rules[r]}
              </option>
            ))}
          </select>
        </div>
      </ConstraintRow>
      <ConstraintRow kind="front" label={t.placement.front} />
      <ConstraintRow kind="frontRow" label={t.placement.frontRow} />
      {/* Not a <label>: a click in the info modal would reach the select. */}
      <div className={ui.field}>
        {t.placement.diagonal}
        <div className={s.rule}>
          <select
            data-testid="opt-diagonal"
            aria-label={t.placement.diagonal}
            value={options.diagonal}
            onChange={(e) =>
              setOptions({ diagonal: Number(e.currentTarget.value) as Diagonal })
            }
          >
            {DIAGONALS.map((d) => (
              <option key={d} value={d}>
                {t.placement.diagonals[DIAGONAL_KEYS[d]]}
              </option>
            ))}
          </select>
          <InfoButton title={t.placement.diagonal} testId="info-diagonal">
            {t.placement.help.diagonal.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </InfoButton>
        </div>
      </div>
    </section>
  );
}

function ConstraintRow({
  kind,
  label,
  children,
}: {
  kind: ConstraintKind;
  label: string;
  children?: ComponentChildren;
}) {
  const t = useT();
  const options = usePlacements((st) => st.options);
  const setOptions = usePlacements((st) => st.setOptions);
  const c = options[kind];
  const update = (patch: Partial<typeof c>) =>
    setOptions({ [kind]: { ...c, ...patch } } as Partial<PlacementOptions>);

  return (
    <div className={s.constraint}>
      <label className={s.check}>
        <input
          type="checkbox"
          data-testid={`opt-${kind}`}
          checked={c.enabled}
          onChange={(e) => update({ enabled: e.currentTarget.checked })}
        />
        <Swatch kind={kind} />
        {label}
      </label>
      <select
        data-testid={`opt-${kind}-weight`}
        aria-label={t.placement.weight(label)}
        disabled={!c.enabled}
        value={c.weight}
        onChange={(e) => update({ weight: Number(e.currentTarget.value) as Weight })}
      >
        {WEIGHTS.map((w) => (
          <option key={w} value={w}>
            {t.placement.weights[WEIGHT_KEYS[w]]}
          </option>
        ))}
      </select>
      <InfoButton title={label} testId={`info-${kind}`}>
        {t.placement.help[kind].map((text) => (
          <p key={text}>{text}</p>
        ))}
        <p className={ui.hint}>{t.placement.help.weights}</p>
      </InfoButton>
      {children}
    </div>
  );
}

function PlaceSection() {
  const t = useT();
  const layout = useCurrentClass();
  const cls = useCurrentStudentClass();
  const options = usePlacements((st) => st.options);
  const showMarks = usePlacements((st) => st.showMarks);
  const setShowMarks = usePlacements((st) => st.setShowMarks);
  const savePlacement = usePlacements((st) => st.savePlacement);
  const clearPlacement = usePlacements((st) => st.clearPlacement);
  // `room` has only the tables that are switched on.
  const { room, disabled, placed, unplaced, members, violations } = useSeating();

  const counts = new Map<ViolationKind, number>();
  for (const v of violations) counts.set(v.kind, (counts.get(v.kind) ?? 0) + 1);
  const blocker =
    members.length === 0
      ? t.placement.needStudents
      : room.tables.length === 0
        ? t.placement.needTables
        : null;

  return (
    <section className={ui.section}>
      <h2>{t.placement.placeHeading}</h2>
      <p className={s.text}>
        {t.placement.summary(cls.name, layout.name, members.length, room.tables.length)}
      </p>
      {disabled.size > 0 && (
        <p className={ui.hint} data-testid="disabled-hint">
          {t.placement.disabledHint(disabled.size)}
        </p>
      )}
      <div className={ui.row}>
        <button
          className={ui.primary}
          data-testid="place"
          disabled={blocker !== null}
          onClick={() => {
            const { seats } = place(room, members, options);
            savePlacement({ roomId: layout.id, classId: cls.id, seats });
          }}
        >
          {t.placement.place}
        </button>
        <button
          data-testid="clear-placement"
          disabled={!placed}
          onClick={() => clearPlacement(layout.id, cls.id)}
        >
          {t.placement.clear}
        </button>
      </div>
      {blocker && <p className={ui.hint}>{blocker}</p>}
      {!placed ? (
        <p className={ui.hint}>{t.placement.notPlaced}</p>
      ) : (
        <>
          {unplaced.length > 0 && (
            <p className={s.warning} data-testid="unplaced">
              {t.placement.unplaced(
                unplaced.map((st) => st.name || t.common.unnamed).join(", "),
              )}
            </p>
          )}
          {violations.length === 0 ? (
            <p className={s.text} data-testid="violations">
              {t.placement.violationsNone}
            </p>
          ) : (
            <ul className={s.violations} data-testid="violations">
              {VIOLATION_KINDS.filter((k) => counts.has(k)).map((k) => (
                <li key={k} data-kind={k}>
                  <Swatch kind={k} />
                  {t.placement.violations[k](counts.get(k)!)}
                </li>
              ))}
            </ul>
          )}
          <label className={s.check}>
            <input
              type="checkbox"
              data-testid="show-marks"
              checked={showMarks}
              onChange={(e) => setShowMarks(e.currentTarget.checked)}
            />
            {t.placement.showMarks}
          </label>
          {showMarks && <p className={ui.hint}>{t.placement.arrowsHint}</p>}
        </>
      )}
    </section>
  );
}
