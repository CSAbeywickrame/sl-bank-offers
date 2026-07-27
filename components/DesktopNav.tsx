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
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-emerald-50 font-semibold text-emerald-700"
                : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
