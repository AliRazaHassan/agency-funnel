import { loadKeepaSnapshot } from "./keepa.js";
import { fetchSocialTrends } from "./socialTrends.js";
import { fetchGoogleTrendsSoft } from "./freeSignals.js";
import { observation } from "./evidence.js";
export function capabilities() {
  return [
    {
      platform: "amazon",
      provider: "Keepa snapshot",
      configured: true,
      note: "Dated ASIN snapshot/manual import. Existing Keepa key is not automatically charged or pulled.",
    },
    {
      platform: "meta",
      provider: "Existing social integration",
      configured: !!(
        process.env.META_AD_LIBRARY_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN
      ),
      note: "Ad activity only, never sales. Search links and curated seed rows excluded.",
    },
    {
      platform: "tiktok",
      provider: "Existing Creative Center integration",
      configured: true,
      note: "Public response when available; curated seeds excluded. Views are not sales.",
    },
    {
      platform: "google",
      provider: "Google Trends",
      configured: process.env.ENABLE_GOOGLE_TRENDS !== "0",
      note: "Free relative search interest; no API key. May be unavailable or rate limited. Set ENABLE_GOOGLE_TRENDS=0 to disable. No Wikipedia substitution.",
    },
  ];
}
export async function collect({ market = "US", query = "" }, now = new Date()) {
  let socialPromise;
  const jobs = capabilities().map(async (cap) => {
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
        reason = rows.length ? "" : "No dated ASIN observations in snapshot";
      } else if (cap.platform === "google") {
        if (!cap.configured)
          reason =
            "ENABLE_GOOGLE_TRENDS is disabled; import a dated Google Trends observation";
        else {
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
            : "Google Trends unavailable or rate limited";
        }
      } else {
        const data = await (socialPromise ??= fetchSocialTrends({
          regionFocus: market,
          nicheHint: query,
        }));
        // Legacy feed does not guarantee exact IDs, metric units and underlying timestamps.
        // Only structured observations can be promoted; never parse prose or curated seeds into proof.
        for (const p of data.items || []) {
          if (
            p.platform !== cap.platform ||
            !p.externalId ||
            !p.dataAt ||
            typeof p.value !== "number" ||
            !p.sourceUrl ||
            !p.unit ||
            /seed|curated|estimated/i.test(`${p.source} ${p.dataStatus}`)
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
        reason = rows.length
          ? ""
          : "Provider returned no exact, dated structured observations; use evidence import";
      }
      return {
        platform: cap.platform,
        status: rows.length ? "success" : "unavailable",
        reason,
        startedAt,
        completedAt: new Date().toISOString(),
        observations: rows,
      };
    } catch {
      return {
        platform: cap.platform,
        status: "failed",
        reason:
          "Provider request failed or returned invalid evidence. Retry or import dated source observations.",
        startedAt,
        completedAt: new Date().toISOString(),
        observations: [],
      };
    }
  });
  return Promise.all(jobs);
}
