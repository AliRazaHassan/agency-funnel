# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-hunter.spec.js >> complete Product Hunter workflow
- Location: tests/e2e/product-hunter.spec.js:26:1

# Error details

```
Test timeout of 25000ms exceeded.
```

```
Error: locator.click: Test timeout of 25000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Launch Product Hunter' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - heading "Product Hunter AI" [level=1] [ref=e6]
      - paragraph [ref=e7]: Trend intelligence · evidence → momentum → profit → Shopify
    - navigation [ref=e8]:
      - button "Evidence research" [ref=e9] [cursor=pointer]
      - button "Home" [ref=e10] [cursor=pointer]
      - button "1 Discover" [ref=e11] [cursor=pointer]:
        - generic [ref=e12]: "1"
        - text: Discover
      - button "2 Radar" [ref=e13] [cursor=pointer]:
        - generic [ref=e14]: "2"
        - text: Radar
      - button "3 Validate" [ref=e15] [cursor=pointer]:
        - generic [ref=e16]: "3"
        - text: Validate
      - button "4 Test" [ref=e17] [cursor=pointer]:
        - generic [ref=e18]: "4"
        - text: Test
      - button "5 Launch" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: "5"
        - text: Launch
      - button "Christmas 2026" [ref=e21] [cursor=pointer]
      - button "Legacy rankings" [ref=e22] [cursor=pointer]
      - button "Settings" [ref=e23] [cursor=pointer]
    - button "Lock" [ref=e25] [cursor=pointer]
  - button "Open AI analyst" [ref=e26] [cursor=pointer]:
    - generic [ref=e27]: AI
    - generic [ref=e28]: Ask analyst
  - main [ref=e29]:
    - generic [ref=e30]:
      - generic [ref=e31]: SIGNAL DESK · EVIDENCE RESEARCH
      - heading "Find evidence. Compare products. Plan a test." [level=2] [ref=e32]
      - paragraph [ref=e33]: Research the US market by default. Every candidate starts with an exact, dated source observation.
    - generic [ref=e34]:
      - generic [ref=e35]:
        - text: Research request / concierge
        - textbox "Research request" [ref=e36]:
          - /placeholder: Find Christmas pet products in the US
      - generic [ref=e37]:
        - text: Market
        - combobox "Market" [ref=e38]:
          - option "US" [selected]
          - option "UK"
          - option "CA"
          - option "AU"
          - option "DE"
          - option "FR"
      - generic [ref=e39]:
        - text: Season
        - combobox "Season" [ref=e40]:
          - option "Any season" [selected]
          - option "Christmas 2026"
      - generic [ref=e41]:
        - text: Maximum landed cost $
        - spinbutton "Maximum landed cost $" [ref=e42]
      - generic [ref=e43]:
        - text: Minimum pre-ad margin %
        - spinbutton "Minimum pre-ad margin %" [ref=e44]
      - button "Research / refresh providers" [ref=e45] [cursor=pointer]
      - button "Filter saved evidence" [ref=e46] [cursor=pointer]
    - navigation "Research sections" [ref=e47]:
      - button "Products" [ref=e48] [cursor=pointer]
      - button "Niches" [ref=e49] [cursor=pointer]
      - button "Shortlist" [ref=e50] [cursor=pointer]
      - button "History" [ref=e51] [cursor=pointer]
      - button "Providers" [ref=e52] [cursor=pointer]
      - button "Import" [ref=e53] [cursor=pointer]
      - button "Export visible results" [ref=e54] [cursor=pointer]
    - paragraph [ref=e55]: 1 candidates · US · 10/22/2026, 3:25:11 PM · Ranked from dated exact observations. No guaranteed winners.
    - article [ref=e57]:
      - generic [ref=e58]: Pet gifts · US
      - heading "Christmas pet ornament fixture" [level=3] [ref=e59]
      - strong [ref=e60]: Research candidate
      - paragraph [ref=e61]: Research confidence 25/100 · 1 platforms
      - paragraph [ref=e62]: Contribution Unknown · margin Unknown% · delivery on-time
      - paragraph [ref=e63]: Recent product-level sales evidence
      - button "Compare evidence & economics" [ref=e64] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | async function login(page) {
  4   |   await page.goto("/");
  5   |   await expect(page.getByRole("heading", { name: "Signal Desk" })).toBeVisible();
  6   |   await page.getByLabel("Password").fill("e2e-secret");
  7   |   await page.getByRole("button", { name: "Enter workspace" }).click();
  8   |   await expect(page.getByText("Product Hunter AI", { exact: false })).toBeVisible();
  9   | }
  10  | 
  11  | test.beforeEach(async ({ page }) => {
  12  |   await page.addInitScript(() => localStorage.setItem("sd_onboarded", "1"));
  13  | });
  14  | 
  15  | test("auth rejects wrong password then accepts valid password", async ({ page }) => {
  16  |   await page.goto("/");
  17  |   await page.getByLabel("Password").fill("wrong-password");
  18  |   await page.getByRole("button", { name: "Enter workspace" }).click();
  19  |   await expect(page.getByText("Wrong password")).toBeVisible();
  20  | 
  21  |   await page.getByLabel("Password").fill("e2e-secret");
  22  |   await page.getByRole("button", { name: "Enter workspace" }).click();
  23  |   await expect(page.getByRole("button", { name: "Launch Product Hunter" })).toBeVisible();
  24  | });
  25  | 
  26  | test("complete Product Hunter workflow", async ({ page }) => {
  27  |   await login(page);
  28  | 
> 29  |   await page.getByRole("button", { name: "Launch Product Hunter" }).click();
      |                                                                     ^ Error: locator.click: Test timeout of 25000ms exceeded.
  30  |   await expect(page.getByText("Where should you sell next?")).toBeVisible();
  31  | 
  32  |   await page.getByLabel("Region").selectOption({ label: "US" });
  33  |   await page.getByLabel("Budget USD").fill("500");
  34  |   await page.getByLabel("Niche hint").fill("pet");
  35  |   await page.getByRole("button", { name: "Run market scout" }).click();
  36  | 
  37  |   await expect(page.getByText(/Ranked opportunities/)).toBeVisible({ timeout: 60000 });
  38  |   const huntButton = page.getByRole("button", { name: "Hunt products" }).first();
  39  |   await expect(huntButton).toBeVisible();
  40  |   await huntButton.click();
  41  | 
  42  |   await expect(page.getByText(/Products ·/)).toBeVisible({ timeout: 90000 });
  43  |   const rows = page.locator(".products-panel tbody tr");
  44  |   await expect(rows.first()).toBeVisible();
  45  |   expect(await rows.count()).toBeGreaterThan(0);
  46  | 
  47  |   const exportButton = page.getByRole("button", { name: /Export \d+ SKUs/ });
  48  |   await expect(exportButton).toBeEnabled();
  49  |   const downloadPromise = page.waitForEvent("download");
  50  |   await exportButton.click();
  51  |   const download = await downloadPromise;
  52  |   expect(download.suggestedFilename()).toContain(".csv");
  53  | 
  54  |   await page.getByRole("button", { name: "Product Radar" }).click();
  55  |   await expect(page.getByRole("heading", { name: "See momentum before saturation." })).toBeVisible();
  56  |   await expect(page.locator(".radar-card").first()).toBeVisible();
  57  | 
  58  |   const firstStat = page.locator(".radar-card .score-quads > div").first();
  59  |   await firstStat.click({ button: "right" });
  60  |   await expect(page.getByText("Ask about this")).toBeVisible();
  61  |   await page.getByRole("button", { name: "Explain this number" }).click();
  62  |   await expect(page.getByText("Product Analyst")).toBeVisible();
  63  |   await expect(page.locator(".concierge-msg.assistant").last()).toBeVisible({ timeout: 30000 });
  64  | 
  65  |   await page.getByRole("button", { name: "×" }).first().click().catch(() => {});
  66  | 
  67  |   const validateButton = page.locator(".radar-card").first().getByRole("button", { name: "Validate" });
  68  |   await validateButton.click();
  69  |   await expect(page.getByText("PRODUCT VALIDATION")).toBeVisible();
  70  |   await expect(page.getByText("TRACKED MOMENTUM")).toBeVisible({ timeout: 30000 });
  71  |   await expect(page.getByText("MARKET FEEDBACK")).toBeVisible();
  72  | 
  73  |   await page.getByLabel("Supplier source").fill("CJ Dropshipping verified quote");
  74  |   await page.getByLabel("Landed cost $").fill("10");
  75  |   await page.getByLabel("Shipping days").fill("8");
  76  |   await page.getByRole("button", { name: "Save verified supplier quote" }).click();
  77  |   await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  78  | 
  79  |   const fields = page.locator(".ad-test-card:not(.supplier-verify-card) .ad-test-form input");
  80  |   await fields.nth(0).fill("20");
  81  |   await fields.nth(1).fill("5000");
  82  |   await fields.nth(2).fill("180");
  83  |   await fields.nth(3).fill("30");
  84  |   await fields.nth(4).fill("5");
  85  |   await fields.nth(5).fill("250");
  86  |   await page.getByRole("button", { name: "Save test & re-score" }).click();
  87  | 
  88  |   await expect(page.locator(".proof-pill")).toBeVisible();
  89  |   await expect(page.locator(".validation-flow button.on")).toContainText("VALIDATED");
  90  | 
  91  |   await page.getByRole("button", { name: "×" }).first().click().catch(() => {});
  92  | 
  93  |   await page.locator(".radar-card").first().getByRole("button", { name: "Shopify draft" }).click();
  94  |   await expect(page.getByText(/Shopify is not connected/)).toBeVisible({ timeout: 15000 });
  95  | 
  96  |   await page.getByRole("button", { name: "Discover" }).click();
  97  |   const saveProject = page.getByRole("button", { name: /Save project|Update project/ }).first();
  98  |   await expect(saveProject).toBeEnabled();
  99  |   await saveProject.click();
  100 |   await expect(page.getByText(/Project saved/)).toBeVisible();
  101 | 
  102 |   await page.getByRole("button", { name: "Home" }).click();
  103 |   await expect(page.getByText("Saved projects")).toBeVisible();
  104 |   await expect(page.locator(".project-card").first()).toBeVisible();
  105 |   await page.locator(".project-card").first().getByRole("button", { name: "Open" }).click();
  106 |   await expect(page.getByRole("heading", { name: "See momentum before saturation." })).toBeVisible();
  107 | 
  108 |   await page.getByRole("button", { name: "Settings" }).click();
  109 |   await expect(page.getByText(/Research store:/)).toBeVisible();
  110 |   await expect(page.getByText(/Shopify:/)).toBeVisible();
  111 | });
  112 | 
  113 | test("center loader is a viewport-centered overlay and concierge avoids it", async ({ page }) => {
  114 |   await login(page);
  115 |   await page.getByRole("button", { name: "Launch Product Hunter" }).click();
  116 | 
  117 |   await page.getByRole("button", { name: "Run market scout" }).click();
  118 |   const overlay = page.locator(".global-progress");
  119 |   await expect(overlay).toBeVisible();
  120 | 
  121 |   const overlayBox = await overlay.boundingBox();
  122 |   const cardBox = await page.locator(".global-progress-card").boundingBox();
  123 |   const viewport = page.viewportSize();
  124 |   expect(overlayBox?.width).toBeGreaterThan((viewport?.width || 0) * 0.95);
  125 |   expect(Math.abs((cardBox.x + cardBox.width / 2) - viewport.width / 2)).toBeLessThan(8);
  126 |   expect(Math.abs((cardBox.y + cardBox.height / 2) - viewport.height / 2)).toBeLessThan(8);
  127 | 
  128 |   await expect(page.getByText(/Ranked opportunities/)).toBeVisible({ timeout: 60000 });
  129 |   await page.getByRole("button", { name: "Hunt products" }).first().click();
```