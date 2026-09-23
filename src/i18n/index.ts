import { create } from "zustand";
import { persist } from "zustand/middleware";
import en from "./en";
import fr from "./fr";

export const LANGUAGES = {
  en: { label: "English", messages: en },
  fr: { label: "Français", messages: fr },
};

export type Language = keyof typeof LANGUAGES;

interface I18nStore {
  lang: Language;
  setLang: (lang: Language) => void;
}

export const useI18n = create<I18nStore>()(
  persist(
    (set) => ({
      lang: "en",
      setLang: (lang) => set({ lang }),
    }),
    { name: "class-placement-lang" },
  ),
);

// Keep <html lang> in sync for screen readers and hyphenation.
document.documentElement.lang = useI18n.getState().lang;
useI18n.subscribe((s) => (document.documentElement.lang = s.lang));

/** Messages for the current language, re-rendering when it changes. */
export const useT = () => useI18n((s) => LANGUAGES[s.lang].messages);

/** Messages for the current language, for use outside components. */
export const getT = () => LANGUAGES[useI18n.getState().lang].messages;
