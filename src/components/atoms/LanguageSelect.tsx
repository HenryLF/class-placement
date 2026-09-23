import { LANGUAGES, useI18n, useT, type Language } from "../../i18n";

export default function LanguageSelect() {
  const t = useT();
  const lang = useI18n((st) => st.lang);
  const setLang = useI18n((st) => st.setLang);

  return (
    <select
      data-testid="language"
      aria-label={t.app.language}
      value={lang}
      onChange={(e) => setLang(e.currentTarget.value as Language)}
    >
      {Object.entries(LANGUAGES).map(([code, { label }]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
