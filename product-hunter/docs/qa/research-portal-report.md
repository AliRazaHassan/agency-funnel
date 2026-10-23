# Signal Desk research portal — verified release

Released 23 October 2026 (Pakistan) to the existing service. Audit fixes are deployed; live data coverage limitations remain explicit.

## Release identity

- Production: https://signal-desk-6for.onrender.com/
- Repository: AliRazaHassan/agency-funnel; application: product-hunter.
- PR #7: https://github.com/AliRazaHassan/agency-funnel/pull/7 (merged).
- Tested PR head: 04ded449a63d7559f1befa63da5f1145a1348928.
- Deployed merge commit: 8429a745d6a5fd74508d9804fea48cf3916be8d6.
- Existing Render service: srv-dar80jbncjis73cg2c00.
- Deploy: dep-dbdp3iui0phs73ba4obg, status LIVE, finished 2026-10-23T16:57:25Z.
- Existing Key Value storage reused. No duplicate hosting or paid resources created.

## Executed checks

| Check | PASS | FAIL | SKIP |
| --- | --- | --- | --- |
| Unit/invariant suite | 70 | 0 | 0 |
| Isolated Redis and production-mode authenticated integration | 2 | 0 | 0 |
| Full desktop/mobile/API Playwright regression | 11 | 0 | 0 |
| Logic verification | PASS | — | — |
| Clean install and production build | PASS | — | — |
| Production localhost authenticated startup smoke | 4 checks | 0 | 0 |

Full local browser run: 95.0 seconds, zero flaky tests. It includes the original scout/hunt, CSV export, radar, concierge, supplier verification, recorded ad tests, Shopify missing-connection behavior, project save/reopen, settings, auth and centered-loader checks. New checks cover Christmas constraints on desktop/mobile, evidence import/filter/export, original zero values, and delayed saved-state hydration. No failed tests were skipped or disabled. Obsolete selectors were updated to current accessible controls, and swallowed close-button exceptions were removed.

GitHub CI for the exact tested head:

- Evidence research validation: SUCCESS — https://github.com/AliRazaHassan/agency-funnel/actions/runs/39990606659
- Christmas research validation: SUCCESS — https://github.com/AliRazaHassan/agency-funnel/actions/runs/39990606658

Production `/api/health` returned the exact deployed revision, `researchStorage=keyvalue`, `authRequired=true`, and all four verification booleans true: unauthenticated research blocked, login accepted, provider/status read accepted and saved-research read accepted. The authenticated smoke ran inside the deployed process using the existing environment password only on localhost; no credentials or cookies were exposed.

## Corrections delivered

The eight reproduced audit issues are fixed with regression coverage: modeled-status case normalization; market-scoped record IDs and conservative migration; negative delivery-day rejection; CSV tags; preservation of structured source filters; concurrent storage initialization; latest comparable observations/zero handling; and Christmas deadlines isolated to Christmas mode.

Additional fixes prevent invalid economics writes, synchronize variant economics, protect research inputs during saved-session hydration, retain the analyst context menu through automatic layout scrolls, cancel obsolete navigation scrolls and expose explicit close controls. Settings distinguish Key Value from ephemeral file storage. Production startup requires configured persistent external storage and exposes deployed revision/read-only verification outcomes.

New workflow: authenticated evidence import/manual observations, provider health, exact product identities, niche grouping, independent evidence dimensions, transparent ranking/verdicts, supplier quote selection, contribution/CPA/ROAS, delivery planning, shortlist/history/test records and visible-session CSV exports. Christmas is a seasonal constraint on that same workflow. Legacy scenario/scoring tools remain available separately and are not evidence for new rankings.

## Source and storage limits

The latest actual provider smoke produced zero usable observations and therefore zero supported products. Checked-in Amazon/social snapshots were empty; local Google Trends was disabled; Meta/TikTok supplied no acceptable exact, dated structured observations. Production health still reports no Keepa key and an empty Amazon snapshot. No SKU sales, quotes, winning products or profit were invented. The synthetic example.com fixtures used by tests were never uploaded to production.

The existing free Key Value instance reports persistenceMode=off. App/client restart preservation is tested, but this is not a database backup or a guarantee against Key Value server data loss. No paid plan change was made. Postgres runtime integration, automated fuzzy cross-platform identity review, scheduled refresh/backoff, complete legacy/concierge schema convergence and successful live-source/supplier verification remain outside the completed audit-fix release. New discovery uses deterministic source identities, not AI-generated proof.

The historical failures and audit remain in `post-push-audit.md` and `post-push-audit-reproduction.json`. Current fixed reproduction is `post-fix-audit-reproduction.json`; implementation details are in `fix-and-release-report.md` and `../research/provider-capabilities.md`. This release is not a claim that every requirement of the original research-engine master brief is complete.

External post-live probes also passed: `/api/health` 200 with exact revision; unauthenticated `/api/research/state` and `/api/research/status` both 401; homepage 200 and its served JavaScript contains the new evidence research UI. Sanitized results: `production-verification.json`.
