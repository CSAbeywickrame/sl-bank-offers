import { describe, expect, it } from "vitest";
import {
  PRESETS_STORAGE_KEY,
  PROMPT_DISMISSED_KEY,
  clearPresets,
  deletePreset,
  dismissPresetPrompt,
  isPresetSelectionEmpty,
  presetSummary,
  presetToRecall,
  reconcilePreset,
  readPresets,
  readPromptDismissedAt,
  savePreset,
  suggestPresetName,
  touchPreset,
  type FilterPreset,
  type PresetSelection,
  type PresetStorage
} from "@/lib/offers/presets";
import type { Bank, Card } from "@/lib/offers/types";

// In-memory PresetStorage backed by a Map, mirroring the browser storage contract
function createMemoryStorage(): PresetStorage {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    }
  };
}

const banks: Bank[] = [
  { id: "ntb", name: "Nations Trust Bank", shortName: "NTB", websiteUrl: "https://ntb.example" },
  { id: "commercial", name: "Commercial Bank", shortName: "ComBank", websiteUrl: "https://combank.example" },
  { id: "dfcc", name: "DFCC Bank", shortName: "DFCC", websiteUrl: "https://dfcc.example" }
];

const cards: Card[] = [
  { id: "ntb-visa", bankId: "ntb", name: "NTB Visa Platinum" },
  { id: "combank-amex", bankId: "commercial", name: "ComBank American Express" },
  { id: "dfcc-classic", bankId: "dfcc", name: "DFCC Classic" },
  { id: "ntb-titanium", bankId: "ntb", name: "NTB Titanium" }
];

const catalog = { banks, cards };

describe("FilterPreset storage helpers", () => {
  it("round-trips a saved preset through readPresets", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-06-01T00:00:00.000Z");

    savePreset(storage, { name: "Weekend deals", bankIds: ["ntb"], categories: ["dining"] }, now);
    const presets = readPresets(storage, now);

    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      name: "Weekend deals",
      bankIds: ["ntb"],
      categories: ["dining"]
    });
  });

  it("returns an empty list when storage contains corrupt JSON", () => {
    const storage = createMemoryStorage();
    storage.setItem(PRESETS_STORAGE_KEY, "{not json");

    expect(readPresets(storage, new Date("2026-06-01T00:00:00.000Z"))).toEqual([]);
  });

  it("returns an empty list when the stored payload is not an array", () => {
    const storage = createMemoryStorage();
    storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify({ foo: "bar" }));

    expect(readPresets(storage, new Date("2026-06-01T00:00:00.000Z"))).toEqual([]);
  });

  it("drops entries missing required fields", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-06-01T00:00:00.000Z");
    const validPreset = {
      id: "p1",
      name: "Groceries",
      bankIds: ["ntb"],
      categories: ["supermarket"],
      createdAt: now.toISOString()
    };
    const missingName = { id: "p2", bankIds: [], categories: [], createdAt: now.toISOString() };
    const missingId = { name: "No id", bankIds: [], categories: [], createdAt: now.toISOString() };

    storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify([validPreset, missingName, missingId]));

    const presets = readPresets(storage, now);
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe("p1");
  });

  it("strips invalid category strings from an otherwise valid preset", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-06-01T00:00:00.000Z");
    const preset = {
      id: "p1",
      name: "Mixed",
      bankIds: ["ntb"],
      categories: ["dining", "not-a-category"],
      createdAt: now.toISOString()
    };
    storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify([preset]));

    const [result] = readPresets(storage, now);
    expect(result.categories).toEqual(["dining"]);
  });
});

