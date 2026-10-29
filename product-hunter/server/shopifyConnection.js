const API_VERSION = '2026-07';
const CONNECTION_QUERY = `query SignalDeskConnection {
  shop { name myshopifyDomain currencyCode }
  currentAppInstallation { accessScopes { handle } }
}`;

// Same-organization Dev Dashboard apps exchange their credentials for expiring
// tokens. Credentials and tokens stay server-side and are never returned by status.
export function createShopifyConnection(env = process.env, request = fetch, clock = Date.now) {
  let cached, pending;
  function config() {
    const store = String(env.SHOPIFY_STORE_DOMAIN || '').trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/$/, '');
    const clientId = String(env.SHOPIFY_CLIENT_ID || '').trim();
    const secret = String(env.SHOPIFY_CLIENT_SECRET || '').trim();
    const token = String(env.SHOPIFY_ADMIN_TOKEN || '').trim();
    const validStore = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(store);
    const mode = clientId && secret ? 'client_credentials' : token ? 'admin_token' : null;
    return { store, clientId, secret, token, mode, validStore };
  }
  function status() {
    const c = config();
    return { configured: !!(c.validStore && c.mode), store: c.store || null,
      apiVersion: API_VERSION, authMode: c.mode, verified: false,
      requiredScopes: ['read_products', 'write_products'] };
  }
  async function accessToken() {
    const c = config();
    if (!c.validStore) throw new Error('Set a valid permanent SHOPIFY_STORE_DOMAIN (*.myshopify.com).');
    if (!c.mode) throw new Error('Shopify is not connected. Install the Signal Desk app, then set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in Render. Existing admin-token integrations can use SHOPIFY_ADMIN_TOKEN.');
    if (c.mode === 'admin_token') return c.token;
    const key = JSON.stringify([c.store, c.clientId, c.secret]);
    if (cached?.key === key && clock() < cached.expiresAt - 60000) return cached.token;
    if (pending?.key === key) return pending.promise;
    const promise = (async () => {
      const response = await request(`https://${c.store}/admin/oauth/access_token`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: c.clientId, client_secret: c.secret }),
      });
      if (!response.ok) throw new Error(`Shopify authorization failed (HTTP ${response.status}). Verify app installation, same organization and server credentials.`);
      const body = await response.json();
      const seconds = Number(body.expires_in);
      if (typeof body.access_token !== 'string' || !body.access_token || !Number.isFinite(seconds) || seconds <= 60)
        throw new Error('Shopify returned an invalid or expired authorization response.');
      cached = { key, token: body.access_token, expiresAt: clock() + seconds * 1000 };
      return cached.token;
    })();
    pending = {key, promise};
    try { return await promise; } finally { if (pending?.promise === promise) pending = null; }
  }
  async function graphql(query, variables = {}) {
    const token = await accessToken();
    const c = config();
    const response = await request(`https://${c.store}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': token},
      body: JSON.stringify({query, variables}),
    });
    if (!response.ok) {
      if (response.status === 401) cached = null;
      // Never automatically retry a product mutation: a lost response can follow
      // successful creation and retrying could duplicate a supplier product.
      throw new Error(`Shopify API failed (HTTP ${response.status}). Recheck the connection before retrying a product import.`);
    }
    const body = await response.json();
    if (body.errors?.length) throw new Error('Shopify rejected the API operation. Verify the installed app scopes and API permissions.');
    return body;
  }
  async function verify() {
    const body = await graphql(CONNECTION_QUERY);
    const shop = body.data?.shop;
    const scopes = body.data?.currentAppInstallation?.accessScopes?.map(s => s.handle) || [];
    if (shop?.myshopifyDomain?.toLowerCase() !== config().store) throw new Error('Shopify returned a different store; connection not verified.');
    if (!scopes.includes('write_products')) throw new Error('The installed Signal Desk app needs write_products permission.');
    if (shop.currencyCode !== 'USD') throw new Error('Signal Desk prices use USD; verify the Shopify store currency before importing.');
    return { ...status(), verified: true, name: shop.name, currency: shop.currencyCode, scopes, checkedAt: new Date(clock()).toISOString() };
  }
  return {status, graphql, verify};
}
