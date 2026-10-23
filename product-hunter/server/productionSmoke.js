// Read-only authenticated checks from inside the deployed process. Secrets never leave localhost.
export async function verifyProductionApi(baseUrl, password) {
  const result = {
    unauthenticatedBlocked: false,
    login: false,
    providerStatus: false,
    storedResearch: false,
  };
  try {
    const options = { signal: AbortSignal.timeout(10000) };
    const locked = await fetch(baseUrl + "/api/research/state", options);
    result.unauthenticatedBlocked = locked.status === 401;
    await locked.body?.cancel();
    const login = await fetch(baseUrl + "/api/auth/login", {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    result.login = login.ok;
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    await login.body?.cancel();
    if (!cookie) return result;
    const headers = { Cookie: cookie };
    const status = await fetch(baseUrl + "/api/research/status", {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    const metadata = await status.json();
    result.providerStatus =
      status.ok && ["postgres", "keyvalue"].includes(metadata.storage);
    const state = await fetch(baseUrl + "/api/research/state", {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    result.storedResearch = state.ok;
    await state.body?.cancel();
  } catch {
    /* Only booleans are reported. Never include request bodies, cookies or infrastructure errors. */
  }
  return result;
}
