import Link from "next/link";
import { siteName } from "@/lib/site-config";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" aria-label={siteName}>
          <img
            src="/brand/sl-card-offers-logo.png"
            alt={siteName}
            className="block h-auto w-[140px] sm:w-[180px]"
          />
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            All Offers
          </Link>
          <Link
            href="/banks"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            Browse Banks
          </Link>
        </nav>
      </div>
    </header>
  );
}
