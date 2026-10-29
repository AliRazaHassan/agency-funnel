import { collect, capabilities } from "../server/evidenceProviders.js";
import { rankEvidence } from "../server/evidence.js";
const constraints = {
  market: "US",
  query: process.argv.slice(2).join(" ").trim() || "Christmas pet",
  season: "christmas-2026",
  maxLandedCost: 15,
  minMargin: 60,
};
const runs = await collect(constraints);
const observations = runs.flatMap((r) => r.observations);
console.log(
  JSON.stringify(
    {
      at: new Date().toISOString(),
      constraints,
      capabilities: capabilities(),
      runs: runs.map(({ observations, ...r }) => ({
        ...r,
        count: observations.length,
      })),
      observations: observations.length,
      products: rankEvidence(observations, {}, constraints),
    },
    null,
    2,
  ),
);
