function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADER = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Cost",
  "Variant Inventory Qty",
  "Variant Inventory Tracker",
  "Variant Weight",
  "Variant Weight Unit",
  "SEO Title",
  "SEO Description",
  "Status",
];

function handleFromTitle(title) {
  return String(title || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Matrixify-compatible Shopify product CSV.
 */
export function productsToMatrixifyCsv(products, { vendor = "AgencyFunnel", niche = "Store" } = {}) {
  const lines = [HEADER.join(",")];

  for (const p of products) {
    const title = p.title;
    const handle = p.id || handleFromTitle(title);
    const price = Number(p.estSellPriceUsd) || 0;
    const cost = Number(p.estCostUsd) || 0;
    const compare = (price * 1.35).toFixed(2);
    const bullets = (p.pdpBullets || p.reasons || []).slice(0, 5);
    const body = `<p>${p.problemSolved || p.hook || title}</p><ul>${bullets
      .map((b) => `<li>${String(b).replace(/</g, "")}</li>`)
      .join("")}</ul><p>${p.evidence || ""}</p>`;
    const weightLb = ((Number(p.estWeightKg) || 0.5) * 2.20462).toFixed(2);
    const row = [
      handle,
      title,
      body,
      vendor,
      p.category || niche,
      `${niche.toLowerCase().replace(/\s+/g, "-")},turnkey,ai-hunted`,
      "TRUE",
      "Title",
      "Default Title",
      price.toFixed(2),
      compare,
      cost.toFixed(2),
      25,
      "shopify",
      weightLb,
      "lb",
      `${title} | ${niche}`,
      `${(p.hook || p.problemSolved || title).slice(0, 140)}`,
      "active",
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  return lines.join("\n");
}
