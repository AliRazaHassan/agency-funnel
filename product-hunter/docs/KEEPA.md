# Keepa — keys & pricing

## Two different Keepa products

| Product | What it is | Price (typical) |
|--------|------------|------------------|
| **Keepa Pro** (website) | Manual Amazon research in browser | **~€29/mo** (or ~€290/yr) |
| **Keepa API** | Live data for *our app* (JSON) | **Starts ~€49/mo** — no free API tier |

Pro ≠ API. For Signal Desk live Amazon stats you need the **API**.

## Keepa API plan prices (token rate)

From Keepa’s published API plans (verify at checkout — can change):

| Tokens / minute | Approx. monthly price |
|-----------------|------------------------|
| 20 (starter) | **€49** |
| 60 | **€129** |
| 250 | **€459** |
| 500 | **€879** |
| 2,000 | **€2,499** |
| 10,000 | **€11,099** |

- Tokens refill every minute; unused tokens expire after ~60 minutes  
- **1 ASIN product request ≈ 1 token** (offers/search cost more)  
- Docs: https://keepa.com/#!api and https://keepa.com/api-docs/plans-tokens.html  

For early Signal Desk use, **€49 / 20 tokens/min** is usually enough to test.

## How to get a key

1. https://keepa.com → account  
2. https://keepa.com/#!api → choose API plan → pay  
3. Copy access key → set `KEEPA_API_KEY` in `.env` / Render  
4. Tell the agent to wire Keepa into product cards  

## Without Keepa (free for users)

Signal Desk still gives **trusted free** signals:

| Source | Cost | What you get |
|--------|------|----------------|
| **Wikimedia Pageviews** | $0, no key | Live public interest proxy |
| **Google Trends** | $0 when reachable | Relative search interest (may fail on cloud IPs) |
| **Cited industry totals** | $0 | Modeled niche $ (APPA etc.) — labeled as models |

These are **not** Amazon sold units / BSR. That still needs Keepa API.

We will **not** invent Amazon sales volume.
