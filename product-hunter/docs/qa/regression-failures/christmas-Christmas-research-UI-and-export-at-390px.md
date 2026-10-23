# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: christmas.spec.js >> Christmas research UI and export at 390px
- Location: tests/e2e/christmas.spec.js:19:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Choose what deserves a Christmas test.' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Choose what deserves a Christmas test.' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Choose what deserves a Christmas test.' })

```

```yaml
- banner:
  - heading "Product Hunter AI" [level=1]
  - paragraph: Trend intelligence · evidence → momentum → profit → Shopify
  - navigation:
    - button "Evidence research"
    - button "Home"
    - button "1 Discover"
    - button "2 Radar"
    - button "3 Validate"
    - button "4 Test"
    - button "5 Launch"
    - button "Christmas 2026"
    - button "Legacy rankings"
    - button "Settings"
  - button "Lock"
- button "Open AI analyst": AI Ask analyst
- main:
  - text: SIGNAL DESK · EVIDENCE RESEARCH
  - heading "Find evidence. Compare products. Plan a test." [level=2]
  - paragraph: Research the US market by default. Every candidate starts with an exact, dated source observation.
  - text: Research request / concierge
  - textbox "Research request":
    - /placeholder: Find Christmas pet products in the US
    - text: Christmas
  - text: Market
  - combobox "Market":
    - option "US" [selected]
    - option "UK"
    - option "CA"
    - option "AU"
    - option "DE"
    - option "FR"
  - text: Season
  - combobox "Season":
    - option "Any season"
    - option "Christmas 2026" [selected]
  - text: Maximum landed cost $
  - spinbutton "Maximum landed cost $"
  - text: Minimum pre-ad margin %
  - spinbutton "Minimum pre-ad margin %"
  - button "Research / refresh providers"
  - button "Filter saved evidence"
  - navigation "Research sections":
    - button "Products"
    - button "Niches"
    - button "Shortlist"
    - button "History"
    - button "Providers"
    - button "Import"
    - button "Export visible results" [disabled]
  - heading "No relevant evidence-backed candidates yet" [level=3]
  - paragraph: Collect observations from available providers or import dated product records. Cost and margin filters exclude candidates with incomplete economics. An empty shortlist is a source gap to resolve.
  - button "Add source observations"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test("Christmas data is protected and authenticated CSV has six source-backed rows", async ({request}) => {
  4  |   const locked=await request.get("/api/christmas/shortlist");
  5  |   expect(locked.status()).toBe(401);
  6  |   await request.post("/api/auth/login",{data:{password:"e2e-secret"}});
  7  |   const response=await request.get("/api/christmas/shortlist?market=US");
  8  |   expect(response.ok()).toBeTruthy();
  9  |   const data=await response.json();
  10 |   expect(data.products).toHaveLength(6);
  11 |   expect(data.summary.verifiedWinners).toBe(0);
  12 |   const csv=await request.post("/api/christmas/export",{data:{market:"UK"}});
  13 |   expect(csv.headers()["content-type"]).toContain("text/csv");
  14 |   expect((await csv.text()).split("\n")).toHaveLength(7);
  15 |   expect((await request.get("/api/christmas/shortlist?market=XX")).status()).toBe(400);
  16 | });
  17 | 
  18 | for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  19 |   test(`Christmas research UI and export at ${viewport.width}px`, async ({page}) => {
  20 |     await page.setViewportSize(viewport);
  21 |     await page.addInitScript(()=>localStorage.setItem("sd_onboarded","1"));
  22 |     await page.goto("/");
  23 |     await page.getByLabel("Password").fill("e2e-secret");
  24 |     await page.getByRole("button",{name:"Enter workspace"}).click();
  25 |     await page.getByRole("button",{name:"Christmas 2026",exact:true}).click();
> 26 |     await expect(page.getByRole("heading",{name:"Choose what deserves a Christmas test."})).toBeVisible();
     |                                                                                             ^ Error: expect(locator).toBeVisible() failed
  27 |     await expect(page.locator(".christmas-candidate")).toHaveCount(6);
  28 |     await expect(page.getByText("6 research priorities · 0 ready to test · 0 verified winners")).toBeVisible();
  29 |     expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  30 |     await page.getByLabel("Target market").selectOption("UK");
  31 |     await expect(page.locator('.christmas-candidate a[href*="amazon.co.uk"]').first()).toBeVisible();
  32 |     const download=page.waitForEvent("download");
  33 |     await page.getByRole("button",{name:"Download shortlist CSV"}).click();
  34 |     expect((await download).suggestedFilename()).toBe("christmas-2026-UK.csv");
  35 |     // Assert the live UI sends the selected product and market to full discovery.
  36 |     await page.route("**/api/discovery/full", async route=>{
  37 |       const body=route.request().postDataJSON();
  38 |       expect(body.regionFocus).toBe("UK"); expect(body.query).toContain("Christmas 2026 Personalized pet ornament");
  39 |       await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({scout:{opportunities:[]},selectedOpp:{niche:"Christmas"},hunt:{products:[]}})});
  40 |     });
  41 |     await page.getByRole("button",{name:"Research this product",exact:true}).first().click();
  42 |     await expect(page.getByRole("heading",{name:"Shortlist decisions, not 50-row homework."})).toBeVisible();
  43 |   });
  44 | }
  45 | 
```