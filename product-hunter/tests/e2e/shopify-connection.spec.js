import {test,expect} from '@playwright/test';
test('Shopify verification endpoint requires authentication and reports missing credentials without a write',async({request})=>{
 expect((await request.post('/api/shopify/verify',{data:{}})).status()).toBe(401);
 await request.post('/api/auth/login',{data:{password:'e2e-secret'}});
 const response=await request.post('/api/shopify/verify',{data:{}});
 expect(response.status()).toBe(400);expect((await response.json()).error).toMatch(/SHOPIFY_STORE_DOMAIN|not connected/);
});
for(const width of [1440,390])test(`Shopify settings distinguish configured from verified at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>localStorage.setItem('sd_onboarded','1'));
 await page.route('**/api/workspace/status',r=>r.fulfill({json:{shopify:{configured:true,store:'bigdealbigthings-vcqncbcf.myshopify.com'},modules:{directShopify:true}}}));
 let verifies=0;
 await page.route('**/api/shopify/verify',r=>{verifies++;return r.fulfill({json:{verified:true,name:'BIGDEALBIGTHINGS',store:'bigdealbigthings-vcqncbcf.myshopify.com',currency:'USD'}});});
 await page.goto('/');await page.getByLabel('Password',{exact:true}).fill('e2e-secret');await page.getByRole('button',{name:'Enter workspace'}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByText(/configured; verification needed/)).toBeVisible();
 await page.getByRole('button',{name:'Verify Shopify connection',exact:true}).click();
 await expect(page.getByText(/product-write access confirmed/)).toBeVisible();
 expect(verifies).toBe(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
