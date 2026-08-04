import { getCategoryLabel, isOfferCategory } from "./categories";
import type { Bank, Card, OfferCategory } from "./types";

export const PRESETS_STORAGE_KEY = "cardcompass:filter-presets";
export const PROMPT_DISMISSED_KEY = "cardcompass:preset-prompt-dismissed-at";
export const MAX_PRESETS = 10;
export const PRESET_TTL_MS = 60 * 24 * 60 * 60 * 1000;
export const PROMPT_DISMISS_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface FilterPreset {
  id: string;
  name: string;
  bankIds: string[];
  categories: OfferCategory[];
  cardId?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface PresetSelection {
  bankIds: string[];
  categories: OfferCategory[];
  cardId?: string;
}

export interface PresetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ReconciledPreset {
  preset: FilterPreset;
  bankIds: string[];
  categories: OfferCategory[];
  cardId?: string;
  missingCount: number;
  isEmpty: boolean;
}

export type OfferCatalog = { banks: Bank[]; cards: Card[] };

// Runtime shape check for a parsed JSON value before it is trusted as a FilterPreset
function isFilterPreset(value: unknown): value is FilterPreset {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    Array.isArray(candidate.bankIds) &&
    candidate.bankIds.every((bankId) => typeof bankId === "string") &&
    Array.isArray(candidate.categories) &&
    typeof candidate.createdAt === "string" &&
    (candidate.cardId === undefined || typeof candidate.cardId === "string") &&
    (candidate.lastUsedAt === undefined || typeof candidate.lastUsedAt === "string")
  );
}

// Cleans up a validated preset's array fields: drops unknown categories, trims/empties bank ids
function sanitisePreset(preset: FilterPreset): FilterPreset {
  return {
    ...preset,
    bankIds: preset.bankIds.map((bankId) => bankId.trim()).filter((bankId) => bankId.length > 0),
    categories: preset.categories.filter(isOfferCategory)
  };
}

