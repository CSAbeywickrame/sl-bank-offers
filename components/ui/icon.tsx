import type { ReactNode } from "react";

// Shared prop shape for every icon in this file
export interface IconProps {
  className?: string;
  size?: number;
}

interface IconBaseProps extends IconProps {
  children: ReactNode;
}

// Renders the shared 16x16 stroke-icon SVG shell, appending the caller's className to the default
function IconBase({ size = 16, className, children }: IconBaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ? `shrink-0 ${className}` : "shrink-0"}
    >
      {children}
    </svg>
  );
}

// Downward chevron, used on dropdown and expand/collapse triggers
export function ChevronDown(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.33 6L8 10.67l4.67-4.67" />
    </IconBase>
  );
}

// Checkmark, used to indicate a selected or completed state
export function Check(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.5 8.5l3 3 6-7" />
    </IconBase>
  );
}

// Diagonal cross, used on dismiss and delete/remove buttons
export function Close(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </IconBase>
  );
}

// Ribbon-style bookmark, used for saved-filter affordances
export function Bookmark(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 3h8v10l-4-2.5L4 13V3z" />
    </IconBase>
  );
}

// Magnifying glass, used for search affordances
export function Search(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="7" cy="7" r="4" />
      <path d="M13 13l-3-3" />
    </IconBase>
  );
}
