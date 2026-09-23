import type { ComponentType } from "preact";
import { useState } from "preact/hooks";
import { useT } from "../../i18n";
import { useUI } from "../../store/useUI";
import HelpButton from "./HelpButton";
import s from "./Pannel.module.css";

export interface PannelTab {
  id: string;
  label: string;
  // Icon-only tab: `label` is the icon and `name` its accessible name.
  name?: string;
  Component: ComponentType;
}

// The tabs come from the app root, so this organism doesn't import pages.
export default function Pannel({ tabs }: { tabs: PannelTab[] }) {
  const t = useT();
  const open = useUI((st) => st.pannelOpen);
  const togglePannel = useUI((st) => st.togglePannel);
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  // Collapsed: only a floating button, so the classroom takes the full width.
  if (!open) {
    return (
      <button
        className={s.expand}
        data-testid="show-pannel"
        aria-label={t.app.showPannel}
        aria-expanded={false}
        onClick={togglePannel}
      >
        ☰
      </button>
    );
  }

  return (
    <aside className={s.pannel}>
      <header className={s.header}>
        <h1 className={s.title}>{t.app.title}</h1>
        <HelpButton />
        <button
          data-testid="hide-pannel"
          aria-label={t.app.hidePannel}
          aria-expanded={true}
          onClick={togglePannel}
        >
          ✕
        </button>
      </header>
      <nav className={s.tabs} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab === active}
            aria-label={tab.name}
            data-testid={`tab-${tab.id}`}
            className={`${s.tab} ${tab.name ? s.iconTab : ""} ${tab === active ? s.activeTab : ""}`}
            onClick={() => setActiveId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {active && <active.Component />}
    </aside>
  );
}
