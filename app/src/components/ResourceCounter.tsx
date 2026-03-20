import type { Item } from "@pwarf/shared";

interface ResourceCounterProps {
  items: Item[];
}

export default function ResourceCounter({ items }: ResourceCounterProps) {
  // Aggregate counts by item name (only raw_material category for now)
  const counts = new Map<string, number>();
  for (const item of items) {
    const prev = counts.get(item.name) ?? 0;
    counts.set(item.name, prev + 1);
  }

  if (counts.size === 0) return null;

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <span className="text-[var(--text)]">
      {entries.map(([name, count], i) => (
        <span key={name}>
          {i > 0 && <span className="text-[var(--border)]"> | </span>}
          <span className="text-[var(--amber)]">{name}:</span> {count}
        </span>
      ))}
    </span>
  );
}
