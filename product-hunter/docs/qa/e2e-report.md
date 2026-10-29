# Signal Desk execution audit — 29 October 2026

## Authenticated production source validation — 29 October 2026, 14:36 PKT

Secure password sign-in succeeded in the live browser after the earlier handoff errors. A real US `Christmas pet` research refresh completed at `2026-10-29T09:36:54Z`. The cost and margin fields were empty, so missing economics filters did not cause the empty list.

| Source | Actual result |
|---|---|
| Amazon | No dated ASIN observations in the snapshot |
| Meta direct | Configuration required; no exact dated structured observations |
| TikTok direct | No exact dated structured observations |
| Google Trends direct | Explore HTTP **429** |
| Existing Apify connection | Automatic-hunt attempt rejected with HTTP **401**: user not found or authentication token invalid |
| Product results | **0 candidates**; no invented candidates inserted |

The Apify 401 was returned during account/credit verification, before the Actor-launch step in `createAutomaticHunter.start`; no Actor was launched by this attempt. Selecting other Apify-backed platforms cannot repair the shared authentication failure, so those launches were not repeated. No new subscription, paid credit purchase, real ad purchase or Shopify write was performed.

**Required next action:** replace/reconnect the existing `APIFY_TOKEN` with a valid token for the intended free Apify account in the existing Render service's environment. Keep the token out of chat, source code, logs and screenshots. Then rerun the free-account/remaining-credit checks and real collection. Google's direct 429 remains a separate source-availability issue; the bounded automatic adapter can only be tested after authentication is repaired.

**Acceptance verdict:** software deployment and regression checks PASS; the promised live winning-product research acceptance currently **FAILS because no usable live product evidence was returned**. Real supplier quotes, destination shipping, exact competitor variants and profit remain unverified. This supersedes earlier statements that the live browser hunt was only blocked by login.

## Release verdict

Software regression: passing. Automated verified-product discovery: **not proven**. The direct free-source smoke executed here returned **0 observations / 0 products**. This is a failed product-discovery acceptance outcome, not a verified list of winners. No sales, supplier shipping cost, or profit has been fabricated or uploaded to production.

Existing production service: `srv-dar80jbncjis73cg2c00`, workspace `tea-d8i12bsm0tmc73c6s4u0`, https://signal-desk-6for.onrender.com/ . Existing `main` branch and existing service only; no paid infrastructure or API subscription created.

## Executed verification

| Check | Result | Scope |
|---|---|---|
| Unit tests | 87 PASS, 0 FAIL, 0 skipped | Evidence identity/freshness, provider normalization, economics, season, scoring, free-credit guards |
| Logic verification | PASS | Existing independent calculation verifier |
| Production Vite build | PASS | Compiled production client |
| Full Playwright regression | 16 PASS, 0 FAIL, 0 skipped | Real locally launched Chromium, isolated application/file storage, 1440px and 390px workflows |
| Real Redis integration | 2 PASS, 0 FAIL, 0 skipped | Local Redis 7.2.6, isolated DBs 14/15: concurrent writers, reconnect, production auth/startup |
| Live direct free-source hunt | 0 observations, 0 candidates | US Christmas pet, maximum landed cost $15, minimum pre-ad margin 60%; source availability NOT PASS |
| Existing production health before release | PASS | HTTP 200; revision 5412179; Key Value mode; auth wall/login/provider-state/read startup flags true |
| Production authenticated browser hunt | EXECUTED — source acceptance FAIL | US Christmas pet: 0 product candidates; direct Google HTTP 429; automatic Apify authentication HTTP 401 |

The automatic provider browser test uses deterministic responses. It checks the UI request/poll/import/refresh chain and does not certify live Apify, TikTok, Meta, or Google access. The legacy workflow uses local fallback mode with no production API keys. External Shopify creation and real advertising purchases were not performed.

## Fixes

