# Signal Desk audit fixes and release

Date: 23 October 2026 (Pakistan). Supersedes the unresolved findings status in the historical post-push audit.

## Corrections

- Evidence statuses normalize case-insensitively. Modeled/estimated observations stay modeled; unknown statuses reject. Earlier stored tag/status formats are repaired conservatively during reads.
- Product record IDs include market and exact identity. Legacy records migrate only when a single market is unambiguous; original records are retained for recovery. Ambiguous legacy records are not copied into either market.
- Negative/excessive delivery-planning days reject. General research requires an explicit target; Christmas mode alone supplies its seasonal default. Quotes require destination and USD currency before being accepted by the USD calculator.
- CSV tags normalize to arrays before persistence; invalid types reject. Legacy CSV tag strings no longer crash ranking.
- Structured platform filters survive natural-language parsing.
- Concurrent initialization shares one completed promise; failed initialization can retry without exposing partially initialized storage.
- Latest comparable observations determine sales evidence, including genuine zero. Contradictory/zero-after-positive recent observations are surfaced for review without discarding history.
- Invalid economics are rejected before storage writes. Supplier selection synchronizes the editor with that variant's economics.
- Saved-session restoration cannot overwrite an in-flight concierge request; form controls restore with the selected session.
- Automatic layout scrolling no longer immediately dismisses the analyst context menu. Explicit scrolling/pointer actions still dismiss it. Navigation cancels old smooth scrolls.

## Verification and test changes

70 unit tests passed, logic verification passed, production build passed. Two real isolated Redis/production-mode integration tests passed: concurrent writes plus client reconnect retain records; production API smoke verifies the auth wall, login and research/provider reads without exposing credentials. The Redis process used only local test DBs 14/15, not the user's store.

The old Christmas UI assertions were intentionally migrated from six editorial cards to the same research engine: selected season, UK market, $15 cost and 60% margin must reach the actual API, missing evidence yields no padded candidates, export works and layouts fit desktop/mobile. The legacy workflow still tests scout, hunt, export, radar, concierge, supplier validation, recorded tests, Shopify missing-connection handling, project save/reopen and settings. Its navigation selectors now match the current UI. No failed checks were skipped or disabled. A separate deterministic test reproduces the real right-click context-menu path.

Both default and CI Playwright entry points now use isolated evidence, project and legacy tracking storage. Production-mode tests use an isolated Redis instance. CI provisions only a temporary Redis service inside the GitHub runner; no new Render resource or paid service is created.

Full browser and remote CI results are recorded below after execution. No production completion is claimed until the existing Render deployment is live and verified.

## Deployment verification

The public health endpoint now reports the deployed Render commit and actual research storage mode. On production startup, a read-only localhost smoke test uses the existing environment password internally to verify unauthenticated blocking, login, provider status and saved research reads. Only boolean outcomes are exposed; no credentials/cookies/source data are logged or returned.

Existing Render service: srv-dar80jbncjis73cg2c00. Existing Key Value: product-hunter-kv. Its current free plan reports persistenceMode=off: it preserves data across app-process reconnects but is not a durable database backup. No plan change or new infrastructure was authorized or performed. Live source coverage and supplier quote quality remain separate from the correctness fixes; no verified winning-product claim is made.

### Follow-up loading-state regression

A full browser run exposed saved-session hydration racing with input entry, producing an appended query and detaching result cards. Research inputs now remain disabled until the initial saved-state read finishes; async restoration cannot overwrite an active request. A deterministic delayed-state browser test covers this exact trigger.

## Final release outcome

- Unit 70/70, isolated Redis/production-auth integration 2/2, full browser/API regression 11/11; zero failed/skipped/flaky checks in the final runs.
- Both CI workflows green on 04ded449a63d7559f1befa63da5f1145a1348928: runs 39990606659 and 39990606658.
- PR #7 merged; deployed commit 8429a745d6a5fd74508d9804fea48cf3916be8d6.
- Existing Render deploy dep-dbdp3iui0phs73ba4obg became LIVE at 2026-10-23T16:57:25Z.
- Production public health matches the deployed SHA, reports Key Value storage and all four authenticated startup checks true. Render logs independently report `Authenticated startup smoke: PASS`.

The failed original audit and intermediate runs remain historical records. The final green suite includes supplier/ad-test/project workflows; it does not certify external product sales or provider access.
