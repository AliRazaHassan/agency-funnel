import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rankOpportunities } from "./rankingAI.js";
import { enrichMarketingPack, normalizeMarketingPack } from "./marketingPack.js";
import { chatJson } from "./openai.js";
import { opportunityTradeRoutes } from "./sourcing.js";
import { enrichOpportunityResearch } from "./researchEngine.js";
import { keepaStatus } from "./keepa.js";
import { fetchSocialTrends } from "./socialTrends.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seeds = JSON.parse(readFileSync(join(__dirname, "data", "market-seeds.json"), "utf8"));

function filterByRegion(list, regionFocus) {
  if (!regionFocus || regionFocus === "Global") return list;
  return list.filter((o) => (o.regionTags || []).includes(regionFocus) || (o.regionTags || []).includes("Global"));
}

function applyBudgetHint(list, budget) {
  if (!budget) return list;
  const b = Number(budget);
  if (!Number.isFinite(b) || b <= 0) return list;
  return list.map((o) => {
    const riskFlags = [...(o.riskFlags || [])];
    let budgetFit = 85;
    if (o.isServiceOffer) {
      budgetFit = b < 500 ? 35 : b < 800 ? 50 : b < 1500 ? 75 : 90;
      if (b < 800) riskFlags.push("Budget fit is weak for a high-ticket service sales motion");
    } else {
      budgetFit = b < 200 ? 45 : b < 400 ? 65 : b < 800 ? 82 : 92;
      if (b < 300) riskFlags.push("Small validation budget — keep tests narrow and creative count low");
    }
    return {
      ...o,
      budgetUsd: b,
      budgetFit,
      riskFlags,
    };
  });
}

async function aiOpportunities({ regionFocus, nicheHint, budget }) {
  const ai = await chatJson(
    `You are a market research analyst for a turnkey Shopify + automation agency.
Return JSON: { "opportunities": [ ... ] } with EXACTLY 10 items.
Each item keys: id, niche, audience, demandDrivers (string[]), sellWhere {primary, geos[], secondaryChannels[]},
whyNow, scores {demand, competition, gap 0-100}, estAovUsd, estContributionUsd,
projectedMonthlyOrders {conservative, base, aggressive},
marketing {persona, hook, adAngles[3], offer, landingPromise, objections[{q,a}]},
riskFlags[], isServiceOffer (bool — almost always false).
All 10 must be PHYSICAL product niches suitable for Shopify turnkey stores (light ship, evergreen).
Do NOT include local-service / WhatsApp automation / DFY agency packages in this list.
No trademarked brand replicas. Prefer evergreen. Be concrete.`,
    `Region focus: ${regionFocus || "Global"}
Budget USD (ads/setup): ${budget || "unspecified"}
Niche hint: ${nicheHint || "none — pick best gaps"}
Agency sells: ready Shopify stores ($300-800) and WhatsApp/WordPress automation ($1000+).`
  );

  if (!ai?.opportunities?.length) return null;
  return ai.opportunities.map((o, i) => ({
    ...o,
    id: o.id || `ai-${i}`,
    marketing: normalizeMarketingPack(o.marketing, o.niche),
    regionTags: o.regionTags || [regionFocus || "Global"],
  }));
}

/**
 * Market scout: demand + where to sell + marketing + AOV, then Ranking AI.
 */
export async function scoutMarket({ regionFocus = "Global", budget, nicheHint } = {}) {
  let list = await aiOpportunities({ regionFocus, nicheHint, budget });
  let source = "openai";

  if (!list) {
    source = "seed";
    list = filterByRegion(seeds, regionFocus).map((o) => ({
      ...o,
      marketing: normalizeMarketingPack(o.marketing, o.niche),
    }));
    if (nicheHint) {
      const hint = nicheHint.toLowerCase();
      const matched = list.filter((o) => o.niche.toLowerCase().includes(hint));
      if (matched.length) list = matched;
    }
  }

  list = applyBudgetHint(list, budget);

  // Split: Shopify product niches vs agency service offers (Model 2)
  const serviceOffers = list.filter((o) => o.isServiceOffer);
  list = list.filter((o) => !o.isServiceOffer);

  // Pad product list to 10 from seeds when AI/short
  if (list.length < 10) {
    const seedProducts = filterByRegion(seeds, regionFocus)
      .filter((o) => !o.isServiceOffer)
      .map((o) => ({
        ...o,
        marketing: normalizeMarketingPack(o.marketing, o.niche),
      }));
    const seen = new Set(list.map((o) => String(o.niche || "").toLowerCase()));
    for (const s of seedProducts) {
      if (list.length >= 10) break;
      const key = String(s.niche || "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(s);
    }
  }
  list = list.slice(0, 10);

  list = await Promise.all(
    list.map((o) =>
      enrichOpportunityResearch({
        ...o,
        marketing: normalizeMarketingPack(o.marketing, o.niche),
      })
    )
  );

  if (source === "seed" && process.env.OPENAI_API_KEY) {
    list = await Promise.all(
      list.slice(0, 10).map(async (o) => {
        const marketing = await enrichMarketingPack(o, { regionFocus });
        return enrichOpportunityResearch({ ...o, marketing, freeSignal: o.freeSignal });
      })
    );
  }

  const ranked = rankOpportunities(list).map((o) => ({
    ...o,
    tradeRoutes: opportunityTradeRoutes(o),
  }));
  const freeOk = ranked.filter((o) => o.freeSignal?.ok).length;
  const socialTrends = await fetchSocialTrends({ regionFocus, nicheHint });
  return {
    source,
    researchLabel:
      "Free trusted layer: Wikimedia + cited benchmarks. TikTok/Meta = trending creatives board (not shop GMV).",
    regionFocus,
    count: ranked.length,
    freeSignalsAttached: freeOk,
    keepa: keepaStatus(),
    socialTrends,
    opportunities: ranked,
    serviceOffers: serviceOffers.map((o) => ({
      ...o,
      marketing: normalizeMarketingPack(o.marketing, o.niche),
      tradeRoutes: opportunityTradeRoutes(o),
      offerType: "agency_service",
      note: "Model 2 — sell a lead automation system (WordPress/WhatsApp). Not physical SKUs; Hunt products will be empty.",
    })),
    engineNote:
      "Shows 10 ranked Shopify product niches. Agency service offers listed separately (not product imports).",
  };
}
