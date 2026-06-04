import { expect, test } from "@playwright/test";

test("home page filters combined offers by bank and category", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "All bank offers in one place" })).toBeVisible();
  await expect(page.getByText("Dining offer sample")).toHaveCount(0);

  await page.getByLabel("Bank").selectOption("cdb");
  await page.getByLabel("Category").selectOption("dining");
  await page.getByRole("button", { name: "Filter" }).click();

  await expect(page).toHaveURL(/bank=cdb/);
  await expect(page).toHaveURL(/category=dining/);
  const firstOffer = page.locator("article").first();
  await expect(firstOffer.getByText("Citizens Development Business Finance")).toBeVisible();
  await expect(firstOffer.getByText("Dining", { exact: true })).toBeVisible();
});

test("offer cards include official bank links", async ({ page }) => {
  await page.goto("/");

  const links = page.getByRole("link", { name: "View at bank" });
  await expect(links.first()).toBeVisible();
  await expect(links.first()).toHaveAttribute("href", /https:\/\//);
});

test("bank and category routes render scoped directories", async ({ page }) => {
  await page.goto("/banks/cdb");
  await expect(page.getByRole("heading", { name: "CDB credit card offers" })).toBeVisible();

  await page.goto("/categories/hotels");
  await expect(page.getByRole("heading", { name: "Hotels card offers" })).toBeVisible();
});