describe("savePreset", () => {
  it("overwrites an existing preset with the same name (case/whitespace-insensitive) and preserves createdAt", () => {
    const storage = createMemoryStorage();
    const created = new Date("2026-05-01T00:00:00.000Z");
    const updated = new Date("2026-06-01T00:00:00.000Z");

    const [first] = savePreset(storage, { name: "Weekend deals", bankIds: ["ntb"], categories: ["dining"] }, created);
    const result = savePreset(storage, { name: "  weekend DEALS  ", bankIds: ["dfcc"], categories: ["fuel"] }, updated);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(first.id);
    expect(result[0].createdAt).toBe(created.toISOString());
    expect(result[0].name).toBe("weekend DEALS");
    expect(result[0].bankIds).toEqual(["dfcc"]);
    expect(result[0].lastUsedAt).toBe(updated.toISOString());
  });

  it("trims the least-recently-used preset once an 11th preset is saved", () => {
    const storage = createMemoryStorage();
    const base = new Date("2026-01-01T00:00:00.000Z");

    for (let i = 0; i < 10; i += 1) {
      const now = new Date(base.getTime() + i * 1000);
      savePreset(storage, { name: `Preset ${i}`, bankIds: [], categories: [] }, now);
    }

    const eleventh = new Date(base.getTime() + 10 * 1000);
    const result = savePreset(storage, { name: "Preset 10", bankIds: [], categories: [] }, eleventh);

    expect(result).toHaveLength(10);
    expect(result.some((preset) => preset.name === "Preset 0")).toBe(false);
    expect(result[0].name).toBe("Preset 10");
  });
});

describe("preset expiry", () => {
  it("drops a preset 61 days past createdAt with no lastUsedAt", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-03-03T00:00:00.000Z");

    storage.setItem(
      PRESETS_STORAGE_KEY,
      JSON.stringify([{ id: "p1", name: "Stale", bankIds: [], categories: [], createdAt: "2026-01-01T00:00:00.000Z" }])
    );

    expect(readPresets(storage, now)).toEqual([]);
  });

  it("keeps the same preset when lastUsedAt is only 3 days old", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-03-03T00:00:00.000Z");
    const lastUsedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    storage.setItem(
      PRESETS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "p1",
          name: "Active",
          bankIds: [],
          categories: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          lastUsedAt: lastUsedAt.toISOString()
        }
      ])
    );

    const presets = readPresets(storage, now);
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe("p1");
  });

  it("drops a preset with an unparseable createdAt", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-03-03T00:00:00.000Z");

    storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify([{ id: "p1", name: "Broken", bankIds: [], categories: [], createdAt: "garbage" }]));

    expect(readPresets(storage, now)).toEqual([]);
  });

  it("persists the pruned list back to storage after dropping expired entries", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-03-03T00:00:00.000Z");
    const stale = { id: "p1", name: "Stale", bankIds: [], categories: [], createdAt: "2026-01-01T00:00:00.000Z" };
    const fresh = { id: "p2", name: "Fresh", bankIds: [], categories: [], createdAt: now.toISOString() };

    storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify([stale, fresh]));

    const presets = readPresets(storage, now);
    expect(presets).toHaveLength(1);

    const raw = JSON.parse(storage.getItem(PRESETS_STORAGE_KEY)!);
    expect(raw).toHaveLength(1);
    expect(raw[0].id).toBe("p2");
  });
});

describe("clearPresets", () => {
  it("empties the preset list and clears the dismissal timestamp", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-06-01T00:00:00.000Z");

    savePreset(storage, { name: "Test", bankIds: [], categories: [] }, now);
    dismissPresetPrompt(storage, now);

    const result = clearPresets(storage);

    expect(result).toEqual([]);
    expect(storage.getItem(PRESETS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(PROMPT_DISMISSED_KEY)).toBeNull();
  });
});

