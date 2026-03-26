import { useState, useEffect, useCallback } from "react";
import type { BugReportSnapshot } from "../hooks/useSimRunner";
import { supabase } from "../lib/supabase";

interface BugReportModalProps {
  onClose: () => void;
  getSnapshot: () => BugReportSnapshot | null;
  civId: string;
  worldId: string;
  playerId: string;
}

export function BugReportModal({ onClose, getSnapshot, civId, worldId, playerId }: BugReportModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    const snapshot = getSnapshot();

    const { error: insertError } = await supabase.from("bug_reports").insert({
      world_id: worldId,
      civilization_id: civId,
      player_id: playerId,
      title: title.trim(),
      description: description.trim(),
      game_state: snapshot ?? {},
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
    } else {
      setSubmitted(true);
    }
  }, [title, description, submitting, getSnapshot, civId, worldId, playerId]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-panel)] border border-[var(--amber)] p-4 min-w-[340px] max-w-[480px] text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[var(--green)] font-bold text-sm mb-3">
          Report Bug
        </h2>

        {submitted ? (
          <>
            <p className="text-[var(--text)] mb-3">
              Bug report submitted. Game state was captured automatically.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-3 py-1 border border-[var(--green)] text-[var(--green)] hover:bg-[var(--green)] hover:text-[var(--bg-panel)] cursor-pointer"
              >
                OK
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2">
              <label className="block text-[var(--text)] mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Dwarf stuck in corridor"
                className="w-full px-2 py-1 bg-[var(--bg-main,#1a1a2e)] border border-[var(--border)] text-[var(--text)] text-xs outline-none focus:border-[var(--amber)]"
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="block text-[var(--text)] mb-1">What happened?</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you saw..."
                rows={4}
                className="w-full px-2 py-1 bg-[var(--bg-main,#1a1a2e)] border border-[var(--border)] text-[var(--text)] text-xs outline-none focus:border-[var(--amber)] resize-vertical"
              />
            </div>

            <p className="text-[var(--border)] mb-3">
              Full game state will be captured automatically.
            </p>

            {error && (
              <p className="text-[var(--red,#f87171)] mb-2">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || submitting}
                className="px-3 py-1 border border-[var(--green)] text-[var(--green)] hover:bg-[var(--green)] hover:text-[var(--bg-panel)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1 border border-[var(--text)] text-[var(--text)] hover:text-[var(--amber)] hover:border-[var(--amber)] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
