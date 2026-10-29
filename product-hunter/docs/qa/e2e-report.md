# Signal Desk execution audit — 29 October 2026

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
| Production authenticated browser hunt | NOT RUN | Current browser is at the workspace password screen; credentials not available to this audit |

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

## Deployment

Production remains on `5412179f5b49a8b82465e468ccd62f5a28ee0d23`. Automatic approval review rejected a direct push to main because it would trigger production deployment without explicit authorization for that action. Changes are prepared on `codex/signal-desk-audit-20261029` for a reviewable PR. Merge/deploy and authenticated production browser research remain pending. Local GitHub HTTPS push also lacks credentials; the connected GitHub API is used for the non-production PR branch.

After the full 16/16 browser run, the final supplier-prefill change was checked with 2/2 focused desktop/mobile match tests.
