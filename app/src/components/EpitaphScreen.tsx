import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface EpitaphScreenProps {
  year: number;
  events: Array<{ text: string; category?: string; tick?: number }>;
  civId: string | null;
  onRestart: () => void;
}

/**
 * Full-screen overlay shown when the civilization falls (all dwarves dead).
 * Displays the year the fortress fell, the cause, and recent history.
 * Allows publishing the ruin to the graveyard.
 */
export function EpitaphScreen({ year, events, civId, onRestart }: EpitaphScreenProps) {
  const fallEvent = events.find(e => e.category === 'fortress_fallen');
  const recentEvents = events
    .filter(e => e.category !== 'fortress_fallen')
    .slice(-6);

  const [ruinId, setRuinId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Fetch ruin ID for this civilization (created by sim flush on fall)
  useEffect(() => {
    if (!civId) return;
    let cancelled = false;
    const poll = async () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data } = await supabase
          .from('ruins')
          .select('id, is_published')
          .eq('civilization_id', civId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (cancelled) return;
        if (data) {
          setRuinId(data.id as string);
          setPublished(data.is_published as boolean);
          return;
        }
        // Ruin not yet written — wait and retry (sim flush may be in flight)
        await new Promise(r => setTimeout(r, 1000));
      }
    };
    void poll();
    return () => { cancelled = true; };
  }, [civId]);

  const handlePublish = useCallback(async () => {
    if (!ruinId || published) return;
    setPublishing(true);
    const { error } = await supabase
      .from('ruins')
      .update({ is_published: true })
      .eq('id', ruinId);
    if (!error) setPublished(true);
    setPublishing(false);
  }, [ruinId, published]);

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
          {ruinId && !published && (
            <button
              onClick={() => void handlePublish()}
              disabled={publishing}
              className="border border-[var(--text)] text-[var(--text)] hover:text-[var(--amber)] hover:border-[var(--amber)] px-4 py-2 text-sm cursor-pointer disabled:opacity-50"
            >
              {publishing ? 'Publishing…' : 'Publish to Ruins'}
            </button>
          )}
          {published && (
            <span className="text-[var(--green)] text-sm self-center">✓ Published to Ruins</span>
          )}
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
