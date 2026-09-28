import test from "node:test";
import assert from "node:assert/strict";
import { trendScore, momentum, saturation } from "../../server/intelligence.js";
import { buildWinnerDecision, selectFinalWinners, WINNER_WEIGHTS } from "../../server/winnerEngine.js";
import { scoreProduct } from "../../server/scorer.js";
import { deriveAdTestMetrics } from "../../server/researchStore.js";
import { productsToMatrixifyCsv } from "../../server/exportShopify.js";
import { computeDemandResearch, PLATFORM_SHARES, computeMarketplaceFromBenchmarks } from "../../server/researchEngine.js";

test("trend score uses documented weights exactly", () => {
  const r=trendScore({amazon:80,tiktok:70,meta:60,google:50,crossPlatform:40,confidence:30});
  assert.equal(r.score,63);
  assert.equal(Object.values(r.weights).reduce((a,b)=>a+b,0),1);
});

test("momentum and saturation calculations are deterministic", () => {
  const history=[
    {date:"2026-01-01",value:100},
    {date:"2026-01-17",value:110},
    {date:"2026-01-24",value:120},
    {date:"2026-01-31",value:130},
  ];
  const m=momentum(history);
  assert.equal(m.d30,30);
  assert.equal(m.status,"EMERGING");
  assert.equal(saturation({demandGrowth:20,advertiserGrowth:80}).risk,"HIGH");
});

test("product margin and contribution math match independent calculation", () => {
  const p=scoreProduct({
    title:"QA Product",category:"QA",estCostUsd:10,estSellPriceUsd:30,estWeightKg:.3,
    shippingDifficulty:"low",demandType:"evergreen",problemSolved:"QA",hook:"QA hook",
    pdpBullets:["a","b","c"],competitionEase:60,supplierEase:75
  },{niche:"QA",marketing:{offer:"QA"}});
  assert.equal(p.marginPct,56.7);
  assert.equal(p.estAovUsd,37.4);
  assert.equal(p.estContributionUsd,21.4);
  assert.equal(p.rejected,false);
});

test("winner v2 weights, evidence confidence and verdict are internally consistent", () => {
  assert.equal(Object.values(WINNER_WEIGHTS).reduce((a,b)=>a+b,0),1);
  const d=buildWinnerDecision({
    trendScore:80,marginPct:60,trendStatus:"EMERGING",supplierEase:80,pillars:{supplierEase:80},
    saturation:{risk:"MEDIUM"},dataConfidence:"HIGH",
    trendComponents:{amazon:80,tiktok:70,meta:60,google:50},
    dataStatus:{amazon:"RECENT",tiktok:"RECENT",meta:"ESTIMATED",google:"RECENT"},
    winning:{pillars:[
      {id:"margin",score:70},{id:"competition",score:60},{id:"shipping",score:80},{id:"creative",score:75}
    ],hardFails:[]}
  });
  assert.equal(d.components.confidence,85);
  assert.equal(d.score,75);
  assert.equal(d.verdict,"STRONG_CANDIDATE");
  assert.equal(d.verifiedSources,3);
});

test("Top Pick ranking never rewrites the underlying winner verdict", () => {
  const products=Array.from({length:50},(_,i)=>({
    id:"p"+i,marginPct:60,trendScore:70-i/2,trendStatus:"EMERGING",saturation:{risk:"MEDIUM"},
    winnerDecision:{score:70-i/4,verdict:"VALIDATE",verifiedSources:1,hardFails:[],label:"Validate before spend"}
  }));
  const out=selectFinalWinners(products);
  assert.equal(out.filter(x=>x.isTopPick).length,10);
  assert.equal(out.find(x=>x.isTopPick).winnerDecision.verdict,"VALIDATE");
  assert.match(out.find(x=>x.isTopPick).topPickReason,/shortlist rank/i);
});

test("ad test metrics calculate CTR CPC CPA ROAS and enforce economic validation", () => {
  const d=deriveAdTestMetrics(
    {spendUsd:30,impressions:5000,clicks:150,addToCarts:25,purchases:5,revenueUsd:300},
    {estContributionUsd:15}
  );
  assert.equal(+d.ctr.toFixed(2),3);
  assert.equal(+d.cpc.toFixed(2),.2);
  assert.equal(+d.cpa.toFixed(2),6);
  assert.equal(+d.roas.toFixed(2),10);
  assert.equal(d.status,"VALIDATED");
  assert.ok(d.proofScore>70);
  assert.throws(()=>deriveAdTestMetrics({impressions:10,clicks:11}),/Clicks cannot exceed impressions/);
});

test("zero purchases never reports a fake zero CPA", () => {
  const d=deriveAdTestMetrics({spendUsd:40,impressions:2000,clicks:80,addToCarts:10,purchases:0,revenueUsd:0},{estContributionUsd:15});
  assert.equal(d.cpa,null);
  assert.equal(d.status,"TESTING");
});

test("Shopify CSV exports drafts with transparent price and cost", () => {
  const csv=productsToMatrixifyCsv([{id:"qa-product",title:"QA Product",category:"QA",estSellPriceUsd:29.99,estCostUsd:10,estWeightKg:.5,pdpBullets:["A"],hook:"QA"}],{niche:"QA"});
  const lines=csv.split("\n");
  assert.equal(lines.length,2);
  assert.match(lines[1],/29\.99/);
  assert.match(lines[1],/10\.00/);
  assert.match(lines[1],/,FALSE,/);
  assert.match(lines[1],/,draft$/);
});


test("demand rubric weights normalize to exactly 1 and marketplace shares conserve totals", () => {
  const d=computeDemandResearch({
    niche:"Pet Supplies",
    whyNow:"evergreen repeat demand",
    demandDrivers:["evergreen","repeat","social"],
    sellWhere:{primary:"Shopify",secondaryChannels:["Amazon","TikTok"]},
    scores:{competition:40}
  });
  const totalWeight=d.factors.reduce((s,x)=>s+x.weight,0);
  assert.ok(Math.abs(totalWeight-1)<1e-9);

  for(const shares of Object.values(PLATFORM_SHARES)){
    const total=Object.values(shares).reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(total-1)<1e-9);
  }

  const m=computeMarketplaceFromBenchmarks({niche:"Pet Supplies",estAovUsd:50,sellWhere:{primary:"Shopify"}});
  assert.ok(m.overall.revenue>0);
  const revenueSum=m.byPlatform.reduce((s,x)=>s+Number(x.revenue||0),0);
  assert.ok(Math.abs(revenueSum-m.overall.revenue)<2);
  assert.equal(m.scope,"niche_online_model");
});
