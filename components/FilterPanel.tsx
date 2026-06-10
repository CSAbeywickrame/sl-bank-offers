"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { categories } from "@/lib/offers/categories";
import type { Bank, Card, OfferCategory } from "@/lib/offers/types";

interface FilterPanelProps {
  banks: Bank[];
  cards: Card[];
  selectedBankId?: string;
  selectedCardId?: string;
  selectedCategory?: OfferCategory;
  search?: string;
  /** Base path for filter pushes — use the current page path to preserve context */
  actionPath?: string;
}

function buildUrl(base: string, params: Record<string, string>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

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

  const availableCards = selectedBankId ? cards.filter((c) => c.bankId === selectedBankId) : cards;

  const bankById = Object.fromEntries(banks.map((b) => [b.id, b]));

  const activeFilterCount = [selectedBankId, selectedCardId, selectedCategory, search].filter(Boolean).length;

  function pushFilter(overrides: Partial<{ bank: string; card: string; category: string; search: string }>) {
    const next = {
      bank: selectedBankId,
      card: selectedCardId,
      category: selectedCategory ?? "",
      search,
      ...overrides,
    };
    router.push(buildUrl(actionPath, next) as Route);
  }

  return (
    <div className="border-y border-slate-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Filter offers</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1.5 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => router.push(actionPath as Route)}
              className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_2fr]">
          <div className="grid gap-1">
            <label htmlFor="offer-bank-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bank
            </label>
            <select
              id="offer-bank-filter"
              name="bank"
              value={selectedBankId}
              onChange={(e) => pushFilter({ bank: e.target.value, card: "" })}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
            >
              <option value="">All banks</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.shortName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-card-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Card
            </label>
            <select
              id="offer-card-filter"
              name="card"
              value={selectedCardId}
              onChange={(e) => pushFilter({ card: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
            >
              <option value="">All cards</option>
              {availableCards.map((card) => {
                const bank = bankById[card.bankId];
                const bankLabel = selectedBankId ? "" : `${bank?.shortName ?? card.bankId} · `;
                return (
                  <option key={card.id} value={card.id}>
                    {bankLabel}{card.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-category-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </label>
            <select
              id="offer-category-filter"
              name="category"
              value={selectedCategory ?? ""}
              onChange={(e) => pushFilter({ category: e.target.value })}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-search-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </label>
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
                className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
              />
              <button
                type="submit"
                className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
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
