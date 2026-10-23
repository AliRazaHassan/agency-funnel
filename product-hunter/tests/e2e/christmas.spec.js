import { test, expect } from "@playwright/test";
test.setTimeout(45000);

test("Christmas data is protected and authenticated CSV has six source-backed rows", async ({
  request,
}) => {
  const locked = await request.get("/api/christmas/shortlist");
  expect(locked.status()).toBe(401);
  await request.post("/api/auth/login", { data: { password: "e2e-secret" } });
  const response = await request.get("/api/christmas/shortlist?market=US");
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.products).toHaveLength(6);
  expect(data.summary.verifiedWinners).toBe(0);
  const csv = await request.post("/api/christmas/export", {
    data: { market: "UK" },
  });
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect((await csv.text()).split("\n")).toHaveLength(7);
  expect(
    (await request.get("/api/christmas/shortlist?market=XX")).status(),
  ).toBe(400);
});

// Christmas is now a constraint on the evidence engine, not six static cards.
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`Christmas constraints and evidence export at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem("sd_onboarded", "1"));
    await page.goto("/");
    await page.getByLabel("Password").fill("e2e-secret");
    await page.getByRole("button", { name: "Enter workspace" }).click();
    await page
      .getByRole("button", { name: "Christmas 2026", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Find evidence. Compare products. Plan a test.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Season", exact: true }),
    ).toHaveValue("christmas-2026");
    await page
      .getByRole("combobox", { name: "Market", exact: true })
      .selectOption("UK");
    await page.getByLabel("Maximum landed cost $").fill("15");
    await page.getByLabel("Minimum pre-ad margin %").fill("60");
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/research/research") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Filter saved evidence" }).click();
    const res = await response;
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.constraints).toMatchObject({
      market: "UK",
      season: "christmas-2026",
      maxLandedCost: 15,
      minMargin: 60,
    });
    expect(data.products).toEqual([]); // isolated store has no UK product evidence; never pad a list.
    await expect(
      page.getByRole("heading", {
        name: "No relevant evidence-backed candidates yet",
      }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export visible results" }).click();
    expect((await download).suggestedFilename()).toBe(
      "signal-desk-research.csv",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
