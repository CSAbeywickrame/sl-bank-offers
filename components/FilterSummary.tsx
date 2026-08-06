import { Close } from "@/components/ui/icon";

export type FilterChipData = { id: string; label: string; onRemove: () => void };

interface FilterSummaryProps {
  resultCount?: number;
  resultLabel?: string;
  chips: FilterChipData[];
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

// Renders a single removable filter pill with a circular "remove" hit target
function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1 text-[13px] font-semibold"
      style={{ background: "var(--badge-bank-bg)", color: "var(--badge-bank-fg)" }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.08] text-inherit transition-colors hover:bg-black/15"
      >
        <Close size={12} />
      </button>
    </span>
  );
}

// Shows the active result count plus a row of removable filter chips
export function FilterSummary({ resultCount, resultLabel = "offers", chips }: FilterSummaryProps) {
  if (chips.length === 0 && resultCount == null) return null;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {resultCount != null && (
        <p className="m-0 text-sm text-[var(--text-body)]">
          <b className="font-bold text-[var(--text-strong)]">
            {resultCount.toLocaleString()} {resultLabel}
          </b>
        </p>
      )}
      {chips.map((chip) => (
        <FilterChip key={chip.id} label={chip.label} onRemove={chip.onRemove} />
      ))}
    </div>
  );
}
