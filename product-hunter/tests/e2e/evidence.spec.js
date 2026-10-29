import { test, expect } from "@playwright/test";
test.setTimeout(45000);
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
test("supplier catalog imports persist without becoming demand evidence", async ({ request }) => {
  await request.post("/api/auth/login", { data: { password: "e2e-secret" } });
  const supplier = { ...fixture, platform: "supplier", externalId: "SUPPLIER-CATALOG-FIXTURE", title: "Supplier catalog regression", niche: "Catalog regression", metric: "catalog_price", value: 15.99, unit: "USD retail", identityKey: "supplier-regression" };
  expect((await request.post("/api/research/import", { data: { observations: [supplier] } })).status()).toBe(200);
  expect((await request.post("/api/research/import", { data: { observations: [{ ...supplier, metric: "shop_sales" }] } })).status()).toBe(400);
  const result = await (await request.post("/api/research/research", { data: { query: "catalog regression", constraints: { market: "US" }, refresh: false } })).json();
  expect(result.products).toHaveLength(1);
  expect(result.products[0].verdict).toBe("Supplier catalog only · validation pending");
  expect(result.products[0].confidence).toBe(0);
  expect(result.products[0].dimensions.platformCoverage).toBe(0);
  expect(result.products[0].dimensions.salesEvidence).toBeNull();
  const saved = await (await request.get("/api/research/state")).json();
  expect(saved.observations.find(o => o.externalId === supplier.externalId).dataStatus).toBe("manual");
});
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
        destination: "US",
        currency: "USD",
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
  expect((await request.post(`/api/research/products/${id}`,{data:{economics:{sellingPrice:40,shipping:-10}}})).status()).toBe(400);
  expect((await request.post('/api/research/research',{data:{refresh:false,constraints:{market:'US',testingDays:-100}}})).status()).toBe(400);
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
    await page.getByLabel("Password", { exact: true }).fill("e2e-secret");
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

test('saved-session hydration cannot append to a newly entered research request',async({page})=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 await page.route('**/api/research/state',async route=>{await pending;await route.fulfill({json:{observations:[],records:{},runs:[],sessions:[{id:'saved-hydration',createdAt:new Date().toISOString(),constraints:{market:'US',query:'Previous research'},products:[],count:0}]}});});
 await page.addInitScript(()=>localStorage.setItem('sd_onboarded','1'));
 await page.goto('/');await page.getByLabel('Password', { exact: true }).fill('e2e-secret');await page.getByRole('button',{name:'Enter workspace'}).click();
 const input=page.getByLabel('Research request',{exact:true});await expect(input).toBeDisabled();release();await expect(input).toBeEnabled();await expect(input).toHaveValue('Previous research');
 await input.fill('Christmas pet');const response=page.waitForResponse(r=>r.url().endsWith('/api/research/research')&&r.request().method()==='POST');await page.getByRole('button',{name:'Filter saved evidence'}).click();const res=await response;expect(res.status()).toBe(200);expect(res.request().postDataJSON().query).toBe('Christmas pet');
});

