"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { categories, getCategoryLabel } from "@/lib/offers/categories";
import { buildFilterQueryString } from "@/lib/offers/query";
import { sortKeys, type Bank, type Card, type OfferCategory, type SortKey } from "@/lib/offers/types";
import { buttonClasses } from "@/components/ui/button";
import { FilterSummary, type FilterChipData } from "@/components/FilterSummary";

interface FilterPanelProps {
  banks: Bank[];
  cards: Card[];
  selectedBankIds?: string[];
  selectedCategories?: OfferCategory[];
  selectedCardId?: string;
  selectedSort?: SortKey;
  search?: string;
  actionPath?: string;
  lockedBankId?: string;
  lockedCategory?: OfferCategory;
  resultCount?: number;
}

const fieldClass = "h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900";
const labelClass = "text-xs font-semibold uppercase tracking-[0.04em] text-neutral-500";

// Human-readable labels for each sort key, in display order
const sortLabels: Record<SortKey, string> = {
  relevance: "Relevance",
  newest: "Newest",
  "expiring-soon": "Expiring soon",
};

interface MultiSelectFieldProps {
  id: string;
  label: string;
  allLabel: string;
  options: { id: string; label: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

// Dependency-free accessible multi-select: a toggle button that reveals a checkbox list panel
function MultiSelectField({ id, label, allLabel, options, selectedIds, onToggle }: MultiSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Closes the panel when a mousedown happens outside the field container
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Closes the panel on Escape and returns focus to the toggle button
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const selectedLabels = options.filter((o) => selectedIds.includes(o.id)).map((o) => o.label);
  const summary =
    selectedLabels.length === 0
      ? allLabel
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`;

  return (
    <div className="grid gap-1" style={{ position: "relative" }} ref={containerRef}>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <button
        type="button"
        id={id}
        ref={buttonRef}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={`flex items-center justify-between ${fieldClass}`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div
          role="group"
          aria-label={label}
          className="absolute left-0 right-0 z-10 grid gap-1 rounded-lg border border-neutral-300 bg-white p-2"
          style={{
            top: "100%",
            marginTop: "4px",
            boxShadow: "0 4px 12px rgb(15 23 42 / 10%)",
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-neutral-900">
              <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => onToggle(option.id)} />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Shows the active-filter count next to the "Filters" / "Filter offers" label, hidden when count is 0
function FilterCountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-700 px-1.5 text-xs font-semibold text-white">
      {count}
    </span>
  );
}

// Shared "Clear all" text button used in both the desktop header and mobile toggle bar
function ClearAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-neutral-500 underline underline-offset-2 transition-colors"
    >
      Clear all
    </button>
  );
}

export function FilterPanel({
  banks,
  cards,
  selectedBankIds = [],
  selectedCategories = [],
  selectedCardId = "",
  selectedSort = "relevance",
  search = "",
  actionPath = "/",
  lockedBankId,
  lockedCategory,
  resultCount,
}: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const cardScopeBankIds = lockedBankId ? [lockedBankId] : selectedBankIds;
  const availableCards =
    cardScopeBankIds.length > 0 ? cards.filter((card) => cardScopeBankIds.includes(card.bankId)) : cards;
  const bankById = Object.fromEntries(banks.map((b) => [b.id, b]));
  const activeFilterCount =
    selectedBankIds.length + selectedCategories.length + (selectedCardId ? 1 : 0) + (search ? 1 : 0);

  // Wide-screen column count adapts when a locked page hides the Bank or Category field,
  // so the remaining fields fill the row instead of leaving the search column empty.
  const fieldGridClass =
    lockedBankId || lockedCategory
      ? "xl:grid-cols-[1fr_1fr_1fr_2fr]"
      : "xl:grid-cols-[1fr_1fr_1fr_1fr_2fr]";

  // Builds a query string from the given filter updates and navigates to actionPath, resetting pagination
  function pushQuery(updates: Parameters<typeof buildFilterQueryString>[1]) {
    const query = buildFilterQueryString(new URLSearchParams(searchParams.toString()), updates, { resetPage: true });
    router.push((query ? `${actionPath}?${query}` : actionPath) as Route);
  }

  // Pushes an updated query string to actionPath, merging the current filter state with overrides
  function pushFilter(overrides: Partial<{ bankIds: string[]; categories: string[]; cardId: string; search: string }>) {
    pushQuery({
      bankIds: selectedBankIds,
      categories: selectedCategories,
      cardId: selectedCardId,
      search,
      ...overrides,
    });
  }

  // Adds id to the list if absent, or removes it if present
  function toggleInList<T>(list: T[], id: T): T[] {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  // Toggles a bank in the selection and clears the selected card, since available cards depend on the bank
  function toggleBank(bankId: string) {
    pushFilter({ bankIds: toggleInList(selectedBankIds, bankId), cardId: "" });
  }

  // Toggles a category in the selection, leaving the selected card untouched
  function toggleCategory(categoryId: string) {
    pushFilter({ categories: toggleInList(selectedCategories, categoryId as OfferCategory) });
  }

  // Clears every filter dimension, skipping any dimension locked by the current page
  function clearAll() {
    pushQuery({
      ...(lockedBankId ? {} : { bankIds: [] }),
      ...(lockedCategory ? {} : { categories: [] }),
      cardId: "",
      search: "",
    });
  }

  const selectedCard = selectedCardId ? cards.find((c) => c.id === selectedCardId) : undefined;
  const chips: FilterChipData[] = [
    ...(lockedBankId ? [] : selectedBankIds.map((bankId) => ({
      id: `bank:${bankId}`,
      label: bankById[bankId]?.shortName ?? bankId,
      onRemove: () => toggleBank(bankId),
    }))),
    ...(lockedCategory ? [] : selectedCategories.map((cat) => ({
      id: `cat:${cat}`,
      label: getCategoryLabel(cat),
      onRemove: () => toggleCategory(cat),
    }))),
    ...(selectedCard ? [{
      id: `card:${selectedCard.id}`,
      label: selectedCard.name,
      onRemove: () => pushFilter({ cardId: "" }),
    }] : []),
    ...(search ? [{
      id: "search",
      label: `“${search}”`,
      onRemove: () => pushFilter({ search: "" }),
    }] : []),
  ];

  return (
    <div className="border-t border-b border-neutral-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="hidden sm:flex sm:mb-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">Filter offers</span>
            <FilterCountBadge count={activeFilterCount} />
          </div>
          {activeFilterCount > 0 && <ClearAllButton onClick={clearAll} />}
        </div>

        <div className="mb-3 flex items-center justify-between sm:hidden">
          <button
            type="button"
            onClick={() => setIsFiltersOpen((prev) => !prev)}
            aria-expanded={isFiltersOpen}
            aria-controls="filter-fields"
            className="flex items-center gap-2"
          >
            <span className="text-sm font-semibold text-neutral-900">Filters</span>
            <FilterCountBadge count={activeFilterCount} />
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
              className={`transition-transform ${isFiltersOpen ? "rotate-180" : ""}`}
            >
              <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {activeFilterCount > 0 && <ClearAllButton onClick={clearAll} />}
        </div>

        <div
          id="filter-fields"
          className={`${isFiltersOpen ? "grid" : "hidden"} sm:grid grid-cols-1 gap-3 sm:grid-cols-2 ${fieldGridClass}`}
        >
          {!lockedBankId && (
            <MultiSelectField
              id="offer-bank-filter"
              label="Bank"
              allLabel="All banks"
              options={banks.map((bank) => ({ id: bank.id, label: bank.shortName }))}
              selectedIds={selectedBankIds}
              onToggle={toggleBank}
            />
          )}

          <div className="grid gap-1">
            <label htmlFor="offer-card-filter" className={labelClass}>Card</label>
            <select
              id="offer-card-filter"
              name="card"
              value={selectedCardId}
              onChange={(e) => pushFilter({ cardId: e.target.value })}
              className={fieldClass}
            >
              <option value="">All cards</option>
              {availableCards.map((card) => {
                const bank = bankById[card.bankId];
                const bankLabel = cardScopeBankIds.length === 1 ? "" : `${bank?.shortName ?? card.bankId} · `;
                return (
                  <option key={card.id} value={card.id}>{bankLabel}{card.name}</option>
                );
              })}
            </select>
          </div>

          {!lockedCategory && (
            <MultiSelectField
              id="offer-category-filter"
              label="Category"
              allLabel="All categories"
              options={categories}
              selectedIds={selectedCategories}
              onToggle={toggleCategory}
            />
          )}

          <div className="grid gap-1">
            <label htmlFor="offer-sort-filter" className={labelClass}>Sort</label>
            <select
              id="offer-sort-filter"
              name="sort"
              value={selectedSort}
              onChange={(e) => pushQuery({ sort: e.target.value as SortKey })}
              className={fieldClass}
            >
              {sortKeys.map((key) => (
                <option key={key} value={key}>{sortLabels[key]}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-search-filter" className={labelClass}>Search</label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("search") as HTMLInputElement;
                pushFilter({ search: input.value });
              }}
              className="flex gap-2"
            >
              <input
                key={search}
                id="offer-search-filter"
                name="search"
                defaultValue={search}
                placeholder="Merchant, bank, offer…"
                className={`min-w-0 flex-1 ${fieldClass}`}
              />
              <button type="submit" className={buttonClasses({ variant: "accent" }) + " shrink-0 whitespace-nowrap"}>
                Search
              </button>
            </form>
          </div>
        </div>

        {(chips.length > 0 || resultCount != null) && (
          <div className="mt-3">
            <FilterSummary resultCount={resultCount} chips={chips} />
          </div>
        )}
      </div>
    </div>
  );
}
