// Analyst shortlist from a dated marketplace report. Category interest is not SKU sales proof.
const SOURCE = {
  name: "Etsy Fall/Winter 2026 seller report",
  url: "https://www.etsy.com/seller-handbook/article/1521255894814",
  publishedAt: "2026-10-14", dataAsOf: "2026-09-14", reviewedAt: "2026-10-22",
  scope: "CATEGORY", status: "PUBLISHED_REPORT",
  limitation: "Etsy directional category data; not verified demand for an individual supplier SKU or another marketplace."
};

const CANDIDATES = [
  ["pet-ornament", "Personalized pet ornament", ["pet", "ornament"], "Pet gifting searches doubled; pet ornament searches rose 22% year over year.", "Offer a pet-name keepsake with a gift box.", "Approve personalization samples and breakage protection."],
  ["friend-keepsake", "Personalized friend keepsake keyring", ["friend", "key"], "Personalized friend gift searches rose 1,400% year over year.", "Match a friendship pair with a personal message.", "Verify engraving quality and customization turnaround."],
  ["custom-napkins", "Personalized fabric napkin set", ["napkin"], "Custom napkin searches rose 33%.", "Sell a coordinated host gift with optional initials.", "Check stitching, wash care and personalization lead time."],
  ["ruffle-tablecloth", "Ruffle holiday tablecloth", ["ruffle", "tablecloth"], "Ruffle tablecloth searches rose 841%.", "Show a complete festive table transformation.", "Validate dimensions, fabric quality and return exposure."],
  ["embellishment-kit", "Adult rhinestone embellishment kit", ["rhinestone", "kit"], "Bedazzled kit searches rose 218%.", "Demonstrate a creative gift project for adults.", "Small parts; confirm contents and avoid unverified child-safety claims."],
  ["whimsical-ornaments", "Whimsical shatter-resistant ornament set", ["whimsical", "ornament"], "Whimsy ornament favorites rose 62% year over year.", "Offer a distinctive coordinated tree theme.", "Confirm material, finish and packaging with a physical sample."]
];

export function christmasDelivery(verification = {}, now = new Date()) {
  const eventDate = "2026-12-25";
  const deliveryTarget = "2026-12-20";
  const n = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
  const fresh = verification.capturedAt && now - new Date(verification.capturedAt) >= 0 && now - new Date(verification.capturedAt) <= 30 * 86400000;
  const complete = verification.verified === true && fresh && /^https:\/\//i.test(verification.productUrl || "") && n(verification.shippingDays) && Number(verification.shippingDays) > 0 && n(verification.processingDays);
  if (!complete) return {status: "UNVERIFIED", eventDate, deliveryTarget, latestOrderDate: null, reason: "A recent supplier listing, processing time and shipping quote are required."};
  // Five calendar days of contingency and seven days for a controlled ad test.
  const latest = new Date(Date.parse(deliveryTarget + "T00:00:00Z") - (Number(verification.shippingDays) + Number(verification.processingDays) + 5) * 86400000);
  const testBy = new Date(latest.getTime() - 7 * 86400000);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const status = today > latest.getTime() ? "TOO_LATE" : today > testBy.getTime() ? "TIGHT" : "ON_TIME";
  return {status, eventDate, deliveryTarget, latestOrderDate: latest.toISOString().slice(0,10), startTestBy: testBy.toISOString().slice(0,10), reason: "Planning cutoff from supplier transit + processing + 5-day contingency; confirm stock and carrier service before promising delivery."};
}

export function buildChristmasShortlist(tracked = [], {market = "US", now = new Date()} = {}) {
  const expired = now >= new Date("2026-12-26T00:00:00Z");
  const allowed = ["US", "UK", "CA", "AU", "DE", "FR"];
  if (!allowed.includes(market)) throw new Error("Choose US, UK, CA, AU, DE or FR for Christmas research");
  const products = CANDIDATES.map(([id,title,terms,evidence,angle,risk], i) => {
    const matches = tracked.filter(row => {
      const p = row.product || row;
      return String(p.market || p.trackingContext?.market || "").toUpperCase() === market && terms.every(t => String(p.title || "").toLowerCase().includes(t));
    }).sort((a,b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const row = matches[0];
    const product = row?.product || row || null;
    const delivery = christmasDelivery(product?.supplierVerification, now);
    const recent = product?.discoveredAt && now - new Date(product.discoveredAt) >= 0 && now - new Date(product.discoveredAt) <= 14 * 86400000;
    const hasProof = recent && product?.winnerDecision?.productVerifiedSources >= 1 && product?.winnerDecision?.verifiedSources >= 2;
    const economics = product?.supplierVerification;
    const ready = !expired && delivery.status === "ON_TIME" && hasProof && economics?.economicsPass === true && product?.winnerDecision?.verdict === "STRONG_CANDIDATE";
    return {id,title,priority:i+1,market,evidence:{...SOURCE,summary:evidence},angle,risk,
      verdict: expired ? "SEASON_ENDED" : ready ? "READY_TO_TEST" : "NEEDS_VERIFICATION",
      verifiedWinner: ready && row?.validationStatus === "VALIDATED",
      delivery, productId: product?.id || null,
      nextSteps: [!hasProof && "Collect recent product-specific demand and an independent second source.", !economics?.economicsPass && "Verify landed cost and a minimum 50% pre-ad margin.", delivery.status !== "ON_TIME" && delivery.reason, "Record a controlled ad test before scaling."].filter(Boolean),
      researchQuery: `Christmas 2026 ${title} for ${market}`,
      links: {
        supplier: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(title)}`,
        amazon: `https://${market === "UK" ? "www.amazon.co.uk" : market === "CA" ? "www.amazon.ca" : market === "AU" ? "www.amazon.com.au" : market === "DE" ? "www.amazon.de" : market === "FR" ? "www.amazon.fr" : "www.amazon.com"}/s?k=${encodeURIComponent(title)}`,
        meta: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${market === "UK" ? "GB" : market}&q=${encodeURIComponent(title)}`
      }
    };
  });
  return {season:2026,eventDate:"2026-12-25",market,generatedAt:now.toISOString(),source:SOURCE,expired,
    note:"Research priorities based on category evidence. Supplier links are search tools; costs, stock, competition and SKU sales remain unverified until recorded.",
    products,summary:{candidates:products.length,readyToTest:products.filter(p=>p.verdict==="READY_TO_TEST").length,verifiedWinners:products.filter(p=>p.verifiedWinner).length}};
}
