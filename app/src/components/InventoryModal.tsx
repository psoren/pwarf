import { useEffect } from "react";
import type { Item, ItemCategory } from "@pwarf/shared";
import type { LiveDwarf } from "../hooks/useDwarves";

interface InventoryModalProps {
  items: Item[];
  dwarves: LiveDwarf[];
  onClose: () => void;
}

const CATEGORY_ORDER: ItemCategory[] = [
  'raw_material', 'food', 'drink', 'tool', 'weapon', 'armor',
  'crafted', 'gem', 'furniture', 'cloth', 'mechanism', 'book', 'container',
];

function groupByCategory(items: Item[]): Map<ItemCategory, Item[]> {
  const map = new Map<ItemCategory, Item[]>();
  for (const item of items) {
    const bucket = map.get(item.category) ?? [];
    bucket.push(item);
    map.set(item.category, bucket);
  }
  return map;
}

function countByName(items: Item[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function CategorySection({ category, items }: { category: ItemCategory; items: Item[] }) {
  const entries = countByName(items);
  return (
    <div className="mb-2">
      <div className="text-[var(--amber)] font-bold capitalize mb-0.5">
        {category.replace(/_/g, ' ')} ({items.length})
      </div>
      <ul className="space-y-0.5 pl-2">
        {entries.map(([name, count]) => (
          <li key={name} className="flex justify-between">
            <span className="text-[var(--green)]">{name}</span>
            <span className="text-[var(--text)]">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InventoryModal({ items, dwarves, onClose }: InventoryModalProps) {
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

  const stockpileItems = items.filter(i => i.held_by_dwarf_id === null);
  const carriedItems = items.filter(i => i.held_by_dwarf_id !== null);

  const stockpileByCategory = groupByCategory(stockpileItems);
  const orderedStockpileCategories = CATEGORY_ORDER.filter(c => stockpileByCategory.has(c));

  const dwarfMap = new Map(dwarves.map(d => [d.id, d]));
  const carriedByDwarf = new Map<string, Item[]>();
  for (const item of carriedItems) {
    const bucket = carriedByDwarf.get(item.held_by_dwarf_id!) ?? [];
    bucket.push(item);
    carriedByDwarf.set(item.held_by_dwarf_id!, bucket);
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-panel)] border border-[var(--amber)] p-4 w-[480px] max-h-[70vh] flex flex-col text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[var(--green)] font-bold text-sm">Inventory</h2>
          <button
            onClick={onClose}
            className="text-[var(--text)] hover:text-[var(--amber)] cursor-pointer"
          >
            [Esc]
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4">
          {/* Stockpile */}
          <div>
            <div className="text-[var(--amber)] font-bold text-sm border-b border-[var(--border)] pb-1 mb-2">
              Stockpile ({stockpileItems.length})
            </div>
            {stockpileItems.length === 0 ? (
              <div className="text-[var(--text)] opacity-50">Nothing in stockpile.</div>
            ) : (
              orderedStockpileCategories.map(cat => (
                <CategorySection key={cat} category={cat} items={stockpileByCategory.get(cat)!} />
              ))
            )}
          </div>

          {/* Carried by dwarves */}
          <div>
            <div className="text-[var(--amber)] font-bold text-sm border-b border-[var(--border)] pb-1 mb-2">
              Carried by dwarves ({carriedItems.length})
            </div>
            {carriedItems.length === 0 ? (
              <div className="text-[var(--text)] opacity-50">No dwarves carrying items.</div>
            ) : (
              [...carriedByDwarf.entries()].map(([dwarfId, dwarfItems]) => {
                const dwarf = dwarfMap.get(dwarfId);
                const name = dwarf
                  ? `${dwarf.name}${dwarf.surname ? ` ${dwarf.surname}` : ''}`
                  : "Unknown";
                return (
                  <div key={dwarfId} className="mb-2">
                    <div className="text-[var(--green)] font-bold mb-0.5">{name}</div>
                    <ul className="space-y-0.5 pl-2">
                      {dwarfItems.map(item => (
                        <li key={item.id} className="flex justify-between">
                          <span className="text-[var(--text)]">{item.name}</span>
                          <span className="text-[var(--text)] opacity-60 capitalize">{item.category.replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
