import { clamp, round1 } from "./rankingAI.js";

const SHIPPING_BUFFER = 3; // USD assumed per order buffer

const BRAND_HINTS =
  /\b(nike|adidas|apple|dyson|stanley|yeti|lululemon|patagonia|sony|samsung|gucci|lv)\b/i;

/**
 * Hard gates + pillar scores + order value math for a product candidate.
 */
export function scoreProduct(raw, opportunity = {}) {
  const cost = Number(raw.estCostUsd) || 0;
  const sell = Number(raw.estSellPriceUsd) || 0;
  const weight = Number(raw.estWeightKg) || 0.5;
  const shippingDifficulty = raw.shippingDifficulty || "med";
  const demandType = raw.demandType || "evergreen";

  const net = sell - cost - SHIPPING_BUFFER;
  const marginPct = sell > 0 ? (net / sell) * 100 : 0;

  const riskFlags = [...(raw.riskFlags || [])];
  riskFlags.push("cost estimate — verify on AutoDS/supplier");

  let rejected = false;
  const rejectReasons = [];

  if (marginPct < 50) {
    rejected = true;
    rejectReasons.push(`Margin ${marginPct.toFixed(0)}% below 50% gate`);
  }
  if (net < 8) {
    rejected = true;
    rejectReasons.push(`Contribution $${net.toFixed(2)} below $8 gate`);
  }
  if (demandType === "fad") {
    rejected = true;
    rejectReasons.push("Fad demand type rejected in v1");
  }
  if (BRAND_HINTS.test(raw.title || "")) {
    rejected = true;
    rejectReasons.push("Possible trademark/brand conflict in title");
    riskFlags.push("trademark risk");
  }
  if (/liquid|battery|glass|fragile/i.test(`${raw.title} ${raw.category} ${raw.supplierNotes || ""}`)) {
    riskFlags.push("fragile/liquid/battery — deprioritized");
  }

  // Pillars 0–100
  const margin = clamp(marginPct);
  const demandFit = clamp(
    (demandType === "evergreen" ? 78 : demandType === "seasonal" ? 62 : 35) +
      (raw.problemSolved ? 8 : 0)
  );
  const competitionEase = clamp(raw.competitionEase ?? 55);
  let logistics = clamp(100 - weight * 35);
  if (shippingDifficulty === "med") logistics = clamp(logistics - 10);
  if (shippingDifficulty === "high") logistics = clamp(logistics - 25);
  if (weight > 1.5) logistics = clamp(logistics - 20);

  const supplierEase = clamp(raw.supplierEase ?? 70);
  const upsell = Number(raw.upsellPriceUsd) || sell * 0.45;
  const estAovUsd = round1(sell + upsell * 0.55);
  const estContributionUsd = round1(net + (upsell * 0.55 - (Number(raw.upsellCostUsd) || cost * 0.4) - 1.5));
  const orderValue = clamp((estAovUsd / 90) * 55 + (estContributionUsd / 35) * 45);
  const marketing = clamp(
    (raw.hook ? 70 : 40) + (raw.pdpBullets?.length >= 3 ? 15 : 0) + (raw.offerLine ? 10 : 0)
  );

  const reasons = [];
  if (marginPct >= 50) reasons.push(`${marginPct.toFixed(0)}% margin after shipping buffer`);
  if (demandType === "evergreen") reasons.push("Evergreen demand type");
  if (weight <= 0.5) reasons.push(`Ships light (~${weight}kg)`);
  if (estAovUsd >= 50) reasons.push(`Projected AOV ~$${estAovUsd}`);
  if (raw.hook) reasons.push(`Hook: ${raw.hook}`);
  reasons.push(...rejectReasons);

  const bundleOffer =
    raw.bundleOffer ||
    (raw.bundleWith?.length
      ? `${raw.title} + ${raw.bundleWith[0]} bundle ≈ $${estAovUsd}`
      : `Solo $${sell} → cart AOV ≈ $${estAovUsd} with 1 upsell`);

  return {
    id: raw.id || slugify(raw.title),
    title: raw.title,
    category: raw.category || opportunity.niche || "General",
    problemSolved: raw.problemSolved || "",
    estCostUsd: round1(cost),
    estSellPriceUsd: round1(sell),
    estWeightKg: round1(weight),
    shippingDifficulty,
    demandType,
    bundleWith: raw.bundleWith || [],
    supplierNotes: raw.supplierNotes || "Verify on AutoDS/Zendrop",
    evidence: raw.evidence || "",
    hook: raw.hook || "",
    pdpBullets: raw.pdpBullets || [],
    offerLine: raw.offerLine || opportunity.marketing?.offer || "",
    estAovUsd,
    estContributionUsd,
    bundleOffer,
    projectedMonthlyOrders: raw.projectedMonthlyOrders || {
      conservative: 20,
      base: 45,
      aggressive: 90,
    },
    pillars: {
      margin: round1(margin),
      demandFit: round1(demandFit),
      competitionEase: round1(competitionEase),
      logistics: round1(logistics),
      supplierEase: round1(supplierEase),
      orderValue: round1(orderValue),
      marketing: round1(marketing),
    },
    marginPct: round1(marginPct),
    reasons,
    riskFlags: [...new Set(riskFlags)],
    rejected,
    researchLabel: "Research score (model + rules) — not live marketplace proof",
  };
}

function slugify(s) {
  return String(s || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
