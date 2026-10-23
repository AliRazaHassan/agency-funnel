import { test, expect } from "@playwright/test";
test.setTimeout(45000);
test("right-click product statistic keeps analyst menu and sends selected context", async ({
  page,
}) => {
  const p = {
    id: "fixture-context",
    title: "Fixture context product",
    trendScore: 64,
    marginPct: 60,
    category: "Fixture",
    trendStatus: "EMERGING",
    winnerDecision: { score: 60, components: {} },
  };
  await page.route("**/api/projects", (r) =>
    r.fulfill({
      json: {
        projects: [
          { id: "proj_fixture", name: "Context fixture", productCount: 1 },
        ],
      },
    }),
  );
  await page.route("**/api/projects/proj_fixture", (r) =>
    r.fulfill({
      json: {
        id: "proj_fixture",
        regionFocus: "US",
        hunt: { count: 1, products: [p] },
      },
    }),
  );
  await page.addInitScript(() => localStorage.setItem("sd_onboarded", "1"));
  await page.goto("/");
  await page.getByLabel("Password").fill("e2e-secret");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page
    .locator(".project-card")
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await expect(page.locator(".global-progress")).toHaveCount(0);
  await page.locator(".score-quads > div").first().click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/concierge"),
  );
  await page.getByRole("button", { name: "Explain this number" }).click();
  const res = await response;
  expect(res.status()).toBe(200);
  const body = res.request().postDataJSON();
  expect(JSON.stringify(body)).toContain("fixture-context");
  await expect(page.locator(".concierge-msg.assistant").last()).toBeVisible();
  await expect(page.locator(".global-progress")).toHaveCount(0);
});
