import { chatJson } from "./openai.js";
import { scoreProduct } from "./scorer.js";
import { rankProducts, scoreOrderValueBlock } from "./rankingAI.js";
import { buildProductMarketplaceSales } from "./marketSales.js";
import { summarizeWinningDeck, buildWinningScorecard } from "./winningScorecard.js";
import { attachKeepaToProducts, keepaStatus } from "./keepa.js";
import { buildIntelligence } from "./intelligence.js";
import { buildWinnerDecision, summarizeWinnerDecisions, selectFinalWinners, summarizeFinalWinners } from "./winnerEngine.js";
import { getHistory } from "./researchStore.js";
import { enrichProductImages } from "./productImages.js";
import { resolveEventFocus, buildEventResearchContext, eventFitForProduct } from "./eventCalendar.js";
import { buildProductToolkit } from "./growthToolkit.js";

const SEED_PRODUCTS = {
  "Pet Supplies": [
    { title: "No-Pull Dog Harness Adjustable", category: "Walking", estCostUsd: 9, estSellPriceUsd: 24.99, estWeightKg: 0.35, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Pulling on walks", bundleWith: ["Nylon Dog Leash 6ft"], hook: "Stop the pull without punishing your dog", pdpBullets: ["4 sizes", "Reflective stitch", "Padded chest"], competitionEase: 58, supplierEase: 78 },
    { title: "Nylon Dog Leash 6ft", category: "Walking", estCostUsd: 4, estSellPriceUsd: 14.99, estWeightKg: 0.2, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Durable everyday leash", bundleWith: ["No-Pull Dog Harness Adjustable"], hook: "The leash that belongs with your harness kit", pdpBullets: ["Padded handle", "6ft control", "Clip-ready"], competitionEase: 45, supplierEase: 85 },
    { title: "Waste Bag Dispenser + Rolls", category: "Walking", estCostUsd: 3.5, estSellPriceUsd: 12.99, estWeightKg: 0.15, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Always have bags", bundleWith: ["Nylon Dog Leash 6ft"], hook: "Never dig for bags mid-walk", pdpBullets: ["Clip-on", "15 rolls", "Leak-resistant"], competitionEase: 50, supplierEase: 88 },
    { title: "Automatic Pet Water Fountain", category: "Hydration", estCostUsd: 12, estSellPriceUsd: 39.99, estWeightKg: 0.9, shippingDifficulty: "med", demandType: "evergreen", problemSolved: "Pet hydration", bundleWith: ["Ceramic Cat Food Bowl Set"], hook: "Fresh flowing water pets actually drink", pdpBullets: ["2.5L", "Filter", "Quiet pump"], competitionEase: 52, supplierEase: 70 },
    { title: "Orthopedic Dog Bed Large", category: "Beds", estCostUsd: 18, estSellPriceUsd: 49.99, estWeightKg: 1.4, shippingDifficulty: "med", demandType: "evergreen", problemSolved: "Joint comfort", bundleWith: ["Pet Blanket Washable Soft"], hook: "Senior-dog comfort without a vet visit", pdpBullets: ["Support foam", "Removable cover", "Large size"], competitionEase: 48, supplierEase: 65 },
    { title: "Slow Feeder Puzzle Bowl", category: "Feeders", estCostUsd: 6.5, estSellPriceUsd: 18.99, estWeightKg: 0.3, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Fast eating / bloat risk", bundleWith: ["Elevated Pet Feeder Dual Bowl"], hook: "Slow the gobble, cut the mess", pdpBullets: ["Puzzle ridges", "Non-slip", "Easy wash"], competitionEase: 60, supplierEase: 80 },
    { title: "Interactive Cat Wand Toy", category: "Toys", estCostUsd: 3, estSellPriceUsd: 11.99, estWeightKg: 0.1, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Indoor cat energy", bundleWith: ["Cat Tunnel Collapsible"], hook: "5-minute play that burns zoomies", pdpBullets: ["Feather tip", "Flexible wand", "Replaceable head"], competitionEase: 55, supplierEase: 90 },
    { title: "Cat Tunnel Collapsible", category: "Toys", estCostUsd: 7, estSellPriceUsd: 19.99, estWeightKg: 0.4, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Enrichment", bundleWith: ["Interactive Cat Wand Toy"], hook: "Turn hallway energy into a play circuit", pdpBullets: ["3-way", "Collapsible", "Crinkle"], competitionEase: 57, supplierEase: 82 },
    { title: "LED Dog Collar USB Rechargeable", category: "Safety", estCostUsd: 7.5, estSellPriceUsd: 21.99, estWeightKg: 0.12, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Night visibility", bundleWith: ["Reflective Dog Vest"], hook: "Be seen on night walks", pdpBullets: ["USB charge", "Multiple modes", "Adjustable"], competitionEase: 54, supplierEase: 75, riskFlags: ["battery — check shipping rules"] },
    { title: "Pet Stain & Odor Enzyme Spray", category: "Cleaning", estCostUsd: 5, estSellPriceUsd: 16.99, estWeightKg: 0.45, shippingDifficulty: "med", demandType: "evergreen", problemSolved: "Odor and stains", bundleWith: ["Pet Hair Remover Roller"], hook: "Kill the smell, not just mask it", pdpBullets: ["Enzyme formula", "Carpet safe", "Spray"], competitionEase: 50, supplierEase: 72, riskFlags: ["liquid shipping"] },
    { title: "Car Seat Cover for Pets", category: "Travel", estCostUsd: 14, estSellPriceUsd: 36.99, estWeightKg: 0.8, shippingDifficulty: "med", demandType: "evergreen", problemSolved: "Car mess", bundleWith: ["Dog Seat Belt Tether 2-Pack"], hook: "Protect the back seat on every ride", pdpBullets: ["Waterproof", "Hammock style", "Universal fit"], competitionEase: 56, supplierEase: 74 },
    { title: "Treat-Dispensing Puzzle Ball", category: "Toys", estCostUsd: 5.5, estSellPriceUsd: 17.99, estWeightKg: 0.2, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Boredom", bundleWith: ["Dog Rope Chew Toy Set"], hook: "Busy brain, calmer dog", pdpBullets: ["Adjustable difficulty", "Treat release", "Durable"], competitionEase: 58, supplierEase: 83 },
  ],
  "Home Fitness Gear": [
    { title: "Resistance Band Set 5 Levels", category: "Strength", estCostUsd: 6, estSellPriceUsd: 22.99, estWeightKg: 0.35, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Home strength without weights", bundleWith: ["Door Anchor Kit"], hook: "Full-body strength that fits in a drawer", pdpBullets: ["5 levels", "Handles", "Carry bag"], competitionEase: 50, supplierEase: 85 },
    { title: "Non-Slip Yoga Mat 6mm", category: "Floor", estCostUsd: 8, estSellPriceUsd: 27.99, estWeightKg: 0.9, shippingDifficulty: "med", demandType: "evergreen", problemSolved: "Stable floor workouts", bundleWith: ["Resistance Band Set 5 Levels"], hook: "Grip that survives sweaty sessions", pdpBullets: ["6mm cushion", "Alignment marks", "Strap"], competitionEase: 42, supplierEase: 80 },
    { title: "Foam Roller Medium Density", category: "Recovery", estCostUsd: 7, estSellPriceUsd: 24.99, estWeightKg: 0.5, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Muscle recovery", bundleWith: ["Massage Ball Set"], hook: "Undo desk tightness in 10 minutes", pdpBullets: ["Medium density", "36cm", "Textured"], competitionEase: 55, supplierEase: 82 },
    { title: "Adjustable Jump Rope", category: "Cardio", estCostUsd: 4, estSellPriceUsd: 15.99, estWeightKg: 0.2, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Cardio at home", bundleWith: ["Non-Slip Yoga Mat 6mm"], hook: "Cardio without leaving the apartment", pdpBullets: ["Ball bearings", "Adjustable", "Grips"], competitionEase: 48, supplierEase: 88 },
    { title: "Push-Up Board Portable", category: "Strength", estCostUsd: 9, estSellPriceUsd: 29.99, estWeightKg: 0.7, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Form variety", bundleWith: ["Resistance Band Set 5 Levels"], hook: "Color-coded push-up progressions", pdpBullets: ["Multiple grips", "Fold flat", "Non-slip"], competitionEase: 60, supplierEase: 78 },
    { title: "Massage Ball Set", category: "Recovery", estCostUsd: 5, estSellPriceUsd: 16.99, estWeightKg: 0.25, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Trigger points", bundleWith: ["Foam Roller Medium Density"], hook: "Target knots rollers miss", pdpBullets: ["2 densities", "Portable", "Pair set"], competitionEase: 62, supplierEase: 84 },
    { title: "Door Anchor Kit", category: "Strength", estCostUsd: 3.5, estSellPriceUsd: 12.99, estWeightKg: 0.15, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Band anchoring", bundleWith: ["Resistance Band Set 5 Levels"], hook: "Turn any door into a cable station", pdpBullets: ["Protective pad", "Heavy strap", "Carabiner"], competitionEase: 58, supplierEase: 90 },
    { title: "Ab Wheel Roller", category: "Core", estCostUsd: 5.5, estSellPriceUsd: 18.99, estWeightKg: 0.4, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Core strength", bundleWith: ["Knee Pad Cushion"], hook: "Core that shows up in 5 minutes a day", pdpBullets: ["Dual wheel", "Non-slip grips", "Stable"], competitionEase: 52, supplierEase: 86 },
  ],
  "Eco Kitchen Gadgets": [
    { title: "Beeswax Wrap Set 3 Sizes", category: "Storage", estCostUsd: 5, estSellPriceUsd: 18.99, estWeightKg: 0.15, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Plastic wrap replacement", bundleWith: ["Silicone Lid Stretch Caps"], hook: "Wrap leftovers without the plastic guilt", pdpBullets: ["3 sizes", "Reusable", "Washable"], competitionEase: 58, supplierEase: 80 },
    { title: "Silicone Lid Stretch Caps 6pc", category: "Storage", estCostUsd: 4, estSellPriceUsd: 14.99, estWeightKg: 0.2, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Missing lids", bundleWith: ["Beeswax Wrap Set 3 Sizes"], hook: "One set fits bowls you already own", pdpBullets: ["6 sizes", "Airtight feel", "Dishwasher"], competitionEase: 55, supplierEase: 85 },
    { title: "Bottle Brush Deep Clean", category: "Cleaning", estCostUsd: 3, estSellPriceUsd: 11.99, estWeightKg: 0.12, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Bottle hygiene", bundleWith: ["Reusable Produce Bags 9pc"], hook: "Reach the bottom most brushes miss", pdpBullets: ["Long handle", "Soft bristles", "Hang loop"], competitionEase: 60, supplierEase: 88 },
    { title: "Reusable Produce Bags 9pc", category: "Shopping", estCostUsd: 4.5, estSellPriceUsd: 15.99, estWeightKg: 0.18, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Plastic produce bags", bundleWith: ["Beeswax Wrap Set 3 Sizes"], hook: "Checkout without the thin plastic bags", pdpBullets: ["Mesh", "Labeled sizes", "Washable"], competitionEase: 52, supplierEase: 87 },
    { title: "Herb Scissor Multi-Blade", category: "Prep", estCostUsd: 3.5, estSellPriceUsd: 13.99, estWeightKg: 0.15, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Slow herb chopping", bundleWith: ["Silicone Lid Stretch Caps"], hook: "Chop herbs in one squeeze", pdpBullets: ["5 blades", "Safety cover", "Easy clean"], competitionEase: 64, supplierEase: 84 },
    { title: "Compost Bin Countertop Charcoal", category: "Waste", estCostUsd: 12, estSellPriceUsd: 34.99, estWeightKg: 1.1, shippingDifficulty: "med", demandType: "evergreen", problemSolved: "Kitchen scraps smell", bundleWith: ["Reusable Produce Bags 9pc"], hook: "Compost without the countertop smell", pdpBullets: ["Charcoal filter", "Handle", "Easy empty"], competitionEase: 50, supplierEase: 70 },
  ],
  default: [
    { title: "Premium Accessory Starter SKU", category: "General", estCostUsd: 8, estSellPriceUsd: 24.99, estWeightKg: 0.4, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Core need in niche", bundleWith: ["Upsell Accessory"], hook: "The hero SKU that starts the cart", pdpBullets: ["Light ship", "Bundle ready", "Evergreen"], competitionEase: 55, supplierEase: 75 },
    { title: "Upsell Accessory", category: "General", estCostUsd: 4, estSellPriceUsd: 14.99, estWeightKg: 0.2, shippingDifficulty: "low", demandType: "evergreen", problemSolved: "Completes the kit", bundleWith: ["Premium Accessory Starter SKU"], hook: "Add-on that lifts AOV without friction", pdpBullets: ["Low cost", "High attach rate", "Simple"], competitionEase: 60, supplierEase: 85 },
  ],
};

function seedForNiche(niche) {
  if (SEED_PRODUCTS[niche]) return SEED_PRODUCTS[niche];
  for (const key of Object.keys(SEED_PRODUCTS)) {
    if (key !== "default" && niche.toLowerCase().includes(key.toLowerCase().split(" ")[0])) {
      return SEED_PRODUCTS[key];
    }
  }
  return SEED_PRODUCTS.default;
}

const VARIANTS = [
  { suffix: "Pro", costMul: 1.12, sellMul: 1.15 },
  { suffix: "Compact", costMul: 0.88, sellMul: 0.9 },
  { suffix: "Premium", costMul: 1.25, sellMul: 1.28 },
  { suffix: "Value Pack", costMul: 1.35, sellMul: 1.4 },
  { suffix: "Travel Size", costMul: 0.75, sellMul: 0.82 },
];


export function amazonEvidenceStatus(product = {}) {
  const k = product.keepa || product.amazon || null;
  if (!k) return "UNAVAILABLE";
  const captured = k.capturedAt ? new Date(k.capturedAt).getTime() : NaN;
  if (Number.isFinite(captured)) {
    const ageDays = (Date.now() - captured) / 86400000;
    if (ageDays > 30) return "ESTIMATED";
  }
  if (k.source === "manual-amazon-paste") return "MANUAL";
  return Number.isFinite(captured) ? "RECENT" : "ESTIMATED";
}

export function firstFiniteSignal(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function amazonSignalScore(product = {}) {
  const k = product.keepa || product.amazon || null;
  if (!k) return 0;
  const parts = [];
  if (Number.isFinite(Number(k.monthlySold))) {
    const sold = Math.max(0, Number(k.monthlySold));
    parts.push(Math.max(0, Math.min(100, Math.round(20 + Math.log10(sold + 1) * 28))));
  }
  if (Number.isFinite(Number(k.salesRank)) && Number(k.salesRank) > 0) {
    const rank = Number(k.salesRank);
    const rankScore = rank <= 5000 ? 90 : rank <= 20000 ? 75 : rank <= 50000 ? 60 : rank <= 100000 ? 45 : 30;
    parts.push(rankScore);
  }
  if (Number.isFinite(Number(k.reviewCount))) {
    const reviews = Math.max(0, Number(k.reviewCount));
    parts.push(Math.max(20, Math.min(85, Math.round(20 + Math.log10(reviews + 1) * 18))));
  }
  return parts.length ? Math.round(parts.reduce((a,b)=>a+b,0)/parts.length) : 50;
}

export function dedupeProductCandidates(list=[]) {
  const unique=[];
  const seen=new Set();
  for(const p of Array.isArray(list)?list:[]) {
    const title=String(p?.title||"").trim();
    const key=title.toLowerCase();
    if(!title||seen.has(key)) continue;
    seen.add(key);
    unique.push({...p,title});
  }
  return unique;
}

/** Expand thin seed catalogs to at least `limit` unique SKUs */
function expandSeedsToLimit(baseList, limit = 50) {
  const out = [];
  const seen = new Set();
  const push = (p) => {
    const key = p.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  for (const p of baseList) push({ ...p });

  let v = 0;
  while (out.length < limit && baseList.length) {
    const src = baseList[out.length % baseList.length];
    const variant = VARIANTS[v % VARIANTS.length];
    v++;
    push({
      ...src,
      title: `${src.title} ${variant.suffix}`,
      estCostUsd: Math.round(src.estCostUsd * variant.costMul * 100) / 100,
      estSellPriceUsd: Math.round(src.estSellPriceUsd * variant.sellMul * 100) / 100,
      competitionEase: Math.min(100, (src.competitionEase || 55) + (v % 7)),
      supplierEase: Math.min(100, (src.supplierEase || 70) + (v % 5)),
      hook: `${src.hook} (${variant.suffix})`,
    });
  }
  return out.slice(0, limit);
}

async function aiProducts(opportunity, limit, activeEvent = null) {
  const ai = await chatJson(
    `You are an ecommerce product researcher. Return JSON: { "products": [ ... ] }.
Each product: title, category, problemSolved, estCostUsd, estSellPriceUsd, estWeightKg,
shippingDifficulty (low|med|high), demandType (evergreen|seasonal|fad),
bundleWith (string[]), supplierNotes, evidence, hook, pdpBullets (3 strings),
offerLine, competitionEase (0-100), supplierEase (0-100),
projectedMonthlyOrders {conservative,base,aggressive},
sourceFrom { primary, platforms (string[]), searchQuery, howToFind (string[]), originHint, notes },
soldOn { yourChannel, geos (string[]), whereCompetitorsSell (string[]), demandSignals (string[]), sellStrategy }.
sourceFrom = where YOU buy/source the product (AutoDS, Zendrop, CJ, AliExpress, etc).
soldOn = where this type of product is already selling + where YOU should sell.
No fad unless necessary. No trademarked brands. Prefer light shipping. Aim margin >50%.
Return EXACTLY ${limit} unique products (different titles).\nWhen seasonal/event context is supplied, include a strong mix of event-specific products and evergreen products with a credible event angle. Avoid items that are unlikely to source/ship before the event.`,
    `Opportunity niche: ${opportunity.niche}
Audience: ${opportunity.audience}
Geo: ${(opportunity.sellWhere?.geos || []).join(", ")}
Your sell channel: ${opportunity.sellWhere?.primary || "Shopify"}
Target AOV context: $${opportunity.estAovUsd}
Return ${limit} product candidates.`
  );
  return ai?.products || null;
}

/**
 * Hunt products for an opportunity, score + rank.
 */
export async function huntProducts(opportunity, { limit = 50 } = {}) {
  const target = Math.max(50, Number(limit) || 50);

  if (opportunity.isServiceOffer) {
    return {
      source: "service",
      researchLabel: "Research score (model + rules) — not live marketplace proof",
      products: [],
      note: "This opportunity is a high-ticket service (not Shopify product import). Use Model 2 automation offer instead.",
    };
  }

  const regionFocus = opportunity.sellWhere?.geos?.[0] || "Global";
  const activeEvent = opportunity.eventFocus?.id ? resolveEventFocus(opportunity.eventFocus.id, { regionFocus }) : null;
  let raw = await aiProducts(opportunity, target, activeEvent);
  let source = "openai";
  if (!raw?.length) {
    source = "seed";
    raw = expandSeedsToLimit(seedForNiche(opportunity.niche), target);
  } else if (raw.length < target) {
    // Pad AI shortfalls with expanded seeds
    const pad = expandSeedsToLimit(seedForNiche(opportunity.niche), target);
    const seen = new Set(raw.map((p) => String(p.title || "").toLowerCase()));
    for (const p of pad) {
      if (raw.length >= target) break;
      const t = String(p.title || "").toLowerCase();
      if (seen.has(t)) continue;
      seen.add(t);
      raw.push(p);
    }
    source = "openai+seed";
  }

  raw = dedupeProductCandidates(raw);
  const uniqueTitles = new Set(raw.map(p=>String(p.title).toLowerCase()));
  if (raw.length < target) {
    const pad = expandSeedsToLimit(seedForNiche(opportunity.niche), target);
    for (const p of pad) {
      if (raw.length >= target) break;
      const key = String(p.title || "").trim().toLowerCase();
      if (!key || uniqueTitles.has(key)) continue;
      uniqueTitles.add(key);
      raw.push(p);
    }
    if (source === "openai") source = "openai+seed";
  }
  raw = raw.slice(0, target);

  const scored = raw.map((p) => scoreProduct(p, opportunity));
  const withKeepa = attachKeepaToProducts(scored, opportunity).map((p) => ({
    ...p,
    winning: buildWinningScorecard(p, opportunity),
  }));
  const marketReady = withKeepa.map((p) => {
    const marketplaceSales = buildProductMarketplaceSales(p, opportunity);
    const projectedMonthlyOrders = marketplaceSales.yourStoreProjection?.orders || p.projectedMonthlyOrders;
    const projectedMonthlyRevenue = marketplaceSales.yourStoreProjection?.revenue || p.projectedMonthlyRevenue;
    const orderValue = scoreOrderValueBlock({ ...p, projectedMonthlyOrders });
    return {
      ...p,
      marketplaceSales,
      projectedMonthlyOrders,
      projectedMonthlyRevenue,
      pillars: { ...p.pillars, orderValue }
    };
  });
  const rankedBase = await Promise.all(rankProducts(marketReady).map(async (p) => {
    const marketplaceSales = p.marketplaceSales;
    const amazonVerified = Boolean(p.keepaStatus?.matched || p.keepa?.match || p.keepaMatched || p.amazon?.matched);
    const amazonProductScoped = Boolean(p.keepa?.match === "asin" || p.amazon?.match === "asin");
    const free = opportunity.freeSignal || {};
    const demand = Number(opportunity.scores?.demand || 0);
    const marketing = Number(opportunity.marketingStrength || opportunity.scores?.marketing || 0);
    const social = Number(free.socialScore || free.social || 0);
    const socialEvidence = opportunity.socialEvidence || {};
    const tiktokEvidence = socialEvidence.tiktok || null;
    const metaEvidence = socialEvidence.meta || null;
    const signals = {
      amazon: amazonVerified ? amazonSignalScore(p) : 0,
      tiktok: firstFiniteSignal(p.socialSignals?.tiktok, tiktokEvidence?.score, social, marketing * 0.7),
      meta: firstFiniteSignal(p.socialSignals?.meta, metaEvidence?.score, social, marketing * 0.65),
      google: Number.isFinite(Number(free.googleMomentumScore)) ? Number(free.googleMomentumScore) : Number(demand),
      crossPlatform: Math.round((demand + marketing) / 2),
      confidence: amazonVerified ? 78 : source === "seed" ? 30 : 48,
    };
    const dataStatus = {
      amazon: amazonVerified ? amazonEvidenceStatus(p) : "UNAVAILABLE",
      tiktok: p.socialSignals?.tiktok ? "ESTIMATED" : (tiktokEvidence?.status || "ESTIMATED"),
      meta: p.socialSignals?.meta ? "ESTIMATED" : (metaEvidence?.status || "ESTIMATED"),
      google: Number.isFinite(Number(free.googleMomentumScore)) ? "RECENT" : "ESTIMATED",
    };
    const dataScope = {
      amazon: amazonProductScoped ? "PRODUCT" : amazonVerified ? "NICHE" : "NONE",
      tiktok: tiktokEvidence ? "NICHE" : "MODELED",
      meta: metaEvidence ? "NICHE" : "MODELED",
      google: Number.isFinite(Number(free.googleMomentumScore)) ? "NICHE" : "MODELED",
    };
    const baseIntelligence = buildIntelligence({ ...p, marketplaceSales, signals, dataStatus, dataScope, market: opportunity.sellWhere?.geos?.[0] || "Global" });
    let trackedHistory=[];
    try{
      const previous=await getHistory(p.id,30);
      trackedHistory=(previous||[]).map(x=>({date:x.capturedAt,value:Number(x.trendScore)||0}));
    }catch{}
    const history=[...trackedHistory,{date:new Date().toISOString(),value:baseIntelligence.trendScore}];
    const intelligence = buildIntelligence({ ...p, marketplaceSales, signals, dataStatus, dataScope, history, market: opportunity.sellWhere?.geos?.[0] || "Global" });
    const eventFit = eventFitForProduct(intelligence, activeEvent);
    const winnerDecision = buildWinnerDecision(intelligence);
    const eventOpportunityScore = eventFit ? Math.round((Number(winnerDecision.score || 0) * 0.8) + (Number(eventFit.score || 0) * 0.2)) : winnerDecision.score;
    const toolkit = buildProductToolkit({ ...intelligence, eventFit, winnerDecision }, activeEvent);
    return { ...intelligence, eventFit, eventOpportunityScore, winnerDecision, toolkit };
  }));

  const ranked = selectFinalWinners(rankedBase);
  const withImages = await enrichProductImages(ranked);

  return {
    source,
    researchLabel:
      "Free signals + rules scorecard. Amazon units only if one-time Keepa snapshot matched.",
    opportunityId: opportunity.id,
    niche: opportunity.niche,
    activeEvent,
    count: withImages.length,
    winningSummary: summarizeWinningDeck(ranked),
    winnerSummary: summarizeFinalWinners(ranked),
    keepa: keepaStatus(),
    products: withImages,
  };
}
