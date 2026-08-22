import type { ReactNode } from "react";

type StatTileProps = {
  value: ReactNode;
  label: string;
  className?: string;
};

// Renders a single stat panel (value + label) for the dark navy hero band.
// Deliberately server-rendered: the design system's count-up variant would have to ship
// "0" in the server HTML for a headline statistic, which we would rather not do.
export function StatTile({ value, label, className }: StatTileProps) {
  return (
    <div
      className={`rounded-lg border border-white/[0.12] bg-white/[0.06] px-5 py-4 text-center sm:text-left ${className ?? ""}`}
    >
      <span className="block text-[30px] font-bold leading-[1.1] tabular-nums text-(--text-on-inverse)">{value}</span>
      <span className="mt-0.5 block text-sm text-(--text-on-inverse-muted)">{label}</span>
    </div>
  );
}
