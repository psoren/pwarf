import { useEffect } from "react";

interface CaveScoutModalProps {
  caveName: string;
  alreadyScouting: boolean;
  onScout: () => void;
  onClose: () => void;
}

export function CaveScoutModal({ caveName, alreadyScouting, onScout, onClose }: CaveScoutModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !alreadyScouting) onScout();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onScout, alreadyScouting]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-panel)] border border-[var(--amber)] p-4 min-w-[260px] max-w-[320px] text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[var(--green)] font-bold text-sm mb-2">
          {caveName}
        </h2>

        {alreadyScouting ? (
          <p className="text-[var(--text)] mb-3">
            A dwarf is already scouting this entrance.
          </p>
        ) : (
          <p className="text-[var(--text)] mb-3">
            Send a dwarf to scout this cave entrance?
          </p>
        )}

        <div className="flex justify-end gap-2">
          {!alreadyScouting && (
            <button
              onClick={onScout}
              className="px-3 py-1 border border-[var(--green)] text-[var(--green)] hover:bg-[var(--green)] hover:text-[var(--bg-panel)] cursor-pointer"
            >
              Scout
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1 border border-[var(--text)] text-[var(--text)] hover:text-[var(--amber)] hover:border-[var(--amber)] cursor-pointer"
          >
            {alreadyScouting ? "OK" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
