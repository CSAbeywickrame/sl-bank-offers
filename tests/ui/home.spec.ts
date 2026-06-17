import { expect, test } from "@playwright/test";

const pageOneFirstTitle = "Up to 10% off at Cargills Online";
const pageTwoFirstTitle = "20% off at Softlogic Restaurants every Friday";
const pageTwentyFiveTitle = "25% off at Softlogic Glomark";
const diningFirstTitle = "Up to 25% off at selected restaurants with ComBank Visa Cards";

test("deep-linked pagination loads the requested page and survives a reload", async ({ page }) => {
  await page.goto("/?page=2&pageSize=12");

  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/pageSize=12/);
  await expect(page.getByRole("heading", { name: pageTwoFirstTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: pageOneFirstTitle })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");

  await page.reload();

  await expect(page.getByRole("heading", { name: pageTwoFirstTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: pageOneFirstTitle })).not.toBeVisible();
});

test("clicking a numbered page link updates the URL and visible results", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Page 2" }).click();

  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("heading", { name: pageTwoFirstTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: pageOneFirstTitle })).not.toBeVisible();
});

test("changing page size resets pagination to page 1", async ({ page }) => {
  await page.goto("/?page=3&pageSize=12");

  await expect(page.getByRole("heading", { name: pageTwentyFiveTitle })).toBeVisible();

  await page.getByLabel("Offers per page").selectOption("24");

  await expect(page).toHaveURL(/pageSize=24/);
  await expect(page).not.toHaveURL(/page=3/);
  await expect(page.getByRole("heading", { name: pageOneFirstTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: pageTwentyFiveTitle })).not.toBeVisible();
});

test("filter changes preserve page size and reset back to page 1", async ({ page }) => {
  await page.goto("/?page=2&pageSize=24");

  await page.getByLabel(/^Category$/).selectOption("dining");

  await expect(page).toHaveURL(/category=dining/);
  await expect(page).toHaveURL(/pageSize=24/);
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByRole("heading", { name: diningFirstTitle })).toBeVisible();
});
