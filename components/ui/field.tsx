import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "@/components/ui/icon";

// Shared control shell for every 40px form field: inputs, native selects, and the
// popover triggers that have to sit flush with them on the filter row.
// Focus recolors the border; the global *:focus-visible rule supplies the ring.
export const fieldClass =
  "h-10 w-full rounded-md border border-(--border-default) bg-(--surface-card) px-3 text-sm text-(--text-strong) transition-colors duration-(--motion-fast) focus:border-(--border-focus) disabled:opacity-60";

// Uppercase micro-label sitting above a field
export const labelClass = "text-xs font-semibold uppercase tracking-(--ls-wide) text-(--text-muted)";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  /** Icon rendered inside the field's leading edge (e.g. a magnifier) */
  iconLeft?: ReactNode;
  className?: string;
};

// Text input matching the design system's filter/search field
export function Input({ iconLeft, className, ...rest }: InputProps) {
  const input = (
    <input
      className={[fieldClass, "placeholder:text-(--text-faint)", iconLeft && "pl-9", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );

  if (!iconLeft) return input;

  return (
    <span className="relative flex min-w-0 flex-1 items-center">
      <span className="pointer-events-none absolute left-3 inline-flex text-(--text-faint)">{iconLeft}</span>
      {input}
    </span>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
  className?: string;
  children: ReactNode;
};

// Native select styled to match the filter bar, with the design system's custom chevron
// replacing the platform one so it reads as a sibling of the multi-select triggers.
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <span className="relative flex items-center">
      <select
        className={[fieldClass, "cursor-pointer appearance-none pr-9", className].filter(Boolean).join(" ")}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 text-(--text-muted)" />
    </span>
  );
}
