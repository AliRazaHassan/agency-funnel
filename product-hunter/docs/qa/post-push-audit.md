# Post-push audit — Signal Desk

Review date: 23 October 2026 (Pakistan).

**Verdict: do not merge or release yet.** Publishing succeeded; the audit found reproducible correctness problems that the existing green unit tests do not cover. No fixes to these new findings are claimed in this audit commit.

## Published state

- Draft PR: https://github.com/AliRazaHassan/agency-funnel/pull/7
- Branch: `codex/evidence-research-portal`
- Audited code commit: `4ed86d673e823352980bea14e31e0f552caae854`
- Remote tree: `29879fd0202e62b31787c3eece7dd10c3e39ec08`, exactly equal to prepared local commit `727e8cc`.
- Shell push could not authenticate. Connected GitHub Git Data tools published the identical tree, preserving PR #6's head as the parent. The remote commit SHA differs from local because the prepared commits were consolidated for transport.
- Production was not merged, deployed or otherwise changed.

## Confirmed findings

| Priority | Finding | Reproduced behavior | Required correction |
| --- | --- | --- | --- |
| P1 | Modeled-status normalization can promote estimates into sales proof | `observation({dataStatus:'MODELED', ...})` becomes `manual`. Positive bought-count data then produces salesEvidence=true and confidence 35. | Normalize statuses case-insensitively, reject unknown labels and preserve modeled/estimated semantics through import. Add API and ranking regressions. |
| P1 | Records can cross market boundaries | With the same explicit identityKey, a UK product receives the US record ID, saved shortlist state and recorded tests. | Namespace record IDs by market and exact identity/variant; provide safe migration. Test US/UK quotes, tests, history and exports independently. |
| P1 | Negative delivery-planning constraints bypass the Christmas deadline | contingencyDays=-100 and testingDays=-100 produce an on-time verdict with a planned order date of 27 March 2027 for a 20 December 2026 delivery target. | Validate nonnegative bounded day counts at request boundary and in the delivery calculator. No order/test date may exceed the delivery target. |
| P1 | Accepted CSV tags crash the research engine | A row with tags=`Christmas,pet` is accepted as a string; ranking throws `(o.tags || []).join is not a function`. | Normalize CSV/string tags to arrays or reject invalid types atomically before persistence. Provide migration for stored malformed rows. |
| P2 | Explicit platform constraints are discarded | parseRequest with base.requiredPlatforms=['amazon'] and no platform in the text returns an empty array. | Merge/preserve structured filters unless the user explicitly changes them. Test combined text and structured constraints. |
| P2 | Parallel first reads fail in development file storage | Promise.all([store.init(), store.read(), store.read()]) on a fresh directory produces two ENOENT failures. The UI requests status/state concurrently. | Share one initialization promise; set the ready mode only after successful file/database/Redis setup. Retry cleanly after failure. |
| P2 | Contradictory recent observations are not surfaced | Same exact source/metric has bought_count=100 yesterday and bought_count=0 today; salesEvidence remains true without a conflict or decline warning. | Preserve history, use explicit latest comparable observations and surface contradictory/declining evidence in momentum, risk and verdict explanations. |
| P2 | Christmas deadline leaks into general research | delivery(quote,{}) always defaults to 2026-12-20 even when no Christmas season was requested. | Require an explicit delivery target for nonseasonal research, or return unverified. Set Christmas defaults only when that mode is selected. |

Run `node scripts/audit-evidence.mjs` to reproduce these findings without changing application data. Actual output is saved in `post-push-audit-reproduction.json`. All source records in that script are synthetic example.com fixtures, not live product evidence. The initialization test uses and removes its own temporary directory.

## Additional code-review risks (not independently reproduced)

- Product update API persists economics before validating them. A negative or invalid stored value can make subsequent ranking throw for the entire session. Validate updates before writing.
- Quote readiness accepts missing destination/currency information. Dollar economics and shipping readiness need explicit market/currency and matching-variant checks.
- On mount, `/state` can restore the most recent saved result while a new auto-research request is in flight. Form controls and visible results can temporarily disagree; bind result restoration and actions to a request/session revision.
- Refresh concurrency/rate limits are process-local. They do not coordinate across multiple app instances or survive restarts.
- The legacy discovery/scoring/concierge paths remain separate. A green new-workflow test does not validate all existing features or mean full convergence is complete.

## Verification

- Reran unit suite on published code: **61 PASS, 0 FAIL, 0 SKIP**.
- Reran logic verification: **PASS**.
- Existing targeted evidence API/desktop/mobile run: **3 PASS**; the full regression was rerun during this audit and its final counts are recorded below when available.
- GitHub Actions evidence workflow: checkout, setup, clean npm ci, production build and Chromium installation all succeeded; browser regression was still running at initial inspection.
- GitHub Actions Christmas workflow completed with **failure**. This is not reported as a green CI run.
- Postgres/Redis runtime integration is still unverified. No production datastore or source credentials were read or printed.
- The previous actual provider run returned zero usable observations. This audit did not create a supported winning-product shortlist.

Release gates: fix the P1 findings with regression coverage; resolve the full browser suite failures; verify persistent storage; obtain actual source observations and supplier quotes; finish legacy/concierge reconciliation; inspect successful CI; only then release to the existing Render service and verify its exact commit.

### Final executed results

- Local production build rerun: **PASS** (unit/logic/build pipeline).
- Local full browser regression rerun: **4 PASS, 5 FAIL, 0 SKIP, 0 flaky**, duration 82.6 seconds. Two obsolete Christmas UI expectations fail; legacy auth landing expectation fails; the legacy workflow and loading-overlay scenarios time out waiting for the former landing button. These failures are retained, not suppressed.
- Remote evidence workflow **39979090088: FAILED** at full browser regression. Logs independently confirm **4 passed / 5 failed**. Installation, build and browser installation passed. Failure screenshots were uploaded successfully: https://github.com/AliRazaHassan/agency-funnel/actions/runs/39979090088/artifacts/12513415290
- Remote Christmas workflow **39979089979: FAILED**. No all-green CI claim.

The eight deterministic audit findings above are additional to the five browser failures. They were reproduced on the published code with synthetic records and remain unfixed in this audit-only handoff.
