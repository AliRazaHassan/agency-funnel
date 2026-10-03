const cache = new Map();

function cleanQuery(value = "") {
  return String(value).replace(/[®™]/g, "").replace(/\b(set|pack|adjustable|portable|premium|large|small|usb|rechargeable)\b/gi, " ").replace(/\s+/g, " ").trim();
}

async function commonsImage(query) {
  const key = cleanQuery(query).toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2200);
  try {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("origin", "*");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", `filetype:bitmap ${cleanQuery(query)}`);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "4");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|mime");
    url.searchParams.set("iiurlwidth", "420");
    url.searchParams.set("format", "json");
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "ProductHunterAI/3.0 (product research UI)" } });
    if (!res.ok) throw new Error(`commons ${res.status}`);
    const json = await res.json();
    const pages = Object.values(json?.query?.pages || {});
    const page = pages.find((p) => p.imageinfo?.[0]?.thumburl && /^image\/(jpeg|png|webp)/i.test(p.imageinfo?.[0]?.mime || ""));
    const info = page?.imageinfo?.[0];
    const result = info?.thumburl ? {
      url: info.thumburl,
      sourceUrl: info.descriptionurl || info.url,
      source: "Wikimedia Commons",
      query: cleanQuery(query),
      status: "LIVE"
    } : null;
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveProductImage(product = {}) {
  if (product.image?.url || product.imageUrl) return product.image || { url: product.imageUrl, source: product.imageSource || "provided", status: "PROVIDED" };
  const attempts = [product.title, `${product.category || ""} ${product.problemSolved || ""}`].filter(Boolean);
  for (const q of attempts) {
    const image = await commonsImage(q);
    if (image) return image;
  }
  return {
    url: null,
    source: "none",
    status: "UNAVAILABLE",
    query: cleanQuery(product.title || product.category || "")
  };
}

export async function attachProductImages(products = []) {
  const list = Array.isArray(products) ? products : [];
  const out = [];
  const chunkSize = 10;
  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);
    const resolved = await Promise.all(chunk.map(async (p) => ({ ...p, image: await resolveProductImage(p) })));
    out.push(...resolved);
  }
  return out;
}
