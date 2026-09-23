import { useT } from "../../i18n";
import ui from "../../style/ui.module.css";
import { byName } from "../../utils/names";

interface Profile {
  id: string;
  name: string;
}

// Load / rename / create / delete a named profile (a room layout or a
// class of students).
export default function ProfilePicker({
  heading,
  newLabel,
  profiles,
  currentId,
  onLoad,
  onRename,
  onNew,
  onDelete,
  onDuplicate,
  deleteConfirm,
}: {
  heading: string;
  newLabel: string;
  profiles: Record<string, Profile>;
  currentId: string;
  onLoad: (id: string) => void;
  onRename: (name: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  // Shows a Copy button when set.
  onDuplicate?: (id: string) => void;
  deleteConfirm: (name: string) => string;
}) {
  const t = useT();
  const current = profiles[currentId];
  const sorted = Object.values(profiles).sort(byName);

  return (
    <section className={ui.section}>
      <h2 data-testid="profile-heading">{heading}</h2>
      <label className={ui.field}>
        {t.profile.load}
        <select value={currentId} onChange={(e) => onLoad(e.currentTarget.value)}>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || t.common.unnamed}
            </option>
          ))}
        </select>
      </label>
      <label className={ui.field}>
        {t.profile.name}
        <input
          type="text"
          value={current?.name ?? ""}
          onInput={(e) => onRename(e.currentTarget.value)}
        />
      </label>
      <div className={ui.row}>
        <button data-testid="new-profile" onClick={() => onNew()}>
          {newLabel}
        </button>
        {onDuplicate && (
          <button
            data-testid="duplicate-profile"
            onClick={() => current && onDuplicate(current.id)}
          >
            {t.profile.duplicate}
          </button>
        )}
        <button
          className={ui.danger}
          onClick={() => {
            if (current && confirm(deleteConfirm(current.name)))
              onDelete(current.id);
          }}
        >
          {t.common.delete}
        </button>
      </div>
    </section>
  );
}
