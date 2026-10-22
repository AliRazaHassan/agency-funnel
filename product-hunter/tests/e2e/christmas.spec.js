import { test, expect } from "@playwright/test";

test("Christmas data is protected and authenticated CSV has six source-backed rows", async ({request}) => {
  const locked=await request.get("/api/christmas/shortlist");
  expect(locked.status()).toBe(401);
  await request.post("/api/auth/login",{data:{password:"e2e-secret"}});
  const response=await request.get("/api/christmas/shortlist?market=US");
  expect(response.ok()).toBeTruthy();
  const data=await response.json();
  expect(data.products).toHaveLength(6);
  expect(data.summary.verifiedWinners).toBe(0);
  const csv=await request.post("/api/christmas/export",{data:{market:"UK"}});
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect((await csv.text()).split("\n")).toHaveLength(7);
  expect((await request.get("/api/christmas/shortlist?market=XX")).status()).toBe(400);
});

for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  test(`Christmas research UI and export at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(()=>localStorage.setItem("sd_onboarded","1"));
    await page.goto("/");
    await page.getByLabel("Password").fill("e2e-secret");
    await page.getByRole("button",{name:"Enter workspace"}).click();
    await page.getByRole("button",{name:"Christmas 2026",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Choose what deserves a Christmas test."})).toBeVisible();
    await expect(page.locator(".christmas-candidate")).toHaveCount(6);
    await expect(page.getByText("6 research priorities · 0 ready to test · 0 verified winners")).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.getByLabel("Target market").selectOption("UK");
    await expect(page.locator('.christmas-candidate a[href*="amazon.co.uk"]').first()).toBeVisible();
    const download=page.waitForEvent("download");
    await page.getByRole("button",{name:"Download shortlist CSV"}).click();
    expect((await download).suggestedFilename()).toBe("christmas-2026-UK.csv");
    // Assert the live UI sends the selected product and market to full discovery.
    await page.route("**/api/discovery/full", async route=>{
      const body=route.request().postDataJSON();
      expect(body.regionFocus).toBe("UK"); expect(body.query).toContain("Christmas 2026 Personalized pet ornament");
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({scout:{opportunities:[]},selectedOpp:{niche:"Christmas"},hunt:{products:[]}})});
    });
    await page.getByRole("button",{name:"Research this product",exact:true}).first().click();
    await expect(page.getByRole("heading",{name:"Shortlist decisions, not 50-row homework."})).toBeVisible();
  });
}
