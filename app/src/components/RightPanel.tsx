import { useState, useEffect, useRef } from "react";
import type { LiveEvent } from "../hooks/useEvents";

interface RightPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  events: LiveEvent[];
}

const TABS = ["Log", "Legends"] as const;
type Tab = (typeof TABS)[number];

const PLACEHOLDER_LEGENDS = [
  "Year 201 — Stonegear founded",
  "Year 202 — First goblin siege",
  "Year 203 — Discovered adamantine",
  "Year 204 — Great flood",
];

/** Map event category to a CSS color variable. */
function categoryColor(category: string): string {
  switch (category) {
    case 'death':
      return 'var(--red, #f87171)';
    case 'fortress_fallen':
      return 'var(--red, #f87171)';
    case 'discovery':
      return 'var(--green)';
    case 'migration':
      return 'var(--cyan)';
    default:
      return 'var(--amber)';
  }
}

export default function RightPanel({ collapsed, onToggle, events }: RightPanelProps) {
  const [tab, setTab] = useState<Tab>("Log");
  const logRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-scroll when new events arrive
  useEffect(() => {
    if (events.length > prevCountRef.current && logRef.current) {
      logRef.current.scrollTop = 0;
    }
    prevCountRef.current = events.length;
  }, [events.length]);

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

          <div ref={logRef} className="px-2 py-1 overflow-y-auto text-xs flex-1">
            {tab === "Log" ? (
              events.length === 0 ? (
                <p className="text-[var(--text)] opacity-50 italic">No events yet.</p>
              ) : (
                <ul className="space-y-0.5">
                  {events.map((event) => (
                    <li key={event.id} className="text-[var(--text)]">
                      <span style={{ color: categoryColor(event.category) }} className="mr-1">*</span>
                      {event.description}
                    </li>
                  ))}
                </ul>
              )
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