test('TikTok native import rejects stale/unknown-market evidence and displays discovery without product promotion', async ({page, request}) => {
  expect((await request.post('/api/research/apify/sync',{data:{items:[]}})).status()).toBe(401);
  await request.post('/api/auth/login',{data:{password:'e2e-secret'}});
  const video={id:'1234567890123456789',text:'Fresh TikTok test discovery',locationCreated:'US',createTimeISO:new Date().toISOString(),webVideoUrl:'https://www.tiktok.com/@fixture/video/1234567890123456789',playCount:100,shareCount:0};
  const imported=await request.post('/api/research/apify/sync',{data:{market:'US',query:'Fresh TikTok test discovery',items:[video,{...video,createTimeISO:'2022-06-01'},{...video,locationCreated:null}]}});
  expect(imported.status()).toBe(200);
  const result=await imported.json(); expect(result.acceptedVideos).toBe(1);expect(result.count).toBe(2);expect(Object.keys(result.rejected)).toHaveLength(2);
  const run=await request.post('/api/research/research',{data:{query:video.text,constraints:{market:'US'},refresh:false}});
  const session=await run.json();expect(session.products).toHaveLength(0);expect(session.discoveries).toHaveLength(2);
  await page.goto('/');
  await page.addInitScript(() => localStorage.setItem('sd_onboarded', '1'));
  await page.reload();
  await page.getByLabel('Password', { exact: true }).fill('e2e-secret');
  await page.getByRole('button',{name:'Enter workspace'}).click();
  await page.getByRole('button',{name:'Providers',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sync existing dataset',exact:true})).toBeDisabled();
  await expect(page.getByRole('link',{name:video.text,exact:true})).toHaveCount(2);
});

test('automatic hunting requires authentication and missing token fails before spending',async({request,page})=>{
 expect((await request.post('/api/research/hunt/start',{data:{}})).status()).toBe(401);
 await request.post('/api/auth/login',{data:{password:'e2e-secret'}});
 const response=await request.post('/api/research/hunt/start',{data:{query:'pet brush',market:'US',requestId:'11111111-1111-1111-1111-111111111111'}});
 expect(response.status()).toBe(400);expect((await response.json()).error).toContain('APIFY_TOKEN');
 expect((await (await request.get('/api/research/state')).json()).hunts || []).toHaveLength(0);
});

test('automatic hunt button starts once, polls completion and refreshes evidence without manual import',async({page})=>{
 let starts=0,refreshes=0;
 await page.addInitScript(()=>localStorage.setItem('sd_onboarded','1'));
 await page.route('**/api/research/status',route=>route.fulfill({json:{apify:{configured:true},storage:'file',providers:[]}}));
 await page.route('**/api/research/hunt/start',route=>{starts++;const body=route.request().postDataJSON();expect(body.query).toBe('pet brush');expect(body.platform).toBe('tiktok');return route.fulfill({json:{id:'fixture-run',status:'RUNNING',query:'pet brush'}});});
 await page.route('**/api/research/hunt/fixture-run',route=>route.fulfill({json:{id:'fixture-run',status:'SUCCEEDED',query:'pet brush',acceptedVideos:1,count:2,rejected:{}}}));
 await page.route('**/api/research/research',route=>{refreshes++;expect(route.request().postDataJSON().refresh).toBe(true);return route.fulfill({json:{id:'fixture-session',createdAt:new Date().toISOString(),constraints:{query:'pet brush',market:'US'},products:[],niches:[],discoveries:[],providers:[],note:'No sales inferred'}});});
 await page.goto('/');await page.getByLabel('Password', { exact: true }).fill('e2e-secret');await page.getByRole('button',{name:'Enter workspace'}).click();
 await page.getByLabel('Research request',{exact:true}).fill('pet brush');
 await page.getByRole('button',{name:'Start automatic hunt · free credits only',exact:true}).click();
 await expect(page.getByText(/Automatic hunt finished: 1 accepted source records, 2 metrics/)).toBeVisible();
 expect(starts).toBe(1);expect(refreshes).toBe(1);
});

for (const width of [1440, 390]) test(`discovery match preserves evidence and opens supplier costing at ${width}px`,async({page,request})=>{
  expect((await request.post('/api/research/match',{data:{}})).status()).toBe(401);
  await request.post('/api/auth/login',{data:{password:'e2e-secret'}});
  const video={id:`123456789012345${width}`,text:`Christmas pet matching ${width}`,locationCreated:'US',createTimeISO:new Date().toISOString(),webVideoUrl:`https://www.tiktok.com/@fixture/video/123456789012345${width}`,playCount:321,shareCount:0};
  await request.post('/api/research/apify/sync',{data:{market:'US',query:video.text,items:[video]}});
  await page.setViewportSize({width,height:900});
  await page.addInitScript(()=>localStorage.setItem('sd_onboarded','1'));
  await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('e2e-secret');await page.getByRole('button',{name:'Enter workspace'}).click();
  await page.getByLabel('Research request',{exact:true}).fill(video.text);
  await page.getByRole('button',{name:'Filter saved evidence'}).click();
  await page.getByRole('button',{name:'Providers',exact:true}).click();
  await page.getByRole('button',{name:'Match exact product',exact:true}).first().click();
  const form=page.getByRole('form',{name:'Match discovery to exact product'});
  await form.getByLabel('Matched product title').fill(video.text);
  await form.getByLabel('Exact supplier listing URL').fill(`https://example.com/supplier/${width}`);
  await form.getByLabel('Exact variant / size / pack').fill('Red / single');
  await form.getByRole('checkbox').check();
  await form.getByRole('button',{name:'Save product match'}).click();
  const detail=page.getByRole('region',{name:'Product research detail'});
  await expect(detail).toBeVisible();
  await expect(detail.getByText('321 views',{exact:true})).toBeVisible();
  await expect(detail.getByText(/Recent product-level sales evidence/).first()).toBeVisible();
  expect(await detail.getByLabel('Advertising CPA $').inputValue()).toBe('');
  await expect(detail.getByLabel('url',{exact:true})).toHaveValue(`https://example.com/supplier/${width}`);
  await expect(detail.getByLabel('variant',{exact:true})).toHaveValue('Red / single');
  const state=await (await request.get('/api/research/state')).json();
  const matched=state.observations.filter(o=>o.productMatch?.listingUrl===`https://example.com/supplier/${width}`);
  expect(matched).toHaveLength(2);expect(matched.every(o=>o.dataStatus==='manual'&&o.scope==='product')).toBe(true);
  expect(matched.every(o=>!['purchases','shop_sales','bought_count'].includes(o.metric))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.global-progress')).toHaveCount(0);
  await page.screenshot({path:`test-results/match-${width}.png`,fullPage:true});
});
