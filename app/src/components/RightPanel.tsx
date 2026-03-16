import { useState } from "react";

interface RightPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

const TABS = ["Log", "Legends"] as const;
type Tab = (typeof TABS)[number];

const PLACEHOLDER_LOG = [
  "Urist cancels Mine: tired.",
  "Kadol has brewed ale.",
  "Doren constructed a wall.",
  "Migrants have arrived!",
  "Aban felled a tree.",
  "A caravan has arrived.",
  "Likot harvested plump helmets.",
];

const PLACEHOLDER_LEGENDS = [
  "Year 201 — Stonegear founded",
  "Year 202 — First goblin siege",
  "Year 203 — Discovered adamantine",
  "Year 204 — Great flood",
];

export default function RightPanel({ collapsed, onToggle }: RightPanelProps) {
  const [tab, setTab] = useState<Tab>("Log");

  return (
    <aside
      className="border-l border-[var(--border)] bg-[var(--bg-panel)] flex flex-col shrink-0 overflow-hidden transition-[width] duration-150"
      style={{ width: collapsed ? 24 : 220 }}
    >
      <button
        onClick={onToggle}
        className="text-[var(--text)] hover:text-[var(--green)] text-xs px-1 py-0.5 self-start cursor-pointer"
        title={collapsed ? "Expand ]" : "Collapse ]"}
      >
        {collapsed ? "<" : ">"}
      </button>

      {!collapsed && (
        <>
          <div className="flex border-b border-[var(--border)] text-xs">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-0.5 cursor-pointer ${
                  tab === t
                    ? "text-[var(--green)] bg-[var(--bg-hover)]"
                    : "text-[var(--text)] hover:text-[var(--amber)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="px-2 py-1 overflow-y-auto text-xs flex-1">
            {tab === "Log" ? (
              <ul className="space-y-0.5">
                {PLACEHOLDER_LOG.map((entry, i) => (
                  <li key={i} className="text-[var(--text)]">
                    <span className="text-[var(--cyan)] mr-1">*</span>
                    {entry}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-0.5">
                {PLACEHOLDER_LEGENDS.map((entry, i) => (
                  <li key={i} className="text-[var(--amber)]">
                    {entry}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
