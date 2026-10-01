import { useEffect, useState } from "preact/hooks";
import { useT } from "../../i18n";
import {
  MAX_SIZE,
  MIN_SIZE,
  tablesOutside,
  toSize,
  useClassRoom,
  useCurrentClass,
} from "../../store/useClassRoom";
import ui from "../../style/ui.module.css";
import ProfilePicker from "../molecules/ProfilePicker";

export default function ClassRoomTab() {
  return (
    <>
      <ProfileSection />
      <GridSection />
      <TablesSection />
    </>
  );
}

function ProfileSection() {
  const t = useT();
  const profiles = useClassRoom((st) => st.profiles);
  const currentId = useClassRoom((st) => st.currentId);
  const newClass = useClassRoom((st) => st.newClass);
  const loadClass = useClassRoom((st) => st.loadClass);
  const renameClass = useClassRoom((st) => st.renameClass);
  const deleteClass = useClassRoom((st) => st.deleteClass);

  return (
    <ProfilePicker
      heading={t.profile.room.heading}
      newLabel={t.profile.room.new}
      profiles={profiles}
      currentId={currentId}
      onLoad={loadClass}
      onRename={renameClass}
      onNew={newClass}
      onDelete={deleteClass}
      deleteConfirm={t.profile.deleteConfirm}
    />
  );
}

function GridSection() {
  const t = useT();
  const { rows, cols, tables } = useCurrentClass();
  const setSize = useClassRoom((st) => st.setSize);

  // A size that would remove tables waits until editing ends, and asks.
  const resize = (newRows: number, newCols: number, commit: boolean) => {
    const removed = tablesOutside(tables, toSize(newRows), toSize(newCols)).length;
    if (removed === 0) setSize(newRows, newCols);
    else if (commit && confirm(t.grid.shrinkConfirm(removed))) setSize(newRows, newCols);
    else return false;
    return true;
  };

  return (
    <section className={ui.section}>
      <h2>{t.grid.heading}</h2>
      <div className={ui.row}>
        <SizeInput
          label={t.grid.rows}
          testId="grid-rows"
          value={rows}
          onResize={(n, commit) => resize(n, cols, commit)}
        />
        <SizeInput
          label={t.grid.columns}
          testId="grid-cols"
          value={cols}
          onResize={(n, commit) => resize(rows, n, commit)}
        />
      </div>
      <p className={ui.hint}>{t.grid.shrinkHint}</p>
    </section>
  );
}

/**
 * A grid size, with a draft: typing "12" over "9" goes through "1", which
 * must not remove the tables past the first row on the way. `onResize`
 * returns whether the size was applied; `commit` is true when editing ends.
 */
function SizeInput({
  label,
  testId,
  value,
  onResize,
}: {
  label: string;
  testId: string;
  value: number;
  onResize: (n: number, commit: boolean) => boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  // Another room loaded, or the size applied.
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = draft === "" ? value : toSize(Number(draft));
    if (n === value || !onResize(n, true)) setDraft(String(value));
  };

  return (
    <label className={ui.field}>
      {label}
      <input
        type="number"
        data-testid={testId}
        min={MIN_SIZE}
        max={MAX_SIZE}
        step={1}
        value={draft}
        onInput={(e) => {
          const text = e.currentTarget.value;
          setDraft(text);
          const n = Number(text);
          if (text !== "" && Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE && n !== value)
            onResize(n, false);
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </label>
  );
}

function TablesSection() {
  const t = useT();
  const { tables } = useCurrentClass();
  const clearTables = useClassRoom((st) => st.clearTables);

  return (
    <section className={ui.section}>
      <h2>{t.tables.heading(tables.length)}</h2>
      <p className={ui.hint}>{t.tables.hint}</p>
      <button
        className={ui.danger}
        disabled={tables.length === 0}
        onClick={() => {
          if (confirm(t.tables.clearConfirm)) clearTables();
        }}
      >
        {t.tables.clearAll}
      </button>
    </section>
  );
}
