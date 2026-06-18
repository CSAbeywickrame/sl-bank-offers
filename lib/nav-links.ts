export const navLinks = [
  { href: "/", label: "All Offers" },
  { href: "/banks", label: "Browse Banks" },
  { href: "/categories", label: "View Categories" },
] as const;

export function isActivePath(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
