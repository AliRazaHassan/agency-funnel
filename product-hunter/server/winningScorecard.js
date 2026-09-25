/**
 * Winning Product scorecard — rule-based pass/fail without Keepa.
 * Weights: Demand 25 · Margin 25 · Competition 20 · Shipping 15 · Creative/Offer 15
 * Pass ≥ 70 and no hard fails.
 */

import { clamp, round1 } from "./rankingAI.js";

export const WINNING_WEIGHTS = {
  demand: 0.25,
  margin: 0.25,
  competition: 0.2,
  shipping: 0.15,
  creative: 0.15,
};

export const WINNING_PASS_SCORE = 70;

/**
 * Build winning scorecard from a scored product (+ optional opportunity context).
 */
export function buildWinningScorecard(product = {}, opportunity = {}) {
  const cost = Number(product.estCostUsd) || 0;
  const sell = Number(product.estSellPriceUsd) || 0;
  const weight = Number(product.estWeightKg) || 0.5;
  const marginPct = Number(product.marginPct);
  const net =
    Number.isFinite(marginPct) && sell > 0
      ? (sell * marginPct) / 100
      : sell - cost - 3;
  const shippingDifficulty = product.shippingDifficulty || "med";
  const demandType = product.demandType || "evergreen";
  const competitionEase = Number(product.pillars?.competitionEase ?? product.competitionEase ?? 55);
  const shipDaysMax = Number(product.supplierOptions?.[0]?.shippingDaysMax) || (shippingDifficulty === "low" ? 14 : shippingDifficulty === "high" ? 30 : 18);
  const freeInterest = Number(opportunity.freeSignal?.interestScore);
  const nicheDemand = Number(opportunity.scores?.demand);

  const hardFails = [];
  const softWarnings = [];
  const passReasons = [];

  // —— Demand (0–100) ——
  let demandScore =
    demandType === "evergreen" ? 78 : demandType === "seasonal" ? 58 : 28;
  if (product.problemSolved) demandScore += 8;
  if (Number.isFinite(freeInterest)) {
    demandScore = demandScore * 0.55 + freeInterest * 0.45;
  } else if (Number.isFinite(nicheDemand)) {
    demandScore = demandScore * 0.7 + nicheDemand * 0.3;
  }
  demandScore = clamp(demandScore);
  if (demandType === "fad") hardFails.push("Fad demand — not a durable winner");
  if (demandScore >= 65) passReasons.push("Demand fit looks solid (evergreen / interest)");
  else if (demandScore < 45) softWarnings.push("Weak demand signals — validate with Keepa/Trends");

  // —— Margin (0–100) ——
  const marginScore = clamp(
    Number.isFinite(product.pillars?.margin) ? product.pillars.margin : marginPct
  );
  if (!Number.isFinite(marginPct) || marginPct < 50) {
    hardFails.push(`Margin ${Number.isFinite(marginPct) ? marginPct.toFixed(0) : "?"} % below 50% gate`);
  } else {
    passReasons.push(`${marginPct.toFixed(0)}% margin after ship buffer`);
  }
  if (net < 8) hardFails.push(`Contribution ~$${round1(net)} below $8/order`);
  if (marginPct >= 60) passReasons.push("Strong margin headroom for ads");

  // —— Competition (0–100) ——
  const competitionScore = clamp(competitionEase);
  if (competitionScore < 40) softWarnings.push("Crowded niche — need sharp differentiation");
  if (competitionScore >= 55) passReasons.push("Competition ease acceptable");
  if (/trademark|brand conflict/i.test((product.reasons || []).join(" "))) {
    hardFails.push("Trademark / brand conflict risk");
  }

  // —— Shipping / fulfill (0–100) ——
  let shippingScore = clamp(product.pillars?.logistics ?? 100 - weight * 35);
  if (shippingDifficulty === "med") shippingScore = clamp(shippingScore - 8);
  if (shippingDifficulty === "high") shippingScore = clamp(shippingScore - 22);
  if (shipDaysMax > 25) {
    shippingScore = clamp(shippingScore - 15);
    softWarnings.push(`Shipping up to ~${shipDaysMax} days — ads conversion risk`);
  } else if (shipDaysMax <= 14) {
    passReasons.push(`Fulfill window ~${shipDaysMax} days or better`);
  }
  if (weight > 1.5) softWarnings.push("Heavy SKU — shipping eats margin");
  if (weight <= 0.5 && shippingDifficulty === "low") {
    passReasons.push("Light / easy ship profile");
  }

  // —— Creative / offer (0–100) ——
  let creativeScore = 35;
  if (product.hook) creativeScore += 25;
  if (product.problemSolved) creativeScore += 15;
  if ((product.pdpBullets || []).length >= 3) creativeScore += 12;
  if ((product.bundleWith || []).length || product.bundleOffer) creativeScore += 10;
  if (product.offerLine) creativeScore += 8;
  creativeScore = clamp(creativeScore);
  if (!product.hook) softWarnings.push("Missing ad hook — hard to test creatives");
  if (product.hook && product.problemSolved) {
    passReasons.push("Problem → hook ready for ads");
  }

  // Risk text bumps
  const risks = product.riskFlags || [];
  if (risks.some((r) => /liquid|battery|fragile|glass/i.test(r))) {
    softWarnings.push("Fulfillment risk (liquid/battery/fragile)");
    shippingScore = clamp(shippingScore - 10);
  }

  const pillars = [
    {
      id: "demand",
      label: "Demand",
      weight: WINNING_WEIGHTS.demand,
      score: round1(demandScore),
      note: Number.isFinite(freeInterest)
        ? `Includes free interest ${freeInterest}`
        : demandType,
    },
    {
      id: "margin",
      label: "Margin",
      weight: WINNING_WEIGHTS.margin,
      score: round1(marginScore),
      note: `${Number.isFinite(marginPct) ? marginPct.toFixed(0) : "—"}% after buffer`,
    },
    {
      id: "competition",
      label: "Competition ease",
      weight: WINNING_WEIGHTS.competition,
      score: round1(competitionScore),
      note: "Higher = easier to stand out",
    },
    {
      id: "shipping",
      label: "Shipping / fulfill",
      weight: WINNING_WEIGHTS.shipping,
      score: round1(shippingScore),
      note: `${shippingDifficulty} · ~${weight}kg · max ~${shipDaysMax}d`,
    },
    {
      id: "creative",
      label: "Creative / offer",
      weight: WINNING_WEIGHTS.creative,
      score: round1(creativeScore),
      note: product.hook ? "Hook present" : "Needs hook",
    },
  ];

  let total = pillars.reduce((s, p) => s + p.score * p.weight, 0);
  total = round1(clamp(total));

  // Verdict
  let verdict = "PASS";
  let verdictLabel = "Potential winner";
  if (hardFails.length || product.rejected) {
    verdict = "FAIL";
    verdictLabel = "Not a winner yet";
    if (product.rejected && !hardFails.length) {
      hardFails.push(...(product.reasons || []).filter((r) => /gate|below|fad|trademark/i.test(r)));
    }
  } else if (total < WINNING_PASS_SCORE) {
    verdict = "WATCH";
    verdictLabel = "Borderline — validate more";
  } else if (softWarnings.length >= 3) {
    verdict = "WATCH";
    verdictLabel = "Pass score, but check warnings";
  }

  const keepaGap = {
    status: "missing",
    note: "Amazon sold units / BSR not connected — add KEEPA_API_KEY for marketplace proof",
  };

  return {
    version: "winning/v1",
    total,
    passThreshold: WINNING_PASS_SCORE,
    verdict, // PASS | WATCH | FAIL
    verdictLabel,
    pillars,
    hardFails: [...new Set(hardFails)],
    softWarnings: [...new Set(softWarnings)],
    passReasons: [...new Set(passReasons)].slice(0, 6),
    keepaGap,
    summary:
      verdict === "PASS"
        ? `Score ${total}/100 — passes rules without Keepa. Still verify cost + Amazon with links/Keepa.`
        : verdict === "WATCH"
          ? `Score ${total}/100 — borderline. Fix warnings or get Keepa proof before ads.`
          : `Score ${total}/100 — fails hard gates. Do not treat as winning SKU.`,
  };
}

export function summarizeWinningDeck(products = []) {
  const list = products || [];
  const pass = list.filter((p) => p.winning?.verdict === "PASS").length;
  const watch = list.filter((p) => p.winning?.verdict === "WATCH").length;
  const fail = list.filter((p) => p.winning?.verdict === "FAIL").length;
  return {
    total: list.length,
    pass,
    watch,
    fail,
    passRate: list.length ? round1((pass / list.length) * 100) : 0,
  };
}
