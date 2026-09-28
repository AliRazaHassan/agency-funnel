import { test, expect } from "@playwright/test";

async function login(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Signal Desk" })).toBeVisible();
  await page.getByLabel("Password").fill("e2e-secret");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await expect(page.getByText("Product Hunter AI", { exact: false })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sd_onboarded", "1"));
});

test("auth rejects wrong password then accepts valid password", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await expect(page.getByText("Wrong password")).toBeVisible();

  await page.getByLabel("Password").fill("e2e-secret");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await expect(page.getByRole("button", { name: "Launch Product Hunter" })).toBeVisible();
});

test("complete Product Hunter workflow", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Launch Product Hunter" }).click();
  await expect(page.getByText("Where should you sell next?")).toBeVisible();

  await page.getByLabel("Region").selectOption({ label: "US" });
  await page.getByLabel("Budget USD").fill("500");
  await page.getByLabel("Niche hint").fill("pet");
  await page.getByRole("button", { name: "Run market scout" }).click();

  await expect(page.getByText(/Ranked opportunities/)).toBeVisible({ timeout: 60000 });
  const huntButton = page.getByRole("button", { name: "Hunt products" }).first();
  await expect(huntButton).toBeVisible();
  await huntButton.click();

  await expect(page.getByText(/Products ·/)).toBeVisible({ timeout: 90000 });
  const rows = page.locator(".products-panel tbody tr");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);

  const exportButton = page.getByRole("button", { name: /Export \d+ SKUs/ });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(".csv");

  await page.getByRole("button", { name: "Product Radar" }).click();
  await expect(page.getByRole("heading", { name: "See momentum before saturation." })).toBeVisible();
  await expect(page.locator(".radar-card").first()).toBeVisible();

  const firstStat = page.locator(".radar-card .score-quads > div").first();
  await firstStat.click({ button: "right" });
  await expect(page.getByText("Ask about this")).toBeVisible();
  await page.getByRole("button", { name: "Explain this number" }).click();
  await expect(page.getByText("Product Analyst")).toBeVisible();
  await expect(page.locator(".concierge-msg.assistant").last()).toBeVisible({ timeout: 30000 });

  await page.getByRole("button", { name: "×" }).first().click().catch(() => {});

  const validateButton = page.locator(".radar-card").first().getByRole("button", { name: "Validate" });
  await validateButton.click();
  await expect(page.getByText("PRODUCT VALIDATION")).toBeVisible();
  await expect(page.getByText("TRACKED MOMENTUM")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("MARKET FEEDBACK")).toBeVisible();

  const fields = page.locator(".ad-test-form input");
  await fields.nth(0).fill("60");
  await fields.nth(1).fill("5000");
  await fields.nth(2).fill("180");
  await fields.nth(3).fill("24");
  await fields.nth(4).fill("3");
  await fields.nth(5).fill("180");
  await page.getByRole("button", { name: "Save test & re-score" }).click();

  await expect(page.locator(".proof-pill")).toBeVisible();
  await expect(page.locator(".validation-flow button.on")).toContainText("VALIDATED");

  await page.getByRole("button", { name: "×" }).first().click().catch(() => {});

  await page.locator(".radar-card").first().getByRole("button", { name: "Shopify draft" }).click();
  await expect(page.getByText(/Shopify is not connected/)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Discover" }).click();
  const saveProject = page.getByRole("button", { name: /Save project|Update project/ }).first();
  await expect(saveProject).toBeEnabled();
  await saveProject.click();
  await expect(page.getByText(/Project saved/)).toBeVisible();

  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.getByText("Saved projects")).toBeVisible();
  await expect(page.locator(".project-card").first()).toBeVisible();
  await page.locator(".project-card").first().getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "See momentum before saturation." })).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText(/Research store:/)).toBeVisible();
  await expect(page.getByText(/Shopify:/)).toBeVisible();
});

test("center loader is a viewport-centered overlay and concierge avoids it", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Launch Product Hunter" }).click();

  await page.getByRole("button", { name: "Run market scout" }).click();
  const overlay = page.locator(".global-progress");
  await expect(overlay).toBeVisible();

  const overlayBox = await overlay.boundingBox();
  const cardBox = await page.locator(".global-progress-card").boundingBox();
  const viewport = page.viewportSize();
  expect(overlayBox?.width).toBeGreaterThan((viewport?.width || 0) * 0.95);
  expect(Math.abs((cardBox.x + cardBox.width / 2) - viewport.width / 2)).toBeLessThan(8);
  expect(Math.abs((cardBox.y + cardBox.height / 2) - viewport.height / 2)).toBeLessThan(8);

  await expect(page.getByText(/Ranked opportunities/)).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Hunt products" }).first().click();
  await expect(page.getByText(/Products ·/)).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "Product Radar" }).click();

  await page.locator(".radar-card .score-quads > div").first().click({ button: "right" });
  await page.getByRole("button", { name: "Explain this number" }).click();
  await expect(page.getByText("Product Analyst")).toBeVisible();
  await expect(page.locator(".global-progress")).toHaveCount(0);
});
