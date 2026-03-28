interface EpitaphScreenProps {
  year: number;
  events: Array<{ text: string; category?: string; tick?: number }>;
  civId: string | null;
  onRestart: () => void;
}

/**
 * Full-screen overlay shown when the civilization falls (all dwarves dead).
 * Displays the year the fortress fell, the cause, and recent history.
 */
export function EpitaphScreen({ year, events, onRestart }: EpitaphScreenProps) {
  const fallEvent = events.find(e => e.category === 'fortress_fallen');
  const recentEvents = events
    .filter(e => e.category !== 'fortress_fallen')
    .slice(-6);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="border border-[var(--red,#f87171)] p-8 max-w-md w-full text-center space-y-4 bg-[var(--bg-panel)]">
        <div className="text-[#f87171] font-bold text-xl tracking-widest">
          THE FORTRESS HAS FALLEN
        </div>
        <div className="text-[var(--text)] text-sm">
          Year <span className="text-[var(--amber)]">{year}</span>
        </div>
        {fallEvent && (
          <div className="text-[var(--text)] text-xs italic border-t border-[var(--border)] pt-3">
            {fallEvent.text}
          </div>
        )}
        {recentEvents.length > 0 && (
          <div className="border-t border-[var(--border)] pt-3 text-left space-y-1">
            <div className="text-[var(--amber)] text-xs font-bold mb-1">Final Days</div>
            {recentEvents.map((e, i) => (
              <div key={i} className="text-[var(--text)] text-xs">· {e.text}</div>
            ))}
          </div>
        )}
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={onRestart}
            className="border border-[var(--amber)] text-[var(--amber)] hover:text-[var(--green)] hover:border-[var(--green)] px-6 py-2 text-sm cursor-pointer"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
