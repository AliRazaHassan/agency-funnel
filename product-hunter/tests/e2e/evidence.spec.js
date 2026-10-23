import { test, expect } from "@playwright/test";
const fixture = {
  platform: "amazon",
  externalId: "TEST-ORNAMENT",
  title: "Christmas pet ornament fixture",
  market: "US",
  scope: "product",
  metric: "bought_count",
  value: 0,
  unit: "bought past month",
  dataAt: new Date().toISOString(),
  sourceUrl: "https://example.com/fixture-ornament",
  niche: "Pet gifts",
};
test("evidence API auth import filters save quotes tests refresh export", async ({
  request,
}) => {
  expect((await request.get("/api/research/state")).status()).toBe(401);
  await request.post("/api/auth/login", { data: { password: "e2e-secret" } });
  const imported = await request.post("/api/research/import", {
    data: { observations: [fixture] },
  });
  expect(imported.status()).toBe(200);
  const bad = await request.post("/api/research/import", {
    data: { observations: [{ ...fixture, value: null }] },
  });
  expect(bad.status()).toBe(400);
  const run = async () => {
    const r = await request.post("/api/research/research", {
      data: {
        query: "Christmas pet",
        constraints: { market: "US" },
        refresh: false,
      },
    });
    expect(r.status()).toBe(200);
    return r.json();
  };
  let r = await run();
  expect(r.products).toHaveLength(1);
  expect(r.products[0].observations[0].value).toBe(0);
  expect(r.products[0].dimensions.salesEvidence).toBeNull();
  const id = r.products[0].id;
  const save = await request.post(`/api/research/products/${id}`, {
    data: {
      shortlisted: true,
      quote: {
        supplier: "Fixture supplier",
        url: "https://example.com/supplier",
        variant: "ornament",
        quotedAt: new Date().toISOString(),
        processingDays: 2,
        transitDays: 8,
        personalizationDays: 0,
      },
      test: { spend: 0, revenue: 0, purchases: 0 },
    },
  });
  expect(save.status()).toBe(200);
  r = await run();
  expect(r.products[0].shortlisted).toBe(true);
  expect(r.products[0].quotes).toHaveLength(1);
  expect(r.products[0].tests).toHaveLength(1);
  const exported = await request.post("/api/research/export", {
    data: { sessionId: r.id },
  });
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain("bought_count=0");
  expect(await exported.text()).toContain(r.products[0].verdict);
  await request.post("/api/auth/logout");
  expect((await request.get("/api/research/state")).status()).toBe(401);
});
for (const width of [1440, 390])
  test(`evidence workflow desktop/mobile ${width}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("sd_onboarded", "1"));
    await page.goto("/");
    await page.getByLabel("Password").fill("e2e-secret");
    await page.getByRole("button", { name: "Enter workspace" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Find evidence. Compare products. Plan a test.",
      }),
    ).toBeVisible();
    await page
      .getByLabel("Research request", { exact: true })
      .fill("Christmas pet");
    await page.getByRole("button", { name: "Filter saved evidence" }).click();
    await expect(
      page.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Compare evidence & economics" })
      .click();
    await expect(
      page.getByRole("region", { name: "Product research detail" }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "0 bought past month", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export visible results" }).click();
    expect((await download).suggestedFilename()).toBe(
      "signal-desk-research.csv",
    );
    await page.screenshot({
      path: `test-results/evidence-${width}.png`,
      fullPage: true,
    });
  });
