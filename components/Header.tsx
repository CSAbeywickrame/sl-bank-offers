import Link from "next/link";
import { DesktopNav } from "@/components/DesktopNav";
import { MobileMenu } from "@/components/MobileMenu";
import { siteName } from "@/lib/site-config";

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

        <DesktopNav />

        <MobileMenu />
      </div>
    </header>
  );
}
