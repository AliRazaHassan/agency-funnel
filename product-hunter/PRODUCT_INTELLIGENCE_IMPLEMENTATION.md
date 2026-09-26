# Product Intelligence V2

This upgrade preserves the existing Product Hunter workflow (scout, hunt, sourcing/profitability, projects, Amazon/Keepa/manual inputs, social signals and Shopify/Matrixify export) and adds a separate evidence-based trend intelligence layer.

## Trend Score
- Amazon demand: 25%
- TikTok momentum: 25%
- Meta ad activity: 20%
- Google search momentum: 15%
- Cross-platform growth: 10%
- Data confidence: 5%

Trend Score does not replace the existing profitability/winning score.

## Added intelligence
- 7/14/30 day momentum calculations
- Acceleration detection
- DISCOVERED / EMERGING / ACCELERATING / STABLE / DECLINING lifecycle states
- SATURATING flag when advertiser growth materially outpaces observed demand
- Data confidence (HIGH/MEDIUM/LOW)
- Evidence-based Why Trending output
- Market/price/trend/status filtering
- Product Radar grouping

## API
- GET /api/intelligence/products
- POST /api/intelligence/search
- POST /api/intelligence/analyze
- POST /api/intelligence/why-trending
- GET /api/intelligence/radar

## Data integrity
The intelligence layer never treats missing metrics as verified sales. Provider data should identify LIVE, RECENT, ESTIMATED, MANUAL, MOCK or UNAVAILABLE status. AI-generated candidates and seed data must not be presented as live platform observations.

## Preserved
- Shopify/Matrixify CSV export
- Product hunt
- Existing profitability scoring
- Sourcing
- Projects
- Client brief
- Authentication
- Keepa/manual Amazon workflow
- Social trends workflow

## Next provider phase
Wire normalized Amazon, TikTok Creative Center, Meta Ad Library and Google Trends observations into the new `signals`, `history`, `dataStatus` and evidence fields. Keep source URL and collection timestamp for each observation.
