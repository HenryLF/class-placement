import { create } from "zustand";
import { persist } from "zustand/middleware";

// Color themes; each is a set of CSS variables in style/global.css.
export const THEMES = ["indigo", "light", "chalk"] as const;
export type Theme = (typeof THEMES)[number];

// Font size, in pixels, of the student names shown on the tables.
export const NAME_SIZE = { min: 8, max: 40, default: 12 } as const;

/** `value` as a usable name size: a whole number inside the range. */
export function toNameSize(value: unknown): number {
  const px = Math.round(Number(value));
  if (!Number.isFinite(px)) return NAME_SIZE.default;
  return Math.min(NAME_SIZE.max, Math.max(NAME_SIZE.min, px));
}

// UI preferences that aren't part of a class profile.
interface UIStore {
  pannelOpen: boolean;
  theme: Theme;
  nameSize: number;
  togglePannel: () => void;
  setTheme: (theme: Theme) => void;
  setNameSize: (px: number) => void;
}

export const useUI = create<UIStore>()(
  persist(
    (set) => ({
      pannelOpen: true,
      theme: "indigo",
      nameSize: NAME_SIZE.default,
      togglePannel: () => set((s) => ({ pannelOpen: !s.pannelOpen })),
      setTheme: (theme) => set({ theme: THEMES.includes(theme) ? theme : "indigo" }),
      setNameSize: (px) => set({ nameSize: toNameSize(px) }),
    }),
    {
      name: "class-placement-ui",
      merge: (persisted, current) => {
        const saved = persisted as Partial<UIStore>;
        return { ...current, ...saved, nameSize: toNameSize(saved.nameSize) };
      },
    },
  ),
);

// global.css reads the theme's variables from <html data-theme>, and the
// tables their name size from --name-size.
function apply({ theme, nameSize }: UIStore) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.setProperty("--name-size", `${nameSize}px`);
}
apply(useUI.getState());
useUI.subscribe(apply);
