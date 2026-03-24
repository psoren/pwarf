import type { Monster } from "@pwarf/shared";
import { EntityModal, statBar } from "./EntityModal";

interface MonsterModalProps {
  monster: Monster;
  onClose: () => void;
  onGoTo?: (x: number, y: number) => void;
}

export function MonsterModal({ monster, onClose, onGoTo }: MonsterModalProps) {
  const typeLabel = monster.type.replace(/_/g, " ");
  const behaviorLabel = monster.behavior.replace(/_/g, " ");
  const loreText = monster.origin_myth ?? monster.lore ?? null;

  return (
    <EntityModal onClose={onClose}>
      <div className="-mt-2 mb-2">
        <h2 className="text-[var(--green)] font-bold text-sm">{monster.name}</h2>
        {monster.epithet && (
          <div className="text-[var(--amber)] italic text-xs">{monster.epithet}</div>
        )}
      </div>

      <div className="text-[var(--text)] mb-2">
        <span className="capitalize">{typeLabel}</span>
        <span className="text-[var(--border)]"> — </span>
        <span className="capitalize text-[var(--amber)]">{behaviorLabel}</span>
      </div>

      <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-1">
        {statBar("HP", monster.health, 100, "var(--green)")}
        {statBar("Threat", monster.threat_level, 10, "#ff6600")}
      </div>

      {monster.current_tile_x !== null && monster.current_tile_y !== null && (
        <div className="text-[var(--text)] flex items-center justify-between border-t border-[var(--border)] pt-2 mt-2">
          <span>
            Pos: <span className="text-[var(--green)]">({monster.current_tile_x}, {monster.current_tile_y})</span>
          </span>
          {onGoTo && (
            <button
              onClick={() => onGoTo(monster.current_tile_x!, monster.current_tile_y!)}
              className="text-[var(--amber)] hover:text-[var(--green)] cursor-pointer"
            >
              Go to
            </button>
          )}
        </div>
      )}

      {monster.size_category && (
        <div className="text-[var(--text)] border-t border-[var(--border)] pt-2 mt-2">
          Size: <span className="text-[var(--green)] capitalize">{monster.size_category}</span>
        </div>
      )}

      {loreText && (
        <div className="border-t border-[var(--border)] pt-2 mt-2">
          <div className="text-[var(--text)] opacity-60 line-clamp-3 text-[10px] leading-snug">
            {loreText}
          </div>
        </div>
      )}
    </EntityModal>
  );
}
