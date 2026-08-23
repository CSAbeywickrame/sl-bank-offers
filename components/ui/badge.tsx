import type { ReactNode } from "react";

export type BadgeTone = "bank" | "category" | "expiry" | "premium" | "neutral" | "success";

type BadgeProps = {
  tone?: BadgeTone;
  /** Renders a small currentColor status dot before the label */
  dot?: boolean;
  children: ReactNode;
  className?: string;
};

// Renders a pill-shaped label colored via the --badge-<tone>-{bg,fg,ring} CSS vars
export function Badge({ tone = "neutral", dot = false, children, className }: BadgeProps) {
  const classes = [
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold leading-[1.4]",
    className,
  ]
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
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
