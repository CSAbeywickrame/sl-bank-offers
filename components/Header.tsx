import Link from "next/link";
import { siteName } from "@/lib/site-config";

// Site-wide sticky header with logo and main navigation
export function Header() {
  return (
    <header
      className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-sm"
      style={{ borderColor: "#dde7e1" }}
    >
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
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            style={{ color: "#3b4a43" }}
          >
            All Offers
          </Link>
          <Link
            href="/banks"
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            style={{ color: "#3b4a43" }}
          >
            Browse Banks
          </Link>
        </nav>
      </div>
    </header>
  );
}
