/**
 * Marketplace sales helpers — delegates to transparent researchEngine.
 * Old storeOrders×55 scaler REMOVED (it was not real market data).
 */
export {
  computeMarketplaceFromBenchmarks as buildMarketplaceSales,
  computeMarketplaceFromBenchmarks,
} from "./researchEngine.js";

import { computeMarketplaceFromBenchmarks } from "./researchEngine.js";

/** Product-level: scale niche model down to similar-SKU slice */
export function buildProductMarketplaceSales(product = {}, opportunity = {}) {
  const nicheSales = computeMarketplaceFromBenchmarks(opportunity);
  if (opportunity.isServiceOffer) {
    return {
      ...nicheSales,
      whoseStats: "Service category — SKU marketplace split N/A",
    };
  }

  // One SKU type ≈ small fraction of niche accessories online
  const skuShareOfNiche = 0.004;
  const overallRevenue = Math.round((nicheSales.overall?.revenue || 0) * skuShareOfNiche);
  const aov = Number(product.estAovUsd || product.estSellPriceUsd) || 25;
  const overallOrders = Math.max(1, Math.round(overallRevenue / aov));

  const byPlatform = (nicheSales.byPlatform || []).map((p) => ({
    ...p,
    orders: Math.round(overallOrders * (p.share || 0)),
    revenue: Math.round(overallRevenue * (p.share || 0)),
  }));

  const captureRate = 0.015;
  const yourBase = Math.max(5, Math.round(overallOrders * captureRate));
  const yourConservative = Math.max(3, Math.round(yourBase * 0.5));
  const yourAggressive = Math.round(yourBase * 2);

  return {
    whoseStats: `Modeled “${product.title}”-type sales across Amazon/Etsy/eBay/DTC — derived from niche benchmark × SKU share (${skuShareOfNiche * 100}% of niche). NOT live BSR.`,
    scope: "product_type_model",
    period: "monthly",
    currency: "USD",
    dataQuality: nicheSales.dataQuality || "low",
    disclaimer: nicheSales.disclaimer,
    method: `${nicheSales.method}; then × ${skuShareOfNiche} SKU-type share`,
    sources: nicheSales.sources || [],
    math: {
      ...(nicheSales.math || {}),
      skuShareOfNiche,
      assumedListingCaptureRate: captureRate,
      productTypeMonthlyRevenueUsd: overallRevenue,
      productTypeMonthlyOrders: overallOrders,
    },
    assumptions: {
      skuShareOfNiche,
      listingCaptureRate: captureRate,
      observed: false,
      note: "Planning assumptions only; replace with tracked store results or verified marketplace data."
    },
    yourStoreProjection: {
      orders: {
        conservative: yourConservative,
        base: yourBase,
        aggressive: yourAggressive,
      },
      revenue: {
        conservative: Math.round(yourConservative * aov),
        base: Math.round(yourBase * aov),
        aggressive: Math.round(yourAggressive * aov),
      },
      channel: product.soldOn?.yourChannel || "Shopify turnkey store",
      note: `Planning projection using a ${(captureRate*100).toFixed(2)}% listing-capture assumption; not observed store performance.`,
    },
    overall: {
      orders: overallOrders,
      revenue: overallRevenue,
      label: "Modeled similar-product sales / mo (all platforms)",
    },
    byPlatform,
    geos: product.soldOn?.geos || opportunity.sellWhere?.geos || [],
  };
}
