import test from "node:test";
import assert from "node:assert/strict";
import { expandSeedsToLimit, hasGoogleMomentum, huntProducts } from "../../server/productHunt.js";
import { deriveSupplierEconomics } from "../../server/researchStore.js";
import { answerConcierge } from "../../server/concierge.js";
import { buildChristmasShortlist, christmasDelivery } from "../../server/christmas.js";
import { buildLaunchIntelligence } from "../../server/launchIntelligence.js";
import { deriveAdTestMetrics } from "../../server/researchStore.js";

const now = new Date("2026-10-22T12:00:00Z");
const quote = {verified:true,productUrl:"https://example.com/sku",capturedAt:"2026-10-21T00:00:00Z",shippingDays:10,processingDays:3,economicsPass:true};
const tracked = {updatedAt:"2026-10-22",validationStatus:"VALIDATED",product:{id:"pet-1",title:"Personalized pet ornament",market:"US",discoveredAt:"2026-10-21",supplierVerification:quote,winnerDecision:{productVerifiedSources:1,verifiedSources:2,verdict:"STRONG_CANDIDATE"}}};

test("small fallback catalogs terminate without inventing extra titles", () => {
  for(const count of [0,2,6,8,12]) {
    const out=expandSeedsToLimit(Array.from({length:count},(_,i)=>({title:`Product ${i}`,estCostUsd:5,estSellPriceUsd:20})),50);
    assert.ok(out.length<=Math.min(50,count*6));
    assert.equal(new Set(out.map(p=>p.title)).size,out.length);
  }
});
test("missing Google momentum stays unavailable while real zero remains valid",()=>{
  for(const v of [null,undefined,"",NaN]) assert.equal(hasGoogleMomentum({googleMomentumScore:v}),false);
  assert.equal(hasGoogleMomentum({googleMomentumScore:0}),true);
});
test("full fallback hunt completes and unrelated queries receive no invented catalog",async()=>{
  const saved=process.env.OPENAI_API_KEY, originalFetch=globalThis.fetch;
  delete process.env.OPENAI_API_KEY; globalThis.fetch=async()=>({ok:false});
  try {
    const r=await huntProducts({niche:"Home Fitness Gear",sellWhere:{geos:["US"]},freeSignal:{googleMomentumScore:null},scores:{demand:60,marketing:60}});
    assert.equal(r.count,48); assert.ok(r.products.every(p=>p.dataStatus.google==="UNAVAILABLE"));
    const unknown=await huntProducts({niche:"Christmas bespoke astronomy keepsakes",sellWhere:{geos:["US"]}});
    assert.equal(unknown.count,0);
  } finally {globalThis.fetch=originalFetch;if(saved)process.env.OPENAI_API_KEY=saved;}
});
test("unknown supplier shipping cannot verify economics",()=>{
  assert.throws(()=>deriveSupplierEconomics({estSellPriceUsd:40},{itemCostUsd:10,shippingCostUsd:null,shippingDays:8}),/landed cost/i);
  assert.equal(deriveSupplierEconomics({estSellPriceUsd:40},{itemCostUsd:10,shippingCostUsd:0,shippingDays:8}).landedCostUsd,10);
});
test("find with constraints starts discovery and preserves filters",async()=>{
  const saved=process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try {
    const r=await answerConcierge({question:"Find products under $15 with 60% margin"});
    assert.equal(r.action.type,"discover"); assert.deepEqual(r.action.filters,{maxCost:15,minMargin:60});
  } finally {if(saved)process.env.OPENAI_API_KEY=saved;}
});
test("Christmas concierge discovery preserves price and margin constraints",async()=>{
  const saved=process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try { const r=await answerConcierge({question:"Find Christmas products under $15 with 60% margin"});
    assert.equal(r.action.type,"discover"); assert.deepEqual(r.action.filters,{maxCost:15,minMargin:60});
  } finally {if(saved)process.env.OPENAI_API_KEY=saved;}
});
test("verified launch economics do not charge shipping twice and CPA includes fees",()=>{
  const p={estSellPriceUsd:40,estCostUsd:5,shippingBufferUsd:3,supplierVerified:true,supplierVerification:{verified:true,landedCostUsd:10,contributionUsd:30,marginPct:75}};
  const result=buildLaunchIntelligence(p).unitEconomics;
  assert.equal(result.shippingBufferUsd,0); assert.equal(result.contributionBeforeAdsUsd,28.6);
  const proof=deriveAdTestMetrics({spendUsd:87,impressions:5000,clicks:100,addToCarts:10,purchases:3,revenueUsd:180},p);
  assert.equal(proof.status,"TESTING"); // $29 CPA exceeds $28.60 net contribution.
});
test("Christmas report alone produces no verified winners",()=>{
  const r=buildChristmasShortlist([],{now});
  assert.equal(r.products.length,6); assert.equal(r.summary.verifiedWinners,0);
  assert.ok(r.products.every(p=>p.verdict==="NEEDS_VERIFICATION"&&p.delivery.status==="UNVERIFIED"));
});
test("delivery cutoff includes processing transit contingency and test lead",()=>{
  const r=christmasDelivery(quote,now);
  assert.equal(r.latestOrderDate,"2026-12-02"); assert.equal(r.startTestBy,"2026-11-25"); assert.equal(r.status,"ON_TIME");
});
test("missing processing time and stale quotes cannot imply delivery readiness",()=>{
  assert.equal(christmasDelivery({...quote,processingDays:null},now).status,"UNVERIFIED");
  assert.equal(christmasDelivery({...quote,capturedAt:"2026-08-01"},now).status,"UNVERIFIED");
});
test("delivery windows become tight then late even when a quote is fresh",()=>{
  assert.equal(christmasDelivery({...quote,capturedAt:"2026-11-26"},new Date("2026-11-27")).status,"TIGHT");
  assert.equal(christmasDelivery({...quote,capturedAt:"2026-12-01"},new Date("2026-12-03")).status,"TOO_LATE");
});
test("only fresh in-market product proof and supplier quote unlock readiness",()=>{
  assert.equal(buildChristmasShortlist([tracked],{now}).summary.verifiedWinners,1);
  assert.equal(buildChristmasShortlist([tracked],{market:"UK",now}).summary.readyToTest,0);
  const stale={...tracked,product:{...tracked.product,discoveredAt:"2026-09-01"}};
  assert.equal(buildChristmasShortlist([stale],{now}).summary.readyToTest,0);
});
test("niche-only signals never create a Christmas winner",()=>{
  const niche={...tracked,product:{...tracked.product,winnerDecision:{...tracked.product.winnerDecision,productVerifiedSources:0}}};
  assert.equal(buildChristmasShortlist([niche],{now}).summary.verifiedWinners,0);
});
test("2026 report cannot silently certify winners for a later season",()=>{
  assert.equal(buildChristmasShortlist([tracked],{now:new Date("2027-01-01")}).expired,true);
  assert.throws(()=>buildChristmasShortlist([],{market:"XX",now}),/Choose/);
});
