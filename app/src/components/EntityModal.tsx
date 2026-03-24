import { useEffect, type ReactNode } from "react";

interface EntityModalProps {
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function EntityModal({ onClose, children, title }: EntityModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-panel)] border border-[var(--amber)] p-4 min-w-[280px] max-w-[360px] text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          {title && (
            <h2 className="text-[var(--amber)] font-bold text-sm">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="text-[var(--text)] hover:text-[var(--amber)] cursor-pointer ml-auto"
          >
            [Esc]
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function statBar(label: string, value: number, max: number, color: string) {
  const pct = Math.round((value / max) * 100);
  const clampedPct = Math.min(100, Math.max(0, pct));
  const barColor = value < max * 0.25 ? "var(--red, #f87171)" : color;
  return (
    <div className="flex items-center gap-1">
      <span className="w-14 text-[var(--text)]">{label}</span>
      <div className="flex-1 h-2 bg-[#333] rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${clampedPct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="w-8 text-right" style={{ color: barColor }}>{Math.round(value)}</span>
    </div>
  );
}
