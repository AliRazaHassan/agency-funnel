export async function api(url, { method = "GET", body, raw } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error("Cannot reach API (is Signal Desk running?).");
    err.network = true;
    throw err;
  }
  if (raw) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error || res.statusText);
      err.needLogin = data.needLogin;
      throw err;
    }
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.needLogin = data.needLogin;
    throw err;
  }
  return data;
}

export async function downloadBlob(url, body, filename) {
  const res = await api(url, { method: "POST", body, raw: true });
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
