"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  clearPresets,
  deletePreset,
  dismissPresetPrompt,
  presetSummary,
  presetToRecall,
  readPresets,
  readPromptDismissedAt,
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

interface UseFilterPresetsResult {
  isLoaded: boolean;
  presets: ReconciledPreset[];
  recall: ReconciledPreset | null;
  save: (name: string, selection: PresetSelection) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  markUsed: (id: string, selection: PresetSelection) => void;
  dismissRecall: () => void;
}

// Returns the browser's localStorage typed as PresetStorage, or null when running on the server
function getPresetStorage(): PresetStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

// Owns saved-filter-preset state: loads from localStorage after mount, exposes CRUD + recall
export function useFilterPresets(catalog: OfferCatalog, hasActiveFilters: boolean): UseFilterPresetsResult {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  // Loads persisted presets and the recall-prompt dismissal timestamp once, after mount
  useEffect(() => {
    const storage = getPresetStorage();
    if (!storage) return;
    const now = new Date();
    setPresets(readPresets(storage, now));
    setDismissedAt(readPromptDismissedAt(storage));
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

  // Wipes every saved preset and refreshes state, syncing the dismissal flag storage also clears
  function clearAll() {
    const storage = getPresetStorage();
    if (!storage) return;
    setPresets(clearPresets(storage));
    setDismissedAt(null);
  }

  // Marks a preset as just-used, self-healing its selection, and refreshes state
  function markUsed(id: string, selection: PresetSelection) {
    const storage = getPresetStorage();
    if (!storage) return;
    setPresets(touchPreset(storage, id, new Date(), selection));
  }

  // Records the recall prompt as dismissed, both in storage and in state, so it recomputes without a reload
  function dismissRecall() {
    const storage = getPresetStorage();
    if (!storage) return;
    const now = new Date();
    dismissPresetPrompt(storage, now);
    setDismissedAt(now.toISOString());
  }

  // Reconciles every stored preset against the current catalog, dropping ids that no longer exist
  const reconciledPresets = useMemo(
    () => presets.map((preset) => reconcilePreset(preset, catalog)),
    [presets, catalog]
  );

  // Recomputes which preset (if any) should be offered as a "welcome back" recall prompt
  const recall = useMemo(() => {
    if (!isLoaded) return null;
    const candidate = presetToRecall({ presets, catalog, hasActiveFilters, dismissedAt, now: new Date() });
    return candidate ? reconcilePreset(candidate, catalog) : null;
  }, [presets, catalog, hasActiveFilters, dismissedAt, isLoaded]);

  return { isLoaded, presets: reconciledPresets, recall, save, remove, clearAll, markUsed, dismissRecall };
}

interface SavedFilterRowProps {
  reconciled: ReconciledPreset;
  onApply: (reconciled: ReconciledPreset) => void;
  onDelete: (id: string) => void;
}

// Renders one saved-preset row: an applicable (or disabled, if now empty) name button plus a delete button
function SavedFilterRow({ reconciled, onApply, onDelete }: SavedFilterRowProps) {
  const { preset, isEmpty, missingCount } = reconciled;

  return (
    <div className="flex items-center gap-2 rounded px-2 py-1.5">
      <button
        type="button"
        disabled={isEmpty}
        onClick={() => onApply(reconciled)}
        className={`min-w-0 flex-1 text-left ${isEmpty ? "text-neutral-400 cursor-not-allowed" : "text-neutral-900"}`}
      >
        <span className="block truncate text-sm font-medium">{preset.name}</span>
        {isEmpty ? (
          <span className="block text-xs text-neutral-500">No longer available</span>
        ) : (
          <>
            <span className="block text-xs text-neutral-500">{presetSummary(reconciled)}</span>
            {missingCount > 0 && (
              <span className="block text-xs text-neutral-500">
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
        className="shrink-0 text-neutral-400 hover:text-neutral-600"
      >
        ×
      </button>
    </div>
  );
}

interface SavedFiltersDropdownProps {
  presets: ReconciledPreset[];
  onApply: (reconciled: ReconciledPreset) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

// Compact "Saved filters" dropdown: applies or deletes individual presets, or clears all of them
function SavedFiltersDropdown({ presets, onApply, onDelete, onClearAll }: SavedFiltersDropdownProps) {
  const { isOpen, setIsOpen, containerRef, triggerRef } = usePopover();
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);

  // Resets the "delete all" confirm step whenever the popover closes, for any reason
  useEffect(() => {
    if (!isOpen) setIsConfirmingClearAll(false);
  }, [isOpen]);

  // Applies a usable preset row and closes the popover
  function handleApply(reconciled: ReconciledPreset) {
    onApply(reconciled);
    setIsOpen(false);
  }

  return (
    <div className="grid gap-1" style={{ position: "relative" }} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex items-center gap-1 text-sm text-neutral-500"
      >
        Saved filters
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div
          role="group"
          aria-label="Saved filters"
          className="absolute left-0 z-10 min-w-[220px] rounded-lg border border-neutral-300 bg-white p-2"
          style={{
            top: "100%",
            marginTop: "4px",
            boxShadow: "0 4px 12px rgb(15 23 42 / 10%)",
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          {presets.map((reconciled) => (
            <SavedFilterRow key={reconciled.preset.id} reconciled={reconciled} onApply={handleApply} onDelete={onDelete} />
          ))}
          <div className="mt-1 border-t border-neutral-200 pt-1">
            {isConfirmingClearAll ? (
              <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                <span className="text-neutral-700">Delete all {presets.length} saved filters?</span>
                <span className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={onClearAll} className="font-semibold text-red-600">Yes</button>
                  <button type="button" onClick={() => setIsConfirmingClearAll(false)} className="text-neutral-500">Cancel</button>
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingClearAll(true)}
                className="w-full px-2 py-1 text-left text-xs text-red-600"
              >
                Delete all saved filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SaveFiltersButtonProps {
  selection: PresetSelection;
  catalog: OfferCatalog;
  existingPresets: ReconciledPreset[];
  onSave: (name: string, selection: PresetSelection) => void;
}

// "Save these filters" text button that expands into an inline name-entry form
function SaveFiltersButton({ selection, catalog, existingPresets, onSave }: SaveFiltersButtonProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const confirmationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears any pending confirmation timeout on unmount, so it can't set state after the component is gone
  useEffect(() => {
    return () => {
      if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
    };
  }, []);

  // Saves the trimmed preset name, shows a transient confirmation, then collapses back to the button
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("presetName") as HTMLInputElement;
    const name = input.value.trim();
    if (!name) return;

    const existed = existingPresets.some(
      (reconciled) => reconciled.preset.name.trim().toLowerCase() === name.toLowerCase()
    );

    onSave(name, selection);
    setIsEditing(false);

    if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
    setConfirmation(existed ? `Updated “${name}”` : "Saved");
    confirmationTimeoutRef.current = setTimeout(() => setConfirmation(null), 2000);
  }

  if (confirmation) {
    return <span className="text-sm text-neutral-500">{confirmation}</span>;
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-sm text-neutral-500 underline underline-offset-2"
      >
        Save these filters
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        name="presetName"
        aria-label="Preset name"
        defaultValue={suggestPresetName(selection, catalog)}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsEditing(false);
        }}
        className="h-8 rounded-md border border-neutral-300 px-2 text-sm"
      />
      <button type="submit" className={buttonClasses({ variant: "accent", size: "sm" })}>
        Save
      </button>
      <button type="button" onClick={() => setIsEditing(false)} className="text-sm text-neutral-500">
        Cancel
      </button>
    </form>
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

// Inline header-row group: the "Saved filters" dropdown plus the "Save these filters" control
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.length > 0 && (
        <SavedFiltersDropdown presets={presets} onApply={onApply} onDelete={onDelete} onClearAll={onClearAll} />
      )}
      {canSave && (
        <SaveFiltersButton selection={selection} catalog={catalog} existingPresets={presets} onSave={onSave} />
      )}
    </div>
  );
}

interface FilterPresetBannerProps {
  recall: ReconciledPreset | null;
  onApply: (reconciled: ReconciledPreset) => void;
  onDismiss: () => void;
}

// Slim full-width banner offering to reload the user's most recent saved filter selection
export function FilterPresetBanner({ recall, onApply, onDismiss }: FilterPresetBannerProps) {
  if (!recall) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
      <span className="text-neutral-700">Welcome back — load “{recall.preset.name}”?</span>
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onApply(recall);
            onDismiss();
          }}
          className={buttonClasses({ variant: "outline", size: "sm" })}
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-neutral-400 hover:text-neutral-600"
        >
          ×
        </button>
      </span>
    </div>
  );
}
