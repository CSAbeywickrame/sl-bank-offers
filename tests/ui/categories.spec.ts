import { expect, test } from "@playwright/test";

test("top navigation links to the categories index", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "View Categories" }).click();

  await expect(page).toHaveURL("/categories");
  await expect(page.getByRole("heading", { name: "All Offer Categories" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dining" })).toBeVisible();
});