describe("reconcilePreset", () => {
  it("drops bank ids missing from the catalog and reports missingCount", () => {
    const preset: FilterPreset = {
      id: "p1",
      name: "Test",
      bankIds: ["ntb", "hnb"],
      categories: ["dining"],
      createdAt: "2026-01-01T00:00:00.000Z"
    };

    const result = reconcilePreset(preset, catalog);

    expect(result.bankIds).toEqual(["ntb"]);
    expect(result.missingCount).toBe(1);
    expect(result.isEmpty).toBe(false);
  });

  it("marks a preset empty once all its banks and categories are gone", () => {
    const preset: FilterPreset = {
      id: "p1",
      name: "Test",
      bankIds: ["hnb"],
      categories: [],
      createdAt: "2026-01-01T00:00:00.000Z"
    };

    const result = reconcilePreset(preset, catalog);

    expect(result.bankIds).toEqual([]);
    expect(result.isEmpty).toBe(true);
  });

  it("drops a cardId whose bank was removed", () => {
    const preset: FilterPreset = {
      id: "p1",
      name: "Test",
      bankIds: ["ntb"],
      categories: [],
      cardId: "ntb-visa",
      createdAt: "2026-01-01T00:00:00.000Z"
    };
    const catalogWithoutNtb = { banks: banks.filter((bank) => bank.id !== "ntb"), cards };

    const result = reconcilePreset(preset, catalogWithoutNtb);

    expect(result.bankIds).toEqual([]);
    expect(result.cardId).toBeUndefined();
    expect(result.missingCount).toBe(2);
  });
});

describe("suggestPresetName", () => {
  it("truncates bank and category lists with the +N rule and joins with a middle dot", () => {
    const selection: PresetSelection = {
      bankIds: ["ntb", "commercial", "dfcc"],
      categories: ["dining", "fuel", "travel"]
    };

    expect(suggestPresetName(selection, catalog)).toBe("NTB, ComBank +1 · Dining, Fuel +1");
  });

  it("returns just the bank part when no categories are selected", () => {
    const selection: PresetSelection = { bankIds: ["ntb", "commercial"], categories: [] };
    expect(suggestPresetName(selection, catalog)).toBe("NTB, ComBank");
  });

  it("returns just the category part when no banks are selected", () => {
    const selection: PresetSelection = { bankIds: [], categories: ["dining"] };
    expect(suggestPresetName(selection, catalog)).toBe("Dining");
  });

  it("falls back to the card name, then to a default label", () => {
    const cardOnly: PresetSelection = { bankIds: [], categories: [], cardId: "ntb-visa" };
    expect(suggestPresetName(cardOnly, catalog)).toBe("NTB Visa Platinum");

    const nothing: PresetSelection = { bankIds: [], categories: [] };
    expect(suggestPresetName(nothing, catalog)).toBe("My filters");
  });
});

describe("presetSummary", () => {
  it("pluralises counts and omits zero-count parts", () => {
    const preset: FilterPreset = {
      id: "p1",
      name: "Test",
      bankIds: ["ntb", "commercial", "dfcc"],
      categories: ["dining", "fuel"],
      createdAt: "2026-01-01T00:00:00.000Z"
    };

    expect(presetSummary(reconcilePreset(preset, catalog))).toBe("3 banks · 2 categories");
  });

  it("uses the singular form for single counts and includes a selected card", () => {
    const preset: FilterPreset = {
      id: "p2",
      name: "Test",
      bankIds: ["ntb"],
      categories: [],
      cardId: "ntb-visa",
      createdAt: "2026-01-01T00:00:00.000Z"
    };

    expect(presetSummary(reconcilePreset(preset, catalog))).toBe("1 bank · 1 card");
  });

  it("returns 'All offers' when the reconciled preset is empty", () => {
    const preset: FilterPreset = {
      id: "p3",
      name: "Empty",
      bankIds: [],
      categories: [],
      createdAt: "2026-01-01T00:00:00.000Z"
    };

    expect(presetSummary(reconcilePreset(preset, catalog))).toBe("All offers");
  });
});

describe("isPresetSelectionEmpty", () => {
  it("is true only when there are no banks, categories, or card", () => {
    expect(isPresetSelectionEmpty({ bankIds: [], categories: [] })).toBe(true);
    expect(isPresetSelectionEmpty({ bankIds: ["ntb"], categories: [] })).toBe(false);
    expect(isPresetSelectionEmpty({ bankIds: [], categories: ["dining"] })).toBe(false);
    expect(isPresetSelectionEmpty({ bankIds: [], categories: [], cardId: "ntb-visa" })).toBe(false);
  });
});

