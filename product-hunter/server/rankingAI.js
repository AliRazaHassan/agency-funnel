/** Shared ranking weights — opportunities + products */

import { buildMarketplaceSales } from "./marketSales.js";

export const RANK_WEIGHTS = {
  demand: 0.3,
  marketing: 0.25,
  orderValue: 0.25,
  sellability: 0.15,
  riskPenalty: 0.15,
};

export const PRODUCT_PILLAR_WEIGHTS = {
  margin: 0.2,
  demandFit: 0.15,
  competitionEase: 0.1,
  logistics: 0.1,
  supplierEase: 0.1,
  orderValue: 0.2,
  marketing: 0.15,
};

export function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Opportunity-level rankScore (0–100).
 */
export function rankOpportunity(input) {
  const demand = clamp(input.demand ?? input.scores?.demand ?? 50);
  const marketing = clamp(input.marketingStrength ?? scoreMarketingPack(input.marketing));
  const orderValue = clamp(input.orderValueScore ?? scoreOrderValueBlock(input));
  const sellability = clamp(input.sellability ?? scoreSellability(input));
  const riskPenalty = clamp(input.riskPenalty ?? scoreRiskPenalty(input.riskFlags));

  const rankScore = round1(
    RANK_WEIGHTS.demand * demand +
      RANK_WEIGHTS.marketing * marketing +
      RANK_WEIGHTS.orderValue * orderValue +
      RANK_WEIGHTS.sellability * sellability -
      RANK_WEIGHTS.riskPenalty * riskPenalty
  );

  return {
    demand,
    marketing,
    orderValue,
    sellability,
    riskPenalty,
    rankScore: clamp(rankScore),
    revenuePotentialScore: clamp(rankScore),
  };
}

export function scoreMarketingPack(marketing = {}) {
  let s = 40;
  if (marketing.hook) s += 15;
  if (Array.isArray(marketing.adAngles) && marketing.adAngles.length >= 3) s += 15;
  if (marketing.offer) s += 10;
  if (marketing.persona) s += 10;
  if (marketing.landingPromise) s += 5;
  if (Array.isArray(marketing.objections) && marketing.objections.length >= 2) s += 5;
  return clamp(s);
}

export function scoreOrderValueBlock(item) {
  const aovRaw = Number(item.estAovUsd) || 0;
  // Cap physical-goods AOV curve so $1k service tickets don't crush all product niches
  const aov = item.isServiceOffer ? Math.min(aovRaw / 12, 95) : Math.min(aovRaw, 95);
  const contribRaw = Number(item.estContributionUsd) || aovRaw * 0.35;
  const contrib = item.isServiceOffer ? Math.min(contribRaw / 15, 90) : Math.min(contribRaw, 45);
  const baseOrders = item.projectedMonthlyOrders?.base ?? 50;
  const aovScore = clamp((aov / 95) * 85);
  const contribScore = clamp((contrib / (item.isServiceOffer ? 90 : 40)) * 80);
  const volumeScore = item.isServiceOffer
    ? clamp((baseOrders / 10) * 70)
    : clamp((baseOrders / 120) * 60);
  return round1(0.4 * aovScore + 0.4 * contribScore + 0.2 * volumeScore);
}

export function scoreSellability(item) {
  let s = 50;
  const primary = item.sellWhere?.primary || "";
  if (/shopify/i.test(primary)) s += 15;
  if (/done-for-you|wordpress|make\.com/i.test(primary)) s += 10;
  if ((item.sellWhere?.geos || []).length >= 2) s += 10;
  if ((item.sellWhere?.secondaryChannels || []).length >= 1) s += 5;
  if (item.isServiceOffer) s += 5; // high ticket clarity
  return clamp(s);
}

export function scoreRiskPenalty(flags = []) {
  if (!flags?.length) return 10;
  return clamp(10 + flags.length * 12);
}

/**
 * Attach ranks + sort opportunities descending.
 */
export function rankOpportunities(list) {
  const ranked = list.map((opp) => {
    const scores = rankOpportunity(opp);
    const base = opp.projectedMonthlyOrders?.base ?? 50;
    const projectedMonthlyRevenue = opp.projectedMonthlyRevenue || {
      conservative: round1((opp.projectedMonthlyOrders?.conservative ?? base * 0.45) * (opp.estAovUsd || 0)),
      base: round1(base * (opp.estAovUsd || 0)),
      aggressive: round1((opp.projectedMonthlyOrders?.aggressive ?? base * 2) * (opp.estAovUsd || 0)),
    };
    // Keep research-engine marketplaceSales if present; do not rebuild with old scaler
    const marketplaceSales = opp.marketplaceSales || buildMarketplaceSales({
      ...opp,
      projectedMonthlyRevenue,
    });
    return {
      ...opp,
      scores: { ...opp.scores, ...scores },
      rankScore: scores.rankScore,
      revenuePotentialScore: scores.revenuePotentialScore,
      projectedMonthlyOrders: opp.projectedMonthlyOrders,
      projectedMonthlyRevenue,
      marketplaceSales,
      marketingStrength: scores.marketing,
      demandResearch: opp.demandResearch,
      researchMeta: opp.researchMeta,
    };
  });

  ranked.sort((a, b) => b.rankScore - a.rankScore);
  return ranked.map((o, i) => ({ ...o, rank: i + 1 }));
}

/**
 * Product-level rank using pillars + commercial signals.
 */
export function rankProduct(product) {
  const pillars = product.pillars || {};
  const w = PRODUCT_PILLAR_WEIGHTS;
  let rankScore =
    w.margin * clamp(pillars.margin) +
    w.demandFit * clamp(pillars.demandFit) +
    w.competitionEase * clamp(pillars.competitionEase) +
    w.logistics * clamp(pillars.logistics) +
    w.supplierEase * clamp(pillars.supplierEase) +
    w.orderValue * clamp(pillars.orderValue) +
    w.marketing * clamp(pillars.marketing);

  if (product.rejected) rankScore *= 0.35;
  rankScore = round1(clamp(rankScore));

  return {
    ...product,
    rankScore,
    revenuePotentialScore: rankScore,
  };
}

export function rankProducts(list) {
  const ranked = list.map(rankProduct);
  ranked.sort((a, b) => b.rankScore - a.rankScore);
  return ranked.map((p, i) => ({ ...p, rank: i + 1 }));
}
