# Free-source integration — 24 October 2026

Implemented: authenticated read-only Apify dataset sync using APIFY_TOKEN, native TikTok JSON import without a token, date/URL/market validation, separate discovery observations, free Google Trends collection enabled by default (disable with ENABLE_GOOGLE_TRENDS=0), exact query provenance URLs, and links to public research tools.

Budget: these endpoints never start Actors, subscribe, upgrade, schedule runs, or buy credits. Dataset sync reads existing results only. Free credits remain on Apify. Automatic Actor execution is deliberately not implemented without a verified free-account budget integration.

Evidence: TikTok publication must be within seven days; source location must match selected market. A creation country is not buyer geography. Videos remain niche discovery; no SKU matching, orders or winners inferred. Missing market records are rejected. Native JSON is limited to 2 MB in the UI and 1000 records server-side. The existing authentication wall protects sync.

Validation: 73 unit tests, logic check and production Vite build pass. Five evidence desktop/mobile/API tests pass, including rejection of old/unknown-market records and confirmation that video discovery is not promoted to product proof. The first new browser-test attempt used obsolete login selectors; those were corrected and all five rerun successfully.

Activation: set APIFY_TOKEN as a server-side Render environment variable to read private datasets. No token is committed or returned to the client. Without that secret, native JSON import remains usable. Meta's official API still requires its existing credentials and has coverage limits; public Meta links and manual evidence remain available. Google cloud requests can be unavailable/rate limited; no fallback metrics fabricated.

Not claimed: successful production Apify authenticated sync, current winning products, supplier margin verification, complete automated Meta/TikTok discovery, or long-term storage backups.
