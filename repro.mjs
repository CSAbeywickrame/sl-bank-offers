import { chromium, devices } from "playwright";

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["Pixel 7"] });
const page = await context.newPage();

await page.addInitScript(() => {
  window.localStorage.setItem(
    "cardcompass:filter-presets",
    JSON.stringify([
      { id: "p1", name: "Fully Stale", bankIds: ["gone-bank"], categories: [], createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() },
    ])
  );
});

await page.goto("http://localhost:3000/");

const trigger = page.getByRole("button", { name: "Saved filters" }).filter({ visible: true });
await trigger.waitFor({ state: "visible" });
await trigger.click();

const group = page.getByRole("group", { name: "Saved filters" });
await group.waitFor({ state: "visible" });

const deleteBtn = group.getByRole("button", { name: "Delete Fully Stale", exact: true });
await deleteBtn.waitFor({ state: "visible" });

console.log("viewportSize:", page.viewportSize());
console.log(
  "docMetrics:",
  await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    scrollX: window.scrollX,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
  }))
);

// Poll scrollY and bounding box for 5 seconds to see if anything is moving on its own
for (let i = 0; i < 8; i++) {
  const scrollY = await page.evaluate(() => window.scrollY);
  const box = await deleteBtn.boundingBox();
  const groupBox = await group.boundingBox();
  console.log(`t=${i * 250}ms scrollY=${scrollY} deleteBox=${JSON.stringify(box)} groupBox=${JSON.stringify(groupBox)}`);
  await page.waitForTimeout(250);
}

await page.screenshot({ path: "/private/tmp/claude-501/-Users-chaithikaabeywickrame-Desktop-Chaithika-Business-BIZTool-bank-offers/318841d5-bcec-41a8-87e3-a92e04dd18db/scratchpad/before-click.png" });

console.log("Now attempting click without force...");
try {
  await deleteBtn.click({ timeout: 8000 });
  console.log("CLICK SUCCEEDED");
} catch (e) {
  console.log("CLICK FAILED:", e.message.split("\n")[0]);
}

await page.screenshot({ path: "/private/tmp/claude-501/-Users-chaithikaabeywickrame-Desktop-Chaithika-Business-BIZTool-bank-offers/318841d5-bcec-41a8-87e3-a92e04dd18db/scratchpad/after-click.png" });

await browser.close();
