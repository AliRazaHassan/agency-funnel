import assert from "node:assert/strict";
import { trendScore, momentum, saturation, evidenceConfidence } from "../server/intelligence.js";
import { scoreProduct } from "../server/scorer.js";
import { buildWinnerDecision, selectFinalWinners } from "../server/winnerEngine.js";
import { deriveAdTestMetrics } from "../server/researchStore.js";
import { parseBoughtCount } from "../server/keepa.js";
import { amazonEvidenceStatus } from "../server/productHunt.js";

function near(actual, expected, epsilon=0.15, label="value"){
  assert.ok(Math.abs(Number(actual)-Number(expected))<=epsilon, `${label}: expected ${expected}, got ${actual}`);
}

// Trend Score weights: Amazon 25, TikTok 25, Meta 20, Google 15, Cross 10, Confidence 5.
assert.equal(trendScore({amazon:100,tiktok:0,meta:0,google:0,crossPlatform:0,confidence:0}).score,25);
assert.equal(trendScore({amazon:100,tiktok:100,meta:100,google:100,crossPlatform:100,confidence:100}).score,100);
assert.equal(trendScore({amazon:-10,tiktok:120,meta:0,google:0,crossPlatform:0,confidence:0}).score,25);

// Evidence confidence provenance mapping.
assert.equal(evidenceConfidence({amazon:"LIVE",tiktok:"RECENT",meta:"MANUAL",google:"ESTIMATED"}),73);
assert.equal(evidenceConfidence({}),0);

// Amazon manual parsing/freshness must be trustworthy.
assert.equal(parseBoughtCount("1K+"),1000);
assert.equal(parseBoughtCount("2.5K+"),2500);
assert.equal(parseBoughtCount("1M+"),1000000);
assert.equal(parseBoughtCount("1,200+"),1200);
assert.equal(amazonEvidenceStatus({keepa:{source:"manual-amazon-paste",capturedAt:new Date().toISOString()}}),"MANUAL");
assert.equal(amazonEvidenceStatus({keepa:{source:"manual-amazon-paste",capturedAt:new Date(Date.now()-31*86400000).toISOString()}}),"ESTIMATED");

// Momentum uses observed history only.
const now=Date.now();
const hist=[
  {date:new Date(now-30*86400000).toISOString(),value:50},
  {date:new Date(now-14*86400000).toISOString(),value:70},
  {date:new Date(now-7*86400000).toISOString(),value:80},
  {date:new Date(now).toISOString(),value:100},
];
const move=momentum(hist);
near(move.d7,25,0.2,"7d momentum");
near(move.d14,42.9,0.2,"14d momentum");
near(move.d30,100,0.2,"30d momentum");
assert.equal(move.status,"EMERGING");

// Saturation requires advertiser evidence; missing evidence must stay UNKNOWN.
assert.equal(saturation({demandGrowth:20,advertiserGrowth:null}).risk,"UNKNOWN");
assert.equal(saturation({demandGrowth:10,advertiserGrowth:65}).risk,"HIGH");
assert.equal(saturation({demandGrowth:60,advertiserGrowth:20}).risk,"LOW");

// Product economics: shipping buffer is included in contribution/margin gate.
const opp={niche:"Test",sellWhere:{geos:["US"],primary:"Shopify"},marketing:{offer:"Offer"},scores:{demand:70}};
const good=scoreProduct({
  title:"Test Product",category:"Test",estCostUsd:10,estSellPriceUsd:30,estWeightKg:.3,
  shippingDifficulty:"low",demandType:"evergreen",problemSolved:"Problem",hook:"Hook",
  pdpBullets:["a","b","c"],competitionEase:60,supplierEase:70
},opp);
near(good.marginPct,56.7,0.1,"margin");
near(good.estContributionUsd,21.4,0.2,"contribution incl upsell");
assert.equal(good.rejected,false);

const bad=scoreProduct({
  title:"Bad Economics",category:"Test",estCostUsd:20,estSellPriceUsd:30,estWeightKg:.3,
  shippingDifficulty:"low",demandType:"evergreen",problemSolved:"Problem",hook:"Hook",
  pdpBullets:["a","b","c"],competitionEase:60,supplierEase:70
},opp);
assert.equal(bad.rejected,true);
assert.ok(bad.reasons.some(x=>/Margin .* below 50% gate/.test(x)));

// Winner decision must preserve a real zero competition score rather than falling back to 50.
const zeroCompetition={
  ...good,
  trendScore:70,trendStatus:"EMERGING",saturation:{risk:"LOW"},
  dataStatus:{amazon:"LIVE",tiktok:"RECENT",meta:"ESTIMATED",google:"ESTIMATED"},
  dataScope:{amazon:"PRODUCT",tiktok:"NICHE",meta:"MODELED",google:"MODELED"},
  evidenceConfidence:64,
  winning:{...good.winning,pillars:good.winning.pillars.map(p=>p.id==="competition"?{...p,score:0}:p)}
};
const zeroDecision=buildWinnerDecision(zeroCompetition);
assert.equal(zeroDecision.components.competition,0);

// Top Pick is shortlist rank only and must never silently convert VALIDATE into STRONG_CANDIDATE.
const validateCandidate={...zeroCompetition,id:"validate-1",marginPct:60,trendScore:65,winnerDecision:{...zeroDecision,verdict:"VALIDATE",hardFails:[],score:68,verifiedSources:1}};
const selected=selectFinalWinners([validateCandidate],1)[0];
assert.equal(selected.isTopPick,true);
assert.equal(selected.winnerDecision.verdict,"VALIDATE");
assert.equal(selected.isFinalWinner,false);

// Ad test calculations independently verified.
const ad=deriveAdTestMetrics({
  spendUsd:60,impressions:5000,clicks:180,addToCarts:24,purchases:3,revenueUsd:180
},{estContributionUsd:25});
near(ad.ctr,3.6,0.01,"CTR");
near(ad.cpc,1/3,0.01,"CPC");
near(ad.atcRate,13.333,0.02,"ATC rate");
near(ad.cvr,1.6667,0.02,"CVR");
near(ad.cpa,20,0.01,"CPA");
near(ad.roas,3,0.01,"ROAS");
assert.equal(ad.status,"VALIDATED");
assert.ok(ad.proofScore>=80 && ad.proofScore<=100);
assert.equal(ad.sampleConfidence,1);

assert.throws(()=>deriveAdTestMetrics({impressions:0,clicks:1}),/Clicks cannot exceed impressions/);
assert.throws(()=>deriveAdTestMetrics({impressions:10,clicks:5,addToCarts:6}),/Add to carts cannot exceed clicks/);
assert.throws(()=>deriveAdTestMetrics({impressions:10,clicks:5,addToCarts:2,purchases:3}),/Purchases cannot exceed add to carts/);
assert.throws(()=>deriveAdTestMetrics({impressions:10,clicks:5,addToCarts:0,purchases:0,revenueUsd:10}),/Revenue requires at least one purchase/);

console.log("Product Hunter logic verification: PASS");
