import { create } from "zustand";
import { persist } from "zustand/middleware";

// Color themes; each is a set of CSS variables in style/global.css.
export const THEMES = ["indigo", "light", "chalk"] as const;
export type Theme = (typeof THEMES)[number];

// UI preferences that aren't part of a class profile.
interface UIStore {
  pannelOpen: boolean;
  theme: Theme;
  togglePannel: () => void;
  setTheme: (theme: Theme) => void;
}

export const useUI = create<UIStore>()(
  persist(
    (set) => ({
      pannelOpen: true,
      theme: "indigo",
      togglePannel: () => set((s) => ({ pannelOpen: !s.pannelOpen })),
      setTheme: (theme) => set({ theme: THEMES.includes(theme) ? theme : "indigo" }),
    }),
    { name: "class-placement-ui" },
  ),
);

// global.css picks the theme's variables from <html data-theme>.
const applyTheme = (theme: Theme) => (document.documentElement.dataset.theme = theme);
applyTheme(useUI.getState().theme);
useUI.subscribe((s) => applyTheme(s.theme));
