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
import { fetchSocialTrends, saveManualSocialTrends } from "./socialTrends.js";
import { listProjects, getProject, saveProject, deleteProject } from "./projects.js";
import { buildClientBrief } from "./clientBrief.js";
import { buildIntelligence, searchIntelligence, whyTrending } from "./intelligence.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 8787;
const isProd = process.env.NODE_ENV === "production";
const hasOpenAIKey = Boolean(String(process.env.OPENAI_API_KEY || "").trim());

const auth = createAuth({
  password: process.env.APP_PASSWORD,
  secret: process.env.SESSION_SECRET,
  sessionHours: Number(process.env.AUTH_SESSION_HOURS || 4),
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
let lastHuntProducts = [];

app.get("/api/health", (_req, res) => {
  const k = keepaStatus();
  res.json({
    ok: true,
    openai: hasOpenAIKey,
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

app.get("/api/trends/social", async (req, res) => {
  try {
    const { regionFocus, nicheHint } = req.query || {};
    const data = await fetchSocialTrends({
      regionFocus: regionFocus || "Global",
      nicheHint: nicheHint || undefined,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || "Trends failed" });
  }
});

app.post("/api/trends/social/manual", (req, res) => {
  try {
    const body = req.body || {};
    const items = body.items || body.entries || [body];
    const saved = saveManualSocialTrends(items);
    res.json({ ok: true, count: saved.length, items: saved.slice(0, 20) });
  } catch (err) {
    res.status(400).json({ error: err.message || "Save failed" });
  }
});

app.get("/api/auth/status", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    required: auth.enabled,
    authenticated: !auth.enabled || auth.readSession(req),
  });
});

app.post("/api/auth/login", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { password } = req.body || {};
  if (!auth.login(password)) {
    return res.status(401).json({ error: "Wrong password" });
  }
  auth.setSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
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
    lastHuntProducts = Array.isArray(result) ? result : (result.products || []);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Hunt failed" });
  }
});

app.get("/api/intelligence/products", (req, res) => {
  const products = searchIntelligence(lastHuntProducts, req.query || {});
  res.json({ products, count: products.length, scoring: "evidence-based-v2" });
});

app.post("/api/intelligence/search", (req, res) => {
  const products = searchIntelligence(lastHuntProducts, req.body || {});
  res.json({ products, count: products.length });
});

app.post("/api/intelligence/analyze", (req, res) => {
  const product = req.body?.product || req.body || {};
  res.json(buildIntelligence(product));
});

app.post("/api/intelligence/why-trending", (req, res) => {
  const product = req.body?.product || req.body || {};
  res.json(whyTrending(product));
});

app.get("/api/intelligence/radar", (_req, res) => {
  const products = lastHuntProducts.map(buildIntelligence);
  const groups = Object.groupBy ? Object.groupBy(products, p => p.trendStatus) : products.reduce((a,p)=>{(a[p.trendStatus] ||= []).push(p);return a;},{});
  res.json({ groups, updatedAt: new Date().toISOString(), note: "Radar uses collected/stored signals; unavailable sources are not fabricated." });
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

app.get("/api/projects", (_req, res) => {
  res.json({ projects: listProjects() });
});

app.get("/api/projects/:id", (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: "Project not found" });
  res.json(p);
});

app.post("/api/projects", (req, res) => {
  try {
    const saved = saveProject(req.body || {});
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message || "Save failed" });
  }
});

app.delete("/api/projects/:id", (req, res) => {
  const ok = deleteProject(req.params.id);
  if (!ok) return res.status(404).json({ error: "Project not found" });
  res.json({ ok: true });
});

app.post("/api/export/brief", (req, res) => {
  try {
    const { format } = req.body || {};
    const brief = buildClientBrief(req.body || {});
    if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${String(brief.title || "brief")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}-brief.html"`
      );
      return res.send(brief.html);
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(brief.title || "brief")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}-brief.md"`
    );
    res.send(brief.markdown);
  } catch (err) {
    res.status(500).json({ error: err.message || "Brief failed" });
  }
});

app.get("/api/workspace/status", (_req, res) => {
  const k = keepaStatus();
  res.json({
    label: "Signal Desk",
    version: "2.1",
    modules: {
      scout: true,
      socialTrends: true,
      productHunt: true,
      winningScorecard: true,
      shopifyExport: true,
      clientBrief: true,
      projects: true,
      freeSignals: true,
      amazonManualPaste: true,
      keepaSnapshot: k.snapshot?.ok || false,
    },
    openai: hasOpenAIKey,
    keepa: k,
  });
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
  console.log(`OpenAI: ${hasOpenAIKey ? "configured" : "seed fallback (OPENAI_API_KEY missing)"}`);
});
