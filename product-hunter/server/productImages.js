const cache = new Map();

function cleanTitle(title="") {
  return String(title)
    .replace(/\b(Pro|Compact|Premium|Value Pack|Travel Size)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackSvg(title="Product") {
  const safe = String(title).slice(0,42).replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#e8eef2"/><stop offset="1" stop-color="#d8e7e5"/></linearGradient></defs><rect width="640" height="480" rx="28" fill="url(#g)"/><circle cx="320" cy="185" r="76" fill="#ffffff" opacity=".9"/><path d="M275 190h90M320 145v90" stroke="#0f6e6a" stroke-width="16" stroke-linecap="round"/><text x="320" y="325" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#0e1a24">${safe}</text><text x="320" y="362" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#5c7380">Product image pending source match</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function commonsImage(query) {
  const key = query.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const params = new URLSearchParams({
      action:"query",
      generator:"search",
      gsrsearch: `file:${query}`,
      gsrnamespace:"6",
      gsrlimit:"6",
      prop:"imageinfo",
      iiprop:"url|extmetadata",
      iiurlwidth:"640",
      format:"json",
      origin:"*",
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent":"SignalDeskProductHunter/2.2 (product research image lookup)" },
    });
    if (!res.ok) throw new Error(`Wikimedia ${res.status}`);
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    const hit = pages.find((p) => {
      const ii = p.imageinfo?.[0];
      const mime = String(ii?.mime || "").toLowerCase();
      const url = ii?.thumburl || ii?.url || "";
      return url && !mime.includes("svg");
    }) || pages.find((p)=>p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url);
    const ii = hit?.imageinfo?.[0];
    if (!ii) throw new Error("No image");
    const meta = ii.extmetadata || {};
    const value = {
      imageUrl: ii.thumburl || ii.url,
      imageSourceUrl: ii.descriptionurl || hit.fullurl || null,
      imageSource: "Wikimedia Commons",
      imageAttribution: [meta.Artist?.value, meta.LicenseShortName?.value].filter(Boolean).join(" · ").replace(/<[^>]+>/g, ""),
      imageStatus: "MATCHED",
    };
    cache.set(key, value);
    return value;
  } catch {
    const value = {
      imageUrl: fallbackSvg(query),
      imageSourceUrl: null,
      imageSource: "Generated fallback",
      imageAttribution: null,
      imageStatus: "FALLBACK",
    };
    cache.set(key, value);
    return value;
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichProductImages(products = [], { concurrency = 8, liveLookupLimit = 16 } = {}) {
  const list = Array.isArray(products) ? products : [];
  const out = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const i = cursor++;
      const product = list[i] || {};
      if (product.imageUrl) {
        out[i] = product;
        continue;
      }
      const query = [cleanTitle(product.title), product.category].filter(Boolean).join(" ");
      if (i >= liveLookupLimit) {
        out[i] = {
          ...product,
          imageUrl: fallbackSvg(cleanTitle(product.title) || "Product"),
          imageSourceUrl: null,
          imageSource: "Generated fallback",
          imageAttribution: null,
          imageStatus: "FALLBACK",
        };
        continue;
      }
      const image = await commonsImage(query || "ecommerce product");
      out[i] = { ...product, ...image };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1,list.length)) }, worker));
  return out;
}
