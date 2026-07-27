import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonClassesArgs = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

// Joins class name fragments, filtering out any falsy or empty values
function joinClasses(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// Builds the Tailwind class string for a button-styled element (button, link, or anchor)
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonClassesArgs): string {
  const base =
    "inline-flex items-center justify-center rounded-md font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses: Record<ButtonVariant, string> = {
    primary: "bg-navy-900 text-white hover:bg-navy-800",
    accent: "bg-emerald-700 text-white hover:bg-emerald-800",
    outline: "bg-white text-emerald-700 border border-emerald-700 hover:bg-emerald-50",
    ghost: "text-[var(--text-body)] hover:bg-neutral-100",
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-[13px]",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
  };

  return joinClasses(base, variantClasses[variant], sizeClasses[size], fullWidth ? "w-full" : undefined, className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

// Renders a styled <button> sharing classes with Link/anchor via buttonClasses
export function Button({ variant, size, fullWidth, className, type, children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClasses({ variant, size, fullWidth, className })} type={type ?? "button"} {...rest}>
      {children}
    </button>
  );
}
