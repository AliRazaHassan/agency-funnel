import { chatJson } from "./openai.js";

function detectAction(question, context = {}) {
  const q = String(question || "").toLowerCase();
  if (/(show|open|go to).*watchlist|watchlist/.test(q)) return { type:"SHOW_WATCHLIST" };
  if (/(show|filter|open).*(top pick|best candidate|winner)/.test(q)) return { type:"SHOW_TOP_PICKS" };
  if (/(show|filter).*(emerging|early opportun)/.test(q)) return { type:"FILTER_LIFECYCLE", value:"EMERGING" };
  if (/(show|filter).*(accelerating|fast growing)/.test(q)) return { type:"FILTER_LIFECYCLE", value:"ACCELERATING" };
  if (/(show|filter).*(saturat|crowded)/.test(q)) return { type:"FILTER_LIFECYCLE", value:"SATURATING" };
  if (/(validate|validation).*(this|product)|^(validate|open validation)/.test(q) && context.product?.id) return { type:"VALIDATE_PRODUCT", productId:context.product.id };
  if (/(shopify|push|draft).*(this|product)|^(shopify draft)/.test(q) && context.product?.id) return { type:"SHOPIFY_PRODUCT", productId:context.product.id };
  if (/(discover|research|find).*(christmas|black friday|valentine|halloween|event|season)/.test(q)) return { type:"OPEN_EVENT_DISCOVERY" };
  return null;
}

function fallbackAnswer(question, context = {}) {
  const p = context.product || {};
  const selectedStat = String(context.selectedStat || "").trim();
  const w = p.winnerDecision || {};
  const trend = p.trendScore ?? "—";
  const confidence = p.dataConfidence || "LOW";
  const margin = p.marginPct ?? "—";
  const status = p.trendStatus || "DISCOVERED";
  const verified = w.verifiedSources ?? 0;
  const risks = [...(w.hardFails || []), ...(p.winning?.softWarnings || [])].slice(0, 3);
  const q = String(question || "").toLowerCase();

  if (!p.title) {
    return {
      answer: selectedStat
        ? `You selected: ${selectedStat}. I can explain what this metric generally means, but select/open a product for a product-specific verdict.`
        : "Select a product first. I can explain its trend score, evidence quality, margin, saturation and whether it is a strong candidate.",
      mode: "rules",
      chips: ["Why is this winning?", "What are the risks?", "Can I test ads?"],
    };
  }

  let answer = `${p.title}: trend ${trend}/100, ${status}, ${confidence} confidence, margin ${margin}%, with ${verified} verified/recent sources. `;
  if (selectedStat) answer = `For the selected stat “${selectedStat}”: ` + answer;
  if (w.verdict === "STRONG_CANDIDATE") answer += "It clears the current winner gates, but it still needs a small ad test before scaling.";
  else if (w.verdict === "AVOID") answer += "It currently fails one or more winner gates, so I would not treat it as launch-ready.";
  else answer += "It looks promising, but the evidence is not strong enough yet to call it a winner.";

  if (q.includes("risk") || q.includes("why not") || q.includes("problem")) {
    answer += risks.length ? ` Main risks: ${risks.join("; ")}.` : " No major hard fail is recorded, but validate supplier cost and live ad competition.";
  } else if (q.includes("trend") || q.includes("why")) {
    answer += ` ${p.whyTrending?.summary || "Cross-platform evidence is still limited."}`;
  } else if (q.includes("ads") || q.includes("test")) {
    answer += w.verdict === "STRONG_CANDIDATE"
      ? " Use a controlled creative test; do not scale until CPA and conversion confirm the economics."
      : " Gather stronger recent evidence before spending meaningfully on ads.";
  }

  return { answer, mode: "rules", chips: ["Why is this winning?", "What are the risks?", "Explain the stats"] };
}

export async function answerConcierge({ question, context = {} } = {}) {
  const product = context.product || {};
  const action = detectAction(question, context);
  const compact = {
    product: product.title,
    category: product.category,
    trendScore: product.trendScore,
    trendStatus: product.trendStatus,
    confidence: product.dataConfidence,
    marginPct: product.marginPct,
    saturation: product.saturation,
    whyTrending: product.whyTrending,
    winnerDecision: product.winnerDecision,
    dataStatus: product.dataStatus,
    trendComponents: product.trendComponents,
    winning: product.winning,
    radarSummary: context.radarSummary,
    selectedStat: context.selectedStat,
  };

  const ai = await chatJson(
    `You are Product Hunter AI Concierge. Explain ecommerce product research stats in plain language.
Never claim guaranteed winners or guaranteed profit. Distinguish VERIFIED/RECENT/MANUAL from ESTIMATED/UNAVAILABLE.
Answer in 2-5 short sentences. Mention the strongest evidence and the biggest risk. If asked what to do, suggest validation steps, not certainty.
Return JSON: {"answer":"...", "chips":["...","...","..."]}. The app may separately execute safe UI actions from the user request.`,
    `Question: ${question || "Explain this product"}\nSelected stat: ${context.selectedStat || "none"}\nContext: ${JSON.stringify(compact)}`
  );

  if (ai?.answer) return { ...ai, mode: "ai", action };
  return { ...fallbackAnswer(question, context), action };
}