// Orders presets most-recently-used first, falling back to createdAt when never used
function sortByRecency(presets: FilterPreset[]): FilterPreset[] {
  return [...presets].sort((a, b) => {
    const aTime = new Date(a.lastUsedAt ?? a.createdAt).getTime();
    const bTime = new Date(b.lastUsedAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });
}

// Generates a unique preset id, preferring crypto.randomUUID when it is available
function createPresetId(now: Date): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `preset-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Joins up to 2 labels verbatim, collapsing any remainder into a trailing "+N"
function truncateList(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

// A preset is expired once it has gone PRESET_TTL_MS untouched, sliding forward on every use
export function isPresetExpired(preset: FilterPreset, now: Date): boolean {
  const reference = new Date(preset.lastUsedAt ?? preset.createdAt);
  if (!Number.isFinite(reference.getTime())) {
    return true;
  }
  return now.getTime() - reference.getTime() > PRESET_TTL_MS;
}

// Loads, validates, sanitises, and prunes stored presets, persisting the pruned list when it shrinks
export function readPresets(storage: PresetStorage, now: Date): FilterPreset[] {
  const raw = storage.getItem(PRESETS_STORAGE_KEY);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const sanitised = parsed.filter(isFilterPreset).map(sanitisePreset);
  const active = sanitised.filter((preset) => !isPresetExpired(preset, now));
  const capped = sortByRecency(active).slice(0, MAX_PRESETS);

  if (capped.length !== parsed.length) {
    storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(capped));
  }

  return capped;
}

// Creates a new preset or overwrites an existing same-named one, then persists the capped, recency-sorted list
export function savePreset(storage: PresetStorage, input: { name: string } & PresetSelection, now: Date): FilterPreset[] {
  const presets = readPresets(storage, now);
  const trimmedName = input.name.trim();
  const existingIndex = presets.findIndex((preset) => preset.name.trim().toLowerCase() === trimmedName.toLowerCase());

  const next =
    existingIndex >= 0
      ? presets.map((preset, index) =>
          index === existingIndex
            ? {
                ...preset,
                name: trimmedName,
                bankIds: input.bankIds,
                categories: input.categories,
                cardId: input.cardId,
                lastUsedAt: now.toISOString()
              }
            : preset
        )
      : [
          {
            id: createPresetId(now),
            name: trimmedName,
            bankIds: input.bankIds,
            categories: input.categories,
            cardId: input.cardId,
            createdAt: now.toISOString(),
            lastUsedAt: now.toISOString()
          },
          ...presets
        ];

  const result = sortByRecency(next).slice(0, MAX_PRESETS);
  storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(result));
  return result;
}

// Removes a preset by id and persists the remaining list
export function deletePreset(storage: PresetStorage, id: string, now: Date): FilterPreset[] {
  const result = readPresets(storage, now).filter((preset) => preset.id !== id);
  storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(result));
  return result;
}

// Marks a preset as just-used, optionally self-healing its selection, and persists the reordered list
export function touchPreset(storage: PresetStorage, id: string, now: Date, selection?: PresetSelection): FilterPreset[] {
  const next = readPresets(storage, now).map((preset) =>
    preset.id === id
      ? {
          ...preset,
          ...(selection ? { bankIds: selection.bankIds, categories: selection.categories, cardId: selection.cardId } : {}),
          lastUsedAt: now.toISOString()
        }
      : preset
  );

  const result = sortByRecency(next);
  storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(result));
  return result;
}

// Wipes all saved presets and the prompt dismissal flag
export function clearPresets(storage: PresetStorage): FilterPreset[] {
  storage.removeItem(PRESETS_STORAGE_KEY);
  storage.removeItem(PROMPT_DISMISSED_KEY);
  return [];
}

// Drops bank/card ids that no longer exist in the catalog and reports how much was dropped
export function reconcilePreset(preset: FilterPreset, catalog: OfferCatalog): ReconciledPreset {
  const bankIds = preset.bankIds.filter((bankId) => catalog.banks.some((bank) => bank.id === bankId));
  const droppedBankCount = preset.bankIds.length - bankIds.length;

  const card = preset.cardId ? catalog.cards.find((c) => c.id === preset.cardId) : undefined;
  const noBanksSelected = preset.bankIds.length === 0;
  const keepCard = card !== undefined && (noBanksSelected || bankIds.includes(card.bankId));
  const cardId = keepCard ? preset.cardId : undefined;
  const droppedCard = Boolean(preset.cardId) && !keepCard;

  return {
    preset,
    bankIds,
    categories: preset.categories,
    cardId,
    missingCount: droppedBankCount + (droppedCard ? 1 : 0),
    isEmpty: bankIds.length === 0 && preset.categories.length === 0 && !cardId
  };
}

// Builds a human-friendly default name from a selection: banks, then categories, then card, then a fallback
export function suggestPresetName(selection: PresetSelection, catalog: OfferCatalog): string {
  const bankNames = selection.bankIds
    .map((bankId) => catalog.banks.find((bank) => bank.id === bankId)?.shortName)
    .filter((name): name is string => Boolean(name));
  const categoryLabels = selection.categories.map((category) => getCategoryLabel(category));

  const bankPart = truncateList(bankNames);
  const categoryPart = truncateList(categoryLabels);

  if (bankPart && categoryPart) {
    return `${bankPart} · ${categoryPart}`;
  }
  if (bankPart) {
    return bankPart;
  }
  if (categoryPart) {
    return categoryPart;
  }

  const card = selection.cardId ? catalog.cards.find((c) => c.id === selection.cardId) : undefined;
  return card?.name ?? "My filters";
}

// Renders a short, pluralised "N banks · N categories · N card" summary of a reconciled preset
export function presetSummary(reconciled: ReconciledPreset): string {
  const parts: string[] = [];

  if (reconciled.bankIds.length > 0) {
    parts.push(`${reconciled.bankIds.length} ${reconciled.bankIds.length === 1 ? "bank" : "banks"}`);
  }
  if (reconciled.categories.length > 0) {
    parts.push(`${reconciled.categories.length} ${reconciled.categories.length === 1 ? "category" : "categories"}`);
  }
  if (reconciled.cardId) {
    parts.push("1 card");
  }

  return parts.length > 0 ? parts.join(" · ") : "All offers";
}

// True when a selection has no banks, categories, or card chosen
export function isPresetSelectionEmpty(selection: PresetSelection): boolean {
  return selection.bankIds.length === 0 && selection.categories.length === 0 && !selection.cardId;
}

// Picks the most recent non-empty preset to offer as a "recall your filters" prompt, honoring dismissal and active filters
export function presetToRecall(options: {
  presets: FilterPreset[];
  catalog: OfferCatalog;
  hasActiveFilters: boolean;
  dismissedAt: string | null;
  now: Date;
}): FilterPreset | null {
  const { presets, catalog, hasActiveFilters, dismissedAt, now } = options;

  if (hasActiveFilters || presets.length === 0) {
    return null;
  }

  if (dismissedAt) {
    const dismissed = new Date(dismissedAt);
    if (Number.isFinite(dismissed.getTime()) && now.getTime() - dismissed.getTime() < PROMPT_DISMISS_WINDOW_MS) {
      return null;
    }
  }

  return presets.find((preset) => !reconcilePreset(preset, catalog).isEmpty) ?? null;
}

// Records the moment the recall prompt was dismissed
export function dismissPresetPrompt(storage: PresetStorage, now: Date): void {
  storage.setItem(PROMPT_DISMISSED_KEY, now.toISOString());
}

// Reads back the recall prompt's dismissal timestamp, if any
export function readPromptDismissedAt(storage: PresetStorage): string | null {
  return storage.getItem(PROMPT_DISMISSED_KEY);
}
