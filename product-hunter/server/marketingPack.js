import { scoreMarketingPack } from "./rankingAI.js";
import { chatJson } from "./openai.js";

/**
 * Ensure marketing pack shape; optionally enrich via AI.
 */
export function normalizeMarketingPack(pack = {}, niche = "") {
  return {
    persona: pack.persona || `Buyer interested in ${niche}`,
    hook: pack.hook || `Solve a real ${niche} problem in one cart`,
    adAngles: Array.isArray(pack.adAngles) && pack.adAngles.length
      ? pack.adAngles.slice(0, 3)
      : [
          `Problem/solution creative for ${niche}`,
          `Bundle value angle for ${niche}`,
          `Gift / urgency angle for ${niche}`,
        ],
    offer: pack.offer || `Bundle offer with free shipping threshold`,
    landingPromise: pack.landingPromise || `Curated ${niche} store ready to transfer`,
    objections: Array.isArray(pack.objections) && pack.objections.length
      ? pack.objections
      : [
          { q: "Is competition high?", a: "Win with bundles and clear creative, not commodity singles." },
          { q: "Are costs real?", a: "Verify supplier landed cost before scaling ads." },
        ],
  };
}

export async function enrichMarketingPack(opportunity, { regionFocus } = {}) {
  const base = normalizeMarketingPack(opportunity.marketing, opportunity.niche);

  const ai = await chatJson(
    `You are an ecommerce marketing strategist. Return JSON only with keys:
persona, hook, adAngles (array of 3 strings), offer, landingPromise,
objections (array of {q,a} length 2). Be specific and usable in ads.`,
    `Niche: ${opportunity.niche}
Audience: ${opportunity.audience}
Region focus: ${regionFocus || "Global"}
Existing hook: ${base.hook}
Improve the marketing pack for a Shopify turnkey store (or service if applicable).`
  );

  if (!ai) return { ...base, marketingStrength: scoreMarketingPack(base), source: "seed" };

  const merged = normalizeMarketingPack({ ...base, ...ai }, opportunity.niche);
  return { ...merged, marketingStrength: scoreMarketingPack(merged), source: "openai" };
}
