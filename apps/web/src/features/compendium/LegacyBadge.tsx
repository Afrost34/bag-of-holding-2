/** Marks content superseded by a newer printing (usually 2014 rules reprinted in 2024). */
export function LegacyBadge() {
  return (
    <span
      title="Replaced by a newer version"
      className="rounded bg-sunken px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted"
    >
      Legacy
    </span>
  );
}
