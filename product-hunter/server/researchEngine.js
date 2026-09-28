/**
 * Transparent research engine.
 * Demand / sales are COMPUTED with cited assumptions — not live Amazon scrapes.
 */

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

/**
 * Public industry ballparks (annual USD) + model assumptions.
 * Update when you plug real APIs (Keepa, Jungle Scout, etc.).
 */
export const INDUSTRY_BENCHMARKS = {
  "Pet Supplies": {
    geo: "US",
    annualTotalUsd: 147_000_000_000,
    source: "APPA (American Pet Products Association) — total US pet industry spend",
    year: "2023–2024 public ballpark",
    onlineShare: 0.22,
    categoryShareOfTotal: 0.07,
    categoryNote: "Non-food supplies/accessories rough slice of APPA total (food dominates; this is a model assumption)",
    confidence: "medium",
  },
  "Home Fitness Gear": {
    geo: "US",
    annualTotalUsd: 15_000_000_000,
    source: "Home fitness equipment market public estimates (multiple analyst summaries)",
    year: "2023–2025 range",
    onlineShare: 0.45,
    categoryShareOfTotal: 0.35,
    categoryNote: "Light accessories/bands/mats share of home fitness (model assumption)",
    confidence: "low",
  },
  "Eco Kitchen Gadgets": {
    geo: "US+UK proxy",
    annualTotalUsd: 8_000_000_000,
    source: "Kitchen gadgets / housewares ecom category proxies (analyst ranges)",
    year: "approximate",
    onlineShare: 0.4,
    categoryShareOfTotal: 0.15,
    categoryNote: "Eco/reusable subset (model assumption)",
    confidence: "low",
  },
  "Beauty Tools & Accessories": {
    geo: "Global beauty tools proxy",
    annualTotalUsd: 20_000_000_000,
    source: "Beauty devices/tools market public estimates",
    year: "approximate",
    onlineShare: 0.35,
    categoryShareOfTotal: 0.25,
    categoryNote: "Tools/accessories vs cosmetics (model assumption)",
    confidence: "low",
  },
  "Baby Travel & Nursery Accessories": {
    geo: "US",
    annualTotalUsd: 12_000_000_000,
    source: "Baby gear / nursery market public estimates",
    year: "approximate",
    onlineShare: 0.4,
    categoryShareOfTotal: 0.2,
    categoryNote: "Travel/accessories slice (model assumption)",
    confidence: "low",
  },
  "Desk & WFH Comfort Accessories": {
    geo: "US",
    annualTotalUsd: 6_000_000_000,
    source: "Office/WFH accessories market proxies",
    year: "approximate",
    onlineShare: 0.5,
    categoryShareOfTotal: 0.3,
    categoryNote: "Small desk accessories vs furniture (model assumption)",
    confidence: "low",
  },
  "Outdoor Micro-Adventure Gear": {
    geo: "US",
    annualTotalUsd: 10_000_000_000,
    source: "Outdoor recreation gear public estimates",
    year: "approximate",
    onlineShare: 0.35,
    categoryShareOfTotal: 0.15,
    categoryNote: "Micro/light gear vs heavy packs/tents (model assumption)",
    confidence: "low",
  },
  default: {
    geo: "US proxy",
    annualTotalUsd: 5_000_000_000,
    source: "Generic specialty retail proxy — replace with niche report",
    year: "placeholder",
    onlineShare: 0.35,
    categoryShareOfTotal: 0.2,
    categoryNote: "Fallback model — low confidence",
    confidence: "very-low",
  },
};

/** Platform share of ONLINE niche sales (model, not scraped GMV) */
export const PLATFORM_SHARES = {
  "Pet Supplies": { Amazon: 0.48, "Shopify DTC": 0.14, Chewy: 0.12, eBay: 0.08, "TikTok Shop": 0.1, Etsy: 0.05, Other: 0.03 },
  "Home Fitness Gear": { Amazon: 0.42, "Shopify DTC": 0.22, eBay: 0.08, "TikTok Shop": 0.14, Walmart: 0.08, Etsy: 0.02, Other: 0.04 },
  "Eco Kitchen Gadgets": { Amazon: 0.35, Etsy: 0.18, "Shopify DTC": 0.2, eBay: 0.1, "TikTok Shop": 0.1, Walmart: 0.04, Other: 0.03 },
  "Beauty Tools & Accessories": { Amazon: 0.4, "Shopify DTC": 0.18, "TikTok Shop": 0.2, eBay: 0.06, Etsy: 0.08, Other: 0.08 },
  "Baby Travel & Nursery Accessories": { Amazon: 0.45, "Shopify DTC": 0.15, Walmart: 0.12, eBay: 0.08, "TikTok Shop": 0.1, Etsy: 0.05, Other: 0.05 },
  "Desk & WFH Comfort Accessories": { Amazon: 0.44, "Shopify DTC": 0.2, eBay: 0.1, "TikTok Shop": 0.12, Walmart: 0.08, Etsy: 0.02, Other: 0.04 },
  "Outdoor Micro-Adventure Gear": { Amazon: 0.4, "Shopify DTC": 0.18, eBay: 0.14, Etsy: 0.06, "TikTok Shop": 0.12, Other: 0.1 },
  default: { Amazon: 0.4, "Shopify DTC": 0.18, eBay: 0.12, Etsy: 0.08, "TikTok Shop": 0.12, Walmart: 0.05, Other: 0.05 },
};

