import type { ReactNode } from "react";

type StatTileProps = {
  value: ReactNode;
  label: string;
  className?: string;
};

// Renders a single stat panel (value + label) for the dark navy hero band
export function StatTile({ value, label, className }: StatTileProps) {
  return (
    <div className={`rounded-xl border border-white/[0.12] bg-white/[0.06] px-5 py-4 text-center sm:text-left ${className ?? ""}`}>
      <span className="block text-[30px] font-bold text-white">{value}</span>
      <span className="mt-0.5 block text-sm text-white/[0.78]">{label}</span>
    </div>
  );
}
