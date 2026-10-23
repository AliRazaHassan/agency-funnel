# Signal Desk evidence portal execution report

Reviewed 23 October 2026 (Pakistan). **Partial implementation; release blocked.** This document does not claim completion of the supplied master brief.

## Repository and production baseline

- Repository: AliRazaHassan/agency-funnel; app: product-hunter.
- Existing service: srv-dar80jbncjis73cg2c00, signal-desk, US Oregon, free plan. No duplicate resources created.
- Existing deployment confirmed live through Render: dep-db0mb60473hc738b7mng, commit d6e23616ba2ccf5da48fd66b7243d5e61327e193.
- Production `/api/health` returned HTTP 200, auth required, OpenAI configured, no Keepa key, empty Amazon snapshot.
- PR #6 was open, draft, unmerged, head 0c667a9d148277c1f4b31e1318fb2dce09f51d28. This branch is based on it and incorporates its fixes.
- Working branch: codex/evidence-research-portal. No applicable AGENTS.md or CLAUDE.md found in repository/ancestor checks.

## Changes implemented

- Integrated authenticated Evidence research surface in the existing React portal, including provider health, product evidence, niche grouping, shortlist, saved research sessions, source imports, quotes, economics, delivery, recorded tests and CSV export.
- Christmas navigation uses the same evidence engine and seasonal constraint. Fixed editorial list remains only behind its existing legacy API; it is not the new discovery result.
- Common strict observation schema, raw provenance, original IDs/URLs, market, scope, metric units, collection/underlying dates, correlation and identity keys.
- Observation-derived candidates only. No generated seed variants, minimum result padding or AI-generated proof in the new workflow.
- Versioned inspectable scoring, stale/model exclusions, explicit unknowns, independent-platform checks and separate verdict gates.
- Shared economics for the new workflow: shipping inclusion, duties, fees, packaging, returns, discount, CPA, ROAS, negative contribution and CPA sensitivities. Supplier variants retain independent economics.
- Dated supplier delivery calculation and quote selection; user-supplied quotes remain labeled as such.
- Durable-store adapters for Postgres/Redis and isolated development file storage. Production file persistence blocked in both new and legacy storage paths.
- Concierge discovery actions route into evidence research. Other legacy concierge actions have not all been migrated.
- Fixed Keepa null-to-zero conversion for monthly sales/rank; retained bought wording separately from modeled sales; malformed session cookie no longer throws.

## Executed verification

| Check | Actual result |
| --- | --- |
| Clean npm ci --no-audit --no-fund | PASS: 178 packages |
| Unit tests | PASS: 61 / FAIL: 0 / SKIP: 0 |
| Logic verification | PASS |
| Production Vite build | PASS: 38 modules |
| New evidence API workflow | PASS: 1 |
| New evidence desktop 1440 / mobile 390 | PASS: 2 |
| Full browser regression (all three spec files) | PASS: 4 / FAIL: 5 / SKIP: 0 |
| Real provider smoke | EXECUTED: 4 unavailable; 0 usable observations; 0 products |
| Isolated file-store close/reopen and record preservation | PASS, unit test |
| Postgres and Redis persistence against running isolated servers | NOT EXECUTED; no test datastore configured |
| Authenticated deployed research workflow | NOT EXECUTED; branch not deployed |

The full regression remains red. Two Christmas UI tests expect the deliberately removed six-card list and old heading. Three legacy Product Hunter tests expect the previous landing flow (`Launch Product Hunter`) immediately after login. Those assertions were not skipped, weakened or marked passed. Their migration and remaining legacy workflow validation are outstanding. Source test files remain intact. New tests cover the actual evidence interface separately.

Browser installation initially failed because Playwright's CDN returned truncated archives and apt installation failed under container permissions. A separate npm-distributed Chromium 153 binary was extracted into /tmp and successfully used with Playwright. It was not added to production dependencies. `CHROMIUM_PATH` selects a locally installed alternative.

An early rerun exposed test storage contamination (duplicate observations/quotes). Fixed by assigning each E2E server run a fresh temporary store and clearing inherited database/Redis URLs. No assertion was relaxed. The subsequent new workflow run passed all three checks.

Screenshots: `screenshots/evidence-desktop.png` and `screenshots/evidence-mobile.png` (synthetic fixture). No production screenshot claim. The global completion overlay can appear briefly at screenshot time and needs a final loading-state polish pass.

