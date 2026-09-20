import Link from "next/link";

type BankCardProps = {
  id: string;
  name: string;
  count: number;
  /** Highest advertised discount across the bank's live offers, when any states one. */
  bestDiscountPct?: number;
  /** When this bank's offers were last confirmed against its own site. */
  lastCheckedAt?: string;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date)
    : "";
}

// Renders a bank directory tile linking to that bank's offers page
export function BankCard({ id, name, count, bestDiscountPct, lastCheckedAt }: BankCardProps) {
  const checked = lastCheckedAt ? formatDate(lastCheckedAt) : "";

  return (
    <Link
      href={`/banks/${id}`}
      aria-label={`${name} — ${count} active offer${count !== 1 ? "s" : ""}${bestDiscountPct !== undefined ? `, best ${bestDiscountPct}% off` : ""}`}
      className="group flex items-center justify-between rounded-lg border border-(--border-subtle) bg-(--surface-card) px-5 py-4 shadow-sm transition-[box-shadow,border-color,transform] duration-(--motion-fast) ease-out hover:-translate-y-0.5 hover:border-(--border-default) hover:shadow-md motion-reduce:hover:translate-y-0"
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-(--text-strong)">{name}</p>
        <p className="mt-0.5 text-xs text-(--text-muted)">
          {count} active offer{count !== 1 ? "s" : ""}
          {/* Freshness belongs on the directory, not just the offer: it is what tells a reader
              whether a bank with few offers is quiet or simply stale. */}
          {checked && <> · checked {checked}</>}
        </p>
      </div>
      {/* The best available saving, so the directory ranks by what a bank is worth rather than by
          how many offers it happens to publish. */}
      {bestDiscountPct !== undefined ? (
        <span className="ml-4 shrink-0 text-right">
          <span className="block text-lg font-bold leading-none text-(--text-link)">{bestDiscountPct}%</span>
          <span className="mt-0.5 block text-[11px] text-(--text-muted)">best</span>
        </span>
      ) : (
        <span className="ml-4 whitespace-nowrap text-sm font-semibold text-(--text-link)" aria-hidden="true">
          View →
        </span>
      )}
    </Link>
  );
}