function benchmarkFor(niche) {
  if (INDUSTRY_BENCHMARKS[niche]) return INDUSTRY_BENCHMARKS[niche];
  const key = Object.keys(INDUSTRY_BENCHMARKS).find(
    (k) => k !== "default" && String(niche || "").toLowerCase().includes(k.toLowerCase().split(" ")[0])
  );
  return INDUSTRY_BENCHMARKS[key] || INDUSTRY_BENCHMARKS.default;
}

function sharesFor(niche) {
  if (PLATFORM_SHARES[niche]) return PLATFORM_SHARES[niche];
  const key = Object.keys(PLATFORM_SHARES).find(
    (k) => k !== "default" && String(niche || "").toLowerCase().includes(k.toLowerCase().split(" ")[0])
  );
  return PLATFORM_SHARES[key] || PLATFORM_SHARES.default;
}

/**
 * Demand INDEX 0–100 from transparent rubric (not a magic hardcoded 82).
 */
export function computeDemandResearch(opportunity = {}) {
  const drivers = opportunity.demandDrivers || [];
  const why = String(opportunity.whyNow || "").toLowerCase();
  const niche = String(opportunity.niche || "").toLowerCase();

  const factors = [];

  // Evergreen / repeat
  let evergreen = 45;
  if (drivers.some((d) => /repeat|evergreen|consumable/i.test(d))) evergreen += 25;
  if (/evergreen|repeat/.test(why)) evergreen += 10;
  evergreen = clamp(evergreen);
  factors.push({
    id: "evergreen",
    label: "Evergreen / repeat demand",
    score: evergreen,
    weight: 0.25,
    evidence: drivers.filter((d) => /repeat|evergreen|consumable/i.test(d)).join("; ") || "Inferred from niche copy",
  });

  // Problem urgency
  let urgency = 40;
  if (drivers.some((d) => /problem|pain|speed|missed|safety|comfort/i.test(d))) urgency += 20;
  if (/willingness to pay|urgency|pain/.test(why)) urgency += 15;
  urgency = clamp(urgency);
  factors.push({
    id: "urgency",
    label: "Problem urgency / WTP",
    score: urgency,
    weight: 0.2,
    evidence: opportunity.whyNow || "From opportunity narrative",
  });

  // Online / channel fit
  let online = 50;
  const primary = opportunity.sellWhere?.primary || "";
  if (/shopify|amazon|tiktok|ebay|etsy/i.test(primary + JSON.stringify(opportunity.sellWhere || {}))) {
    online += 20;
  }
  if ((opportunity.sellWhere?.secondaryChannels || []).length >= 2) online += 10;
  online = clamp(online);
  factors.push({
    id: "onlineFit",
    label: "Online channel fit",
    score: online,
    weight: 0.15,
    evidence: `${primary}; ${(opportunity.sellWhere?.secondaryChannels || []).join(", ")}`,
  });

  // Gift / social
  let gift = 35;
  if (drivers.some((d) => /gift|social|instagram|tiktok|visual/i.test(d))) gift += 30;
  if (/gift|ugc|instagram|tiktok/.test(why + niche)) gift += 10;
  gift = clamp(gift);
  factors.push({
    id: "giftSocial",
    label: "Gift / social creative potential",
    score: gift,
    weight: 0.15,
    evidence: drivers.filter((d) => /gift|social|visual/i.test(d)).join("; ") || "Limited gift signals",
  });

  // Competition pressure (higher competition → lower demand opportunity quality)
  const competitionRaw = Number(opportunity.scores?.competition);
  const competition = Number.isFinite(competitionRaw) ? competitionRaw : 55;
  const competitionEase = clamp(100 - competition);
  factors.push({
    id: "competitionEase",
    label: "Competition ease (inverse of crowdedness)",
    score: competitionEase,
    weight: 0.15,
    evidence: `Competition index ${competition}/100 (seed/AI heuristic until live SERP/BSR data)`,
  });

  // Benchmark confidence boost
  const bench = benchmarkFor(opportunity.niche);
  let dataConfidence = bench.confidence === "medium" ? 70 : bench.confidence === "low" ? 50 : 30;
  if (opportunity.isServiceOffer) dataConfidence = 45;
  factors.push({
    id: "dataConfidence",
    label: "Benchmark data confidence",
    score: dataConfidence,
    weight: 0.08,
    evidence: `${bench.source} (${bench.year}) · confidence=${bench.confidence}`,
  });

  // Free live signal (Wikimedia ± Google Trends) when present
  const free = opportunity.freeSignal;
  if (free?.ok && Number.isFinite(free.interestScore)) {
    factors.push({
      id: "freePublicInterest",
      label: "Free public interest (Wikimedia/Trends)",
      score: clamp(free.interestScore),
      weight: 0.22,
      evidence:
        free.providers?.map((p) => `${p.provider}: ${p.interestScore}`).join(" · ") ||
        free.honesty,
    });
    // Rebalance earlier weights slightly so total ≈ 1
    const locked = new Set(["freePublicInterest"]);
    const others = factors.filter((f) => !locked.has(f.id));
    const othersWeight = others.reduce((s, f) => s + f.weight, 0);
    const targetOthers = 0.78;
    if (othersWeight > 0) {
      for (const f of others) f.weight = (f.weight / othersWeight) * targetOthers;
    }
  }

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0) || 1;
  if (Math.abs(totalWeight - 1) > 0.0001) {
    for (const f of factors) f.weight = f.weight / totalWeight;
  }

  const demand = round1(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  return {
    demandScore: clamp(demand),
    factors,
    freeSignal: free || null,
    method: free?.ok
      ? "Weighted rubric + free public interest (Wikimedia Pageviews ± Google Trends). Not Amazon sold units."
      : "Weighted rubric (evergreen, urgency, online fit, gift/social, competition ease, benchmarks). Free live feed unavailable this run.",
    replacesHardcoded: true,
  };
}

