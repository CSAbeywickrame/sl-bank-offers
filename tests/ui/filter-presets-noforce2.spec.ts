import { expect, test, type Locator, type Page } from "@playwright/test";

const PRESETS_KEY = "cardcompass:filter-presets";
const DISMISSED_KEY = "cardcompass:preset-prompt-dismissed-at";
const DAY_MS = 24 * 60 * 60 * 1000;

interface StoredPreset {
  id: string;
  name: string;
  bankIds: string[];
  categories: string[];
  cardId?: string;
  createdAt: string;
  lastUsedAt?: string;
}

// FilterPresetControls (dropdown trigger + "Save these filters") renders twice in the DOM —
// once for the desktop header row, once for the mobile row — with CSS hiding whichever
// doesn't match the current viewport. Every locator for these two triggers must filter to
// the visible instance; `.first()` would pick the wrong one under the "mobile" project.
function savedFiltersButton(page: Page) {
  return page.getByRole("button", { name: "Saved filters" }).filter({ visible: true });
}

// Returns the visible "Save these filters" trigger (see savedFiltersButton for why this is filtered)
function saveTheseFiltersButton(page: Page) {
  return page.getByRole("button", { name: "Save these filters" }).filter({ visible: true });
}

// Returns the open "Saved filters" popover panel (only ever rendered once, by whichever instance is open)
function savedFiltersGroup(page: Page) {
  return page.getByRole("group", { name: "Saved filters" });
}

// Escapes RegExp special characters so a dynamic preset name can be safely embedded in a pattern
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns a preset row's name button, matched by its accessible name starting with the preset
// name — anchored so it can't also match the sibling "Delete {name}" button in the same row
function presetRowButton(page: Page, name: string) {
  return savedFiltersGroup(page).getByRole("button", { name: new RegExp(`^${escapeRegExp(name)}`) });
}

// Returns a preset row's delete ("x") button by its exact accessible name
function deletePresetButton(page: Page, name: string) {
  return savedFiltersGroup(page).getByRole("button", { name: `Delete ${name}`, exact: true });
}

// Clicks a small, right-aligned control inside the "Saved filters" popover (delete "x", Yes,
// Cancel, "Delete all saved filters"). On the mobile project only, once these rows sit below
// the fold, Playwright's actionability check repeatedly re-triggers scrollIntoViewIfNeeded on
// these edge-of-panel targets and never converges, reporting a false "intercepted by a sibling"
// even though screenshots taken mid-retry show no real overlap and a `force` click lands on and
// correctly activates the intended button every time. `force: true` skips only that flaky
// hit-test — the element still has to be visible, enabled, and attached to be clicked.
function clickInPopover(locator: Locator) {
  return locator.click();
}

// Seeds localStorage with the given presets before the app's first script runs
function seedPresets(page: Page, presets: StoredPreset[]) {
  return page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: PRESETS_KEY, value: presets }
  );
}

// Reads back and parses the raw presets array straight from localStorage
function readStoredPresets(page: Page): Promise<StoredPreset[] | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, PRESETS_KEY);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ presetsKey, dismissedKey }) => {
      window.localStorage.removeItem(presetsKey);
      window.localStorage.removeItem(dismissedKey);
    },
    { presetsKey: PRESETS_KEY, dismissedKey: DISMISSED_KEY }
  );
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "html, body { scroll-behavior: auto !important; }";
    document.documentElement.appendChild(style);
  });
});

test("saves a preset from the UI and persists it to localStorage", async ({ page }) => {
  await page.goto("/?bank=ntb&bank=commercial-bank&category=dining");

  await saveTheseFiltersButton(page).click();

  const nameInput = page.getByLabel("Preset name");
  await expect(nameInput).not.toHaveValue("");

  await nameInput.fill("My combo");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const stored = await readStoredPresets(page);
  expect(stored).toHaveLength(1);
  expect(stored?.[0].bankIds).toEqual(["ntb", "commercial-bank"]);
  expect(stored?.[0].categories).toEqual(["dining"]);
});

