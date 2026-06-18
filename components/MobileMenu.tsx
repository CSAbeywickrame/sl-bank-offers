"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navLinks = [
  { href: "/", label: "All Offers" },
  { href: "/banks", label: "Browse Banks" },
  { href: "/categories", label: "View Categories" },
] as const;

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const enterTimer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(enterTimer);
    } else {
      setIsAnimating(false);
      const exitTimer = setTimeout(() => setIsMounted(false), 300);
      return () => clearTimeout(exitTimer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-nav"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
          isOpen ? "bg-[#08271c]/10" : "hover:bg-neutral-100"
        }`}
        style={{ color: "#3b4a43" }}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M4 4l12 12M4 16L16 4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {isMounted && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className={`fixed left-0 right-0 bottom-0 z-50 flex flex-col justify-center gap-3 transition-all duration-300 ease-out p-3 ${
            isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ top: "64px", backgroundColor: "#08271c", height: "100vh" }}
        >
          {navLinks.map(({ href, label }, index) => {
            const isActive = pathname === href;
            return (
              <div
                key={href}
                className={`flex flex-col items-center transition-all duration-300 ease-out ${
                  isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                }`}
                style={{ transitionDelay: `${index * 75}ms` }}
              >
                <Link
                  href={href}
                  className="text-2xl font-light tracking-wide"
                  style={{ color: isActive ? "#d4af5f" : "rgba(255,255,255,0.75)" }}
                >
                  {label}
                </Link>
                {isActive && (
                  <span
                    style={{
                      display: "block",
                      width: "40px",
                      height: "2px",
                      backgroundColor: "#d4af5f",
                      borderRadius: "1px",
                      marginTop: "6px",
                    }}
                  />
                )}
              </div>
            );
          })}
        </nav>
      )}
    </div>
  );
}
