/**
 * Where to source (buy) and where products are typically sold.
 * Research guidance — verify live on each platform before ordering.
 */

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Per-source buy options: cost + shipping days (catalog estimates until live supplier API).
 */
export function buildSupplierOptions(product = {}) {
  if (Array.isArray(product.supplierOptions) && product.supplierOptions.length) {
    return product.supplierOptions;
  }

  const base = Number(product.estCostUsd) || 10;
  const weight = Number(product.estWeightKg) || 0.4;
  const heavy = weight > 0.8;
  const query = product.title || product.sourceFrom?.searchQuery || "product";

  return [
    {
      id: "autods",
      name: "AutoDS",
      type: "dropship_app",
      unitCostUsd: round2(base * 1.06),
      shippingDaysMin: heavy ? 10 : 7,
      shippingDaysMax: heavy ? 18 : 14,
      warehouse: "US / EU preferred (else CN)",
      includes: "App markup + catalog shipping estimate",
      searchHint: query,
      verifyUrl: "https://www.autods.com/",
      dataQuality: "estimate",
    },
    {
      id: "zendrop",
      name: "Zendrop",
      type: "dropship_app",
      unitCostUsd: round2(base * 1.08),
      shippingDaysMin: heavy ? 9 : 6,
      shippingDaysMax: heavy ? 16 : 12,
      warehouse: "Often faster branded fulfillment options",
      includes: "App markup + shipping estimate",
      searchHint: query,
      verifyUrl: "https://www.zendrop.com/",
      dataQuality: "estimate",
    },
    {
      id: "cj",
      name: "CJ Dropshipping",
      type: "dropship_app",
      unitCostUsd: round2(base * 0.98),
      shippingDaysMin: heavy ? 12 : 8,
      shippingDaysMax: heavy ? 25 : 18,
      warehouse: "CN + some local warehouses",
      includes: "Product + ship estimate",
      searchHint: query,
      verifyUrl: "https://cjdropshipping.com/",
      dataQuality: "estimate",
    },
    {
      id: "aliexpress",
      name: "AliExpress (direct)",
      type: "marketplace",
      unitCostUsd: round2(base * 0.92),
      shippingDaysMin: heavy ? 15 : 12,
      shippingDaysMax: heavy ? 35 : 25,
      warehouse: "Mostly CN",
      includes: "Item price; shipping varies by seller",
      searchHint: query,
      verifyUrl: `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(query).replace(/%20/g, "-")}.html`,
      dataQuality: "estimate",
    },
  ];
}

export function defaultSourceFrom(product = {}, opportunity = {}) {
  const title = product.title || "product";
  const niche = opportunity.niche || product.category || "general";
  const query = `${title}`.slice(0, 80);
  const options = buildSupplierOptions({
    ...product,
    title: query,
    estCostUsd: product.estCostUsd,
    estWeightKg: product.estWeightKg,
  });
  const best = options[0];

  const base = product.sourceFrom || {};
  return normalizeSource(
    {
      primary: base.primary || best?.name || "AutoDS",
      platforms: base.platforms || options.map((o) => o.name),
      searchQuery: base.searchQuery || query,
      howToFind: base.howToFind || [
        `Search “${query}” on AutoDS or Zendrop`,
        "Filter: rating 4.5+, orders, ship time under 12–20 days (prefer local warehouse)",
        "Compare landed cost vs your sell price before import",
      ],
      originHint: base.originHint || nicheMatchOrigin(niche),
      notes: base.notes || product.supplierNotes || "Confirm stock + shipping days before ads",
      unitCostUsd: best?.unitCostUsd,
      shippingDaysMin: best?.shippingDaysMin,
      shippingDaysMax: best?.shippingDaysMax,
      priceNote:
        "Catalog estimate — confirm live landed cost + shipping on the supplier before buying",
    },
    product
  );
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
  if (n.includes("beauty") || n.includes("gulf")) {
    return "Often CN factories; prefer UAE/EU warehouse when available for Gulf";
  }
  if (n.includes("eco") || n.includes("kitchen")) {
    return "Often CN / EU wholesale; UK buyers prefer faster EU stock";
  }
  if (n.includes("fitness")) {
    return "CN dropship common; US/EU warehouse cuts returns complaints";
  }
  if (n.includes("pet")) {
    return "CN + US pet accessory suppliers via AutoDS/Zendrop";
  }
  if (n.includes("baby")) {
    return "CN accessories; avoid regulated medical claims";
  }
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
    unitCostUsd: src.unitCostUsd,
    shippingDaysMin: src.shippingDaysMin,
    shippingDaysMax: src.shippingDaysMax,
    priceNote: src.priceNote,
  };
}

function normalizeSold(sold, opportunity) {
  return {
    yourChannel: sold.yourChannel || opportunity.sellWhere?.primary || "Shopify turnkey store",
    geos: sold.geos || opportunity.sellWhere?.geos || [],
    whereCompetitorsSell:
      sold.whereCompetitorsSell || sold.competitorChannels || ["Amazon", "Shopify DTC"],
    demandSignals: sold.demandSignals || [],
    sellStrategy: sold.sellStrategy || "",
  };
}

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
