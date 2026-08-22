"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { categories, getCategoryLabel } from "@/lib/offers/categories";
import { buildFilterQueryString } from "@/lib/offers/query";
import { sortKeys, type Bank, type Card, type OfferCategory, type SortKey } from "@/lib/offers/types";
import { buttonClasses } from "@/components/ui/button";
import { fieldClass, Input, labelClass, Select } from "@/components/ui/field";
import { usePopover } from "@/components/ui/popover";
import { Check, ChevronDown, Search } from "@/components/ui/icon";
import { FilterSummary, type FilterChipData } from "@/components/FilterSummary";
import { FilterPresetControls, useFilterPresets } from "@/components/FilterPresets";
import { isPresetSelectionEmpty, type PresetSelection, type ReconciledPreset } from "@/lib/offers/presets";

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
  const { isOpen, setIsOpen, containerRef, triggerRef } = usePopover();

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
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={`flex items-center justify-between ${fieldClass}`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
        <ChevronDown size={16} className="text-(--text-muted)" />
      </button>
      {isOpen && (
        <div
          role="group"
          aria-label={label}
          className="absolute left-0 right-0 z-10 grid gap-1 rounded-lg border border-(--border-default) bg-(--surface-card) p-2 shadow-md"
          style={{
            top: "100%",
            marginTop: "var(--space-1)",
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-(--text-strong)">
              <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => onToggle(option.id)} />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact active-filter count, shown only on the mobile "Filters" disclosure since the
// desktop row communicates the same thing through the chips beneath it
function FilterCountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold"
      style={{ background: "var(--action-accent-bg)", color: "var(--action-accent-fg)" }}
    >
      {count}
    </span>
  );
}

// Shared "Clear all" text button used in the tier 1 header row
function ClearAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-bold text-(--text-link) transition-colors duration-(--motion-fast) hover:text-(--text-link-hover)"
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
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);

  const cardScopeBankIds = lockedBankId ? [lockedBankId] : selectedBankIds;
  const availableCards =
    cardScopeBankIds.length > 0 ? cards.filter((card) => cardScopeBankIds.includes(card.bankId)) : cards;
  const bankById = Object.fromEntries(banks.map((b) => [b.id, b]));
  const activeFilterCount =
    selectedBankIds.length + selectedCategories.length + (selectedCardId ? 1 : 0) + (search ? 1 : 0);

  // Preset selection reflects the *effective* filter, folding in any dimension locked by the current page
  const selection: PresetSelection = {
    bankIds: lockedBankId ? [lockedBankId] : selectedBankIds,
    categories: lockedCategory ? [lockedCategory] : selectedCategories,
    cardId: selectedCardId || undefined,
  };
  const catalog = useMemo(() => ({ banks, cards }), [banks, cards]);
  const {
    isLoaded,
    presets,
    save,
    remove,
    clearAll: clearAllPresets,
    markUsed,
  } = useFilterPresets(catalog);

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

  // Returns whether a preset's card exists in the catalog and is in scope for the current locked bank, if any
  function isCardInScope(reconciled: ReconciledPreset): boolean {
    if (!reconciled.cardId) return true;
    const card = cards.find((c) => c.id === reconciled.cardId);
    if (!card) return false;
    return !lockedBankId || card.bankId === lockedBankId;
  }

  // Applies a saved preset's filters, respecting locked dimensions, and marks the preset as just-used
  function applyPreset(reconciled: ReconciledPreset) {
    const cardId = isCardInScope(reconciled) ? reconciled.cardId ?? "" : "";
    pushQuery({
      ...(lockedBankId ? {} : { bankIds: reconciled.bankIds }),
      ...(lockedCategory ? {} : { categories: reconciled.categories }),
      cardId,
      search: "",
    });
    markUsed(reconciled.preset.id, {
      bankIds: reconciled.bankIds,
      categories: reconciled.categories,
      cardId: reconciled.cardId,
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
    <div className="relative z-10 mx-auto -mt-8 max-w-7xl px-4">
      <div
        className="rounded-xl border border-(--border-subtle) bg-(--surface-card)"
        style={{ boxShadow: "var(--shadow-panel)" }}
      >
        {/* Tier 1 — the primary controls: bank, card, search, sort, plus the preset cluster */}
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <button
              type="button"
              onClick={() => setIsFiltersOpen((prev) => !prev)}
              aria-expanded={isFiltersOpen}
              aria-controls="filter-fields"
              className="flex items-center gap-2 text-sm font-semibold text-(--text-strong) sm:hidden"
            >
              Filters
              <FilterCountBadge count={activeFilterCount} />
              <ChevronDown size={12} className={`transition-transform ${isFiltersOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Bank, card, search and sort are peers on one row; they collapse together below sm: */}
            <div
              id="filter-fields"
              className={`${isFiltersOpen ? "flex" : "hidden"} w-full flex-wrap items-end gap-3 sm:flex sm:w-auto`}
            >
              {!lockedBankId && (
                <div className="w-full sm:w-48">
                  <MultiSelectField
                    id="offer-bank-filter"
                    label="Bank"
                    allLabel="All banks"
                    options={banks.map((bank) => ({ id: bank.id, label: bank.shortName }))}
                    selectedIds={selectedBankIds}
                    onToggle={toggleBank}
                  />
                </div>
              )}

              <div className="grid w-full gap-1 sm:w-48">
                <label htmlFor="offer-card-filter" className={labelClass}>Card</label>
                <Select
                  id="offer-card-filter"
                  name="card"
                  value={selectedCardId}
                  onChange={(e) => pushFilter({ cardId: e.target.value })}
                >
                  <option value="">All cards</option>
                  {availableCards.map((card) => {
                    const bank = bankById[card.bankId];
                    const bankLabel = cardScopeBankIds.length === 1 ? "" : `${bank?.shortName ?? card.bankId} · `;
                    return (
                      <option key={card.id} value={card.id}>{bankLabel}{card.name}</option>
                    );
                  })}
                </Select>
              </div>

              <div className="grid w-full gap-1 sm:w-72">
                <label htmlFor="offer-search-filter" className={labelClass}>Search</label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem("search") as HTMLInputElement;
                    pushFilter({ search: input.value });
                  }}
                  className="flex gap-2"
                >
                  <Input
                    key={search}
                    id="offer-search-filter"
                    name="search"
                    defaultValue={search}
                    placeholder="Merchant, bank, offer…"
                    iconLeft={<Search size={16} />}
                  />
                  {/* The design system pairs a magnifier inside the field with a labelled
                      emerald submit button; the label is clearer than a second magnifier. */}
                  <button type="submit" className={buttonClasses({ variant: "accent", className: "shrink-0" })}>
                    Search
                  </button>
                </form>
              </div>

              <div className="grid w-full gap-1 sm:w-40">
                <label htmlFor="offer-sort-filter" className={labelClass}>Sort</label>
                <Select
                  id="offer-sort-filter"
                  name="sort"
                  value={selectedSort}
                  onChange={(e) => pushQuery({ sort: e.target.value as SortKey })}
                >
                  {sortKeys.map((key) => (
                    <option key={key} value={key}>{sortLabels[key]}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Preset controls and "Clear all" travel together, pinned to the right */}
            <div className="ml-auto flex flex-nowrap items-center gap-3">
              <FilterPresetControls
                presets={presets}
                isLoaded={isLoaded}
                selection={selection}
                catalog={catalog}
                canSave={activeFilterCount > 0 && !isPresetSelectionEmpty(selection)}
                onApply={applyPreset}
                onSave={save}
                onDelete={remove}
                onClearAll={clearAllPresets}
              />
              {activeFilterCount > 0 && <ClearAllButton onClick={clearAll} />}
            </div>
          </div>

          {(chips.length > 0 || resultCount != null) && (
            <div className="mt-3">
              <FilterSummary resultCount={resultCount} chips={chips} />
            </div>
          )}
        </div>

        {/* Tier 2 — categories get the full panel width: wrapping on desktop, scrolling on mobile */}
        {!lockedCategory && (
          <div
            className="relative rounded-b-xl border-t p-4"
            style={{ background: "var(--surface-muted)", borderColor: "var(--border-subtle)" }}
          >
            <div
              role="group"
              aria-label="Category"
              className="scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto sm:flex-wrap sm:snap-none sm:overflow-visible"
            >
              {categories.map((category) => {
                const isSelected = selectedCategories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleCategory(category.id)}
                    className="inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-(--motion-fast) hover:brightness-95 active:brightness-90 sm:min-h-9"
                    style={{
                      background: isSelected ? "var(--action-accent-bg)" : "var(--surface-card)",
                      color: isSelected ? "var(--action-accent-fg)" : "var(--text-body)",
                      borderColor: isSelected ? "transparent" : "var(--border-default)",
                    }}
                  >
                    {isSelected && <Check size={12} />}
                    {category.label}
                  </button>
                );
              })}
            </div>
            {/* Fades the last pill on mobile so a cut-off row reads as scrollable, not broken */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-br-xl sm:hidden"
              style={{ background: "linear-gradient(to left, var(--surface-muted), transparent)" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
