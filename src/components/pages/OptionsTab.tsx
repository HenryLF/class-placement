import { useRef, useState } from "preact/hooks";
import { useT } from "../../i18n";
import {
  ImportParseError,
  applyImport,
  createExport,
  exportFileName,
  parseImport,
  type ExportKind,
} from "../../store/backup";
import { THEMES, useUI, type Theme } from "../../store/useUI";
import ui from "../../style/ui.module.css";
import LanguageSelect from "../atoms/LanguageSelect";
import s from "./OptionsTab.module.css";

export default function OptionsTab() {
  const t = useT();
  return (
    <>
      <section className={ui.section}>
        <h2>{t.options.languageHeading}</h2>
        <LanguageSelect />
      </section>
      <ThemeSection />
      <BackupSection />
      <section className={ui.section} data-testid="about">
        <h2>{t.options.aboutHeading}</h2>
        {t.options.about.map((text) => (
          <p key={text} className={s.text}>
            {text}
          </p>
        ))}
      </section>
    </>
  );
}

function ThemeSection() {
  const t = useT();
  const theme = useUI((st) => st.theme);
  const setTheme = useUI((st) => st.setTheme);

  return (
    <section className={ui.section}>
      <h2>{t.options.themeHeading}</h2>
      <select
        data-testid="theme"
        aria-label={t.options.theme}
        value={theme}
        onChange={(e) => setTheme(e.currentTarget.value as Theme)}
      >
        {THEMES.map((th) => (
          <option key={th} value={th}>
            {t.options.themes[th]}
          </option>
        ))}
      </select>
    </section>
  );
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  // Revoking right away can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BackupSection() {
  const t = useT();
  const file = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const exportKind = (kind: ExportKind) => {
    const now = new Date();
    download(JSON.stringify(createExport(kind, now), null, 2), exportFileName(kind, now));
  };

  const importFile = async (f: File) => {
    try {
      const imported = parseImport(await f.text());
      applyImport(imported);
      const { rooms, classes } = imported;
      const text = [
        rooms.length > 0 && t.options.importedRooms(rooms.length),
        classes.length > 0 && t.options.importedClasses(classes.length),
      ];
      setStatus({ ok: true, text: text.filter(Boolean).join(" ") });
    } catch (e) {
      if (!(e instanceof ImportParseError)) throw e;
      setStatus({ ok: false, text: t.options.errors[e.code] });
    }
  };

  return (
    <section className={ui.section}>
      <h2>{t.options.backupHeading}</h2>
      <div className={ui.row}>
        <button data-testid="export-rooms" onClick={() => exportKind("rooms")}>
          {t.options.exportRooms}
        </button>
        <button data-testid="export-classes" onClick={() => exportKind("classes")}>
          {t.options.exportClasses}
        </button>
      </div>
      <p className={ui.hint}>{t.options.exportHint}</p>
      <button data-testid="import" onClick={() => file.current?.click()}>
        {t.options.import}
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className={s.file}
        data-testid="import-file"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          // Cleared so picking the same file again still fires a change.
          e.currentTarget.value = "";
          setStatus(null);
          if (f) void importFile(f);
        }}
      />
      <p className={ui.hint}>{t.options.importHint}</p>
      {status && (
        <p
          className={status.ok ? s.ok : s.error}
          role="status"
          data-testid="import-status"
        >
          {status.text}
        </p>
      )}
    </section>
  );
}
