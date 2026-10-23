# Christmas 2026 research run — US

Run recorded in `christmas-live-run.json`. User-facing review date: 23 October 2026 (Pakistan). Raw timestamps are UTC from the execution host.

Starting market: **US**, explicitly chosen as the initial market. Constraints: Christmas 2026, landed cost at most $15, pre-ad contribution margin at least 60%. Default delivery planning target is 20 December, with five contingency days and seven testing days; these are editable planning assumptions in the API, not carrier cutoffs.

**Result: 0 supported products. No verified winners or supplier quotes.**

The actual provider adapter run produced zero usable original observations:

- Amazon snapshot is empty.
- Meta did not return usable exact, dated observations.
- TikTok did not return usable exact, dated observations.
- Google Trends is disabled in the local environment.

No product identities, sales metrics, supplier prices or delivery dates were invented to fill this list. The existing six-product Christmas list is editorial context, not the output of this research engine. It is no longer the Christmas tab's discovery surface.

The deterministic E2E ornament fixture is a synthetic test record on example.com; it is NOT a researched product or recommendation. No fixture records were uploaded to production.

Next requirement: provide working legitimate source access or dated original evidence imports and exact supplier quotes. Then run the same portal request again. Missing unit costs/shipping/fees/returns keep economics incomplete; strict cost/margin filters correctly exclude unknown inputs. Without those filters, dated product observations can appear as research candidates with missing-proof actions, rather than being called winners.

This run was executed locally against real provider attempts and the checked-out snapshots. It was NOT an authenticated production research run. Production remains on commit `d6e23616ba2ccf5da48fd66b7243d5e61327e193`; no release was performed.

## Release update — 23 October 2026

The audit-fix release is now live on the existing service at commit 8429a745d6a5fd74508d9804fea48cf3916be8d6 (PR #7). The earlier production-baseline paragraph above describes the time of the original research run. This deployment does not change that run's honest outcome: no supported product shortlist or supplier quote was obtained. Current verification is in `../qa/research-portal-report.md`.