describe("presetToRecall", () => {
  const preset: FilterPreset = {
    id: "p1",
    name: "Weekend deals",
    bankIds: ["ntb"],
    categories: ["dining"],
    createdAt: "2026-01-01T00:00:00.000Z"
  };

  it("returns null when filters are already active", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    expect(presetToRecall({ presets: [preset], catalog, hasActiveFilters: true, dismissedAt: null, now })).toBeNull();
  });

  it("returns null when there are no saved presets", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    expect(presetToRecall({ presets: [], catalog, hasActiveFilters: false, dismissedAt: null, now })).toBeNull();
  });

  it("returns null when the prompt was dismissed less than 24h ago", () => {
    const now = new Date("2026-06-01T10:00:00.000Z");
    const dismissedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    expect(presetToRecall({ presets: [preset], catalog, hasActiveFilters: false, dismissedAt, now })).toBeNull();
  });

  it("returns a preset once the dismissal window has passed", () => {
    const now = new Date("2026-06-01T10:00:00.000Z");
    const dismissedAt = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();

    const result = presetToRecall({ presets: [preset], catalog, hasActiveFilters: false, dismissedAt, now });
    expect(result?.id).toBe("p1");
  });

  it("treats an unparseable dismissedAt as not dismissed", () => {
    const now = new Date("2026-06-01T10:00:00.000Z");

    const result = presetToRecall({ presets: [preset], catalog, hasActiveFilters: false, dismissedAt: "garbage", now });
    expect(result?.id).toBe("p1");
  });

  it("returns null when every preset reconciles to empty, even once the dismissal window has passed", () => {
    const now = new Date("2026-06-01T10:00:00.000Z");
    const dismissedAt = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    const emptyPreset: FilterPreset = {
      id: "p2",
      name: "Stale filters",
      bankIds: ["hnb"],
      categories: [],
      createdAt: "2026-01-01T00:00:00.000Z"
    };

    expect(presetToRecall({ presets: [emptyPreset], catalog, hasActiveFilters: false, dismissedAt, now })).toBeNull();
  });

  it("skips an empty preset in favour of the next non-empty one", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const emptyPreset: FilterPreset = {
      id: "p2",
      name: "Stale filters",
      bankIds: ["hnb"],
      categories: [],
      createdAt: "2026-01-01T00:00:00.000Z"
    };

    const result = presetToRecall({ presets: [emptyPreset, preset], catalog, hasActiveFilters: false, dismissedAt: null, now });
    expect(result?.id).toBe("p1");
  });
});

describe("touchPreset and deletePreset", () => {
  it("updates lastUsedAt and self-heals the selection when one is supplied", () => {
    const storage = createMemoryStorage();
    const created = new Date("2026-01-01T00:00:00.000Z");
    const touchedAt = new Date("2026-02-01T00:00:00.000Z");

    const [saved] = savePreset(storage, { name: "Groceries", bankIds: ["ntb"], categories: ["supermarket"] }, created);
    const result = touchPreset(storage, saved.id, touchedAt, { bankIds: ["dfcc"], categories: ["fuel"] });

    expect(result[0].lastUsedAt).toBe(touchedAt.toISOString());
    expect(result[0].bankIds).toEqual(["dfcc"]);
    expect(result[0].categories).toEqual(["fuel"]);
  });

  it("removes a preset by id", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-01-01T00:00:00.000Z");

    const [saved] = savePreset(storage, { name: "Groceries", bankIds: ["ntb"], categories: ["supermarket"] }, now);
    const result = deletePreset(storage, saved.id, now);

    expect(result).toEqual([]);
  });
});

describe("dismissPresetPrompt / readPromptDismissedAt", () => {
  it("writes and reads the dismissal timestamp", () => {
    const storage = createMemoryStorage();
    const now = new Date("2026-06-01T00:00:00.000Z");

    expect(readPromptDismissedAt(storage)).toBeNull();
    dismissPresetPrompt(storage, now);
    expect(readPromptDismissedAt(storage)).toBe(now.toISOString());
  });
});
