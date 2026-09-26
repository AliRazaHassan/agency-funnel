import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { scoutMarket } from "./marketScout.js";
import { huntProducts } from "./productHunt.js";
import { productsToMatrixifyCsv } from "./exportShopify.js";
import { createAuth } from "./auth.js";
import { keepaStatus, saveManualAmazonEntries } from "./keepa.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 8787;
const isProd = process.env.NODE_ENV === "production";

const auth = createAuth({
  password: process.env.APP_PASSWORD,
  secret: process.env.SESSION_SECRET,
});

if (isProd && !process.env.APP_PASSWORD) {
  console.error("FATAL: APP_PASSWORD is required in production");
  process.exit(1);
}

app.set("trust proxy", 1);
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  return next(err);
});
app.use(auth.middleware);

let lastScout = { opportunities: [] };

app.get("/api/health", (_req, res) => {
  const k = keepaStatus();
  res.json({
    ok: true,
    openai: Boolean(process.env.OPENAI_API_KEY),
    authRequired: auth.enabled,
    label: "Signal Desk",
    dataMode: {
      freeSignals: true,
      keepaLiveKey: k.liveKeyConfigured,
      keepaSnapshot: k.snapshot,
    },
  });
});

app.get("/api/keepa/status", (_req, res) => {
  res.json(keepaStatus());
});

app.post("/api/amazon/manual", (req, res) => {
  try {
    const body = req.body || {};
    const entries = body.entries || body.products || [body];
    const snap = saveManualAmazonEntries(entries);
    res.json({
      ok: true,
      snapshot: snap,
      message:
        "Saved manual Amazon one-time data. Re-hunt products to match. (We do not scrape Amazon.)",
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Save failed" });
  }
});

app.get("/api/auth/status", (req, res) => {
  res.json({
    required: auth.enabled,
    authenticated: !auth.enabled || auth.readSession(req),
  });
});

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body || {};
  if (!auth.login(password)) {
    return res.status(401).json({ error: "Wrong password" });
  }
  auth.setSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/auth/logout", (_req, res) => {
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/market/scout", async (req, res) => {
  try {
    const { regionFocus, budget, nicheHint } = req.body || {};
    const result = await scoutMarket({ regionFocus, budget, nicheHint });
    lastScout = result;
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Scout failed" });
  }
});

app.post("/api/products/hunt", async (req, res) => {
  try {
    const { opportunityId, opportunity, limit } = req.body || {};
    let opp = opportunity;
    if (!opp && opportunityId) {
      opp = lastScout.opportunities?.find((o) => o.id === opportunityId);
    }
    if (!opp) {
      return res.status(400).json({
        error: "Provide opportunity object or opportunityId from a prior scout",
      });
    }
    const result = await huntProducts(opp, { limit: limit || 50 });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Hunt failed" });
  }
});

app.post("/api/products/export", (req, res) => {
  try {
    const { products, niche, vendor } = req.body || {};
    if (!Array.isArray(products) || !products.length) {
      return res.status(400).json({ error: "products array required" });
    }
    const csv = productsToMatrixifyCsv(products, {
      niche: niche || "Store",
      vendor,
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="shopify-import.csv"'
    );
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Export failed" });
  }
});

const clientDist = join(__dirname, "..", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Signal Desk http://127.0.0.1:${PORT}`);
  console.log(`Auth: ${auth.enabled ? "password required" : "open (set APP_PASSWORD)"}`);
  console.log(`OpenAI: ${process.env.OPENAI_API_KEY ? "on" : "seed fallback"}`);
});
