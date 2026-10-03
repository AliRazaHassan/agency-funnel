import { chatJson } from "./openai.js";
import { fetchSocialTrends } from "./socialTrends.js";
import { fetchFreeDemandSignal } from "./freeSignals.js";
import { getUpcomingEvents } from "./seasonal.js";

function normalizeRegion(region = "Global") {
  const r = String(region || "Global").trim();
  return r || "Global";
}

function observedRows(trends = {}) {
  return (trends.items || [])
    .filter((x) => x?.title)
    .slice(0, 35)
    .map((x) => ({
      platform: x.platform,
      title: x.title,
      category: x.category || null,
      status: x.dataStatus || (x.source === "manual-paste" ? "MANUAL" : "ESTIMATED"),
      source: x.source || null,
      capturedAt: x.capturedAt || null,
      metric: x.metric || null,
      url: x.researchUrl || null,
    }));
}

function evidenceBundle({ social, demand, seasonal, title }) {
  const tokens = String(title || "").toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3);
  const matched = social.filter((row) => {
    const hay = `${row.title || ""} ${row.category || ""}`.toLowerCase();
    return tokens.some((t) => hay.includes(t));
  }).slice(0, 6);

  const evidence = matched.map((m) => ({
    source: m.platform === "tiktok" ? "TikTok Creative Center" : m.platform === "meta" ? "Meta Ad Library" : m.source,
    status: m.status,
    scope: "NICHE_OR_PRODUCT",
    value: m.metric || m.title,
    capturedAt: m.capturedAt,
    url: m.url,
  }));

  for (const p of demand?.providers || []) {
    evidence.push({
      source: p.provider,
      status: p.provider === "Google Trends" ? "RECENT" : "LIVE",
      scope: "NICHE",
      value: p.provider === "Google Trends"
        ? `interest ${p.interestScore}/100 · momentum ${p.momentumDelta ?? "—"}`
        : `interest ${p.interestScore}/100`,
      url: p.url || null,
    });
  }

  if (seasonal?.length) {
    evidence.push({
      source: "Commercial calendar",
      status: "LIVE",
      scope: "EVENT",
      value: seasonal.slice(0, 2).map((e) => `${e.name} in ${e.daysAway}d`).join(" · "),
      url: null,
    });
  }
  return evidence;
}

export async function discoverProductsLive({ opportunity = {}, regionFocus, query, constraints = {}, limit = 50 } = {}) {
  const region = normalizeRegion(regionFocus || opportunity.sellWhere?.geos?.[0] || "Global");
  const niche = String(query || opportunity.niche || "").trim() || "ecommerce products";
  const [socialTrends, demandSignal] = await Promise.all([
    fetchSocialTrends({ regionFocus: region, nicheHint: niche }),
    fetchFreeDemandSignal(niche, region),
  ]);
  const seasonal = getUpcomingEvents({ region, days: 180 }).slice(0, 5);
  const observations = observedRows(socialTrends);

  const ai = await chatJson(
    `You are a live-evidence ecommerce discovery engine.
Generate product candidates from the supplied OBSERVATIONS, DEMAND SIGNALS and EVENT CALENDAR. Do not use a static predefined catalog.
Return JSON {"products":[...]}.
Each product must have: title, category, problemSolved, estCostUsd, estSellPriceUsd, estWeightKg, shippingDifficulty, demandType, bundleWith[], supplierNotes, hook, pdpBullets[3], offerLine, competitionEase, supplierEase, projectedMonthlyOrders{conservative,base,aggressive}, discoveryReason, observationRefs[].
observationRefs contains integer indices into OBSERVATIONS that materially influenced the candidate; use [] if none.
Prefer generic non-trademarked physical products, light shipping, visual/demo potential, gross margin potential >55%.
Respect constraints. Do NOT claim observed Amazon sales unless Amazon evidence was explicitly supplied. Return up to ${Math.min(80, Math.max(10, Number(limit)||50))} unique products.`,
    `MARKET: ${region}
NICHE/REQUEST: ${niche}
CONSTRAINTS: ${JSON.stringify(constraints)}
DEMAND: ${JSON.stringify(demandSignal)}
UPCOMING EVENTS: ${JSON.stringify(seasonal.map(e => ({name:e.name,date:e.date,daysAway:e.daysAway,themes:e.themes,sellingWindowOpen:e.sellingWindowOpen})))}
OBSERVATIONS: ${JSON.stringify(observations)}`
  );

  const raw = Array.isArray(ai?.products) ? ai.products : [];
  const seen = new Set();
  const products = [];
  for (const p of raw) {
    const title = String(p?.title || "").trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    const refs = (p.observationRefs || []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < observations.length);
    const referenced = refs.map((i) => observations[i]);
    products.push({
      ...p,
      title,
      discoverySource: "live-evidence-ai-cluster",
      discoveredAt: new Date().toISOString(),
      discoveryEvidence: {
        referencedObservations: referenced,
        evidence: evidenceBundle({ social: referenced.length ? referenced : observations, demand: demandSignal, seasonal, title }),
        sourceCounts: {
          tiktok: observations.filter((o) => o.platform === "tiktok").length,
          meta: observations.filter((o) => o.platform === "meta").length,
          demandProviders: (demandSignal?.providers || []).length,
        },
        note: "Candidate generated from current evidence inputs. Source statuses remain explicit; generation is not itself proof of sales.",
      },
    });
    if (products.length >= limit) break;
  }

  return {
    engine: "live-discovery-v1",
    generatedAt: new Date().toISOString(),
    region,
    query: niche,
    constraints,
    observed: {
      socialCount: observations.length,
      demandProviders: (demandSignal?.providers || []).map((p) => p.provider),
      upcomingEvents: seasonal.map((e) => ({ id:e.id, name:e.name, date:e.date, daysAway:e.daysAway })),
    },
    socialTrends,
    demandSignal,
    products,
    count: products.length,
    honesty: raw.length
      ? "Products are synthesized from current observed evidence and demand signals; evidence status is shown per source."
      : "No live-evidence product candidates could be generated in this run.",
  };
}
