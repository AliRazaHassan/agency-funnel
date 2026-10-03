import test from "node:test";
import assert from "node:assert/strict";
import { trendScore, momentum, saturation, evidenceConfidence, buildIntelligence } from "../../server/intelligence.js";
import { buildWinnerDecision, selectFinalWinners, WINNER_WEIGHTS } from "../../server/winnerEngine.js";
import { scoreProduct } from "../../server/scorer.js";
import { deriveAdTestMetrics } from "../../server/researchStore.js";
import { productsToMatrixifyCsv } from "../../server/exportShopify.js";
import { computeDemandResearch, PLATFORM_SHARES, computeMarketplaceFromBenchmarks } from "../../server/researchEngine.js";
import { RANK_WEIGHTS, PRODUCT_PILLAR_WEIGHTS, rankOpportunity, scoreOrderValueBlock } from "../../server/rankingAI.js";
import { WINNING_WEIGHTS, buildWinningScorecard } from "../../server/winningScorecard.js";
import { buildProductMarketplaceSales } from "../../server/marketSales.js";
function parseCsvRow(line){
  const out=[]; let cur="", quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){cur+='"';i++;}
      else quoted=!quoted;
    } else if(ch===","&&!quoted){out.push(cur);cur="";}
    else cur+=ch;
  }
  out.push(cur); return out;
}


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
  assert.equal(m.status,"PEAK");
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
    dataScope:{amazon:"PRODUCT",tiktok:"NICHE",meta:"NICHE",google:"NICHE"},
    winning:{pillars:[
      {id:"margin",score:70},{id:"competition",score:60},{id:"shipping",score:80},{id:"creative",score:75}
    ],hardFails:[]}
  });
  assert.equal(d.components.confidence,73);
  assert.equal(d.score,73);
  assert.equal(d.verdict,"STRONG_CANDIDATE");
  assert.equal(d.verifiedSources,3);
  assert.equal(d.productVerifiedSources,1);
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

