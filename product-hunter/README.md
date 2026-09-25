# Signal Desk (Product Hunter)

Private AI market research → ranking → product hunt → Shopify CSV.

## Local

```bash
cd product-hunter
cp .env.example .env
# set APP_PASSWORD=your-secret
npm install
npm run dev
```

- UI: http://localhost:5177  
- API: http://localhost:8787  

Without `APP_PASSWORD`, auth is open (local only). Production **requires** it.

## Keepa (live Amazon stats)

See [docs/KEEPA.md](docs/KEEPA.md).

1. Sign up at [keepa.com](https://keepa.com) → open [API](https://keepa.com/#!api) → buy a plan → copy access key  
2. Set `KEEPA_API_KEY` in `.env` or Render Environment  
3. Tell the agent to wire live Keepa lookups (paid API; not free)

Without Keepa you still get **per-source cost + shipping days** (AutoDS / Zendrop / CJ / AliExpress estimates) when you click a product and select a source.

## Render deploy

1. Push repo to GitHub  
2. Render → **New** → **Blueprint** → select repo (`render.yaml`)  
   Or Web Service: root `product-hunter`, build `npm install && npm run build`, start `npm start`  
3. Set env vars:
   - `APP_PASSWORD` (required)
   - `SESSION_SECRET` (auto if Blueprint)
   - `OPENAI_API_KEY` (optional)

App URL will serve the built UI + API together (password gate on open).

## Auth

Cookie session (`ph_session`, HttpOnly). Login via `/api/auth/login`.
