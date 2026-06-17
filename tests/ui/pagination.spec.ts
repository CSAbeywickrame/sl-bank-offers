import { expect, test } from "@playwright/test";

test("home page deep links into the requested page and preserves filters while paging", async ({ page }) => {
  await page.goto("/?bank=commercial-bank&page=2&pageSize=24");

  await expect(page).toHaveURL(/bank=commercial-bank/);
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/pageSize=24/);

  await expect(page.getByText("Page 2 of", { exact: false })).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Page 1" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Page 2", exact: true })).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Page 1" }).click();
  await expect(page).toHaveURL(/bank=commercial-bank/);
  await expect(page).toHaveURL(/pageSize=24/);
  await expect(page).not.toHaveURL(/page=2/);
});

test("changing filters and page size resets back to page 1 while preserving the rest of the query state", async ({ page }) => {
  await page.goto("/?bank=commercial-bank&page=2&pageSize=24");

  await page.getByLabel(/^Category$/).selectOption("dining");
  await expect(page).toHaveURL(/bank=commercial-bank/);
  await expect(page).toHaveURL(/category=dining/);
  await expect(page).toHaveURL(/pageSize=24/);
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByText("Page 1 of", { exact: false })).toBeVisible();

  await page.getByLabel(/^Offers per page$/).selectOption("48");
  await expect(page).toHaveURL(/bank=commercial-bank/);
  await expect(page).toHaveURL(/category=dining/);
  await expect(page).toHaveURL(/pageSize=48/);
  await expect(page).not.toHaveURL(/page=2/);
});
