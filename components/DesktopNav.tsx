"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, navLinks } from "@/lib/nav-links";

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
      {navLinks.map(({ href, label }) => {
        const active = isActivePath(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-sm border px-3.5 py-2 text-sm font-semibold transition-colors duration-(--motion-fast) ${
              active
                ? "border-emerald-100 bg-emerald-50 text-(--text-link)"
                : "border-transparent text-(--text-body) hover:bg-(--surface-muted) hover:text-(--text-strong)"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