test("applies a preset from the dropdown", async ({ page }) => {
  const now = new Date().toISOString();
  await seedPresets(page, [
    { id: "p1", name: "My combo", bankIds: ["ntb", "commercial-bank"], categories: ["dining"], createdAt: now, lastUsedAt: now },
  ]);
  await page.goto("/");

  await savedFiltersButton(page).click();
  await clickInPopover(presetRowButton(page, "My combo"));

  await expect(page).toHaveURL(/bank=ntb/);
  await expect(page).toHaveURL(/bank=commercial-bank/);
  await expect(page).toHaveURL(/category=dining/);
});

test("shows the recall banner on a clean visit and applies it", async ({ page }) => {
  const now = new Date().toISOString();
  await seedPresets(page, [
    { id: "p1", name: "My combo", bankIds: ["ntb", "commercial-bank"], categories: ["dining"], createdAt: now, lastUsedAt: now },
  ]);
  await page.goto("/");

  const banner = page.getByText(/Welcome back/);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("My combo");

  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page).toHaveURL(/bank=ntb/);
  await expect(page).toHaveURL(/bank=commercial-bank/);
  await expect(page).toHaveURL(/category=dining/);
});

test("hides the recall banner when filters are already active", async ({ page }) => {
  const now = new Date().toISOString();
  await seedPresets(page, [
    { id: "p1", name: "My combo", bankIds: ["ntb", "commercial-bank"], categories: ["dining"], createdAt: now, lastUsedAt: now },
  ]);
  await page.goto("/?bank=ntb");

  await expect(page.getByText(/Welcome back/)).not.toBeVisible();
});

test("dismissing the recall banner hides it and records the dismissal", async ({ page }) => {
  const now = new Date().toISOString();
  await seedPresets(page, [
    { id: "p1", name: "My combo", bankIds: ["ntb", "commercial-bank"], categories: ["dining"], createdAt: now, lastUsedAt: now },
  ]);
  await page.goto("/");

  await expect(page.getByText(/Welcome back/)).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText(/Welcome back/)).not.toBeVisible();

  const dismissedAt = await page.evaluate((key) => window.localStorage.getItem(key), DISMISSED_KEY);
  expect(dismissedAt).toBeTruthy();
});

test("deletes a single preset, leaving the other one in place", async ({ page }) => {
  const now = new Date().toISOString();
  await seedPresets(page, [
    { id: "p1", name: "Preset A", bankIds: ["ntb"], categories: [], createdAt: now, lastUsedAt: now },
    { id: "p2", name: "Preset B", bankIds: ["boc"], categories: [], createdAt: now, lastUsedAt: now },
  ]);
  await page.goto("/");

  await savedFiltersButton(page).click();
  await clickInPopover(deletePresetButton(page, "Preset A"));

  await expect(presetRowButton(page, "Preset A")).not.toBeVisible();
  await expect(presetRowButton(page, "Preset B")).toBeVisible();

  const stored = await readStoredPresets(page);
  expect(stored).toHaveLength(1);
  expect(stored?.[0].name).toBe("Preset B");
});

test("clears all presets only after a two-step confirm", async ({ page }) => {
  const now = new Date().toISOString();
  await seedPresets(page, [
    { id: "p1", name: "Preset A", bankIds: ["ntb"], categories: [], createdAt: now, lastUsedAt: now },
    { id: "p2", name: "Preset B", bankIds: ["boc"], categories: [], createdAt: now, lastUsedAt: now },
  ]);
  await page.goto("/");

  await savedFiltersButton(page).click();
  await clickInPopover(savedFiltersGroup(page).getByRole("button", { name: "Delete all saved filters" }));

  await expect(savedFiltersGroup(page).getByText("Delete all 2 saved filters?")).toBeVisible();
  await expect(presetRowButton(page, "Preset A")).toBeVisible();
  await expect(presetRowButton(page, "Preset B")).toBeVisible();

  await clickInPopover(savedFiltersGroup(page).getByRole("button", { name: "Cancel" }));
  await expect(savedFiltersGroup(page).getByText("Delete all 2 saved filters?")).not.toBeVisible();
  await expect(savedFiltersGroup(page).getByRole("button", { name: "Delete all saved filters" })).toBeVisible();

  await clickInPopover(savedFiltersGroup(page).getByRole("button", { name: "Delete all saved filters" }));
  await clickInPopover(savedFiltersGroup(page).getByRole("button", { name: "Yes" }));

  await expect(savedFiltersButton(page)).not.toBeVisible();
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), PRESETS_KEY);
  expect(stored).toBeNull();
});

