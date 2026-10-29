import { loadKeepaSnapshot } from "./keepa.js";
import { fetchSocialTrends } from "./socialTrends.js";
import {
  fetchGoogleTrendsSoft,
  googleTrendsFailure,
  googleTrendsDirectEnabled,
} from "./freeSignals.js";
import { observation } from "./evidence.js";
import { apifyConfigured } from "./apifyEvidence.js";

const APIFY_HINT =
  "Prefer Automatic hunt (Apify) when APIFY_TOKEN is set, or import a dated observation.";

/**
 * Capability + honesty mode for Meta / TikTok / Google Trends / Amazon.
 * mode is LIVE | SEED | UNAVAILABLE so top-products UI never looks live when empty.
 */
export function capabilities() {
  const apify = apifyConfigured();
  const metaToken = !!(
    process.env.META_AD_LIBRARY_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN
  );
  const trendsDirect = googleTrendsDirectEnabled();
  const snap = loadKeepaSnapshot({ force: true });
  const amazonCount = Array.isArray(snap.products) ? snap.products.length : 0;
  const keepaKey = !!process.env.KEEPA_API_KEY;

  return [
    {
      platform: "amazon",
      provider: "Keepa snapshot",
      configured: amazonCount > 0 || keepaKey,
      mode: amazonCount > 0 ? "LIVE" : "UNAVAILABLE",
      observationCount: amazonCount,
      liveKeyConfigured: keepaKey,
      preferredPath: amazonCount > 0 ? "snapshot" : "manual-paste-or-keepa-pull",
      note: "Dated ASIN snapshot/manual import. Keepa key is not auto-pulled on each request. Empty snapshot = no live Amazon tops.",
    },
    {
      platform: "meta",
      provider: metaToken
        ? "Meta Ad Library Graph"
        : apify
          ? "Apify Facebook ads scraper"
          : "Curated seed board + Ad Library links",
      configured: metaToken || apify,
      mode: metaToken || apify ? "LIVE" : "SEED",
      preferredPath: apify
        ? "apify-automatic-hunt"
        : metaToken
          ? "meta-graph"
          : "seed-board",
      note: metaToken || apify
        ? "Ad activity only, never sales. Seeds and search links excluded from evidence."
        : "No Meta token or APIFY_TOKEN — desk shows SEED board only; evidence collect stays empty until configured.",
    },
    {
      platform: "tiktok",
      provider: apify
        ? "Apify TikTok scraper"
        : "Creative Center soft + curated seed board",
      configured: apify,
      mode: apify ? "LIVE" : "SEED",
      preferredPath: apify ? "apify-automatic-hunt" : "seed-board",
      note: apify
        ? "Apify path preferred on cloud. Views/likes are not sales."
        : "Without APIFY_TOKEN, cloud typically falls back to SEED board. Creative Center soft-calls often fail on datacenter IPs. Seeds never become evidence.",
    },
    {
      platform: "google",
      provider: trendsDirect
        ? "Google Trends (direct, opt-in)"
        : apify
          ? "Apify Google Trends scraper"
          : "Google Trends (disabled)",
      configured: trendsDirect || apify,
      mode: trendsDirect || apify ? "LIVE" : "UNAVAILABLE",
      preferredPath: apify
        ? "apify-automatic-hunt"
        : trendsDirect
          ? "direct-explore"
          : "enable-flag-or-apify",
      note: "ENABLE_GOOGLE_TRENDS=1 opts into direct unofficial Trends (desk + evidence). Default off. On Render prefer Apify Automatic hunt. Relative index only; no Wikipedia substitution.",
    },
  ];
}

function emptyReason(platform, cap, detail) {
  const parts = [detail].filter(Boolean);
  if (cap.mode === "SEED") {
    parts.push(
      "SEED board is not live top-products evidence.",
    );
  }
  if (cap.preferredPath?.startsWith("apify") || apifyConfigured()) {
    parts.push(APIFY_HINT);
  }
  return parts.join(" ") || `${platform} returned no dated structured observations`;
}

