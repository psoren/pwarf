import type { Monster } from "@pwarf/shared";
import { EntityModal } from "./EntityModal";
import { needBar } from "./needBar";

interface MonsterModalProps {
  monster: Monster;
  onClose: () => void;
  onGoTo: (monster: Monster) => void;
}

function threatColor(level: number): string {
  if (level >= 8) return "#ff2222";
  if (level >= 5) return "#ff6600";
  if (level >= 3) return "var(--amber)";
  return "var(--green)";
}

export function MonsterModal({ monster, onClose, onGoTo }: MonsterModalProps) {
  const displayName = monster.epithet
    ? `${monster.name} "${monster.epithet}"`
    : monster.name;

  return (
    <EntityModal title={displayName} titleColor="#ff2222" onClose={onClose}>
      <div className="text-[var(--text)] mb-1 flex gap-3">
        <span>Type: <span className="text-[var(--green)] capitalize">{monster.type}</span></span>
        <span>Size: <span className="text-[var(--green)] capitalize">{monster.size_category}</span></span>
      </div>

      <div className="text-[var(--text)] mb-1 flex gap-3">
        <span>Behavior: <span className="text-[var(--green)] capitalize">{monster.behavior}</span></span>
        <span>Status: <span className={monster.status === "active" ? "text-[var(--green)]" : "text-[#f87171]"} >{monster.status}</span></span>
      </div>

      {monster.current_tile_x !== null && monster.current_tile_y !== null && (
        <div className="text-[var(--text)] flex items-center justify-between mb-2">
          <span>
            Pos: <span className="text-[var(--green)]">({monster.current_tile_x}, {monster.current_tile_y})</span>
          </span>
          <button
            onClick={() => onGoTo(monster)}
            className="text-[var(--amber)] hover:text-[var(--green)] cursor-pointer"
          >
            Go to
          </button>
        </div>
      )}

      <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-1">
        <div className="text-[var(--amber)] font-bold mb-0.5">Health</div>
        {needBar("HP", monster.health, "var(--green)")}
      </div>

      <div className="border-t border-[var(--border)] pt-2 mt-2">
        <div className="text-[var(--amber)] font-bold mb-0.5">Threat</div>
        <div className="flex items-center gap-1">
          <span className="w-14 text-[var(--text)]">Level</span>
          <span className="font-bold" style={{ color: threatColor(monster.threat_level) }}>
            {monster.threat_level}
          </span>
        </div>
      </div>

      {monster.lore && (
        <div className="border-t border-[var(--border)] pt-2 mt-2">
          <div className="text-[var(--amber)] font-bold mb-0.5">Lore</div>
          <p className="text-[var(--text)] italic">{monster.lore}</p>
        </div>
      )}

      {monster.first_seen_year !== null && (
        <div className="border-t border-[var(--border)] pt-2 mt-2 text-[var(--text)]">
          First seen: year {monster.first_seen_year}
        </div>
      )}

      {monster.slain_year !== null && (
        <div className="text-[#f87171] mt-1">
          Slain in year {monster.slain_year}
        </div>
      )}
    </EntityModal>
  );
}
