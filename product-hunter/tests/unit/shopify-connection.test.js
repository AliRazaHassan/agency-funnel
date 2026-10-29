import test from 'node:test';
import assert from 'node:assert/strict';
import {createShopifyConnection} from '../../server/shopifyConnection.js';
const store='bigdealbigthings-vcqncbcf.myshopify.com';
const env={SHOPIFY_STORE_DOMAIN:store,SHOPIFY_CLIENT_ID:'fixture-id',SHOPIFY_CLIENT_SECRET:'fixture-secret'};
const good={data:{shop:{name:'BIGDEALBIGTHINGS',myshopifyDomain:store,currencyCode:'USD'},currentAppInstallation:{accessScopes:[{handle:'write_products'},{handle:'read_products'}]}}};
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(body)});
function setup(options={}){
 let exchanges=0,calls=0,time=Date.now();
 const request=async(url,init)=>{
  assert.equal(init.redirect,'error');
  if(url.endsWith('/admin/oauth/access_token')){
   exchanges++;assert.equal(init.body.get('grant_type'),'client_credentials');
   assert.equal(init.body.get('client_secret'),'fixture-secret');
   return response(options.authBody||{access_token:'fixture-token',expires_in:120},options.authStatus||200);
  }
  calls++;assert.equal(init.headers['X-Shopify-Access-Token'],'fixture-token');
  return response(options.body||good,options.apiStatus||200);
 };
 return {connection:createShopifyConnection(env,request,()=>time),exchanges:()=>exchanges,calls:()=>calls,advance:ms=>{time+=ms;}};
}
test('same-org Shopify connection exchanges once, verifies exact store/scopes and never exposes credentials',async()=>{
 const t=setup();const results=await Promise.all([t.connection.verify(),t.connection.verify()]);
 assert.equal(t.exchanges(),1);assert.equal(t.calls(),2);assert.equal(results[0].verified,true);assert.equal(results[0].currency,'USD');
 assert.doesNotMatch(JSON.stringify(results),/fixture-secret|fixture-token|fixture-id/);
 assert.equal(t.connection.status().verified,false);
});
test('Shopify credentials renew before token expiry without requiring a merchant login',async()=>{
 const t=setup();await t.connection.verify();t.advance(61000);await t.connection.verify();assert.equal(t.exchanges(),2);
});
test('invalid hosts and missing credentials fail before sending any request',async()=>{
 for(const c of [{...env,SHOPIFY_STORE_DOMAIN:'evil.example'},{...env,SHOPIFY_STORE_DOMAIN:store+'/path'},{SHOPIFY_STORE_DOMAIN:store}]){
  let calls=0;const connection=createShopifyConnection(c,async()=>{calls++;});
  assert.equal(connection.status().configured,false);await assert.rejects(()=>connection.verify());assert.equal(calls,0);
 }
});
test('Shopify auth failures never echo provider bodies or launch a GraphQL request',async()=>{
 const t=setup({authStatus:401,authBody:{error:'fixture-secret'}});await assert.rejects(()=>t.connection.verify(),e=>/authorization failed/.test(e.message)&&!e.message.includes('fixture-secret'));assert.equal(t.calls(),0);
});
test('wrong shop, currency and missing product-write scope cannot verify',async()=>{
 for(const data of [{...good.data,shop:{...good.data.shop,myshopifyDomain:'wrong.myshopify.com'}},{...good.data,shop:{...good.data.shop,currencyCode:'EUR'}},{...good.data,currentAppInstallation:{accessScopes:[]}}])await assert.rejects(()=>setup({body:{data}}).connection.verify());
});
test('401 GraphQL responses do not automatically retry a potentially successful product mutation',async()=>{
 const t=setup({apiStatus:401});await assert.rejects(()=>t.connection.graphql('mutation fixture { ignored }'));assert.equal(t.calls(),1);assert.equal(t.exchanges(),1);
});
test('invalid token lifetimes and top-level GraphQL errors cannot be reported as a verified connection',async()=>{
 await assert.rejects(()=>setup({authBody:{access_token:'fixture-token',expires_in:0}}).connection.verify());
 await assert.rejects(()=>setup({body:{errors:[{message:'fixture-secret'}]}}).connection.verify(),e=>!e.message.includes('fixture-secret'));
});
test('existing static Admin tokens remain supported without a client-credentials exchange',async()=>{
 let calls=0;const c=createShopifyConnection({SHOPIFY_STORE_DOMAIN:store,SHOPIFY_ADMIN_TOKEN:'legacy-fixture'},async(url,opts)=>{calls++;assert.ok(url.includes('/graphql.json'));assert.equal(opts.headers['X-Shopify-Access-Token'],'legacy-fixture');return response(good);});
 assert.equal((await c.verify()).verified,true);assert.equal(calls,1);
});
