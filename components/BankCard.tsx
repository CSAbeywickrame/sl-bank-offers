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
      className="group flex items-center justify-between rounded-lg border border-(--border-subtle) bg-(--surface-card) px-5 py-4 shadow-sm transition-[box-shadow,border-color,transform] duration-(--motion-fast) ease-out hover:-translate-y-0.5 hover:border-(--border-default) hover:shadow-md motion-reduce:hover:translate-y-0"
    >
      <div>
        <p className="text-[15px] font-semibold text-(--text-strong)">{name}</p>
        <p className="mt-0.5 text-xs text-(--text-muted)">
          {count} active offer{count !== 1 ? "s" : ""}
        </p>
      </div>
      <span className="ml-4 whitespace-nowrap text-sm font-semibold text-(--text-link)" aria-hidden="true">
        View →
      </span>
    </Link>
  );
}
