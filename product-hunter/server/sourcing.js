/**
 * Where to source (buy) and where products are typically sold.
 * Research guidance — verify live on each platform before ordering.
 */

export function defaultSourceFrom(product = {}, opportunity = {}) {
  if (product.sourceFrom) return normalizeSource(product.sourceFrom, product);

  const title = product.title || "product";
  const niche = opportunity.niche || product.category || "general";
  const query = `${title}`.slice(0, 80);

  return {
    primary: "AutoDS / Zendrop catalog (AliExpress-backed)",
    platforms: ["AutoDS", "Zendrop", "CJ Dropshipping", "AliExpress"],
    searchQuery: query,
    howToFind: [
      `Search “${query}” on AutoDS or Zendrop`,
      "Filter: rating 4.5+, orders, ship time under 12–20 days (prefer local warehouse)",
      "Compare landed cost vs your sell price before import",
    ],
    originHint: nicheMatchOrigin(niche),
    notes: product.supplierNotes || "Confirm stock + shipping days before ads",
  };
}

export function defaultSoldOn(product = {}, opportunity = {}) {
  if (product.soldOn) return normalizeSold(product.soldOn, opportunity);

  const geos = opportunity.sellWhere?.geos || ["United States"];
  const niche = opportunity.niche || product.category || "niche";
  const secondary = opportunity.sellWhere?.secondaryChannels || [];

  return {
    yourChannel: opportunity.sellWhere?.primary || "Shopify turnkey store",
    geos,
    whereCompetitorsSell: [
      `Amazon (${geos[0] || "US"}) — ${niche} bestsellers`,
      "Independent Shopify / DTC stores",
      ...secondary.slice(0, 2),
    ].filter(Boolean),
    demandSignals: [
      "Similar listings active on Amazon + TikTok/Meta ads creatives",
      "Evergreen search intent for the problem this SKU solves",
    ],
    sellStrategy: `Sell on your Shopify store in ${(geos || []).slice(0, 2).join(" / ")}; avoid racing Amazon on price alone — win with bundles + creative.`,
  };
}

function nicheMatchOrigin(niche) {
  const n = String(niche).toLowerCase();
  if (n.includes("beauty") || n.includes("gulf")) return "Often CN factories; prefer UAE/EU warehouse when available for Gulf";
  if (n.includes("eco") || n.includes("kitchen")) return "Often CN / EU wholesale; UK buyers prefer faster EU stock";
  if (n.includes("fitness")) return "CN dropship common; US/EU warehouse cuts returns complaints";
  if (n.includes("pet")) return "CN + US pet accessory suppliers via AutoDS/Zendrop";
  if (n.includes("baby")) return "CN accessories; avoid regulated medical claims";
  return "Typically sourced via CN dropship catalogs (AutoDS/Zendrop/CJ)";
}

function normalizeSource(src, product) {
  return {
    primary: src.primary || "AutoDS / Zendrop",
    platforms: src.platforms || ["AutoDS", "Zendrop", "AliExpress"],
    searchQuery: src.searchQuery || product.title || "",
    howToFind: src.howToFind || [`Search “${product.title}” on AutoDS`],
    originHint: src.originHint || "",
    notes: src.notes || product.supplierNotes || "",
  };
}

function normalizeSold(sold, opportunity) {
  return {
    yourChannel: sold.yourChannel || opportunity.sellWhere?.primary || "Shopify turnkey store",
    geos: sold.geos || opportunity.sellWhere?.geos || [],
    whereCompetitorsSell: sold.whereCompetitorsSell || sold.competitorChannels || ["Amazon", "Shopify DTC"],
    demandSignals: sold.demandSignals || [],
    sellStrategy: sold.sellStrategy || "",
  };
}

/** Opportunity-level: where you buy inventory vs where you sell the store offer */
export function opportunityTradeRoutes(opportunity = {}) {
  const geos = opportunity.sellWhere?.geos || [];
  return {
    buyInventoryFrom: opportunity.isServiceOffer
      ? {
          primary: "No physical inventory — deliver WordPress + Make.com + WhatsApp setup",
          platforms: ["Fluent Forms", "Make.com", "Whapi.cloud / Twilio"],
        }
      : {
          primary: "Dropship catalogs (AutoDS / Zendrop / CJ) → import to Shopify",
          platforms: ["AutoDS", "Zendrop", "CJ Dropshipping", "AliExpress"],
          notes: "Development store products first; connect real supplier SKUs before client handoff",
        },
    sellOfferOn: {
      primary: opportunity.sellWhere?.primary || "Shopify turnkey store",
      geos,
      secondaryChannels: opportunity.sellWhere?.secondaryChannels || [],
      customerAcquisition: ["Meta/TikTok ads", "pSEO landers", "WhatsApp nurture"],
    },
  };
}
