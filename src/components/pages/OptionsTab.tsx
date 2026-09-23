import { useRef, useState } from "preact/hooks";
import { getT, useI18n, useT } from "../../i18n";
import {
  BackupParseError,
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
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
  const lang = useI18n((st) => st.lang);
  const file = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const importFile = async (f: File) => {
    try {
      const text = await f.text();
      const data = parseBackup(text);
      const exported = (JSON.parse(text) as { exportedAt?: string }).exportedAt;
      const date = exported ? new Date(exported).toLocaleString(lang) : f.name;
      if (!confirm(t.options.importConfirm(date))) return;
      restoreBackup(data);
      // The language may have changed with the data.
      setStatus({ ok: true, text: getT().options.imported });
    } catch (e) {
      if (!(e instanceof BackupParseError)) throw e;
      const errors = t.options.errors;
      setStatus({
        ok: false,
        text: e.code === "broken" ? errors.broken(e.key ?? "") : errors[e.code],
      });
    }
  };

  return (
    <section className={ui.section}>
      <h2>{t.options.backupHeading}</h2>
      <button
        data-testid="export"
        onClick={() => {
          const now = new Date();
          download(JSON.stringify(createBackup(localStorage, now), null, 2), backupFileName(now));
        }}
      >
        {t.options.export}
      </button>
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
