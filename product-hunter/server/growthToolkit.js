function money(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function slugQuery(value) {
  return encodeURIComponent(String(value || "").trim());
}

export function buildProductToolkit(product = {}, event = null) {
  const sell = Number(product.estSellPriceUsd) || Number(product.estAovUsd) || 0;
  const cost = Number(product.estCostUsd) || 0;
  const shipping = Number(product.shippingBufferUsd) || 3;
  const landed = cost + shipping;
  const contribution = Math.max(0, sell - landed);
  const breakEvenCpa = contribution;
  const targetCpa = contribution * 0.7;
  const marginPct = sell > 0 ? (contribution / sell) * 100 : 0;

  const orderScenarios = [10, 50, 100].map((ordersPerDay) => ({
    ordersPerDay,
    monthlyOrders: ordersPerDay * 30,
    monthlyRevenue: money(ordersPerDay * 30 * sell),
    monthlyContributionBeforeAds: money(ordersPerDay * 30 * contribution),
    monthlyContributionAtTargetCpa: money(ordersPerDay * 30 * Math.max(0, contribution - targetCpa)),
  }));

  const problem = product.problemSolved || "a clear customer problem";
  const eventName = event?.name || product.eventFit?.eventName || null;
  const baseHook = product.hook || `A simpler way to solve ${problem}`;
  const creativeHooks = [
    baseHook,
    `POV: you finally fixed ${String(problem).toLowerCase()} without the usual hassle.`,
    `Before you buy another generic option, see what makes ${product.title || "this product"} different.`,
    eventName ? `${eventName} angle: make ${product.title || "this"} an easy, useful gift instead of another forgettable purchase.` : `Demo angle: show the problem in the first 2 seconds, then the product solving it.`,
    `Comparison angle: cheap workaround vs. ${product.title || "the purpose-built solution"}.`,
  ];

  const competitorChannels = [...new Set([
    ...(product.soldOn?.whereCompetitorsSell || []),
    "Amazon",
    "TikTok",
    "Google Shopping",
  ])].slice(0,6);

  const competitorSearchLinks = [
    { id:"amazon", label:"Amazon competitors", url:`https://www.amazon.com/s?k=${slugQuery(product.title)}` },
    { id:"google", label:"Google Shopping", url:`https://www.google.com/search?tbm=shop&q=${slugQuery(product.title)}` },
    { id:"tiktok", label:"TikTok search", url:`https://www.tiktok.com/search?q=${slugQuery(product.title)}` },
    { id:"meta", label:"Meta Ad Library", url:`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${slugQuery(product.title)}&search_type=keyword_unordered` },
  ];

  const saturationRisk = product.saturation?.risk || "UNKNOWN";
  const competition = product.winnerDecision?.components?.competition ?? product.competitionEase ?? null;
  const opportunity = saturationRisk === "LOW" ? "Demand may have room before heavy saturation."
    : saturationRisk === "HIGH" ? "Treat as a crowded market; differentiation and proof matter more."
    : "Validate advertiser density before scaling.";

  const bullets = (product.pdpBullets || []).slice(0,5);
  const faq = [
    { q:"What problem does it solve?", a: problem },
    { q:"Why buy this version?", a: bullets.length ? bullets.join(" · ") : "Position around the strongest verified product benefits and supplier proof." },
    { q:"How fast should I test it?", a: eventName && product.eventFit?.daysUntil != null ? `Prioritize a fast validation cycle because ${eventName} is ${product.eventFit.daysUntil} days away.` : "Run a small controlled creative test before increasing spend." },
  ];

  return {
    economics: {
      sellPriceUsd: money(sell),
      productCostUsd: money(cost),
      shippingBufferUsd: money(shipping),
      landedCostUsd: money(landed),
      contributionUsd: money(contribution),
      marginPct: money(marginPct),
      breakEvenCpaUsd: money(breakEvenCpa),
      targetCpaUsd: money(targetCpa),
      scenarios: orderScenarios,
    },
    creativeKit: {
      hooks: creativeHooks,
      ugcScript: [
        `0–2s: show the pain — ${problem}.`,
        `2–6s: reveal ${product.title || "the product"} in use.`,
        `6–12s: demonstrate the strongest benefit: ${bullets[0] || baseHook}.`,
        `12–18s: add proof/comparison and address one objection.`,
        `18–22s: CTA — shop now / test the offer.`,
      ],
      landingAngle: product.offerLine || product.hook || baseHook,
      eventAngle: eventName ? `${eventName}: useful, giftable, easy-to-understand offer with delivery cutoff messaging.` : null,
    },
    competitorIntelligence: {
      channels: competitorChannels,
      searchLinks: competitorSearchLinks,
      saturationRisk,
      competitionScore: competition,
      opportunity,
      dataStatus: "SEARCH-LINKED",
      note: "Links open current marketplace/ad searches; saturation score only uses evidence already collected by Product Hunter.",
    },
    launchKit: {
      title: product.title,
      suggestedPriceUsd: money(sell),
      compareAtPriceUsd: money(sell * 1.2),
      seoTitle: `${product.title || "Product"} | Practical solution for ${problem}`.slice(0,70),
      metaDescription: `${baseHook} Shop ${product.title || "this product"} with a clear offer, practical benefits and fast checkout.`.slice(0,155),
      bullets,
      faq,
      bundleWith: product.bundleWith || [],
    },
  };
}