export async function collect({ market = "US", query = "" }, now = new Date()) {
  let socialPromise;
  const caps = capabilities();
  const jobs = caps.map(async (cap) => {
    const startedAt = new Date().toISOString(),
      rows = [];
    let reason = "";
    try {
      if (cap.platform === "amazon") {
        const snap = loadKeepaSnapshot({ force: true });
        for (const p of snap.products || []) {
          if (!p.asin || !p.capturedAt) continue;
          for (const [metric, value, unit] of [
            [
              p.boughtText ? "bought_count" : "modeled_sales",
              p.monthlySold,
              p.boughtText || "estimated units/month",
            ],
            ["sales_rank", p.salesRank, "rank"],
            ["reviews", p.reviewCount, "reviews"],
            ["price", p.buyBoxUsd, "USD"],
          ]) {
            if (value == null) continue;
            rows.push(
              observation(
                {
                  platform: "amazon",
                  provider: p.source,
                  externalId: p.asin,
                  title: p.title,
                  market:
                    snap.meta.domain === "com"
                      ? "US"
                      : snap.meta.domain === "co.uk"
                        ? "UK"
                        : snap.meta.domain.toUpperCase(),
                  metric,
                  value,
                  unit,
                  scope: "product",
                  sourceUrl: p.amazonUrl,
                  dataAt: p.capturedAt,
                  period: metric === "bought_count" ? "past month" : null,
                  currency: "USD",
                  dataStatus: metric === "modeled_sales" ? "modeled" : "manual",
                  collectionMethod: "snapshot",
                  niche: p.niche || "Unclassified",
                  limitations:
                    "Snapshot supplied by existing integration; bought counts are observed wording, not exact orders.",
                },
                now,
              ),
            );
          }
        }
        reason = rows.length
          ? ""
          : emptyReason(
              "amazon",
              cap,
              "No dated ASIN observations in snapshot (UNAVAILABLE — not live Amazon tops).",
            );
      } else if (cap.platform === "google") {
        if (googleTrendsDirectEnabled()) {
          const g = await fetchGoogleTrendsSoft(
            query,
            market === "UK" ? "GB" : market,
          );
          if (g)
            for (const [metric, value, unit] of [
              ["interest", g.interestScore, "relative index"],
              ["growth_pct", null, "%"],
            ])
              if (value != null)
                rows.push(
                  observation(
                    {
                      platform: "google",
                      provider: "Google Trends",
                      title: query,
                      externalId: query,
                      market,
                      metric,
                      value,
                      unit,
                      scope: "niche",
                      sourceUrl: g.url,
                      dataAt: g.dataAt,
                      period: "3 months",
                      collectionMethod: "api",
                      niche: query,
                    },
                    now,
                  ),
                );
          reason = rows.length
            ? ""
            : emptyReason(
                "google",
                cap,
                googleTrendsFailure(query, market === "UK" ? "GB" : market) ||
                  "Direct Google Trends returned no series.",
              );
        } else if (apifyConfigured()) {
          reason = emptyReason(
            "google",
            cap,
            "Direct Trends disabled (ENABLE_GOOGLE_TRENDS≠1). Use Automatic hunt · Google Trends (Apify) — preferred on Render.",
          );
        } else {
          reason = emptyReason(
            "google",
            cap,
            "Google Trends UNAVAILABLE: set ENABLE_GOOGLE_TRENDS=1 for direct probe, or APIFY_TOKEN for Automatic hunt.",
          );
        }
      } else {
        // Meta / TikTok — structured live rows only; SEED board never becomes evidence.
        if (cap.platform === "meta" && !cap.configured) {
          reason = emptyReason(
            "meta",
            cap,
            "Meta UNAVAILABLE for evidence: set META_AD_LIBRARY_TOKEN (or FACEBOOK_ACCESS_TOKEN) or APIFY_TOKEN.",
          );
        } else {
          const data = await (socialPromise ??= fetchSocialTrends({
            regionFocus: market,
            nicheHint: query,
          }));
          for (const p of data.items || []) {
            if (
              p.platform !== cap.platform ||
              !p.externalId ||
              !p.dataAt ||
              typeof p.value !== "number" ||
              !p.sourceUrl ||
              !p.unit ||
              /seed|curated|estimated|SEED/i.test(
                `${p.source} ${p.dataStatus}`,
              )
            )
              continue;
            rows.push(
              observation(
                {
                  ...p,
                  market: p.market || market,
                  collectionMethod:
                    p.source === "manual-paste" ? "manual" : "api",
                },
                now,
              ),
            );
          }
          if (!rows.length) {
            const base =
              cap.platform === "tiktok" && !apifyConfigured()
                ? "TikTok returned no exact, dated structured observations (SEED fallback is not evidence)."
                : apifyConfigured()
                  ? `Direct ${cap.platform} feed empty.`
                  : "Provider returned no exact, dated structured observations; use evidence import.";
            reason = emptyReason(cap.platform, cap, base);
          }
        }
      }
      return {
        platform: cap.platform,
        status: rows.length ? "success" : "unavailable",
        mode: rows.length ? "LIVE" : cap.mode === "SEED" ? "SEED" : "UNAVAILABLE",
        reason,
        startedAt,
        completedAt: new Date().toISOString(),
        observations: rows,
      };
    } catch {
      return {
        platform: cap.platform,
        status: "failed",
        mode: "UNAVAILABLE",
        reason:
          "Provider request failed or returned invalid evidence. Retry, configure tokens, or import dated source observations." +
          (apifyConfigured() ? ` ${APIFY_HINT}` : ""),
        startedAt,
        completedAt: new Date().toISOString(),
        observations: [],
      };
    }
  });
  return Promise.all(jobs);
}
