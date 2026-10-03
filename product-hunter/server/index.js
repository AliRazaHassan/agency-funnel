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
import { listProjects, getProject, saveProject, deleteProject, projectStoreMode } from "./projects.js";
import { buildClientBrief } from "./clientBrief.js";
import { buildIntelligence, searchIntelligence, whyTrending } from "./intelligence.js";
import { answerConcierge } from "./concierge.js";
import { buildValidationPlan } from "./validation.js";
import { initResearchStore, researchStoreMode, trackProducts, listTrackedProducts, getHistory, updateValidationStatus, addAdTest, getAdTests, saveSupplierVerification, getSupplierVerification } from "./researchStore.js";
import { shopifyStatus, createShopifyDraft } from "./shopify.js";
import { getUpcomingEvents } from "./seasonal.js";
import { discoverProductsLive } from "./liveDiscovery.js";
import { buildLaunchKit } from "./launchKit.js";
import { buildWatchAlerts } from "./watchAlerts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 8787;
const isProd = process.env.NODE_ENV === "production";
const hasOpenAIKey = Boolean(String(process.env.OPENAI_API_KEY || "").trim());

await initResearchStore();

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

app.get("/api/events/upcoming", (req, res) => {
  const region = String(req.query.region || "Global");
  const days = Math.max(30, Math.min(365, Number(req.query.days) || 210));
  const events = getUpcomingEvents({ region, days });
  res.json({ region, days, generatedAt: new Date().toISOString(), events });
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

app.post("/api/discovery/live", async (req,res)=>{
  try{
    const { opportunity, regionFocus, query, constraints, limit } = req.body || {};
    res.json(await discoverProductsLive({opportunity,regionFocus,query,constraints,limit:limit||50}));
  }catch(err){
    console.error(err);
    res.status(500).json({error:err.message||"Live discovery failed"});
  }
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
    await trackProducts(lastHuntProducts, { opportunityId: opp.id, niche: opp.niche, market: opp.sellWhere?.geos?.[0] || "Global" });
    res.json({ ...result, tracking: { mode: researchStoreMode(), captured: lastHuntProducts.length } });
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

app.post("/api/products/validate", async (req, res) => {
  try {
    const product = req.body?.product || req.body || {};
    if (!product.title) return res.status(400).json({ error: "product required" });
    const result = await buildValidationPlan(product);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Validation failed" });
  }
});

app.post("/api/concierge", async (req, res) => {
  try {
    const result = await answerConcierge(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Concierge failed" });
  }
});

app.get("/api/intelligence/radar", (_req, res) => {
  const products = lastHuntProducts.map(buildIntelligence);
  const groups = Object.groupBy ? Object.groupBy(products, p => p.trendStatus) : products.reduce((a,p)=>{(a[p.trendStatus] ||= []).push(p);return a;},{});
  res.json({ groups, updatedAt: new Date().toISOString(), note: "Radar uses collected/stored signals; unavailable sources are not fabricated." });
});

app.get("/api/tracking/products", async (_req,res)=>{
  try{res.json({products:await listTrackedProducts(),mode:researchStoreMode()});}
  catch(err){res.status(500).json({error:err.message||"Tracking failed"});}
});
app.get("/api/tracking/:id/history", async (req,res)=>{
  try{const days=Math.max(1,Math.min(90,Number(req.query.days)||30));res.json({productId:req.params.id,days,history:await getHistory(req.params.id,days)});}
  catch(err){res.status(500).json({error:err.message||"History failed"});}
});
app.post("/api/tracking/:id/status", async (req,res)=>{
  try{res.json(await updateValidationStatus(req.params.id,req.body?.status));}
  catch(err){res.status(400).json({error:err.message||"Status update failed"});}
});
app.post("/api/tracking/:id/tests", async (req,res)=>{
  try{res.json(await addAdTest(req.params.id,req.body||{}));}
  catch(err){res.status(400).json({error:err.message||"Ad test save failed"});}
});
app.post("/api/tracking/:id/supplier", async (req,res)=>{
  try{res.json(await saveSupplierVerification(req.params.id,req.body||{}));}
  catch(err){res.status(400).json({error:err.message||"Supplier verification failed"});}
});
app.get("/api/tracking/:id/supplier", async (req,res)=>{
  try{res.json({verification:await getSupplierVerification(req.params.id)});}
  catch(err){res.status(500).json({error:err.message||"Supplier verification load failed"});}
});

app.get("/api/tracking/:id/tests", async (req,res)=>{
  try{res.json({tests:await getAdTests(req.params.id)});}
  catch(err){res.status(500).json({error:err.message||"Ad tests failed"});}
});
app.post("/api/watch/alerts", async (req,res)=>{
  try{res.json({alerts:await buildWatchAlerts(req.body||{})});}
  catch(err){res.status(500).json({error:err.message||"Alert check failed"});}
});

app.post("/api/launch-kit", async (req,res)=>{
  try{res.json(await buildLaunchKit(req.body?.product||req.body||{}));}
  catch(err){res.status(400).json({error:err.message||"Launch kit failed"});}
});

app.get("/api/shopify/status", (_req,res)=>res.json(shopifyStatus()));
app.post("/api/shopify/products", async (req,res)=>{
  try{res.json(await createShopifyDraft(req.body?.product||req.body||{}));}
  catch(err){res.status(400).json({error:err.message||"Shopify create failed"});}
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

app.get("/api/projects", async (_req, res) => {
  try { res.json({ projects: await listProjects() }); }
  catch (err) { res.status(500).json({ error: err.message || "Project list failed" }); }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    const p = await getProject(req.params.id);
    if (!p) return res.status(404).json({ error: "Project not found" });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message || "Project load failed" }); }
});

app.post("/api/projects", async (req, res) => {
  try {
    const saved = await saveProject(req.body || {});
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message || "Save failed" });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    const ok = await deleteProject(req.params.id);
    if (!ok) return res.status(404).json({ error: "Project not found" });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message || "Project delete failed" }); }
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

app.get("/api/workspace/status", async (_req, res) => {
  const k = keepaStatus();
  res.json({
    label: "Signal Desk",
    version: "4.0",
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
      aiConcierge: true,
      productValidation: true,
      historicalTracking: true,
      adTestFeedback: true,
      directShopify: shopifyStatus().configured,
      seasonalRadar: true,
      productImages: true,
      liveDiscovery: true,
      evidenceLedger: true,
      winnerBoard: true,
      opportunityFinder: true,
      watchAlerts: true,
      launchKit: true,
      economicsSimulator: true,
      historicalCharts: true,
    },
    openai: hasOpenAIKey,
    keepa: k,
    researchStore: researchStoreMode(),
    projectStore: await projectStoreMode(),
    shopify: shopifyStatus(),
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
