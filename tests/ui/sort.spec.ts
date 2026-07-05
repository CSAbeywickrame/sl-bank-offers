import { expect, test } from "@playwright/test";

test("selecting a sort option updates the URL", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Sort").selectOption("newest");
  await expect(page).toHaveURL(/sort=newest/);

  await page.getByLabel("Sort").selectOption("expiring-soon");
  await expect(page).toHaveURL(/sort=expiring-soon/);

  await page.getByLabel("Sort").selectOption("relevance");
  await expect(page).not.toHaveURL(/sort=/);
});

test("loading the page with a sort query param preselects it in the Sort control", async ({ page }) => {
  await page.goto("/?sort=newest");

  await expect(page.getByLabel("Sort")).toHaveValue("newest");
});