/**
 * Marketplace $ from industry benchmarks — NOT storeOrders * 55 fake scaler.
 */
export function computeMarketplaceFromBenchmarks(opportunity = {}) {
  if (opportunity.isServiceOffer) {
    return {
      whoseStats:
        "Service demand pool proxy (DFY agencies + DIY SaaS) — NOT your closed deals",
      scope: "service_category",
      period: "monthly",
      currency: "USD",
      dataQuality: "low",
      disclaimer:
        "No live CRM/marketplace feed. Service numbers are planning proxies only.",
      method: "Heuristic service pool — replace with your outbound pipeline data",
      sources: [],
      yourStoreProjection: {
        orders: opportunity.projectedMonthlyOrders || {},
        revenue: opportunity.projectedMonthlyRevenue || {},
        channel: opportunity.sellWhere?.primary || "Done-for-you package",
        note: "Your agency capacity projection (inputs), not market GMV",
      },
      overall: {
        orders: null,
        revenue: null,
        label: "Overall $ not claimed for services without pipeline data",
      },
      byPlatform: [
        { platform: "DFY agencies", share: 0.35, orders: null, revenue: null, note: "share only" },
        { platform: "Freelance marketplaces", share: 0.25, orders: null, revenue: null, note: "share only" },
        { platform: "DIY SaaS tools", share: 0.3, orders: null, revenue: null, note: "share only" },
        { platform: "Other", share: 0.1, orders: null, revenue: null, note: "share only" },
      ],
      geos: opportunity.sellWhere?.geos || [],
    };
  }

  const bench = benchmarkFor(opportunity.niche);
  const annualOnlineCategory =
    bench.annualTotalUsd * bench.onlineShare * bench.categoryShareOfTotal;
  const monthlyRevenue = annualOnlineCategory / 12;
  const aov = Number(opportunity.estAovUsd) || 50;
  const monthlyOrders = Math.round(monthlyRevenue / aov);
  const shares = sharesFor(opportunity.niche);

  const byPlatform = Object.entries(shares).map(([platform, share]) => ({
    platform,
    share,
    orders: Math.round(monthlyOrders * share),
    revenue: round1(monthlyRevenue * share),
  }));
  byPlatform.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

  // Realistic new DTC store capture of modeled online niche (tiny)
  const captureRate = 0.000025;
  const yourOrdersBase = Math.max(12, Math.round(monthlyOrders * captureRate));
  const yourOrders = {
    conservative: Math.max(6, Math.round(yourOrdersBase * 0.45)),
    base: yourOrdersBase,
    aggressive: Math.round(yourOrdersBase * 2.5),
  };

  return {
    whoseStats: `Modeled online “${opportunity.niche}” sales across Amazon/Etsy/eBay/DTC — industry benchmark math, NOT live scraped GMV`,
    scope: "niche_online_model",
    period: "monthly",
    currency: "USD",
    dataQuality: bench.confidence,
    disclaimer:
      "Dollar figures are MODELLED from public industry totals × online share × category share. Verify with Keepa/Helium10/eRank before ads.",
    method: `monthly ≈ (annualTotal × onlineShare × categoryShare) / 12; then split by platform share table`,
    sources: [
      {
        name: bench.source,
        year: bench.year,
        geo: bench.geo,
        annualTotalUsd: bench.annualTotalUsd,
        onlineShare: bench.onlineShare,
        categoryShareOfTotal: bench.categoryShareOfTotal,
        categoryNote: bench.categoryNote,
      },
    ],
    math: {
      annualTotalUsd: bench.annualTotalUsd,
      onlineShare: bench.onlineShare,
      categoryShareOfTotal: bench.categoryShareOfTotal,
      annualOnlineCategoryUsd: round1(annualOnlineCategory),
      monthlyRevenueUsd: round1(monthlyRevenue),
      assumedAovUsd: aov,
      monthlyOrders,
      yourCaptureRate: captureRate,
    },
    yourStoreProjection: {
      orders: yourOrders,
      revenue: {
        conservative: round1(yourOrders.conservative * aov),
        base: round1(yourOrders.base * aov),
        aggressive: round1(yourOrders.aggressive * aov),
      },
      channel: opportunity.sellWhere?.primary || "Shopify turnkey store",
      note: `Assumes ~${(captureRate * 100).toFixed(4)}% capture of modeled online niche — planning assumption, not observed share`,
    },
    overall: {
      orders: monthlyOrders,
      revenue: round1(monthlyRevenue),
      label: "Modeled online niche sales / mo (all platforms)",
    },
    byPlatform,
    geos: opportunity.sellWhere?.geos || [],
  };
}