test("keeps a partially-stale preset usable and drops only the missing bank on apply", async ({ page }) => {
  const now = new Date().toISOString();
  await seedPresets(page, [
    {
      id: "p1",
      name: "Partial",
      bankIds: ["ntb", "bank-that-no-longer-exists"],
      categories: ["dining"],
      createdAt: now,
      lastUsedAt: now,
    },
  ]);
  await page.goto("/");

  await savedFiltersButton(page).click();
  await expect(presetRowButton(page, "Partial")).toContainText(/no longer available/i);

  await clickInPopover(presetRowButton(page, "Partial"));

  await expect(page).toHaveURL(/bank=ntb/);
  await expect(page).toHaveURL(/category=dining/);
  await expect(page).not.toHaveURL(/bank-that-no-longer-exists/);
});

test("disables a fully-stale preset's name button but keeps its delete button working", async ({ page }) => {
  const now = new Date().toISOString();
  await seedPresets(page, [
    { id: "p1", name: "Fully Stale", bankIds: ["gone-bank"], categories: [], createdAt: now, lastUsedAt: now },
  ]);
  await page.goto("/");

  await savedFiltersButton(page).click();

  const row = presetRowButton(page, "Fully Stale");
  await expect(row.getByText("No longer available", { exact: true })).toBeVisible();
  await expect(row).toBeDisabled();

  await clickInPopover(deletePresetButton(page, "Fully Stale"));
  await expect(row).not.toBeVisible();
});

test("prunes a preset that is expired on both createdAt and lastUsedAt", async ({ page }) => {
  const staleTimestamp = new Date(Date.now() - 61 * DAY_MS).toISOString();
  await seedPresets(page, [
    { id: "p1", name: "Old", bankIds: ["ntb"], categories: [], createdAt: staleTimestamp, lastUsedAt: staleTimestamp },
  ]);
  await page.goto("/");

  await expect(savedFiltersButton(page)).not.toBeVisible();
  await expect(page.getByText(/Welcome back/)).not.toBeVisible();
});

test("keeps a preset alive when only lastUsedAt is recent (sliding expiry)", async ({ page }) => {
  const createdAt = new Date(Date.now() - 61 * DAY_MS).toISOString();
  const lastUsedAt = new Date(Date.now() - 3 * DAY_MS).toISOString();
  await seedPresets(page, [
    { id: "p1", name: "Still Alive", bankIds: ["ntb"], categories: [], createdAt, lastUsedAt },
  ]);
  await page.goto("/");

  await expect(savedFiltersButton(page)).toBeVisible();
});

test("does not log a hydration mismatch when presets are seeded before load", async ({ page }) => {
  const now = new Date().toISOString();
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => consoleMessages.push(msg.text()));
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await seedPresets(page, [
    { id: "p1", name: "My combo", bankIds: ["ntb", "commercial-bank"], categories: ["dining"], createdAt: now, lastUsedAt: now },
  ]);
  await page.goto("/");

  await expect(savedFiltersButton(page)).toBeVisible();

  const hydrationIssues = [...consoleMessages, ...pageErrors].filter((text) => /hydrat/i.test(text));
  expect(hydrationIssues).toEqual([]);
});
