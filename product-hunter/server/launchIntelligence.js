function round2(n){ return Math.round(Number(n||0)*100)/100; }
function q(v){ return encodeURIComponent(String(v||"").trim()); }

function profitScenario(profitPerOrder, ordersPerDay){
  const daily = profitPerOrder * ordersPerDay;
  return { ordersPerDay, dailyProfitUsd: round2(daily), monthlyProfitUsd: round2(daily * 30) };
}

export function buildLaunchIntelligence(product = {}, opportunity = {}) {
  const sell = Number(product.estSellPriceUsd) || Number(product.estAovUsd) || 0;
  const cost = Number(product.estCostUsd) || Number(product.sourceFrom?.unitCostUsd) || 0;
  const shipping = Number(product.shippingBufferUsd) || 3;
  const feesPct = 0.035;
  const fees = round2(sell * feesPct);
  const contribution = round2(Math.max(0, sell - cost - shipping - fees));
  const targetCpa = round2(contribution * 0.65);
  const targetRoas = targetCpa > 0 ? round2(sell / targetCpa) : null;
  const title = product.title || "product";
  const enc = q(title);
  const seasonal = product.seasonalFit || null;

  const competitorIntel = {
    status: "RESEARCH_LINKS",
    note: "Search links are live. Counts/prices are not claimed until verified from the destination.",
    searches: [
      { id:"amazon", label:"Amazon competitors", url:`https://www.amazon.com/s?k=${enc}` },
      { id:"google", label:"Google Shopping", url:`https://www.google.com/search?tbm=shop&q=${enc}` },
      { id:"meta", label:"Meta Ad Library", url:`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${enc}` },
      { id:"tiktok", label:"TikTok search", url:`https://www.tiktok.com/search?q=${enc}` },
      { id:"etsy", label:"Etsy", url:`https://www.etsy.com/search?q=${enc}` }
    ],
    positioning: {
      avoid: "Competing on price alone",
      prefer: ["bundle differentiation","problem/solution creative","fast-shipping proof","clear guarantee/returns","niche-specific landing page"]
    }
  };

  const baseHook = product.hook || `A simple way to solve ${product.problemSolved || "a daily problem"}`;
  const creativeIntel = {
    hooks: [
      baseHook,
      `I wish I found this ${String(product.category || "product").toLowerCase()} sooner`,
      `3 reasons ${product.problemSolved || "this problem"} gets easier with ${title}`,
      seasonal ? `${seasonal.eventName} is coming — this is the useful gift people actually keep` : `Before you buy another ${String(product.category || "product").toLowerCase()}, watch this`
    ],
    angles: [
      { id:"problem-solution", label:"Problem → solution demo", script:`Show the problem in the first 2 seconds, demonstrate ${title}, then show the practical outcome.` },
      { id:"ugc", label:"UGC testimonial", script:`Creator explains why they bought it, shows one real use case, then gives a low-pressure CTA.` },
      { id:"comparison", label:"Comparison", script:`Compare the old/frustrating method with ${title}; focus on time, convenience or comfort rather than unsupported claims.` },
      { id:"bundle", label:"Bundle/AOV", script:`Pair ${title} with ${(product.bundleWith || [])[0] || "a complementary accessory"} and frame the set as the complete solution.` }
    ],
    landingPage: {
      headline: product.offerLine || product.hook || `${title} — built around the problem it solves`,
      sections: ["problem","demo/benefits","what is included","shipping/returns","FAQ","bundle offer"]
    }
  };

  const unitEconomics = {
    currency: "USD",
    sellPriceUsd: round2(sell),
    productCostUsd: round2(cost),
    shippingBufferUsd: round2(shipping),
    paymentFeeUsd: fees,
    contributionBeforeAdsUsd: contribution,
    breakEvenCpaUsd: contribution,
    targetCpaUsd: targetCpa,
    targetRoas,
    scenarios: [10,50,100].map((orders) => profitScenario(Math.max(0, contribution-targetCpa), orders)),
    note: "Planning economics. Replace estimated supplier cost/shipping with a verified quote before scaling."
  };

  return { competitorIntel, creativeIntel, unitEconomics };
}
