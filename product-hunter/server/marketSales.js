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
      productTypeMonthlyRevenueUsd: overallRevenue,
      productTypeMonthlyOrders: overallOrders,
    },
    yourStoreProjection: {
      orders: {
        conservative: Math.max(3, Math.round(yourBase * 0.5)),
        base: yourBase,
        aggressive: Math.round(yourBase * 2),
      },
      revenue: {
        base: Math.round(yourBase * aov),
      },
      channel: product.soldOn?.yourChannel || "Shopify turnkey store",
      note: "Your listing capture of this product-type pool (planning only)",
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
