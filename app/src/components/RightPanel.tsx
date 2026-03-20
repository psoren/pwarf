import { useState, useEffect, useRef } from "react";
import type { LiveEvent } from "../hooks/useEvents";
import type { Ruin } from "@pwarf/shared";

interface RightPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  events: LiveEvent[];
  mode: "world" | "fortress";
  publishedRuins?: Ruin[];
}

type FortressTab = "Log" | "Legends";
type WorldTab = "Log" | "Legends" | "Graveyard";
type Tab = FortressTab | WorldTab;

/** Categories that appear in the Legends tab (significant history). */
const LEGEND_CATEGORIES = new Set([
  'death', 'fortress_fallen', 'migration', 'discovery',
  'artifact_created', 'artifact_lost',
  'battle', 'monster_slain', 'monster_siege',
  'trade_caravan_arrival', 'marriage',
]);

/** Group significant events by year, newest year first. */
export function groupEventsByYear(events: LiveEvent[]): Array<{ year: number; events: LiveEvent[] }> {
  const byYear = new Map<number, LiveEvent[]>();
  for (const event of events) {
    if (!LEGEND_CATEGORIES.has(event.category)) continue;
    const list = byYear.get(event.year) ?? [];
    list.push(event);
    byYear.set(event.year, list);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, evts]) => ({ year, events: evts }));
}

/** Group consecutive events with the same description into (event, count) pairs. */
export function groupConsecutiveEvents(events: LiveEvent[]): Array<{ event: LiveEvent; count: number }> {
  const groups: Array<{ event: LiveEvent; count: number }> = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && last.event.description === event.description) {
      last.count++;
    } else {
      groups.push({ event, count: 1 });
    }
  }
  return groups;
}

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
    case 'battle':
    case 'monster_siege':
      return '#f97316'; // orange — combat
    case 'monster_slain':
      return 'var(--green)';
    case 'trade_caravan_arrival':
      return 'var(--cyan)';
    case 'marriage':
      return '#cc44aa'; // pink
    default:
      return 'var(--amber)';
  }
}

/** Map cause_of_death to a short display string. */
export function causeLabel(cause: string): string {
  switch (cause) {
    case 'starvation': return 'starved';
    case 'dehydration': return 'thirsted';
    case 'tantrum_spiral': return 'tantrum';
    case 'plague': return 'plague';
    case 'combat': return 'slain';
    case 'unknown': return 'unknown';
    default: return cause;
  }
}

export default function RightPanel({ collapsed, onToggle, events, mode, publishedRuins = [] }: RightPanelProps) {
  const tabs: Tab[] = mode === "world" ? ["Log", "Legends", "Graveyard"] : ["Log", "Legends"];
  const [tab, setTab] = useState<Tab>("Log");
  const logRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Reset to Log tab when mode changes
  useEffect(() => {
    setTab("Log");
  }, [mode]);

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
            {tabs.map((t) => (
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
                  {groupConsecutiveEvents(events).map(({ event, count }) => (
                    <li key={event.id} className="text-[var(--text)]">
                      <span style={{ color: categoryColor(event.category) }} className="mr-1">*</span>
                      {event.description}
                      {count > 1 && (
                        <span className="ml-1 opacity-50 text-[0.65rem]">×{count}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : tab === "Legends" ? (
              groupEventsByYear(events).length === 0 ? (
                <p className="text-[var(--text)] opacity-50 italic">No history yet.</p>
              ) : (
                <div className="space-y-2">
                  {groupEventsByYear(events).map(({ year, events: yearEvents }) => (
                    <div key={year}>
                      <div className="text-[var(--amber)] font-bold mb-0.5">Year {year}</div>
                      <ul className="space-y-0.5 pl-1">
                        {yearEvents.map((event) => (
                          <li key={event.id} className="text-[var(--text)]">
                            <span style={{ color: categoryColor(event.category) }} className="mr-1">*</span>
                            {event.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Graveyard tab */
              publishedRuins.length === 0 ? (
                <p className="text-[var(--text)] opacity-50 italic">No published ruins yet.</p>
              ) : (
                <ul className="space-y-2">
                  {publishedRuins.map((ruin) => (
                    <li key={ruin.id} className="border-b border-[var(--border)] pb-1">
                      <div className="text-[var(--amber)] font-bold truncate">{ruin.name}</div>
                      <div className="text-[var(--text)] opacity-70 flex gap-2 flex-wrap">
                        <span>Year {ruin.fallen_year}</span>
                        <span className="text-[var(--red,#f87171)]">{causeLabel(ruin.cause_of_death)}</span>
                        <span>pop {ruin.peak_population}</span>
                        {ruin.danger_level > 0 && (
                          <span className="text-[var(--amber)]">danger {ruin.danger_level}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </>
      )}
    </aside>
  );
}
