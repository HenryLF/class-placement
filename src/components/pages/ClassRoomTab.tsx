import { useT } from "../../i18n";
import {
  MAX_SIZE,
  MIN_SIZE,
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
      heading={t.profile.heading}
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
  const { rows, cols } = useCurrentClass();
  const setSize = useClassRoom((st) => st.setSize);

  return (
    <section className={ui.section}>
      <h2>{t.grid.heading}</h2>
      <div className={ui.row}>
        <label className={ui.field}>
          {t.grid.rows}
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={rows}
            onChange={(e) => setSize(e.currentTarget.valueAsNumber, cols)}
          />
        </label>
        <label className={ui.field}>
          {t.grid.columns}
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={cols}
            onChange={(e) => setSize(rows, e.currentTarget.valueAsNumber)}
          />
        </label>
      </div>
      <p className={ui.hint}>{t.grid.shrinkHint}</p>
    </section>
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
