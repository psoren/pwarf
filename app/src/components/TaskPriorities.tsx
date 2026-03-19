import type { TaskType } from "@pwarf/shared";

/** Task types that can be player-designated (not autonomous) */
const PRIORITY_TASK_TYPES: Array<{ label: string; taskType: TaskType }> = [
  { label: "Mine", taskType: "mine" },
  { label: "Haul", taskType: "haul" },
  { label: "Farm (till)", taskType: "farm_till" },
  { label: "Farm (plant)", taskType: "farm_plant" },
  { label: "Farm (harvest)", taskType: "farm_harvest" },
  { label: "Build Wall", taskType: "build_wall" },
  { label: "Build Floor", taskType: "build_floor" },
  { label: "Build Stairs Up", taskType: "build_stairs_up" },
  { label: "Build Stairs Down", taskType: "build_stairs_down" },
  { label: "Build Stairs Both", taskType: "build_stairs_both" },
];

interface TaskPrioritiesProps {
  priorities: Record<string, number>;
  onChangePriority: (taskType: TaskType, priority: number) => void;
  onClose: () => void;
}

export default function TaskPriorities({ priorities, onChangePriority, onClose }: TaskPrioritiesProps) {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--bg-panel)] border border-[var(--amber)] p-3 min-w-[280px]">
      <div className="flex justify-between items-center mb-2 border-b border-[var(--border)] pb-1">
        <span className="text-[var(--amber)] font-bold text-sm">Task Priorities</span>
        <button
          onClick={onClose}
          className="text-[var(--text)] hover:text-[var(--red,#f87171)] text-xs cursor-pointer"
        >
          [Esc]
        </button>
      </div>
      <p className="text-[var(--text)] text-xs mb-2 opacity-60">
        Higher priority tasks are claimed first (1–10)
      </p>
      <ul className="space-y-0.5">
        {PRIORITY_TASK_TYPES.map(({ label, taskType }) => {
          const value = priorities[taskType] ?? 5;
          return (
            <li key={taskType} className="flex items-center justify-between px-1 py-0.5 text-xs hover:bg-[var(--bg-hover)]">
              <span className="text-[var(--text)]">{label}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onChangePriority(taskType, Math.max(1, value - 1))}
                  className="text-[var(--amber)] hover:text-[var(--green)] cursor-pointer px-1"
                  disabled={value <= 1}
                >
                  -
                </button>
                <span className={`w-4 text-center font-bold ${value >= 8 ? 'text-[var(--green)]' : value <= 3 ? 'text-[var(--red,#f87171)]' : 'text-[var(--text)]'}`}>
                  {value}
                </span>
                <button
                  onClick={() => onChangePriority(taskType, Math.min(10, value + 1))}
                  className="text-[var(--amber)] hover:text-[var(--green)] cursor-pointer px-1"
                  disabled={value >= 10}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
