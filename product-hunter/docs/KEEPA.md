# Keepa — one-time data (recommended) vs live API

## What we use day-to-day (free)

| Source | Cost | What you get |
|--------|------|----------------|
| **Wikimedia Pageviews** | $0 | Live public interest |
| **Cited industry totals** | $0 | Modeled niche $ (labeled) |
| **Google Trends** | $0 opt-in (`ENABLE_GOOGLE_TRENDS=1`) | Relative search interest |

No monthly Keepa required for Scout / Hunt / Winning scorecard.

### Free Amazon proof (no Keepa, no scrape)

1. Hunt a product → open detail  
2. Click **Open Amazon search**  
3. Copy **ASIN** + “X bought in past month” from the listing  
4. Paste into **Add Amazon one-time data** → Save  

We do **not** scrape Amazon (ToS / block risk). Manual paste is the free one-time path.

## Amazon proof = one-time Keepa dump (paid optional)

Keepa API has **no free tier** (~€49/mo starter). For Signal Desk you do **not** need it forever:

1. Buy Keepa API for **one month** (or use tokens while testing)  
2. Pull ASINs into a local snapshot file  
3. **Cancel** the plan  
4. App keeps reading `server/data/keepa-snapshot.json`

### Pull command

```bash
# in product-hunter/
# set KEEPA_API_KEY in .env for this session only
npm run keepa:pull -- B0XXXXXXXXX B0YYYYYYYYY --niche="Pet Supplies"
```

Or paste Keepa product JSON into `server/data/keepa-snapshot.json` under `products[]`.

### Snapshot fields we use

- `asin`, `title`
- `monthlySold` (Amazon “bought in past month” bracket)
- `stats.avg30` / `current` → sales rank + price
- Optional: `niche` for matching

Hunt matches snapshot rows by **ASIN** or **fuzzy title**, then Winning scorecard can use real Amazon sold/BSR when matched.

## Live key (optional)

`KEEPA_API_KEY` is only needed for `npm run keepa:pull`.  
You do **not** need the key on Render for daily free-mode use — just deploy the snapshot file if you want Amazon rows in production.

## Pricing reference (API)

| Tokens / minute | Approx. monthly |
|-----------------|-----------------|
| 20 (starter) | **€49** |
| … | higher tiers |

Pro website ≠ API. Docs: https://keepa.com/#!api
