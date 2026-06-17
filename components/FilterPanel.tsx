"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { categories } from "@/lib/offers/categories";
import { buildUpdatedQueryString } from "@/lib/offers/pagination";
import type { Bank, Card, OfferCategory } from "@/lib/offers/types";

interface FilterPanelProps {
  banks: Bank[];
  cards: Card[];
  selectedBankId?: string;
  selectedCardId?: string;
  selectedCategory?: OfferCategory;
  search?: string;
  actionPath?: string;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  height: "40px",
  borderRadius: "8px",
  border: "1px solid #c4d3cb",
  background: "#fff",
  padding: "0 12px",
  fontSize: "14px",
  color: "#16201b",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6a7d73",
};

export function FilterPanel({
  banks,
  cards,
  selectedBankId = "",
  selectedCardId = "",
  selectedCategory,
  search = "",
  actionPath = "/",
}: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const availableCards = selectedBankId ? cards.filter((c) => c.bankId === selectedBankId) : cards;
  const bankById = Object.fromEntries(banks.map((b) => [b.id, b]));
  const activeFilterCount = [selectedBankId, selectedCardId, selectedCategory, search].filter(Boolean).length;

  function pushFilter(overrides: Partial<{ bank: string; card: string; category: string; search: string }>) {
    const query = buildUpdatedQueryString(
      new URLSearchParams(searchParams.toString()),
      {
        bank: selectedBankId,
        card: selectedCardId,
        category: selectedCategory ?? "",
        search,
        ...overrides,
      },
      { resetPage: true }
    );

    router.push((query ? `${actionPath}?${query}` : actionPath) as Route);
  }

  return (
    <div style={{ borderTop: "1px solid #dde7e1", borderBottom: "1px solid #dde7e1", background: "#fff", boxShadow: "0 1px 2px rgb(15 23 42 / 5%)" }}>
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: "#16201b" }}>Filter offers</span>
            {activeFilterCount > 0 && (
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white"
                style={{ background: "#047857" }}
              >
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const query = buildUpdatedQueryString(
                  new URLSearchParams(searchParams.toString()),
                  { bank: "", card: "", category: "", search: "" },
                  { resetPage: true }
                );

                router.push((query ? `${actionPath}?${query}` : actionPath) as Route);
              }}
              className="text-sm underline underline-offset-2 transition-colors"
              style={{ color: "#6a7d73" }}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_2fr]">
          <div className="grid gap-1">
            <label htmlFor="offer-bank-filter" style={labelStyle}>Bank</label>
            <select
              id="offer-bank-filter"
              name="bank"
              value={selectedBankId}
              onChange={(e) => pushFilter({ bank: e.target.value, card: "" })}
              style={fieldStyle}
            >
              <option value="">All banks</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>{bank.shortName}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-card-filter" style={labelStyle}>Card</label>
            <select
              id="offer-card-filter"
              name="card"
              value={selectedCardId}
              onChange={(e) => pushFilter({ card: e.target.value })}
              style={fieldStyle}
            >
              <option value="">All cards</option>
              {availableCards.map((card) => {
                const bank = bankById[card.bankId];
                const bankLabel = selectedBankId ? "" : `${bank?.shortName ?? card.bankId} · `;
                return (
                  <option key={card.id} value={card.id}>{bankLabel}{card.name}</option>
                );
              })}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-category-filter" style={labelStyle}>Category</label>
            <select
              id="offer-category-filter"
              name="category"
              value={selectedCategory ?? ""}
              onChange={(e) => pushFilter({ category: e.target.value })}
              style={fieldStyle}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-search-filter" style={labelStyle}>Search</label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("search") as HTMLInputElement;
                pushFilter({ search: input.value });
              }}
              className="flex gap-2"
            >
              <input
                id="offer-search-filter"
                name="search"
                defaultValue={search}
                placeholder="Merchant, bank, offer…"
                className="min-w-0 flex-1"
                style={fieldStyle}
              />
              <button
                type="submit"
                className="shrink-0 whitespace-nowrap rounded-lg text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
                style={{ height: "40px", background: "#047857", padding: "0 16px" }}
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
