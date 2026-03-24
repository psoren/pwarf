import type { TaskType } from "@pwarf/shared";

export type BuildOption = {
  label: string;
  key: string;
  taskType: TaskType;
};

const BUILD_OPTIONS: BuildOption[] = [
  { label: "Wall", key: "w", taskType: "build_wall" },
  { label: "Floor", key: "f", taskType: "build_floor" },
  { label: "Bed", key: "e", taskType: "build_bed" },
  { label: "Well", key: "l", taskType: "build_well" },
  { label: "Mushroom Garden", key: "m", taskType: "build_mushroom_garden" },
  { label: "Door", key: "d", taskType: "build_door" },
];

interface BuildMenuProps {
  onSelect: (taskType: TaskType) => void;
  onClose: () => void;
}

export default function BuildMenu({ onSelect, onClose }: BuildMenuProps) {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--bg-panel)] border border-[var(--amber)] p-3 min-w-[200px]">
      <div className="flex justify-between items-center mb-2 border-b border-[var(--border)] pb-1">
        <span className="text-[var(--amber)] font-bold text-sm">Build</span>
        <button
          onClick={onClose}
          className="text-[var(--text)] hover:text-[var(--red,#f87171)] text-xs cursor-pointer"
        >
          [Esc]
        </button>
      </div>
      <ul className="space-y-0.5">
        {BUILD_OPTIONS.map((opt) => (
          <li key={opt.taskType}>
            <button
              onClick={() => onSelect(opt.taskType)}
              className="w-full text-left px-1 py-0.5 text-xs text-[var(--text)] hover:bg-[var(--bg-hover)] hover:text-[var(--green)] cursor-pointer"
            >
              <kbd className="text-[var(--amber)] mr-2">{opt.key}</kbd>
              {opt.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { BUILD_OPTIONS };
