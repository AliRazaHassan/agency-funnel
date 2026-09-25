/**
 * Generates ~500+ pSEO keyword rows for WP All Import.
 * Run: npm run generate:keywords
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "model-3-pseo");
const outFile = join(outDir, "keywords-import.csv");

const niches = [
  { slug: "pet supplies", label: "Pet Supplies", products: "pet products" },
  { slug: "home fitness", label: "Home Fitness", products: "fitness gear" },
  { slug: "eco kitchen gadgets", label: "Eco Kitchen Gadgets", products: "eco kitchen gadgets" },
  { slug: "beauty", label: "Beauty", products: "beauty products" },
  { slug: "baby products", label: "Baby Products", products: "baby products" },
];

const cities = [
  "Austin", "Denver", "Portland", "Nashville", "Raleigh", "Tampa", "Phoenix",
  "Manchester", "Bristol", "Leeds", "Edinburgh", "Birmingham",
  "Dubai", "Abu Dhabi", "Riyadh", "Jeddah", "Doha", "Kuwait City",
  "Toronto", "Vancouver", "Melbourne", "Brisbane",
];

const professions = [
  "realtors", "dentists", "gym owners", "salon owners", "restaurant owners",
  "chiropractors", "tutors", "clinic managers", "spa owners", "coaches",
];

const ctaVariants = ["whatsapp_mockup", "store_transfer", "automation_demo"];

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function metaTitle(keyword) {
  const base = titleCase(keyword);
  return base.length <= 58 ? `${base} (2026)` : `${base.slice(0, 55)}...`;
}

function metaDesc(keyword, niche) {
  return `Practical guide for ${keyword}. Get a free AI mockup for your ${niche} store or lead system — reply in under 60 seconds.`.slice(0, 155);
}

function outline(kind) {
  const maps = {
    inventory: "supplier sync|low-stock alerts|SKU naming|bundles|returns workflow",
    buy: "preloaded products|shipping policy|tracking page|supplier connected|same-day transfer",
    wordpress: "Fluent Forms|Make.com|WhatsApp reply|CRM sheet|follow-up sequence",
    cost: "theme cost|apps|products|transfer fee|ads buffer",
    flow: "Flow trigger|supplier notify|SKU map|exceptions|refund alert",
    whatsapp: "form fields|AI proposal|Whapi/Twilio|speed reply|CTA",
  };
  return maps[kind] || maps.buy;
}

const rows = [];
const seen = new Set();

function pushRow({ keyword, niche, city, intent, kind, cta }) {
  const key = keyword.toLowerCase().trim();
  if (seen.has(key) || key.length < 12) return;
  seen.add(key);
  const h1 = titleCase(keyword);
  rows.push({
    keyword,
    primary_niche: niche,
    city_or_null: city || "",
    intent,
    h1,
    meta_title: metaTitle(keyword),
    meta_description: metaDesc(keyword, niche),
    outline_bullets: outline(kind),
    cta_variant: cta,
  });
}

// Pattern A: inventory automation per niche
for (const n of niches) {
  pushRow({
    keyword: `how to automate inventory in ${n.slug} Shopify store`,
    niche: n.slug,
    intent: "informational",
    kind: "inventory",
    cta: "whatsapp_mockup",
  });
  pushRow({
    keyword: `${n.slug} Shopify inventory automation with AutoDS`,
    niche: n.slug,
    intent: "informational",
    kind: "inventory",
    cta: "whatsapp_mockup",
  });
  pushRow({
    keyword: `${n.label} Shopify Flow order to supplier automation`,
    niche: n.slug,
    intent: "informational",
    kind: "flow",
    cta: "whatsapp_mockup",
  });
}

// Pattern B: buy ready-made store
for (const n of niches) {
  pushRow({
    keyword: `buy ready made Shopify store for ${n.slug}`,
    niche: n.slug,
    intent: "transactional",
    kind: "buy",
    cta: "store_transfer",
  });
  pushRow({
    keyword: `ready made ${n.slug} Shopify store for sale`,
    niche: n.slug,
    intent: "transactional",
    kind: "buy",
    cta: "store_transfer",
  });
  pushRow({
    keyword: `turnkey ${n.slug} ecommerce store transfer`,
    niche: n.slug,
    intent: "transactional",
    kind: "buy",
    cta: "store_transfer",
  });
  pushRow({
    keyword: `${n.slug} dropshipping store setup cost`,
    niche: n.slug,
    intent: "commercial",
    kind: "cost",
    cta: "store_transfer",
  });
  pushRow({
    keyword: `best automated Shopify store for ${n.slug} niche`,
    niche: n.slug,
    intent: "commercial",
    kind: "buy",
    cta: "store_transfer",
  });
}

// Pattern C: city + profession WordPress automation
for (const city of cities) {
  for (const prof of professions) {
    pushRow({
      keyword: `best automated WordPress setup for ${city} ${prof}`,
      niche: "wordpress automation",
      city,
      intent: "commercial",
      kind: "wordpress",
      cta: "automation_demo",
    });
    pushRow({
      keyword: `${city} ${prof} WhatsApp lead automation`,
      niche: "wordpress automation",
      city,
      intent: "commercial",
      kind: "whatsapp",
      cta: "automation_demo",
    });
  }
}

// Pattern D: general WhatsApp / Make.com
for (const prof of professions) {
  pushRow({
    keyword: `WhatsApp lead automation for ${prof}`,
    niche: "wordpress automation",
    intent: "commercial",
    kind: "whatsapp",
    cta: "automation_demo",
  });
  pushRow({
    keyword: `Make.com Fluent Forms webhook for ${prof}`,
    niche: "wordpress automation",
    intent: "informational",
    kind: "wordpress",
    cta: "automation_demo",
  });
}

// Pattern E: niche + city commercial hybrids (subset)
const hybridCities = cities.slice(0, 12);
for (const n of niches) {
  for (const city of hybridCities) {
    pushRow({
      keyword: `${city} ${n.slug} Shopify store for sale`,
      niche: n.slug,
      city,
      intent: "transactional",
      kind: "buy",
      cta: "store_transfer",
    });
    pushRow({
      keyword: `how to start ${n.slug} Shopify store in ${city}`,
      niche: n.slug,
      city,
      intent: "informational",
      kind: "inventory",
      cta: "whatsapp_mockup",
    });
  }
}

// Trim / pad toward 500–550
let finalRows = rows.slice(0, 520);
if (finalRows.length < 500) {
  let i = 0;
  while (finalRows.length < 500 && i < niches.length * 50) {
    const n = niches[i % niches.length];
    const city = cities[i % cities.length];
    pushRow({
      keyword: `${n.slug} automated shipping policy template ${city}`,
      niche: n.slug,
      city,
      intent: "informational",
      kind: "buy",
      cta: "whatsapp_mockup",
    });
    finalRows = rows.slice(0, 520);
    i++;
  }
}

const header = [
  "keyword",
  "primary_niche",
  "city_or_null",
  "intent",
  "h1",
  "meta_title",
  "meta_description",
  "outline_bullets",
  "cta_variant",
  "slug",
  "intro",
  "faq_1_q",
  "faq_1_a",
  "faq_2_q",
  "faq_2_a",
  "faq_3_q",
  "faq_3_a",
];

function slugify(keyword) {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function enrich(row) {
  const niche = row.primary_niche;
  const intro = `Searching for “${row.keyword}”? This page breaks down a practical setup for ${niche}${row.city_or_null ? ` in ${row.city_or_null}` : ""} — plus how to get a ready system without waiting weeks.`;
  return {
    ...row,
    slug: slugify(row.keyword),
    intro,
    faq_1_q: `How fast can I launch a ${niche} solution?`,
    faq_1_a: "Most turnkey Shopify transfers happen the same day after payment. WordPress lead automation usually goes live within 48–72 hours.",
    faq_2_q: "Is this DIY or done-for-you?",
    faq_2_a: "Both paths exist: buy a prebuilt store, or get the same automation wired on your site. Start with a free WhatsApp mockup.",
    faq_3_q: "What do I need before we start?",
    faq_3_a: "A WhatsApp number, niche preference, and budget range. Domain and Shopify/WordPress access come after the mockup call.",
  };
}

finalRows = finalRows.map(enrich);

const lines = [
  header.join(","),
  ...finalRows.map((r) => header.map((h) => csvEscape(r[h])).join(",")),
];

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, lines.join("\n"), "utf8");
console.log(`Wrote ${finalRows.length} rows → ${outFile}`);
