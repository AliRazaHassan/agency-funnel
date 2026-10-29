# Signal Desk provider capabilities

Reviewed 23 October 2026 (Pakistan). This is an implementation and capability inventory, not a claim that every integration is live.

| Platform | Existing implementation | Evidence portal behavior | Actual run |
| --- | --- | --- | --- |
| Amazon | Keepa snapshot, optional API pull script, manual observations | Requires dated ASIN records. Bought wording remains separate from modeled monthly sales. Original URLs and market retained. No automatic paid pull. | Empty snapshot; production health also reports no Keepa key. |
| Meta | Optional Ad Library token integration, otherwise curated research links | Preserves exact ad ID, advertiser and creative URL from successful active-ad responses. Active ads are attention, not purchases. Seeds and search links excluded. | No usable structured observations locally. Production token status not read. |
| TikTok | Best-effort public Creative Center response, curated fallback | Accepts only exact IDs, numeric metrics, units and underlying dates. Legacy category/seed prose cannot become SKU sales proof. | No usable structured observations. |
| Google | **Unified opt-in:** `ENABLE_GOOGLE_TRENDS=1` for desk freeSignals **and** evidence direct collect. Unset/≠1 = off. Prefer Apify Automatic hunt on Render. Wikipedia remains desk-only freeSignals, never evidence ranking. | Trends query records remain niche scoped. Uses last underlying time-series date. No Wikipedia demand substitution. | Direct often 429 on cloud; Apify preferred when `APIFY_TOKEN` set. |

## Import and identity

The Evidence research > Import screen accepts a manual form or CSV/JSON. Required fields: `platform`, `externalId`, `title`, `market`, `scope`, `metric`, `value`, `unit`, `dataAt`, `sourceUrl`. JSON uses an array or `{observations: [...]}`; CSV uses those column headings. Zero is valid. Invalid/missing fields reject the batch atomically. Imports retain raw rows and label themselves manual rather than provider verified.

Optional fields include `canonicalUrl`, `provider`, `niche`, `identityKey`, `correlationKey`, `currency`, `period`, `limitations`, and `tags` (JSON array). Default identity is platform + market + external ID. Cross-platform matching currently requires an explicit shared exact identity key; automatic fuzzy matching is deliberately not implemented. Variants need separate keys. Correlation keys prevent copied observations from counting as independent platforms.

## Freshness and ranking

Amazon/Meta/TikTok expire after 7 days; Google after 14. Freshness uses `dataAt`, never collection time. These are research policy windows, not platform guarantees. Only fresh non-modeled product observations contribute to evidence confidence. Niche observations are persisted separately and do not create exact candidates. Attention, sales, momentum and competition remain separate dimensions. Missing competition remains unknown.

Confidence v1: 15 per fresh independent platform, 20 for positive observed product sales, and 10 each for competition evidence, complete economics and dated delivery; capped at 100. Weights are shown in product detail. Confidence is evidence coverage, not a probability of success.

## Storage, refresh and configuration

The new evidence store uses existing `DATABASE_URL` (Postgres) or `REDIS_URL`. It refuses local-file persistence in production. Postgres uses row transactions; Redis uses WATCH/MULTI with bounded contention retries. Local file persistence is for development/tests, with atomic replacement and serialized writes. Legacy project/research file writes are now blocked in production too.

Refresh is manual, rate limited to one active run and three seconds between starts. Provider failures are isolated. Existing source integrations have bounded request timeouts. There is no scheduled monitor, provider retry/backoff scheduler, or automatic credential setup. No new paid infrastructure was provisioned. Production datastore connectivity has NOT been verified in this change. Redis/Postgres integration tests remain required.

Configure credentials only in the existing Render service's environment settings or an approved secrets interface. Never put secret values in this document or chat. Existing Render tooling exposed service/deploy/log reads and environment updates, but no secret-reading operation was used. Current production OpenAI availability and empty Amazon snapshot were established through public health, not secret inspection.

## Honesty modes (LIVE / SEED / UNAVAILABLE)

`/api/health` `dataMode.sourceModes` and `/api/research/status` `sourceModes` label each of Amazon, Meta, TikTok, Google as:

| Mode | Meaning |
|------|---------|
| **LIVE** | Configured path can return structured observations (token, Apify, or non-empty Keepa snapshot). |
| **SEED** | Desk curated social board only — **not** evidence / not live tops. |
| **UNAVAILABLE** | Empty or disabled; collect fails with an explicit reason (prefer Apify when token present). |

Radar hides numeric platform scores when status is not LIVE/RECENT/MANUAL.

## Remaining integration work

- Successful live SKU-level source collection and exact supplier quotes.
- Optional AI extraction with strict source references; new ranking currently uses deterministic source identities and does not call AI.
- Automatic cross-platform identity review and variant attribute matching.
- Google time-series visualization, query-level growth, supplier discovery adapter and quote verification.
- Durable refresh jobs, caching/backoff across processes, retention/pagination and monitoring.
- Reconcile remaining legacy ranking/scenario screens and all concierge actions with the new schema. Legacy Shopify draft/client brief exports are preserved but not migrated or verified through new evidence sessions.

## Audit-fix update

Evidence v2 adds market-scoped IDs, conservative legacy migration, status/tag normalization, latest comparable metrics, validated quote planning and input validation. General delivery targets are explicit; Christmas defaults apply only in that mode. Isolated Redis and production auth smoke tests are now executed. See `../qa/fix-and-release-report.md` for current release verification; the earlier audit remains historical evidence.
