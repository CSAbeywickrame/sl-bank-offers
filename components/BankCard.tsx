import Link from "next/link";

type BankCardProps = {
  id: string;
  name: string;
  count: number;
};

// Renders a bank directory tile linking to that bank's offers page
export function BankCard({ id, name, count }: BankCardProps) {
  return (
    <Link
      href={`/banks/${id}`}
      aria-label={`${name} — ${count} active offer${count !== 1 ? "s" : ""}`}
      className="group flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-white px-5 py-4 shadow-sm transition-all duration-150 hover:border-neutral-300 hover:shadow-md"
    >
      <div>
        <p className="text-[15px] font-semibold text-[var(--text-strong)]">{name}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {count} active offer{count !== 1 ? "s" : ""}
        </p>
      </div>
      <span className="ml-4 text-sm font-semibold text-emerald-700" aria-hidden="true">
        View →
      </span>
    </Link>
  );
}
