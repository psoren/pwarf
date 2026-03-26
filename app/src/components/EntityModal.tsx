import { useEffect, type ReactNode } from "react";

interface EntityModalProps {
  title: string;
  titleColor?: string;
  onClose: () => void;
  children: ReactNode;
}

export function EntityModal({ title, titleColor = "var(--green)", onClose, children }: EntityModalProps) {
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
          <h2 className="font-bold text-sm" style={{ color: titleColor }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text)] hover:text-[var(--amber)] cursor-pointer"
          >
            [Esc]
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
