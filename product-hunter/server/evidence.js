import { createHash } from "node:crypto";
export const VERSION = "evidence-v3";
export const TTL_DAYS = { meta: 7, tiktok: 7, google: 14, amazon: 7, supplier: 7 };
export const finite = (v) =>
  v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v))
    ? Number(v)
    : null;
const hash = (v) => createHash("sha256").update(v).digest("hex").slice(0, 24);
export const productId = (market, identityKey) =>
  hash(JSON.stringify([market, identityKey]));
export function migrateEvidenceRecords(data) {
  // Repair earlier accepted tag/status formats without discarding source history.
  data.observations = (data.observations || []).map((o) => {
    let tags = [],
      status = "modeled";
    try {
      tags = normalizeTags(o.tags);
    } catch {
      /* Quarantine malformed legacy tags as no tags. */
    }
    try {
      status = normalizeStatus({
        ...o,
        dataStatus: o.rawRecord?.dataStatus || o.dataStatus,
      });
    } catch {
      /* Unknown legacy evidence never becomes proof. */
    }
    return { ...o, tags, dataStatus: status };
  });
  const markets = new Map();
  for (const o of data.observations || []) {
    if (!markets.has(o.identityKey)) markets.set(o.identityKey, new Set());
    markets.get(o.identityKey).add(o.market);
  }
  for (const [identityKey, values] of markets) {
    const legacyId = hash(identityKey),
      legacy = data.records[legacyId];
    if (!legacy || values.size !== 1) continue;
    const market = [...values][0],
      id = productId(market, identityKey);
    if (!data.records[id])
      data.records[id] = { ...legacy, market, migratedFrom: legacyId };
  }
  return data;
}
function normalizeStatus(raw) {
  const value = String(raw.dataStatus || "")
    .trim()
    .toLowerCase();
  if (["modeled", "estimated", "estimate"].includes(value)) return "modeled";
  if (
    value &&
    !["manual", "observed", "live", "recent", "unavailable"].includes(value)
  )
    throw new Error("Unknown data status");
  if (value === "unavailable")
    throw new Error("Unavailable records cannot contain observed metrics");
  return raw.collectionMethod === "api" ? "observed" : "manual";
}
function normalizeTags(tags) {
  if (tags == null || tags === "") return [];
  const list = typeof tags === "string" ? tags.split(",") : tags;
  if (!Array.isArray(list) || list.some((t) => typeof t !== "string"))
    throw new Error("Tags must be strings");
  return [...new Set(list.map((t) => t.trim()).filter(Boolean))];
}
export function httpUrl(v) {
  try {
    const u = new URL(v);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function observation(raw, now = new Date()) {
  const platform = String(raw.platform || "").toLowerCase();
  if (!TTL_DAYS[platform])
    throw new Error("Platform must be meta, tiktok, google, amazon or supplier");
  const title = String(raw.title || "").trim(),
    sourceUrl = httpUrl(raw.sourceUrl),
    dataAt = raw.dataAt || raw.observedAt;
  if (!title || !sourceUrl || !dataAt || !Number.isFinite(Date.parse(dataAt)))
    throw new Error("Title, source URL and underlying dataAt date required");
  if (Date.parse(dataAt) > +now + 300000)
    throw new Error("Underlying data date cannot be in the future");
  const scope = raw.scope || "product";
  if (!["product", "niche"].includes(scope))
    throw new Error("Scope must be product or niche");
  const externalId = String(raw.externalId || "").trim();
  if (scope === "product" && !externalId)
    throw new Error("Exact product/ad/listing externalId required");
  const market = String(raw.market || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) throw new Error("Two-letter market required");
  const metric = String(raw.metric || "").trim(),
    value = finite(raw.value);
  if (!metric || value === null || !String(raw.unit || "").trim())
    throw new Error("Metric, numeric value (including zero) and unit required");
  if (platform === "supplier" && (scope !== "product" ||
      !["catalog_price", "rating_count"].includes(metric) || value < 0 ||
      (metric === "rating_count" && !Number.isInteger(value))))
    throw new Error("Supplier records require an exact product and non-negative catalog_price or integer rating_count; catalog facts are not demand evidence");
  const collectedAt = now.toISOString();
  const canonicalUrl = httpUrl(raw.canonicalUrl) || sourceUrl;
  return {
    ...raw,
    tags: normalizeTags(raw.tags),
    platform,
    title,
    sourceUrl,
    canonicalUrl,
    externalId,
    market,
    scope,
    metric,
    value,
    unit: String(raw.unit),
    provider: String(raw.provider || "manual"),
    collectionMethod: raw.collectionMethod || "manual",
    dataStatus: normalizeStatus(raw),
    dataAt: new Date(dataAt).toISOString(),
    collectedAt,
    currency: raw.currency || null,
    period: raw.period || null,
    niche: raw.niche || "Unclassified",
    identityKey: String(
      raw.identityKey || `${platform}:${market}:${externalId || canonicalUrl}`,
    ),
    correlationKey: String(
      raw.correlationKey ||
        `${platform}:${market}:${externalId || canonicalUrl}`,
    ),
    limitations:
      raw.limitations ||
      "Observation is not proof of profitability; manual records are user supplied.",
    rawRecord: raw,
    id: hash(
      JSON.stringify([
        platform,
        market,
        externalId,
        canonicalUrl,
        metric,
        dataAt,
        value,
      ]),
    ),
  };
}
export function freshness(o, now = new Date()) {
  const ageDays = (+now - Date.parse(o.dataAt)) / 86400000;
  return {
    ageDays: Number.isFinite(ageDays) ? +ageDays.toFixed(2) : null,
    status: ageDays >= 0 && ageDays <= TTL_DAYS[o.platform] ? "fresh" : "stale",
    expiresAfterDays: TTL_DAYS[o.platform],
  };
}
// Matching is an explicit user assertion about a listing and variant. Keep the
// original engagement metrics and dates; matching never manufactures sales.
export function matchDiscovery(rows, input, now = new Date()) {
  const source = rows.find((o) => o.id === input.observationId);
  const listingUrl = httpUrl(input.listingUrl);
  const title = String(input.title || "").trim();
  const variant = String(input.variant || "").trim();
  if (!source || source.scope !== "niche" || !["tiktok", "meta"].includes(source.platform))
    throw new Error("Select a TikTok video or Meta ad discovery to match");
  if (!listingUrl || !title || !variant || input.confirmed !== true)
    throw new Error("Exact listing URL, product title, variant and match confirmation required");
  const listing = new URL(listingUrl);
  listing.hash = "";
  const identityKey = `listing:${listing.href}:${variant.toLowerCase()}`;
  return rows.filter((o) => o.scope === "niche" && o.platform === source.platform &&
    o.market === source.market && o.externalId === source.externalId).map((o) => {
    const matched = observation({
      platform: o.platform, provider: o.provider, externalId: o.externalId,
      title, market: o.market, scope: "product", metric: o.metric, value: o.value,
      unit: o.unit, dataAt: o.dataAt, sourceUrl: o.sourceUrl,
      canonicalUrl: o.canonicalUrl, correlationKey: o.correlationKey,
      identityKey, niche: o.niche, tags: o.tags, period: o.period,
      currency: o.currency, dataStatus: o.dataStatus === "modeled" ? "modeled" : "manual",
      collectionMethod: "manual", matchedFrom: o.id,
      productMatch: { listingUrl: listing.href, variant, confirmedAt: now.toISOString(), method: "user-confirmed" },
      limitations: `${o.limitations} Product/variant match is user supplied. Original engagement is not sales; supplier costs and delivery require a separate quote.`,
    }, now);
    // A matched assertion must coexist with its original niche observation.
    matched.id = hash(JSON.stringify([o.id, identityKey, "user-match"]));
    return matched;
  });
}
export function economics(input = {}) {
  const fields = [
    "sellingPrice",
    "discount",
    "productCost",
    "shipping",
    "landedCost",
    "duties",
    "feesPct",
    "feeFixed",
    "packaging",
    "returnsPct",
    "adCpa",
  ];
  const v = Object.fromEntries(fields.map((k) => [k, finite(input[k])]));
  const missing = [];
  for (const k of [
    "sellingPrice",
    "discount",
    "duties",
    "feesPct",
    "feeFixed",
    "packaging",
    "returnsPct",
    "adCpa",
  ])
    if (v[k] === null) missing.push(k);
  if (v.landedCost === null) {
    for (const k of ["productCost", "shipping"])
      if (v[k] === null) missing.push(k);
  }
  for (const [k, n] of Object.entries(v))
    if (n !== null && n < 0) throw new Error(`${k} cannot be negative`);
  if (v.discount > 100 || v.feesPct > 100 || v.returnsPct > 100)
    throw new Error("Percentage inputs must be between 0 and 100");
  if (missing.length)
    return {
      complete: false,
      missing,
      inputs: v,
      contribution: null,
      marginPct: null,
      breakEvenCpa: null,
    };
  const revenue = v.sellingPrice * (1 - v.discount / 100),
    landed = v.landedCost ?? v.productCost + v.shipping;
  const contribution =
    revenue -
    landed -
    v.duties -
    v.packaging -
    (revenue * v.feesPct) / 100 -
    v.feeFixed -
    (revenue * v.returnsPct) / 100;
  const round = (n) => Math.round(n * 100) / 100;
  return {
    complete: true,
    missing: [],
    inputs: v,
    revenue: round(revenue),
    landedCost: round(landed),
    contribution: round(contribution),
    marginPct: revenue > 0 ? round((contribution / revenue) * 100) : null,
    breakEvenCpa: round(contribution),
    targetCpa: round(contribution * 0.7),
    breakEvenRoas: contribution > 0 ? round(revenue / contribution) : null,
    profitAfterAds: round(contribution - v.adCpa),
    scenarios: [0.8, 1, 1.2].map((m) => ({
      cpa: round(v.adCpa * m),
      profit: round(contribution - v.adCpa * m),
    })),
    assumptions:
      "Landed cost includes item and shipping only. Duties, fees, packaging and returns added separately. CPA scenarios are not sales forecasts.",
  };
}
export function delivery(quote = {}, constraints = {}, now = new Date()) {
  const target =
      constraints.deliveryTarget ||
      (constraints.season === "christmas-2026" ? "2026-12-20" : null),
    days = ["processingDays", "transitDays", "personalizationDays"].map((k) =>
      finite(quote[k]),
    );
  const captured = Date.parse(quote.quotedAt),
    age = (+now - captured) / 86400000;
  if (
    !target ||
    !httpUrl(quote.url) ||
    age < 0 ||
    age > 7 ||
    !Number.isFinite(age) ||
    days.some((n) => n === null || n < 0) ||
    !Number.isFinite(Date.parse(target))
  )
    return {
      status: "unverified",
      target,
      reason:
        "Need exact listing, quote within 7 days and processing, transit and personalization days.",
    };
  const contingency = finite(constraints.contingencyDays) ?? 5,
    testDays = finite(constraints.testingDays) ?? 7;
  if (contingency < 0 || testDays < 0 || contingency > 365 || testDays > 365)
    throw new Error("Planning days must be between 0 and 365");
  const latest = new Date(
      Date.parse(target) -
        (days.reduce((a, b) => a + b, 0) + contingency) * 86400000,
    ),
    test = new Date(+latest - testDays * 86400000);
  return {
    status: +now > +latest ? "too late" : +now > +test ? "tight" : "on-time",
    target,
    latestOrderDate: latest.toISOString().slice(0, 10),
    testDeadline: test.toISOString().slice(0, 10),
    quoteAgeDays: +age.toFixed(1),
    assumptions: {
      processingDays: days[0],
      transitDays: days[1],
      personalizationDays: days[2],
      contingencyDays: contingency,
      testingDays: testDays,
    },
    reason:
      "Planning calculation from supplier quote; not a carrier guarantee.",
  };
}
export function parseRequest(text = "", base = {}) {
  const out = { ...base, query: text, market: base.market || "US" };
  if (/\b(US|USA|United States)\b/i.test(text)) out.market = "US";
  for (const m of ["UK", "CA", "AU", "DE", "FR"])
    if (new RegExp(`\\b${m}\\b`, "i").test(text)) out.market = m;
  if (/christmas/i.test(text)) out.season = "christmas-2026";
  const cost = text.match(/(?:under|below|less than)\s*\$?(\d+(?:\.\d+)?)/i),
    margin = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:pre-ad\s*)?margin/i);
  if (cost) out.maxLandedCost = +cost[1];
  if (margin) out.minMargin = +margin[1];
  out.requiredPlatforms = [
    ...new Set([
      ...(base.requiredPlatforms || []),
      ...["amazon", "tiktok", "meta", "google"].filter((p) =>
        new RegExp(`\\b${p}\\b`, "i").test(text),
      ),
    ]),
  ];
  out.exclude = [...(base.exclude || [])];
  if (/exclude[^.]*fragile/i.test(text)) out.exclude.push("fragile");
  if (/exclude[^.]*batter/i.test(text))
    out.exclude.push("battery", "batteries");
  return out;
}
const STOP = new Set(
  "find trending products product in the us usa with recent demand evidence landed cost under at least pre ad margin manageable competition delivery before christmas 2026 show research for of and on exact niche please $15 60 amazon tiktok meta google momentum increasing interest already selling budget shipping price max minimum maximum exclude fragile batteries".split(
    " ",
  ),
);
export function relevant(o, c) {
  if (o.market !== c.market) return false;
  const hay =
    `${o.title} ${o.niche} ${normalizeTags(o.tags).join(" ")}`.toLowerCase();
  if ((c.exclude || []).some((s) => hay.includes(s))) return false;
  const words = String(c.query || "")
    .replace(/exclude[^.]*/gi, "")
    .replace(/(?:under|below|less than)\s*\$?\d+(?:\.\d+)?/gi, "")
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?%?/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  // Every explicit product/niche term must remain relevant. Seasonal relevance is a separate constraint.
  if (!words.every((w) => hay.includes(w))) return false;
  if (c.season === "christmas-2026" && !/christmas|holiday|gift/.test(hay))
    return false;
  return true;
}
export function rankEvidence(
  observations,
  records = {},
  constraints = {},
  now = new Date(),
) {
  const groups = new Map();
  for (const o of observations.filter(
    (o) => o.scope === "product" && relevant(o, constraints),
  )) {
    const key = o.identityKey;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...o, freshness: freshness(o, now) });
  }
  const products = [];
  for (const [identityKey, rows] of groups) {
    const id = productId(constraints.market, identityKey),
      record = records[id] || {},
      quotes = record.quotes || [],
      quote =
        quotes.find((q) => q.id === record.selectedQuoteId) || quotes[0] || {};
    const econ = economics({ ...record.economics, ...quote.economics }),
      ship = delivery(quote, constraints, now);
    if (quote.destination !== constraints.market || quote.currency !== "USD") {
      ship.status = "unverified";
      ship.reason =
        "A quote for the selected destination and USD economics is required.";
    }
    const latest = new Map();
    for (const o of rows) {
      const key = JSON.stringify([
        o.platform,
        o.externalId,
        o.metric,
        o.period,
        o.unit,
        o.correlationKey,
      ]);
      if (
        !latest.has(key) ||
        Date.parse(o.dataAt) > Date.parse(latest.get(key).dataAt)
      )
        latest.set(key, o);
    }
    const freshRows = [...latest.values()].filter(
      (o) =>
        o.freshness.status === "fresh" &&
        !["modeled", "estimated"].includes(String(o.dataStatus).toLowerCase()),
    );
    // Catalog facts never establish sales or independent demand corroboration.
    const catalogRows = freshRows.filter((o) => o.platform === "supplier");
    const demandRows = freshRows.filter((o) => o.platform !== "supplier");
    const sourcePlatform = new Map();
    for (const o of demandRows)
      if (!sourcePlatform.has(o.correlationKey))
        sourcePlatform.set(o.correlationKey, o.platform);
    const usable = demandRows.filter(
      (o) => sourcePlatform.get(o.correlationKey) === o.platform,
    );
    const independent = [...new Set(usable.map((o) => o.correlationKey))],
      platforms = [...new Set(usable.map((o) => o.platform))];
    if (
      (constraints.requiredPlatforms || []).some((p) => !platforms.includes(p))
    )
      continue;
    const sales = usable.filter(
      (o) =>
        ["bought_count", "shop_sales", "purchases"].includes(o.metric) &&
        o.value > 0,
    );
    const attention = usable.filter((o) =>
      ["views", "engagement", "interest", "active_ads"].includes(o.metric),
    );
    const momentum = usable.filter((o) => o.metric === "growth_pct");
    const competition = usable.filter((o) => o.metric === "advertiser_count");
    const missing = [];
    const conflicts = rows.filter((o) => {
      const key = JSON.stringify([
        o.platform,
        o.externalId,
        o.metric,
        o.period,
        o.unit,
        o.correlationKey,
      ]);
      const recent = latest.get(key);
      return (
        recent &&
        recent.id !== o.id &&
        o.freshness.status === "fresh" &&
        recent.value !== o.value &&
        (recent.dataAt === o.dataAt ||
          (["bought_count", "shop_sales", "purchases"].includes(o.metric) &&
            recent.value === 0 &&
            o.value > 0))
      );
    });
    if (conflicts.length)
      missing.push("Review changed or conflicting historical observations");
    if (!sales.length) missing.push("Recent product-level sales evidence");
    if (platforms.length < 2)
      missing.push("Independent cross-platform corroboration");
    if (!competition.length) missing.push("Competition observations");
    if (!econ.complete) missing.push("Complete supplier quote and economics");
    if (ship.status === "unverified") missing.push("Fresh delivery quote");
    if (econ.complete && econ.profitAfterAds <= 0)
      missing.push("Positive estimated profit after advertising costs");
    const failed =
      (econ.complete && econ.profitAfterAds <= 0) || ship.status === "too late";
    const ready =
      !failed &&
      !conflicts.length &&
      sales.length &&
      platforms.length >= 2 &&
      competition.length &&
      econ.complete &&
      econ.marginPct >= (constraints.minMargin ?? 60) &&
      ship.status === "on-time";
    const validTests = (record.tests || []).filter(
      (t) =>
        Number.isInteger(finite(t.purchases)) && finite(t.purchases) > 0 &&
        finite(t.spend) !== null &&
        finite(t.revenue) !== null &&
        econ.complete &&
        t.revenue - t.spend - (econ.revenue - econ.contribution) * t.purchases >
          0,
    );
    const verdict = failed
      ? "Avoid / fails economics or delivery"
      : ready && validTests.length
        ? "Validated by recorded test"
        : ready
          ? "Ready for controlled test"
          : !usable.length && catalogRows.length
            ? "Supplier catalog only · validation pending"
          : usable.length
            ? "Research candidate"
            : "Insufficient evidence";
    const confidence = Math.min(
      100,
      platforms.length * 15 +
        (sales.length ? 20 : 0) +
        (competition.length ? 10 : 0) +
        (econ.complete ? 10 : 0) +
        (ship.status === "on-time" ? 10 : 0),
    );
    const product = {
      id,
      identityKey,
      title: rows[0].title,
      niche: rows[0].niche,
      market: constraints.market,
      observations: rows,
      quotes,
      selectedQuoteId: record.selectedQuoteId || null,
      productMatch: rows.find((o) => o.productMatch)?.productMatch || null,
      economics: econ,
      delivery: ship,
      verdict,
      confidence,
      scoreVersion: VERSION,
      dimensions: {
        attention: attention.length
          ? attention.map((o) => ({
              metric: o.metric,
              value: o.value,
              unit: o.unit,
            }))
          : null,
        salesEvidence: sales.length ? true : null,
        momentum: momentum.length ? momentum.map((o) => o.value) : null,
        competition: competition.length
          ? competition.map((o) => o.value)
          : null,
        supplierConfidence:
          ship.status === "unverified" ? "unverified" : "dated quote",
        independentSources: independent.length,
        platformCoverage: platforms.length,
        catalogSources: new Set(catalogRows.map((o) => o.correlationKey)).size,
      },
      missing,
      mainRisk:
        missing[0] || "Recorded observations do not guarantee future profit.",
      nextAction: missing.length
        ? `Collect: ${missing.join("; ")}`
        : "Run a controlled test and record spend, purchases and revenue.",
      conditions:
        "Fresh sales, independent corroboration, competition, complete economics and on-time delivery required; validation additionally requires a profitable recorded test.",
      matchExplanation:
        "Same explicit identityKey only. Different listing IDs remain separate unless the importer explicitly supplies a shared identityKey.",
      shortlisted: !!record.shortlisted,
      history: record.history || [],
      tests: record.tests || [],
    };
    if (
      constraints.maxLandedCost != null &&
      (!econ.complete || econ.landedCost > constraints.maxLandedCost)
    )
      continue;
    if (
      constraints.minMargin != null &&
      (!econ.complete || econ.marginPct < constraints.minMargin)
    )
      continue;
    products.push(product);
  }
  products.sort(
    (a, b) => b.confidence - a.confidence || a.title.localeCompare(b.title),
  );
  return products;
}
export function csv(products) {
  const cell = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [
    [
      "Product",
      "Market",
      "Niche",
      "Verdict",
      "Confidence",
      "Landed cost",
      "Pre-ad contribution",
      "Margin %",
      "Estimated profit after ads",
      "Break-even CPA",
      "Supplier listing",
      "Supplier variant",
      "Delivery",
      "Sources",
      "Missing proof",
    ],
    ...products.map((p) => [
      p.title,
      p.market,
      p.niche,
      p.verdict,
      p.confidence,
      p.economics.landedCost,
      p.economics.contribution,
      p.economics.marginPct,
      p.economics.profitAfterAds,
      p.economics.breakEvenCpa,
      p.quotes.find((q) => q.id === p.selectedQuoteId)?.url || p.quotes[0]?.url,
      p.quotes.find((q) => q.id === p.selectedQuoteId)?.variant || p.quotes[0]?.variant,
      p.delivery.status,
      p.observations
        .map(
          (o) =>
            `${o.platform}: ${o.metric}=${o.value} ${o.unit} (${o.dataAt}) ${o.sourceUrl}`,
        )
        .join("; "),
      p.missing.join("; "),
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\n");
}
