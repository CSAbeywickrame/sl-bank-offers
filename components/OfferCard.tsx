import Link from "next/link";
import { getCategoryLabel } from "@/lib/offers/categories";
import type { Offer } from "@/lib/offers/types";

function formatDate(value: string | undefined): string {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function isExpiringSoon(validUntil: string | undefined): boolean {
  if (!validUntil) return false;
  const date = new Date(validUntil);
  if (!Number.isFinite(date.getTime())) return false;
  const daysRemaining = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysRemaining >= 0 && daysRemaining <= 14;
}

export function OfferCard({ offer }: { offer: Offer }) {
  const expiringSoon = isExpiringSoon(offer.validUntil);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-150 hover:border-neutral-300 hover:shadow-md" style={{ borderColor: "#dde7e1" }}>
      {/* Emerald-to-gold top rule */}
      <div style={{ height: "4px", background: "linear-gradient(90deg, #059669, #c99a2e)", flexShrink: 0 }} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "#e3f1ea", color: "#065f46", boxShadow: "inset 0 0 0 1px #d1fae5" }}
          >
            {offer.bankName}
          </span>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "#fffbeb", color: "#92400e", boxShadow: "inset 0 0 0 1px #fef3c7" }}
          >
            {getCategoryLabel(offer.category)}
          </span>
          {expiringSoon && (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "#fef2f2", color: "#b91c1c", boxShadow: "inset 0 0 0 1px #fee2e2" }}
            >
              Expiring soon
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          {offer.merchant && (
            <p className="mb-1 text-xs font-semibold uppercase" style={{ color: "#047857", letterSpacing: "0.04em" }}>
              {offer.merchant}
            </p>
          )}
          <h2 className="text-base font-semibold leading-snug transition-colors duration-150 group-hover:text-emerald-700" style={{ color: "#16201b" }}>
            {offer.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: "#6a7d73" }}>
            {offer.description}
          </p>
        </div>

        {/* Validity grid */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg text-xs" style={{ background: "#e9f1ec", padding: "10px 12px" }}>
          <div>
            <dt className="font-semibold" style={{ color: "#16201b" }}>Valid until</dt>
            <dd style={{ color: expiringSoon ? "#dc2626" : "#3b4a43" }}>{formatDate(offer.validUntil)}</dd>
          </div>
          <div>
            <dt className="font-semibold" style={{ color: "#16201b" }}>Last checked</dt>
            <dd style={{ color: "#3b4a43" }}>{formatDate(offer.lastCheckedAt)}</dd>
          </div>
        </dl>

        {/* CTA row */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex flex-1 items-center justify-center rounded-lg text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#0d3a29]"
            href={`/offers/${offer.id}`}
            style={{ height: "40px", background: "#08271c", padding: "0 16px" }}
          >
            View details
          </Link>
          <a
            className="inline-flex flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150 hover:bg-emerald-50"
            href={offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{ height: "40px", border: "1px solid #047857", color: "#047857", padding: "0 16px" }}
          >
            View at bank
          </a>
        </div>
      </div>
    </article>
  );
}
