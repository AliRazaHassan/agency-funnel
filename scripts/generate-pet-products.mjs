/**
 * Matrixify-friendly Pet Supplies product seed list.
 * Run: node scripts/generate-pet-products.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "model-1-shopify");
const outFile = join(outDir, "pet-supplies-products.csv");

const products = [
  ["Orthopedic Dog Bed Large", "Beds", 49.99, 22.0, "Supportive foam bed for medium-large dogs."],
  ["Calming Dog Bed Small", "Beds", 34.99, 14.5, "Plush calming bed for small breeds."],
  ["Elevated Pet Feeder Dual Bowl", "Feeders", 29.99, 11.0, "Raised stainless bowls for dogs and cats."],
  ["Slow Feeder Puzzle Bowl", "Feeders", 18.99, 6.5, "Slows eating and reduces bloating risk."],
  ["Automatic Pet Water Fountain", "Hydration", 39.99, 15.0, "Filtered circulating water fountain 2.5L."],
  ["Travel Water Bottle for Dogs", "Hydration", 16.99, 5.5, "Leak-proof portable bottle with bowl lid."],
  ["Nylon Dog Leash 6ft", "Walking", 14.99, 4.0, "Durable leash with padded handle."],
  ["No-Pull Dog Harness Adjustable", "Walking", 24.99, 9.0, "Reflective no-pull harness, 4 sizes."],
  ["Retractable Dog Leash 16ft", "Walking", 22.99, 8.5, "One-button lock retractable leash."],
  ["Waste Bag Dispenser + Rolls", "Walking", 12.99, 3.5, "Clip-on dispenser with 15 biodegradable rolls."],
  ["Interactive Cat Wand Toy", "Toys", 11.99, 3.0, "Feather wand for active play."],
  ["Cat Tunnel Collapsible", "Toys", 19.99, 7.0, "3-way collapsible play tunnel."],
  ["Dog Rope Chew Toy Set", "Toys", 15.99, 4.5, "3-piece cotton rope set for chewers."],
  ["Treat-Dispensing Puzzle Ball", "Toys", 17.99, 5.5, "Slow-release treat ball for enrichment."],
  ["Cat Scratching Post Tall", "Furniture", 42.99, 18.0, "Sisal post with dangling toy."],
  ["Window Cat Perch Hammock", "Furniture", 27.99, 10.0, "Suction-cup window perch."],
  ["Pet Grooming Glove Pair", "Grooming", 13.99, 3.8, "Deshedding massage gloves."],
  ["Dog Nail Clippers with Guard", "Grooming", 14.99, 4.2, "Safety-guard clippers + file."],
  ["Pet Hair Remover Roller", "Grooming", 12.99, 3.2, "Reusable lint roller for sofa and car."],
  ["Silicone Dog Bath Brush", "Grooming", 9.99, 2.8, "Shampoo brush for wet baths."],
  ["Car Seat Cover for Pets", "Travel", 36.99, 14.0, "Waterproof hammock-style seat cover."],
  ["Pet Carrier Soft-Sided", "Travel", 44.99, 17.5, "Airline-style soft carrier with mesh."],
  ["Dog Seat Belt Tether 2-Pack", "Travel", 15.99, 4.8, "Adjustable car safety tethers."],
  ["Collapsible Travel Dog Bowl 2pk", "Travel", 11.99, 3.0, "Silicone fold-flat bowls."],
  ["LED Dog Collar USB Rechargeable", "Safety", 21.99, 7.5, "Bright LED collar for night walks."],
  ["Pet First Aid Kit Compact", "Safety", 28.99, 10.5, "Travel first-aid essentials for pets."],
  ["Reflective Dog Vest", "Safety", 18.99, 6.0, "High-vis vest for evening walks."],
  ["GPS Tracker Tag Compatible Case", "Safety", 12.99, 3.5, "Silicone case for AirTag-style trackers."],
  ["Ceramic Cat Food Bowl Set", "Feeders", 22.99, 8.0, "Tilted ceramic bowls, whisker-friendly."],
  ["Dog Food Storage Container 15lb", "Feeders", 32.99, 12.0, "Airtight container with scoop."],
  ["Cat Litter Mat Oversized", "Litter", 19.99, 6.5, "Honeycomb double-layer litter mat."],
  ["Covered Litter Box with Filter", "Litter", 39.99, 15.5, "Hooded box with carbon filter."],
  ["Pet Stain & Odor Enzyme Spray", "Cleaning", 16.99, 5.0, "Enzyme cleaner for carpets and fabric."],
  ["Pet Blanket Washable Soft", "Beds", 23.99, 8.0, "Fleece blanket for crate or sofa."],
  ["Orthopedic Cat Bed Donut", "Beds", 26.99, 9.5, "Calming donut bed for cats."],
  ["Dog Cooling Mat Large", "Beds", 29.99, 11.0, "Pressure-activated cooling gel mat."],
  ["Puppy Training Pads 50ct", "Training", 24.99, 9.0, "Super-absorbent house training pads."],
  ["Clicker Training Kit", "Training", 9.99, 2.5, "Clicker + target stick starter kit."],
  ["Dog Agility Weave Poles Set", "Training", 34.99, 13.0, "Portable backyard agility poles."],
  ["Catnip Spray Organic Blend", "Toys", 10.99, 2.9, "Potent catnip spray for toys."],
];

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const header = [
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

const lines = [header.join(",")];

for (const [title, type, price, cost, blurb] of products) {
  const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const compare = (price * 1.35).toFixed(2);
  const body = `<p>${blurb}</p><ul><li>Ready for automated fulfillment</li><li>Premium niche: Pet Supplies</li><li>Add supplier SKU in AutoDS/Zendrop</li></ul>`;
  const row = [
    handle,
    title,
    body,
    "AgencyFunnel Pets",
    type,
    `pet,${type.toLowerCase()},turnkey`,
    "TRUE",
    "Title",
    "Default Title",
    price.toFixed(2),
    compare,
    cost.toFixed(2),
    25,
    "shopify",
    0.5,
    "lb",
    `${title} | Pet Supplies Store`,
    `${blurb} Shop our automated pet supplies store.`.slice(0, 155),
    "active",
  ];
  lines.push(row.map(csvEscape).join(","));
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, lines.join("\n"), "utf8");
console.log(`Wrote ${products.length} products → ${outFile}`);
