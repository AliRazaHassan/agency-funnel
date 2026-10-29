# Signal Desk → BIGDEALBIGTHINGS

Target: `bigdealbigthings-vcqncbcf.myshopify.com`, USD. Existing Render service: `srv-dar80jbncjis73cg2c00`.

## What is ready

- Target domain saved to the existing Render service. A deployment with that configuration became live.
- Same-organization Dev Dashboard app authentication via `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`, exchanged server-side for an expiring token. The returned expiry is honored and concurrent requests share one exchange. Existing `SHOPIFY_ADMIN_TOKEN` installations remain supported.
- Secret-bearing calls use bounded timeouts and reject redirects. Only permanent myshopify.com domains are accepted. Status/verification responses never return credentials or tokens.
- Authenticated `POST /api/shopify/verify` checks the exact store, USD currency and installed product-write scope without creating a product. Settings distinguish configured credentials from a verified connection.
- Product creation remains DRAFT. Mutations are not automatically retried after ambiguous or rejected responses, avoiding accidental duplicate drafts.

## Exact authorization needed

The Shopify Dev Dashboard form is prepared for **Signal Desk - BIGDEALBIGTHINGS**, App URL `https://signal-desk-6for.onrender.com/`, non-embedded, scopes `read_products,write_products`. No order/customer/payment access is requested.

Automatic approval review rejected clicking Create app because the specific `write_products` permission had not been explicitly authorized. No app was created by that rejected attempt. App creation, store installation and live API credential verification remain pending user approval.

After approval, create/install the app under the same organization as the target store. Transfer its client ID and client secret directly to the existing Render service's environment, preserving unrelated variables. Never put credentials in chat, research fields, Git or logs. Deploy the backend change and environment, then use Verify Shopify connection to verify real store access. A client from another organization must use the appropriate OAuth installation flow instead; do not try to bypass organization checks.

## Dropshipping boundary

The store's installed-app read returned Flow and Shopify ChatGPT MCP App only. A supplier app was not installed at this check. Product creation in Shopify does not connect supplier variants, synchronize stock, place supplier orders or fulfill customer orders. A chosen dropshipping supplier account/app and exact variant mapping are still needed. Live trending discovery remains separately blocked by Apify HTTP 401 and direct Google HTTP 429 recorded in the QA report. No product is labeled verified merely because it can be exported.

## Validation actually executed

- 95/95 unit tests passed (8 new connection tests), 0 failures/skips.
- Independent logic verification and production build passed.
- New connection browser/API checks: 3/3 passed, including 1440px and 390px configured→verified rendering and authentication/missing-credential rejection.
- New verification GraphQL query validated against Admin API 2026-07.
- Token exchange, expiry, wrong-store/currency/scope rejection, no secret echoes, legacy-token compatibility and no automatic mutation retry were tested with deterministic provider responses. These are not claims of live Shopify authorization.
- No actual store product was created by these tests.

Current Shopify references:
- https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard
- https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant?lang=node
