"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PAGE_SIZE_OPTIONS,
  buildUpdatedQueryString,
  getVisiblePageNumbers,
} from "@/lib/offers/pagination";
import { Select } from "@/components/ui/field";

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
  minWidth: "var(--control-h)",
  height: "var(--control-h)",
  borderRadius: "var(--radius-pill)",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--border-default)",
  background: "var(--surface-card)",
  color: "var(--text-strong)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "var(--fs-body)",
  fontWeight: "var(--fw-semibold)",
  padding: "0 14px",
  transition: "background-color var(--motion-fast) ease, border-color var(--motion-fast) ease, color var(--motion-fast) ease",
};

const currentPagePillStyle: React.CSSProperties = {
  ...pillStyle,
  borderColor: "var(--action-accent-bg)",
  background: "var(--action-accent-bg)",
  color: "var(--action-accent-fg)",
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
    <div className="grid gap-4 rounded-lg border border-(--border-subtle) bg-(--surface-card) px-4 py-4 shadow-sm sm:px-5">
      {!navOnly && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-(--ls-wider) text-(--text-muted)">
              Results
            </p>
            <p className="mt-1 text-sm font-medium text-(--text-strong)">
              Showing {startIndex.toLocaleString()}-{endIndex.toLocaleString()} of {totalItems.toLocaleString()} offers
            </p>
            <p className="mt-1 text-sm text-(--text-muted)">
              Page {page} of {totalPages}
            </p>
          </div>

          <label className="grid gap-1 text-sm font-medium text-(--text-strong) sm:w-[180px]">
            <span className="text-xs font-semibold uppercase tracking-(--ls-wider) text-(--text-muted)">
              Offers per page
            </span>
            <Select
              aria-label="Offers per page"
              value={String(pageSize)}
              onChange={(event) => handlePageSizeChange(event.target.value)}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} offers
                </option>
              ))}
            </Select>
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
                className="inline-flex h-10 items-center justify-center px-1 text-sm font-semibold text-(--text-muted)"
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
                style={token === page ? currentPagePillStyle : pillStyle}
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
