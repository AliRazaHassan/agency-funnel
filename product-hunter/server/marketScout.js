import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rankOpportunities } from "./rankingAI.js";
import { enrichMarketingPack, normalizeMarketingPack } from "./marketingPack.js";
import { chatJson } from "./openai.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seeds = JSON.parse(readFileSync(join(__dirname, "data", "market-seeds.json"), "utf8"));

function filterByRegion(list, regionFocus) {
  if (!regionFocus || regionFocus === "Global") return list;
  return list.filter((o) => (o.regionTags || []).includes(regionFocus) || (o.regionTags || []).includes("Global"));
}

function applyBudgetHint(list, budget) {
  if (!budget) return list;
  const b = Number(budget);
  if (!Number.isFinite(b)) return list;
  return list.map((o) => {
    let demand = o.scores?.demand || 50;
    let riskFlags = [...(o.riskFlags || [])];
    if (b < 800 && o.isServiceOffer) {
      demand = Math.max(40, demand - 18);
      riskFlags.push("High-ticket service — needs sales capacity beyond small ad budget");
    }
    if (b < 500 && !o.isServiceOffer) demand = Math.min(100, demand + 4);
    if (b >= 1000 && o.isServiceOffer) demand = Math.min(100, demand + 6);
    return {
      ...o,
      riskFlags,
      scores: { ...o.scores, demand },
    };
  });
}

async function aiOpportunities({ regionFocus, nicheHint, budget }) {
  const ai = await chatJson(
    `You are a market research analyst for a turnkey Shopify + automation agency.
Return JSON: { "opportunities": [ ... ] } with 5-6 items.
Each item keys: id, niche, audience, demandDrivers (string[]), sellWhere {primary, geos[], secondaryChannels[]},
whyNow, scores {demand, competition, gap 0-100}, estAovUsd, estContributionUsd,
projectedMonthlyOrders {conservative, base, aggressive},
marketing {persona, hook, adAngles[3], offer, landingPromise, objections[{q,a}]},
riskFlags[], isServiceOffer (bool).
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

  // Enrich top seeds with marketing AI when key present (skip if already from openai full pack)
  if (source === "seed" && process.env.OPENAI_API_KEY) {
    list = await Promise.all(
      list.slice(0, 6).map(async (o) => {
        const marketing = await enrichMarketingPack(o, { regionFocus });
        return { ...o, marketing };
      })
    );
  }

  const ranked = rankOpportunities(list);
  return {
    source,
    researchLabel: "Research score (model + rules) — not live marketplace proof",
    regionFocus,
    count: ranked.length,
    opportunities: ranked,
  };
}