/**
 * Enrich opportunity: free signals + demand + marketplace; overwrite fake seed scores.
 */
export async function enrichOpportunityResearch(opportunity = {}) {
  let freeSignal = opportunity.freeSignal;
  if (!freeSignal) {
    try {
      const { fetchFreeDemandSignal } = await import("./freeSignals.js");
      const geo = opportunity.sellWhere?.geos?.[0] || opportunity.regionTags?.[0] || "US";
      freeSignal = await fetchFreeDemandSignal(opportunity.niche, geo);
    } catch {
      freeSignal = { ok: false, free: true, honesty: "Free signal fetch failed" };
    }
  }

  const withSignal = { ...opportunity, freeSignal };
  const demandResearch = computeDemandResearch(withSignal);
  const marketplaceSales = computeMarketplaceFromBenchmarks({
    ...withSignal,
    scores: {
      ...opportunity.scores,
      demand: demandResearch.demandScore,
    },
  });

  // Attach free signal provenance onto marketplace sources list
  if (freeSignal?.ok && Array.isArray(marketplaceSales.sources)) {
    for (const p of freeSignal.providers || []) {
      marketplaceSales.sources.push({
        name: `${p.provider} (free)`,
        year: "live",
        note: p.note,
        interestScore: p.interestScore,
        url: p.url,
      });
    }
  }

  const projectedMonthlyOrders =
    marketplaceSales.yourStoreProjection?.orders || opportunity.projectedMonthlyOrders;
  const projectedMonthlyRevenue =
    marketplaceSales.yourStoreProjection?.revenue || opportunity.projectedMonthlyRevenue;

  const competition = Number(opportunity.scores?.competition) || 55;
  const gap = clamp(Math.round(demandResearch.demandScore * 0.6 + (100 - competition) * 0.4));

  return {
    ...withSignal,
    scores: {
      ...opportunity.scores,
      demand: demandResearch.demandScore,
      gap,
      competition,
    },
    demandResearch,
    marketplaceSales,
    freeSignal,
    projectedMonthlyOrders,
    projectedMonthlyRevenue,
    researchMeta: {
      verifiedLiveMarketplace: false,
      freePublicInterest: Boolean(freeSignal?.ok),
      engine: "researchEngine/v3-free-signals",
      warning:
        "Free layer = Wikimedia (± Trends) + cited industry $ models. Amazon sold units still need Keepa (paid).",
    },
  };
}
