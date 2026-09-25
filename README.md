# Agency Funnel

**Separate from** Shopfront Italia / city-biz-directory.

## Signal Desk (main app)

Password-protected research workspace: market scout → marketing/AOV ranking → product hunt → Shopify CSV.

```bash
cd product-hunter
cp .env.example .env   # set APP_PASSWORD
npm install
npm run dev
```

- Local UI: http://localhost:5177  
- Deploy: [product-hunter/README.md](product-hunter/README.md) + [`render.yaml`](render.yaml)

## Toolkit folders

| Folder | Role |
|--------|------|
| `model-1-shopify/` | Niches + Pet store checklist |
| `model-2-automation/` | Make.com / WhatsApp blueprint |
| `model-3-pseo/` | pSEO keywords + page template |
| `action-plan/WEEK-1.md` | Week-1 plan |

```bash
npm run generate:all
```