1. **Loss-making products could pass readiness.** Readiness now fails when estimated profit after advertising is zero or negative. CPA starts unknown instead of silently assuming $0. CSV and product cards include profit after ads and break-even CPA.
2. **Discovery-to-product workflow was missing.** TikTok videos and Meta ads can now be matched to an exact supplier URL and variant with explicit confirmation. The original discovery remains unchanged. Matched metrics retain their dates, source URLs, correlation, and engagement units; they are labeled user supplied. Search-interest records cannot be promoted this way. Variant-specific supplier fields prefill in the quote editor, with costs and quote dates left unknown.
3. **Matched records collided with source IDs.** Matched IDs are deterministic and distinct from the original niche evidence, making repeated matching idempotent while preserving variant separation.
4. **Failed hunt errors disappeared during refresh.** The reason is now set after the refresh completes.
5. **Discovery filters differed from product filters.** Both now apply the same market, relevance, exclusion and seasonal rules.
6. **Fractional purchases were accepted.** Recorded purchase counts now require whole numbers; fractional historical records cannot qualify as validated tests.
7. **Google partial/no-data rows could distort interest and freshness.** Direct collection now excludes partial periods, absent/out-of-range values and future dates; genuine zero remains data, and the latest complete point determines underlying date.
8. **Browser suite had regressed on login.** Password selectors also matched the Show password button. Selectors now address the exact Password field, and the automatic-hunt message assertion matches the current meaningful result.
9. **CI missed database integrations on main.** Main/PR regression now includes temporary Redis, deterministic npm installation and always-uploaded JUnit/screenshots.
10. **Mobile provenance tables were excessively tall.** Long source details now sit in a bounded scrollable table. Screenshots inspected at desktop and mobile widths; no horizontal page overflow in the tested workflows.

## Browser coverage

Authentication success/failure/logout; Christmas market/cost/margin propagation; evidence import with actual zero; invalid evidence rejection; supplier quote save; shortlisting; recorded tests; saved-session hydration; TikTok date/country rejection; automatic hunt idempotent UI start/poll/refresh; explicit product matching with supplier prefill at both widths; scout → hunt → CSV → radar; contextual analyst; supplier validation/ad-test feedback; project save/reopen; disconnected Shopify handling; settings and centered loading.

## Source acceptance gaps

- **Amazon:** local snapshot empty. No new paid Keepa pull was made.
- **TikTok:** public adapter returned no exact dated structured observations in this environment. Engagement never counted as product sales.
- **Meta:** no local token configured, no usable records. Production token availability has not been inferred from local state.
- **Google Trends:** direct request timed out in this environment. The bounded free-credit Actor adapter exists, but no live Actor was launched in this audit.
- **Supplier/competitor economics:** no exact live supplier quote, destination shipping price, or same-variant competitor price was independently verified for an actual product.
- **Storage:** existing Key Value is not evidence of durable backups. Prior release documentation reports its free plan persistence off. App reconnect tests do not certify persistence after Redis service data loss.

Until these gaps are resolved, use the app to collect and compare evidence; do not label a filled Top 50 as verified winners or promise Christmas delivery/profit.

## Reproduction

```bash
cd product-hunter
npm ci
npm run build
TEST_REDIS_URL=redis://127.0.0.1:6379/15 node --test tests/integration/*.test.js
npx playwright install --with-deps chromium
npm run test:regression
npm run research:smoke
```

Local Playwright CDN downloads produced invalid/truncated archives. The tests were actually executed using Chromium 153 supplied by the registry package `@sparticuz/chromium` in temporary storage, selected with `CHROMIUM_PATH`; no new project dependency was added. A Redis server started in a separate command could not be reached from the test command in this environment; running the server and tests together resolved that environmental failure. These initial failed attempts are not counted as successful executions.

## Screenshots and source output

Screenshots contain synthetic fixtures only, never real sales proof:

- Desktop and mobile screenshots: generated as `test-results/match-1440.png` and `test-results/match-390.png`; inspected locally. CI uploads screenshots as workflow artifacts.
- [Actual direct-provider smoke output](live-source-smoke-2026-10-29.json)

## Deployment and post-release validation

PR #10 was explicitly approved by the user for merge/deploy with validation, merged as `15bd89e4aec514388815477ca964829d0295520c`, and deployed to the existing Render service.

- Deployment: `dep-dbhh2nss728c73d37bb0`, **LIVE** at 2026-10-29T09:27:40Z (14:27 PKT).
- Merged-commit CI: [run 40849704562](https://github.com/AliRazaHassan/agency-funnel/actions/runs/40849704562), **SUCCESS**. Actual job logs confirm **87 unit**, **2 isolated Redis/production integration**, and **16 Playwright** tests passed; no unit/integration failures or skips. Logic and production build passed.
- Production HTTP validation at 2026-10-29T09:29:37Z: **all executed checks passed**. Public health revision matches the merge commit; homepage and compiled frontend asset return 200; the deployed bundle contains the new matching and after-ad profit UI.
- Six research endpoints reject unauthenticated reads/writes with 401, including the new match endpoint, import, research, export, state and provider status.
- All four internally authenticated startup checks true: auth wall, valid login, provider-status/storage read and saved-research read. Render logs independently report `Authenticated startup smoke: PASS`.
- No application error logs returned for the queried post-rollout window starting 2026-10-29T09:27:25Z. This is an immediate release check, not a long-term stability claim.
- Production storage connection reports Key Value. Its backup/durability limitations remain unchanged.

### Still not validated

A fresh production browser check still displays the password screen. The previous secure sign-in request timed out; authenticated browser research remains blocked by login. The internal startup checks validate authentication and reads, **not** a live external provider hunt. The production Amazon snapshot is empty. No new verified-product shortlist, supplier quote, competitor price, ad campaign or profit claim is certified by this release. The saved direct-provider smoke remains the actual pre-release source result (0 observations / 0 candidates).

### Public production validation evidence

```json
{
  "at": "2026-10-29T09:29:37Z",
  "expectedRevision": "15bd89e4aec514388815477ca964829d0295520c",
  "health": {
    "ok": true,
    "openai": true,
    "authRequired": true,
    "label": "Signal Desk",
    "revision": "15bd89e4aec514388815477ca964829d0295520c",
    "researchStorage": "keyvalue",
    "verification": {
      "unauthenticatedBlocked": true,
      "login": true,
      "providerStatus": true,
      "storedResearch": true
    },
    "dataMode": {
      "freeSignals": true,
      "keepaLiveKey": false,
      "keepaSnapshot": {
        "ok": false,
        "mode": "snapshot",
        "count": 0,
        "meta": {
          "capturedAt": null,
          "domain": "com",
          "count": 0,
          "note": "Empty snapshot. Use UI “Add Amazon one-time data” (paste from amazon.com) or npm run keepa:pull. Free Wikimedia works without this.",
          "oneTime": true
        }
      }
    }
  },
  "checks": {
    "health_http_200": true,
    "deployed_revision_matches": true,
    "persistent_storage_connected": true,
    "authenticated_startup_checks": {
      "unauthenticatedBlocked": true,
      "login": true,
      "providerStatus": true,
      "storedResearch": true
    },
    "GET /api/research/state blocks unauthenticated": true,
    "GET /api/research/status blocks unauthenticated": true,
    "POST /api/research/match blocks unauthenticated": true,
    "POST /api/research/import blocks unauthenticated": true,
    "POST /api/research/research blocks unauthenticated": true,
    "POST /api/research/export blocks unauthenticated": true,
    "homepage_http_200": true,
    "frontend_asset_http_200": true,
    "deployed UI includes Match exact product": true,
    "deployed UI includes Estimated profit after ads": true,
    "deployed UI includes Save product match": true
  }
}
```
