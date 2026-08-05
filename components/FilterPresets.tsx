"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  clearPresets,
  deletePreset,
  findPresetMatchingSelection,
  presetSummary,
  readPresets,
  reconcilePreset,
  savePreset,
  suggestPresetName,
  touchPreset,
  type FilterPreset,
  type OfferCatalog,
  type PresetSelection,
  type PresetStorage,
  type ReconciledPreset,
} from "@/lib/offers/presets";
import { usePopover } from "@/components/ui/popover";
import { buttonClasses } from "@/components/ui/button";
import { Bookmark, Check, ChevronDown, Close } from "@/components/ui/icon";

interface UseFilterPresetsResult {
  isLoaded: boolean;
  presets: ReconciledPreset[];
  save: (name: string, selection: PresetSelection) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  markUsed: (id: string, selection: PresetSelection) => void;
}

// Returns the browser's localStorage typed as PresetStorage, or null when running on the server
function getPresetStorage(): PresetStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

// Owns saved-filter-preset state: loads from localStorage after mount, exposes CRUD
export function useFilterPresets(catalog: OfferCatalog): UseFilterPresetsResult {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Loads persisted presets once, after mount
  useEffect(() => {
    const storage = getPresetStorage();
    if (!storage) return;
    const now = new Date();
    setPresets(readPresets(storage, now));
    setIsLoaded(true);
  }, []);

  // Saves (or overwrites a same-named) preset and refreshes state from the persisted list
  function save(name: string, selection: PresetSelection) {
    const storage = getPresetStorage();
    if (!storage) return;
    setPresets(savePreset(storage, { name, ...selection }, new Date()));
  }

  // Deletes a preset by id and refreshes state from the persisted list
  function remove(id: string) {
    const storage = getPresetStorage();
    if (!storage) return;
    setPresets(deletePreset(storage, id, new Date()));
  }

  // Wipes every saved preset and refreshes state
  function clearAll() {
    const storage = getPresetStorage();
    if (!storage) return;
    setPresets(clearPresets(storage));
  }

  // Marks a preset as just-used, self-healing its selection, and refreshes state
  function markUsed(id: string, selection: PresetSelection) {
    const storage = getPresetStorage();
    if (!storage) return;
    setPresets(touchPreset(storage, id, new Date(), selection));
  }

  // Reconciles every stored preset against the current catalog, dropping ids that no longer exist
  const reconciledPresets = useMemo(
    () => presets.map((preset) => reconcilePreset(preset, catalog)),
    [presets, catalog]
  );

  return { isLoaded, presets: reconciledPresets, save, remove, clearAll, markUsed };
}

// Small uppercase section label, matching the labelClass idiom used across the filter panel
const sectionLabelClass = "text-xs font-semibold uppercase tracking-[0.04em] text-(--text-muted)";

interface SavedFilterRowProps {
  reconciled: ReconciledPreset;
  onApply: (reconciled: ReconciledPreset) => void;
  onDelete: (id: string) => void;
}

// Renders one saved-preset row: an applicable (or disabled, if now empty) name button plus a delete button
function SavedFilterRow({ reconciled, onApply, onDelete }: SavedFilterRowProps) {
  const { preset, isEmpty, missingCount } = reconciled;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <button
        type="button"
        disabled={isEmpty}
        onClick={() => onApply(reconciled)}
        className={`min-w-0 flex-1 text-left transition-colors ${
          isEmpty ? "cursor-not-allowed text-(--text-muted)" : "text-(--text-strong) hover:text-(--text-body)"
        }`}
      >
        <span className="block truncate text-sm font-medium">{preset.name}</span>
        {isEmpty ? (
          <span className="block text-xs text-(--text-muted)">No longer available</span>
        ) : (
          <>
            <span className="block text-xs text-(--text-muted)">{presetSummary(reconciled)}</span>
            {missingCount > 0 && (
              <span className="block text-xs text-(--text-muted)">
                {missingCount} saved filter{missingCount === 1 ? "" : "s"} no longer available
              </span>
            )}
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => onDelete(preset.id)}
        aria-label={`Delete ${preset.name}`}
        className="shrink-0 text-(--text-muted) transition-colors hover:text-(--text-strong) active:brightness-90"
      >
        <Close />
      </button>
    </div>
  );
}

interface SavedFiltersPopoverProps {
  presets: ReconciledPreset[];
  canSave: boolean;
  selection: PresetSelection;
  catalog: OfferCatalog;
  onApply: (reconciled: ReconciledPreset) => void;
  onSave: (name: string, selection: PresetSelection) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

// Single "Saved filters" popover: lists saved presets, hosts the save-current-filters flow, and clears all
function SavedFiltersPopover({
  presets,
  canSave,
  selection,
  catalog,
  onApply,
  onSave,
  onDelete,
  onClearAll,
}: SavedFiltersPopoverProps) {
  const { isOpen, setIsOpen, containerRef, triggerRef } = usePopover();
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const confirmationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchingPreset = findPresetMatchingSelection(
    presets.map((reconciled) => reconciled.preset),
    selection
  );

  // Resets transient popover state (delete-all confirm, save form) whenever the popover closes
  useEffect(() => {
    if (!isOpen) {
      setIsConfirmingClearAll(false);
      setIsSavingNew(false);
    }
  }, [isOpen]);

  // Clears any pending confirmation timeout on unmount, so it can't set state after the component is gone
  useEffect(() => {
    return () => {
      if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
    };
  }, []);

  // Applies a usable preset row and closes the popover
  function handleApply(reconciled: ReconciledPreset) {
    onApply(reconciled);
    setIsOpen(false);
  }

  // Saves the trimmed preset name, shows a transient confirmation, then collapses the save form
  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("presetName") as HTMLInputElement;
    const name = input.value.trim();
    if (!name) return;

    const existed = presets.some(
      (reconciled) => reconciled.preset.name.trim().toLowerCase() === name.toLowerCase()
    );

    onSave(name, selection);
    setIsSavingNew(false);

    if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
    setConfirmation(existed ? `Updated “${name}”` : "Saved");
    confirmationTimeoutRef.current = setTimeout(() => setConfirmation(null), 2000);
  }