test("ad test metrics calculate CTR CPC CPA ROAS and require verified economics", () => {
  const metrics={spendUsd:30,impressions:5000,clicks:150,addToCarts:25,purchases:5,revenueUsd:300};
  const marketOnly=deriveAdTestMetrics(metrics,{estContributionUsd:15});
  assert.equal(+marketOnly.ctr.toFixed(2),3);
  assert.equal(+marketOnly.cpc.toFixed(2),.2);
  assert.equal(+marketOnly.cpa.toFixed(2),6);
  assert.equal(+marketOnly.roas.toFixed(2),10);
  assert.equal(marketOnly.marketValidated,true);
  assert.equal(marketOnly.economicsVerified,false);
  assert.equal(marketOnly.status,"TESTING");

  const d=deriveAdTestMetrics(metrics,{
    estContributionUsd:15,
    supplierVerified:true,
    supplierVerification:{verified:true,contributionUsd:20,marginPct:66.7}
  });
  assert.equal(d.marketValidated,true);
  assert.equal(d.economicsVerified,true);
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
  const cells=parseCsvRow(lines[1]);
  assert.equal(cells[10],"");
  assert.equal(cells[12],"0");
  assert.equal(cells[13],"");
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


test("opportunity rank positive weights sum to 1 and lower budget fit lowers rank", () => {
  const positive=RANK_WEIGHTS.demand+RANK_WEIGHTS.marketing+RANK_WEIGHTS.orderValue+RANK_WEIGHTS.sellability;
  assert.equal(positive,1);
  const base={demand:70,marketingStrength:70,orderValueScore:70,sellability:80,riskPenalty:10};
  const high=rankOpportunity({...base,budgetFit:100});
  const low=rankOpportunity({...base,budgetFit:40});
  assert.ok(high.rankScore>low.rankScore);
  assert.ok(high.rankScore<=100&&low.rankScore>=0);
});


test("tracked product ids are market-context safe", () => {
  const raw={title:"Same Product",category:"QA",estCostUsd:8,estSellPriceUsd:25,estWeightKg:.2,shippingDifficulty:"low",demandType:"evergreen",problemSolved:"QA",hook:"Hook",pdpBullets:["a","b","c"]};
  const us=scoreProduct(raw,{niche:"QA Niche",sellWhere:{geos:["US"]},marketing:{offer:"x"}});
  const uk=scoreProduct(raw,{niche:"QA Niche",sellWhere:{geos:["UK"]},marketing:{offer:"x"}});
  assert.notEqual(us.id,uk.id);
});


test("rule gate weights sum to 1 and a sub-50 margin hard-fails", () => {
  assert.equal(Object.values(WINNING_WEIGHTS).reduce((a,b)=>a+b,0),1);
  const w=buildWinningScorecard({
    estCostUsd:15,estSellPriceUsd:25,marginPct:28,estWeightKg:.3,
    shippingDifficulty:"low",demandType:"evergreen",
    pillars:{margin:28,competitionEase:60,logistics:80},
    hook:"hook",problemSolved:"problem",pdpBullets:["a","b","c"],riskFlags:[]
  },{scores:{demand:70}});
  assert.equal(w.verdict,"FAIL");
  assert.ok(w.hardFails.some(x=>x.includes("below 50%")));
});

test("product marketplace planning scenarios conserve order times AOV", () => {
  const product={title:"QA Product",estAovUsd:40,soldOn:{yourChannel:"Shopify"}};
  const opportunity={niche:"Pet Supplies",estAovUsd:50,sellWhere:{geos:["US"]}};
  const m=buildProductMarketplaceSales(product,opportunity);
  assert.equal(m.assumptions.observed,false);
  assert.equal(m.math.skuShareOfNiche,0.004);
  assert.equal(m.math.assumedListingCaptureRate,0.015);
  for(const k of ["conservative","base","aggressive"]){
    assert.equal(m.yourStoreProjection.revenue[k],Math.round(m.yourStoreProjection.orders[k]*40));
  }
});


test("product pillar weights sum to 1 and unknown supplier cost is rejected", () => {
  assert.ok(Math.abs(Object.values(PRODUCT_PILLAR_WEIGHTS).reduce((a,b)=>a+b,0)-1)<1e-9);
  const p=scoreProduct({title:"Unknown Cost",category:"QA",estCostUsd:0,estSellPriceUsd:40,estWeightKg:.3,shippingDifficulty:"low",demandType:"evergreen",problemSolved:"QA",hook:"hook",pdpBullets:["a","b","c"]},{niche:"QA",sellWhere:{geos:["US"]},marketing:{offer:"x"}});
  assert.equal(p.rejected,true);
  assert.ok(p.reasons.some(x=>x.includes("Supplier cost missing")));
  for(const score of Object.values(p.pillars)) assert.ok(score>=0&&score<=100);
});


test("evidence confidence is source-status weighted and missing ad data keeps saturation unknown", () => {
  assert.equal(evidenceConfidence({amazon:"RECENT",tiktok:"RECENT",meta:"ESTIMATED",google:"UNAVAILABLE"}),51);
  assert.equal(saturation({demandGrowth:40}).risk,"UNKNOWN");
  const p=buildIntelligence({
    id:"evidence-test",
    signals:{amazon:0,tiktok:75,meta:70,google:65,crossPlatform:70,confidence:99},
    dataStatus:{amazon:"UNAVAILABLE",tiktok:"ESTIMATED",meta:"ESTIMATED",google:"ESTIMATED"},
    history:[]
  });
  assert.equal(p.evidenceConfidence,26);
  assert.equal(p.dataConfidence,"LOW");
  assert.match(p.whyTrending.summary,/modeled signals/i);
});


test("modeled order volume cannot inflate order-value score", () => {
  const base={estAovUsd:50,estContributionUsd:20,isServiceOffer:false};
  const low=scoreOrderValueBlock({...base,projectedMonthlyOrders:{base:10}});
  const high=scoreOrderValueBlock({...base,projectedMonthlyOrders:{base:1000}});
  assert.equal(low,high);
  const observedLow=scoreOrderValueBlock({...base,projectedMonthlyOrders:{base:10},volumeEvidenceStatus:"RECENT"});
  const observedHigh=scoreOrderValueBlock({...base,projectedMonthlyOrders:{base:100},volumeEvidenceStatus:"RECENT"});
  assert.ok(observedHigh>observedLow);
});


test("niche-only recent signals cannot create a strong product verdict", () => {
  const d=buildWinnerDecision({
    trendScore:90,marginPct:65,trendStatus:"EMERGING",pillars:{supplierEase:85},
    saturation:{risk:"UNKNOWN"},dataConfidence:"HIGH",evidenceConfidence:85,
    dataStatus:{amazon:"UNAVAILABLE",tiktok:"RECENT",meta:"RECENT",google:"RECENT"},
    dataScope:{amazon:"NONE",tiktok:"NICHE",meta:"NICHE",google:"NICHE"},
    winning:{pillars:[
      {id:"margin",score:85},{id:"competition",score:80},{id:"shipping",score:90},{id:"creative",score:90}
    ],hardFails:[]}
  });
  assert.equal(d.productVerifiedSources,0);
  assert.notEqual(d.verdict,"STRONG_CANDIDATE");
  assert.match(d.reason,/product-specific/i);
});
