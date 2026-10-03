# Signal Desk

Complete research workspace for turnkey Shopify stores + agency offers.

## Product modules

| Module | What it does |
|--------|----------------|
| **Home** | Saved projects, start new session |
| **Desk · Scout** | 10 ranked Shopify niches + TikTok/Meta trending board |
| **Desk · Hunt** | 50+ SKUs, costs, links, PASS/WATCH/FAIL scorecard |
| **Amazon paste** | Free one-time Amazon ASIN / bought-in-past-month notes |
| **Projects** | Save / resume scout+hunt packages |
| **Client brief** | Download HTML research brief for clients |
| **Shopify export** | Matrixify CSV + direct Shopify draft when connected |
| **Seasonal Radar** | Upcoming commerce events (Christmas, Black Friday, Valentine’s, etc.) + event-fit research |\n| **Product imagery** | Wikimedia Commons lookup with attribution + safe fallback |\n| **Growth toolkit** | Competitor searches, creative hooks, break-even CPA economics + Shopify launch kit |\n| **Settings** | Module + data-mode status |

## Run locally

```bash
cd product-hunter
cp .env.example .env   # set APP_PASSWORD
npm install
npm run dev            # API :8787 + Vite :5177
```

Open **http://127.0.0.1:5177/** (prefer `127.0.0.1` over `localhost` on Windows).

## Production (Render)

Blueprint: `render.yaml` · root `product-hunter` · set `APP_PASSWORD`.

## Data honesty

- Free: Wikimedia interest + cited industry models + social creative boards  
- Amazon units: manual paste or optional one-time Keepa snapshot (`docs/KEEPA.md`)  
- No Amazon/TikTok/FB shop scraping  

## Scripts

```bash
npm run keepa:pull -- B0XXXXXXXXX   # optional one-time Keepa dump
```