  // Cancels the save form on Escape. usePopover's document-level Escape listener lives on the
  // same node React delegates to, so a plain stopPropagation() can't stop it firing too —
  // stopImmediatePropagation() on the native event is what actually keeps the popover open.
  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.nativeEvent.stopImmediatePropagation();
      setIsSavingNew(false);
    }
  }

  const count = presets.length;

  return (
    <div className="grid gap-1" style={{ position: "relative" }} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex h-10 items-center gap-1.5 rounded-md border border-(--border-default) bg-(--surface-card) px-3 text-sm font-medium text-(--text-body) transition-colors hover:text-(--text-strong) active:brightness-90"
      >
        <Bookmark size={14} />
        Saved filters
        {count > 0 && (
          <span
            aria-hidden="true"
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-(--action-accent-bg) px-1 text-[10px] font-semibold text-(--action-accent-fg)"
          >
            {count}
          </span>
        )}
        <ChevronDown size={12} />
      </button>
      {isOpen && (
        <div
          role="group"
          aria-label="Saved filters"
          className="absolute right-0 z-10 w-72 rounded-lg border border-(--border-default) bg-(--surface-card) p-2"
          style={{
            top: "100%",
            marginTop: "4px",
            boxShadow: "0 4px 12px rgb(15 23 42 / 10%)",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          <p className={`${sectionLabelClass} px-2 pb-1 pt-0.5`}>Saved filters</p>

          {presets.length === 0 ? (
            <p className="px-2 py-3 text-sm text-(--text-muted)">No saved filters yet.</p>
          ) : (
            <div>
              {presets.map((reconciled, index) => (
                <div key={reconciled.preset.id} className={index > 0 ? "border-t border-(--border-subtle)" : undefined}>
                  <SavedFilterRow reconciled={reconciled} onApply={handleApply} onDelete={onDelete} />
                </div>
              ))}
            </div>
          )}

          {(canSave || matchingPreset) && (
            <>
              <div className="my-1 border-t border-(--border-subtle)" />
              {confirmation ? (
                <p className="px-2 py-2 text-sm text-(--text-muted)">{confirmation}</p>
              ) : matchingPreset ? (
                <p className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-(--text-muted)">
                  <Check size={14} />
                  Saved as “{matchingPreset.name}”
                </p>
              ) : isSavingNew ? (
                <form onSubmit={handleSave} className="grid gap-1.5 px-2 py-1.5">
                  <label htmlFor="preset-name-input" className={sectionLabelClass}>
                    Preset name
                  </label>
                  <input
                    id="preset-name-input"
                    type="text"
                    name="presetName"
                    defaultValue={suggestPresetName(selection, catalog)}
                    autoFocus
                    onKeyDown={handleNameKeyDown}
                    className="h-9 w-full rounded-md border border-(--border-default) bg-(--surface-card) px-2 text-sm text-(--text-strong)"
                  />
                  <div className="mt-0.5 flex items-center gap-3">
                    <button type="submit" className={buttonClasses({ variant: "accent", size: "sm" })}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSavingNew(false)}
                      className="text-sm text-(--text-muted) transition-colors hover:text-(--text-strong)"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSavingNew(true)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-(--text-body) transition-colors hover:bg-(--surface-muted) hover:text-(--text-strong)"
                >
                  <span aria-hidden="true">+ </span>
                  Save these filters
                </button>
              )}
            </>
          )}

          {presets.length > 0 && (
            <>
              <div className="my-1 border-t border-(--border-subtle)" />
              {isConfirmingClearAll ? (
                <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                  <span className="text-(--text-body)">Delete all {presets.length} saved filters?</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={onClearAll} className="font-semibold text-red-600 hover:text-red-700">
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClearAll(false)}
                      className="text-(--text-muted) hover:text-(--text-strong)"
                    >
                      Cancel
                    </button>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingClearAll(true)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-red-600 transition-colors hover:bg-(--surface-muted) hover:text-red-700"
                >
                  Delete all saved filters
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface FilterPresetControlsProps {
  presets: ReconciledPreset[];
  isLoaded: boolean;
  selection: PresetSelection;
  catalog: OfferCatalog;
  canSave: boolean;
  onApply: (reconciled: ReconciledPreset) => void;
  onSave: (name: string, selection: PresetSelection) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

// Single header-row control for saved filters: one "Saved filters" trigger that opens a popover
// hosting the preset list, the save-current-filters flow, and delete-all
export function FilterPresetControls({
  presets,
  isLoaded,
  selection,
  catalog,
  canSave,
  onApply,
  onSave,
  onDelete,
  onClearAll,
}: FilterPresetControlsProps) {
  if (!isLoaded) return null;
  if (presets.length === 0 && !canSave) return null;

  return (
    <SavedFiltersPopover
      presets={presets}
      canSave={canSave}
      selection={selection}
      catalog={catalog}
      onApply={onApply}
      onSave={onSave}
      onDelete={onDelete}
      onClearAll={onClearAll}
    />
  );
}
