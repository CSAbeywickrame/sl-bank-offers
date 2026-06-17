"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PAGE_SIZE_OPTIONS,
  buildUpdatedQueryString,
  getVisiblePageNumbers,
} from "@/lib/offers/pagination";

interface OfferPaginationProps {
  actionPath: string;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  navOnly?: boolean;
}

const pillStyle: React.CSSProperties = {
  minWidth: "40px",
  height: "40px",
  borderRadius: "9999px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#c4d3cb",
  background: "#fff",
  color: "#16201b",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "14px",
  fontWeight: 600,
  padding: "0 14px",
  transition: "all 150ms ease",
};

export function OfferPagination({
  actionPath,
  page,
  pageSize,
  totalItems,
  totalPages,
  startIndex,
  endIndex,
  navOnly = false,
}: OfferPaginationProps) {
  if (navOnly && totalPages <= 1) return null;
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageTokens = getVisiblePageNumbers(page, totalPages);

  function getPageHref(targetPage: number): string {
    const query = buildUpdatedQueryString(new URLSearchParams(searchParams.toString()), {
      page: String(targetPage),
      pageSize: String(pageSize),
    });

    return query ? `${actionPath}?${query}` : actionPath;
  }

  function handlePageSizeChange(nextPageSize: string) {
    const query = buildUpdatedQueryString(
      new URLSearchParams(searchParams.toString()),
      {
        pageSize: nextPageSize,
      },
      { resetPage: true },
    );

    router.push((query ? `${actionPath}?${query}` : actionPath) as Route);
  }

  return (
    <div
      className="grid gap-4 rounded-2xl border px-4 py-4 sm:px-5"
      style={{ borderColor: "#dde7e1", background: "#fff", boxShadow: "0 1px 2px rgb(15 23 42 / 5%)" }}
    >
      {!navOnly && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "#6a7d73" }}>
              Results
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: "#16201b" }}>
              Showing {startIndex.toLocaleString()}-{endIndex.toLocaleString()} of {totalItems.toLocaleString()} offers
            </p>
            <p className="mt-1 text-sm" style={{ color: "#6a7d73" }}>
              Page {page} of {totalPages}
            </p>
          </div>

          <label className="grid gap-1 text-sm font-medium sm:w-[180px]" style={{ color: "#16201b" }}>
            <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "#6a7d73" }}>
              Offers per page
            </span>
            <select
              aria-label="Offers per page"
              value={String(pageSize)}
              onChange={(event) => handlePageSizeChange(event.target.value)}
              className="h-10 rounded-md border px-3 text-sm"
              style={{ borderColor: "#c4d3cb", background: "#fff", color: "#16201b" }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} offers
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Offer pagination" className="flex flex-wrap justify-center gap-2">
          {/* {page > 1 && (
            <Link
              href={getPageHref(page - 1) as Route}
              className="inline-flex items-center justify-center rounded-full text-sm font-semibold"
              style={pillStyle}
            >
              Prev
            </Link>
          )} */}

          {pageTokens.map((token, index) =>
            token === "ellipsis" ? (
              <span
                key={`ellipsis-${page}-${index}`}
                className="inline-flex h-10 items-center justify-center px-1 text-sm font-semibold"
                style={{ color: "#6a7d73" }}
              >
                ...
              </span>
            ) : (
              <Link
                key={token}
                href={getPageHref(token) as Route}
                aria-current={token === page ? "page" : undefined}
                aria-label={`Page ${token}`}
                className="inline-flex items-center justify-center rounded-full text-sm font-semibold"
                style={
                  token === page
                    ? {
                        ...pillStyle,
                        borderColor: "#047857",
                        background: "#047857",
                        color: "#fff",
                      }
                    : pillStyle
                }
              >
                {token}
              </Link>
            ),
          )}

          {/* {page < totalPages && (
            <Link
              href={getPageHref(page + 1) as Route}
              className="inline-flex items-center justify-center rounded-full text-sm font-semibold"
              style={pillStyle}
            >
              Next
            </Link>
          )} */}
        </nav>
      )}
    </div>
  );
}
