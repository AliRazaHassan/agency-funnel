# BIGDEALBIGTHINGS Christmas pet sourcing audit — 2026-10-29

US / USD, dropshipping only. These are catalog candidates, not researched winners. **No product currently passes launch validation.** No Shopify product was imported or recreated. Collective import remains a merchant action; account eligibility, installation and supplier terms were not accepted on the merchant's behalf.

## Candidate decisions

| Original candidate | Public retail reference | Audit decision |
| --- | --- | --- |
| SodaPup Christmas Tree rubber treat dispenser | $15.99 | HOLD. Exact Large / Green rubber product located. Supplier-level dropshipping route confirmed; exact wholesale quote, inventory, US shipping and recent sales still missing. |
| SodaPup Candy Cane nylon toy | $12.99 | HOLD. Exact red nylon listing located. Extracted page contains both Sold out and Add to cart; inventory unknown. Wholesale economics and recent demand unverified. |
| As You Wish Scribble Merry Christmas bandana | $8.00 | HOLD. Exact Black / S variant, SKU 66-25-15 SMBK, located. Stock, account-specific dropshipping, shipping, economics and demand unverified. |
| Doot's Candy Canes collar | $22.00 in prior Collective shelf | HOLD. Shelf price is not a wholesale quote. Exact primary supplier variant and current stock not independently verified. |
| DDPaws Christmas Plaid Set | $33.00 in prior Collective shelf and indexed collection | HOLD. Exact size / pieces must be chosen. Identical review totals appear on many different sets; do not attribute them as product-specific demand. No account-specific dropship price, lead time or recent sales proof. |
| VIP Digital Presence Christmas plush / squeak toy | $12.50 in prior Collective shelf | EXCLUDE from launch shortlist pending exact primary supplier URL, SKU, material / size, stock, dropship terms and delivery verification. |

The first three exact supplier pages are saved in the companion JSON for manual import as **supplier / catalog_price**, with provenance and limitations. The other three are not inserted as exact-product evidence because a verified exact variant source is missing.

## Primary sources reviewed

- https://sodapup.com/products/mkb-christmas-tree-durable-rubber-chew-toy-treat-dispenser-large-green — Large / Green, retail $15.99; cumulative reviews are not recent unit sales.
- https://sodapup.com/products/sp-candy-cane-chew-toy-red — retail $12.99; mixed stock cues; no stock claim made.
- https://sodapup.com/pages/become-a-wholesaler?view=sp-dropship — supplier explicitly offers dropshipping through Collective, TopDawg, Doba and ShopDot. This does not establish this store's eligibility or agreed cost.
- https://sodapup.com/policies/shipping-policy — Colorado warehouse; typical retail processing 1–2 business days, transit variable and not guaranteed. Retail policy is not a negotiated dropship quote.
- https://asyouwishapparel.com/products/christmas-dog-bandana-scribble-merry-38473 — Black / S $8.00; cotton; up to 15-inch neck. No fulfillment promise inferred.
- https://ddpaws.com/collections/plaid-set — indexed Christmas Plaid Set $33.00; current collection ordering changes. Variant, composition and review attribution remain unresolved.

Public pages were retrieved through web search on October 29. Some underlying snapshots were crawled October 28; imported catalog observations use that conservative underlying date. Prices may change. No review count, seller-wide sales badge, historical review or catalog availability was treated as dated product sales.

## Validation requirements still missing

For each exact variant: recent attributable product sales; independent demand corroboration; competition observations; supplier agreement and verified stock; US destination quote with processing and transit times; wholesale item price and shipping; fees, returns and advertising CPA. Retail prices are not wholesale costs and must not populate landed-cost fields. Profit and Christmas delivery remain **unknown**, not zero and not guaranteed.

## Feed blocker and implementation verification

The last authenticated automatic collection failed at Apify account verification with HTTP 401 (invalid token). No actor was launched. This credential cannot be reconstructed from public sources. Google Trends previously returned HTTP 429; Meta and Amazon did not supply dated exact-product observations. The supplier import feature does not repair or conceal those provider failures.

Supplier catalog records are now accepted with a separate platform. Only non-negative catalog prices and integer cumulative review counts are accepted. Supplier records cannot establish sales, attention, competition, demand platform coverage or independent demand sources, including misleading legacy metrics. Public catalog imports never populate a supplier quote or economics automatically.

Local validation: 89 unit tests and logic verification passed; production build passed; focused authenticated supplier import/persistence regression passed. Additional CI and deployment results are recorded in the pull request.
