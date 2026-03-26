export function needBar(label: string, value: number, color: string) {
  const pct = Math.round(value);
  const barColor = value < 25 ? "var(--red, #f87171)" : color;
  return (
    <div className="flex items-center gap-1">
      <span className="w-14 text-[var(--text)]">{label}</span>
      <div className="flex-1 h-2 bg-[#333] rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="w-8 text-right" style={{ color: barColor }}>{pct}</span>
    </div>
  );
}
