/**
 * One-time Keepa pull → writes server/data/keepa-snapshot.json
 * Usage: KEEPA_API_KEY=xxx node scripts/keepa-pull.mjs B0XXX B0YYY
 * Then you can cancel the Keepa API plan — app reads the snapshot file.
 */
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pullKeepaOnce } from "../server/keepa.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const asins = process.argv.slice(2).filter((a) => /^B0[A-Z0-9]+$/i.test(a) || /^[A-Z0-9]{10}$/i.test(a));
const nicheFlag = process.argv.find((a) => a.startsWith("--niche="));
const niche = nicheFlag ? nicheFlag.slice("--niche=".length) : null;

if (!asins.length) {
  console.error("Usage: npm run keepa:pull -- B0XXXXXXXXX B0YYYYYYYYY [--niche=Pet Supplies]");
  process.exit(1);
}

const snap = await pullKeepaOnce(asins, { niche });
console.log(`Wrote ${snap.products.length} products → server/data/keepa-snapshot.json`);
console.log(snap.meta);
console.log("You can cancel Keepa API now — Signal Desk will use this one-time file + free signals.");
