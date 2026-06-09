import { expect, test } from "@playwright/test";

test("home page filters combined offers by bank and category", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "All bank offers in one place" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Up to 10% off at Cargills Online" })).toBeVisible();

  await page.getByLabel(/^Bank$/).selectOption("commercial-bank");
  await page.getByLabel(/^Category$/).selectOption("travel");
  await page.getByRole("button", { name: "Filter" }).click();

  await expect(page).toHaveURL(/bank=commercial-bank/);
  await expect(page).toHaveURL(/category=travel/);
  const firstOffer = page.locator("article").first();
  await expect(firstOffer.getByText("Commercial Bank of Ceylon")).toBeVisible();
  await expect(firstOffer.getByText("Travel", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Travel offers with Sri Lankan Airlines" })).toBeVisible();
});

test("offer cards include official bank links", async ({ page }) => {
  await page.goto("/");

  const links = page.getByRole("link", { name: "View at bank" });
  await expect(links.first()).toBeVisible();
  await expect(links.first()).toHaveAttribute("href", /https:\/\//);
});

test("offer cards open a dedicated offer detail page", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "View details for Up to 10% off at Cargills Online" }).click();

  await expect(page).toHaveURL(/\/offers\/commercial-bank-cargills-online-june-2026$/);
  await expect(page.getByRole("heading", { name: "Up to 10% off at Cargills Online" })).toBeVisible();
  await expect(page.getByRole("article").getByText("Commercial Bank of Ceylon")).toBeVisible();
  await expect(page.getByText("Commercial Bank Credit Cards")).toBeVisible();
  await expect(page.getByRole("link", { name: "View at bank" })).toHaveAttribute("href", /https:\/\//);
  await expect(page.getByRole("link", { name: "View terms" })).toHaveAttribute("href", /https:\/\//);
});

test("home page filters offers by card", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel(/^Card$/).selectOption("ndb-premium-credit-cards");
  await page.getByRole("button", { name: "Filter" }).click();

  await expect(page).toHaveURL(/card=ndb-premium-credit-cards/);
  await expect(page.getByRole("heading", { name: "Up to 36 months 0% installment plans on education payments" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Up to 10% off at Cargills Online" })).not.toBeVisible();
});

test("bank and category routes render scoped directories", async ({ page }) => {
  await page.goto("/banks/commercial-bank");
  await expect(page.getByRole("heading", { name: "Commercial Bank credit card offers" })).toBeVisible();

  await page.goto("/categories/travel");
  await expect(page.getByRole("heading", { name: "Travel card offers" })).toBeVisible();
});
