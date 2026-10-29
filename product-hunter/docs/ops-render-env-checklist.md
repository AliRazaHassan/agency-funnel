# Ops checklist — Render env + Key Value (Signal Desk top products)

Use this after merging the Blueprint / foundation PR. **Do not commit secrets.** Set values only in the Render Dashboard (or an approved secrets UI).

## 1. Blueprint / Redis

1. Confirm `render.yaml` declares web `signal-desk` + Key Value `product-hunter-kv`, and `REDIS_URL` via `fromService`.
2. Sync / deploy the Blueprint so `REDIS_URL` is wired. Existing env vars omitted from the Blueprint are **not** deleted by sync.
3. Confirm health: `researchStorage` / workspace status show **keyvalue** (not file).

## 2. Key Value persistence (Dashboard — required human step)

Blueprint **cannot** turn persistence on.

1. Open Key Value **product-hunter-kv** in the Render Dashboard.
2. Enable **persistence** if available for your plan (Free KV has **no** disk persistence; upgrading may be required).
3. Without persistence, research/evidence/projects can wipe on KV restart/upgrade even though `REDIS_URL` is set.

## 3. Source tokens (user-supplied — leave blank until you have them)

| Variable | Purpose | Mode without it |
|----------|---------|-----------------|
| `APIFY_TOKEN` | Automatic hunt TikTok / Meta / Google Trends (FREE Apify only) | Preferred cloud path missing |
| `META_AD_LIBRARY_TOKEN` or `FACEBOOK_ACCESS_TOKEN` | Direct Meta Ad Library Graph | Meta evidence UNAVAILABLE; desk SEED board |
| `KEEPA_API_KEY` | One-time `npm run keepa:pull` only | Amazon stays UNAVAILABLE until snapshot/manual paste |
| `ENABLE_GOOGLE_TRENDS` | Must be exactly `1` to enable **direct** Trends (desk + evidence) | Direct Trends off; prefer Apify hunt |

Also keep existing: `APP_PASSWORD`, `SESSION_SECRET`, `OPENAI_API_KEY`.

## 4. `ENABLE_GOOGLE_TRENDS` semantics (unified)

- **Opt-in everywhere:** desk `freeSignals` and evidence `collect` both require `ENABLE_GOOGLE_TRENDS=1` for the unofficial direct Explore API.
- Unset / `0` / any other value = direct Trends **off**.
- On Render, prefer **Automatic hunt → Google Trends (Apify)** when `APIFY_TOKEN` is set; direct Explore often returns HTTP 429 on datacenter IPs.

## 5. Smoke after keys

1. `/api/health` → `dataMode.sourceModes` shows LIVE/SEED/UNAVAILABLE per platform (not empty pretending live).
2. Research Portal → Providers: modes + preferred paths visible.
3. With Apify: start Automatic hunt for one platform; empty direct collect must report UNAVAILABLE clearly, not invent tops.
4. Amazon: manual paste or Keepa pull → snapshot count &gt; 0 → Amazon mode LIVE.

## 6. Honesty rule

SEED boards and OpenAI candidates are research scaffolding. **Top products** require dated LIVE/RECENT/MANUAL observations — never treat SEED/UNAVAILABLE as live tops.