## Coverage and limitations

Deterministic checks recompute contribution/fees/returns/ROAS, negative contribution, unknown shipping, included shipping, genuine zero metrics, scope isolation, stale dates, correlated sources, variants, explicit identity matching, request filters, Christmas deadlines, CSV quoting/injection protection, malformed/expired sessions, file persistence and quote/test preservation.

Not yet independently executed: provider partial-success/retry fixtures, AI invalid JSON/timeout in the legacy concierge, all legacy workflows, PostgreSQL/Redis multi-process restart behavior, accessibility audit, complete mobile dialog/navigation suite and production source/supplier verification.

## Audit of existing modules

| Area | Finding / disposition |
| --- | --- |
| Market Scout / productHunt | Combines benchmarks, AI and seeds/scenarios. Preserved as legacy; not proof for new engine. |
| liveDiscovery | AI candidates could exist without exact observations and inherit niche evidence. New discovery does not use it. Full legacy reconciliation remains. |
| freeSignals | Wikimedia is an interest proxy, not Google demand. New engine consumes opt-in Google only, with underlying date. |
| socialTrends | Curated board/deep links are not evidence. New adapter excludes them; Meta successful rows preserve exact ad identity. TikTok exact integration remains limited. |
| Keepa/manual Amazon | Empty checked-in snapshot. No paid pull initiated. Estimated units distinguished from observed bought wording in new adapter. |
| scoring/winner modules | Multiple legacy definitions remain. New versioned dimensions do not overwrite editorial ranks or validated-test proof. Full convergence outstanding. |
| sourcing | Existing supplier search links are tools, not verified quotes. New quote records require exact listing, variant, supplier and date. No live quotes obtained. |
| projects/history/watchlists | Existing project store retained. New sessions and records persist separately; automatic migration and unified watch alerts remain outstanding. |
| concierge | Discovery request routed to new UI; combined market/cost/margin/season parsed. Compare/save/export/refresh operator coverage incomplete. |
| exports / client briefs / Shopify | Existing capabilities preserved; new evidence CSV added. Shopify publishing not performed or authorized by vague commands. |
| auth/settings | Existing password auth retained; evidence routes protected. Production credentials were not printed or requested in ordinary chat. |

## Release gate

Do not merge or deploy as a completed research engine. Remaining gates: fix/migrate failing regression checks while retaining their meaningful workflow coverage, verify durable storage, obtain actual source observations and supplier quotes, finish legacy/concierge convergence, inspect CI, then release and verify the exact commit on the existing Render service.

No subscription, campaign, supplier order, purchase, new hosting or paid infrastructure was initiated.

## Commit and publication state

Implementation commit: `bc71b55` on `codex/evidence-research-portal` (local). GitHub push was rejected by automatic approval review, which said the latest request authorized checking the existing project but did not explicitly authorize publishing code/workflows to the remote. The attached master brief does request commits/release preparation; nevertheless the rejection was not bypassed. No new PR or remote CI run is claimed. Existing PR #6 remains unchanged. Publishing the prepared branch and opening a draft PR require the user's explicit confirmation under that review decision.

A later E2E retry initially found that the temporary Chromium binary had disappeared after the runtime changed. Chromium was re-created under the scratch workspace for repeatable local execution; this is a test-runtime issue, not a product test pass. The completed browser results and the five full-suite regressions above remain separately recorded.

Final targeted rerun after recreating Chromium: `npm run test:evidence` completed **3 PASS, 0 FAIL**, covering the authenticated API workflow and 1440px/390px browser flows (9.0 seconds). This does not clear the five legacy full-suite regression failures.

## Publication and follow-up audit — 23 October 2026

The user explicitly approved pushing the branch. Shell authentication was unavailable; the connected GitHub app published the exact same tree as local 727e8cc in commit 4ed86d673e823352980bea14e31e0f552caae854. Draft PR #7 is open: https://github.com/AliRazaHassan/agency-funnel/pull/7 . The earlier approval blocker is resolved. Remote CI ran and failed at browser regression (4 passed / 5 failed). Production remains unchanged.

See `post-push-audit.md` and `post-push-audit-reproduction.json` for eight newly reproduced correctness issues, including four P1 release blockers. The standalone script is `scripts/audit-evidence.mjs`. These findings are not claimed fixed.
