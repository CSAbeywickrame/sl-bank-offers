import Link from "next/link";

export function EmptyState() {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ border: "1px dashed #c4d3cb", borderRadius: "12px", padding: "64px 24px" }}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: "56px", height: "56px", borderRadius: "9999px", background: "#e9f1ec" }}
      >
        <svg width="28" height="28" fill="none" stroke="#95a89e" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold" style={{ color: "#16201b" }}>
        No offers found
      </h2>
      <p className="mt-1.5 text-sm" style={{ color: "#6a7d73", maxWidth: "360px" }}>
        No offers match your current filters. Try adjusting the bank, category, or search term.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center rounded-lg text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
        style={{ height: "40px", background: "#047857", padding: "0 16px" }}
      >
        Clear filters
      </Link>
    </div>
  );
}
