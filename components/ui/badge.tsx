import type { ReactNode } from "react";

export type BadgeTone = "bank" | "category" | "expiry" | "premium" | "neutral" | "success";

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

// Renders a pill-shaped label colored via the --badge-<tone>-{bg,fg,ring} CSS vars
export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  const classes = ["inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      style={{
        background: `var(--badge-${tone}-bg)`,
        color: `var(--badge-${tone}-fg)`,
        boxShadow: `inset 0 0 0 1px var(--badge-${tone}-ring)`,
      }}
    >
      {children}
    </span>
  );
}
