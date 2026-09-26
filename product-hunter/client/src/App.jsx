import { useEffect, useMemo, useRef, useState } from "react";
import { MarketVizBoard, ProductDetailPanel, FreeSignalChip, WinningBadge, SocialTrendsBoard } from "./Visuals.jsx";
import { api, downloadBlob } from "./api.js";
import { Onboarding, HomeView, SettingsView } from "./Shell.jsx";
import { Concierge } from "./Concierge.jsx";

function actionLabel(url = "") {
  if (url.includes("/market/scout")) return "Researching markets";
  if (url.includes("/products/hunt")) return "Hunting winning products";
  if (url.includes("/projects") && url.includes("/api/projects")) return "Saving or loading project";
  if (url.includes("/products/export")) return "Preparing Shopify export";
  if (url.includes("/export/brief")) return "Building client brief";
  if (url.includes("/concierge")) return "AI Concierge is reading the stats";
  if (url.includes("/auth/login")) return "Signing you in";
  if (url.includes("/auth/logout")) return "Securing workspace";
  if (url.includes("/trends/social")) return "Refreshing trend evidence";
  if (url.includes("/amazon/manual")) return "Saving Amazon evidence";
  if (url.includes("/intelligence")) return "Analyzing product intelligence";
  return "Working on your request";
}

function expectedMs(url = "") {
  if (url.includes("/products/hunt")) return 18000;
  if (url.includes("/market/scout")) return 14000;
  if (url.includes("/concierge")) return 7000;
  if (url.includes("/export/")) return 5000;
  return 4000;
}

function GlobalActionProgress({ state }) {
  if (!state.visible) return null;
  return (
    <div className="global-progress" role="status" aria-live="polite">
      <div className="global-progress-top">
        <div>
          <strong>{state.label}</strong>
          <span>{state.done ? "Complete" : "Estimated progress"}</span>
        </div>
        <b>{Math.round(state.percent)}%</b>
      </div>
      <progress max="100" value={state.percent} aria-label={state.label}>
        {Math.round(state.percent)}%
      </progress>
      <small>{state.done ? "Done" : "This reaches 100% when the server finishes the action."}</small>
    </div>
  );
}

function ScoreBar({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${v}%` }} />
      </div>
      <span>{Math.round(v)}</span>
    </div>
  );
}

function Login({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: { password } });
      onSuccess();
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>Signal Desk</h1>
        <p>Private research workspace. Enter the access password to continue.</p>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>
        <button className="btn" type="submit" disabled={loading || !password}>
          {loading ? "Checking…" : "Enter workspace"}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState({ loading: true, required: true, authenticated: false });
  const [globalProgress, setGlobalProgress] = useState({ visible: false, percent: 0, label: "", done: false });
  const progressRef = useRef({ active: new Map(), timer: null, hideTimer: null, startedAt: 0, url: "" });
  const [regionFocus, setRegionFocus] = useState("Global");
  const [budget, setBudget] = useState("500");
  const [nicheHint, setNicheHint] = useState("");
  const [scout, setScout] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [hunt, setHunt] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState("");
  const [trendFilter, setTrendFilter] = useState("ALL");
  const [radarQuery, setRadarQuery] = useState("");
  const [radarMarket, setRadarMarket] = useState("ALL");
  const [error, setError] = useState("");
  const [winFilter, setWinFilter] = useState("ALL"); // ALL | PASS | WATCH | FAIL
  const [view, setView] = useState("home"); // home | desk | settings
  const [projectId, setProjectId] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem("sd_onboarded") !== "1"
  );

  const step = hunt ? 3 : scout ? 2 : 1;

  const selectedProducts = useMemo(() => {
    if (!hunt?.products) return [];
    return hunt.products.filter((p) => selectedIds.has(p.id));
  }, [hunt, selectedIds]);

  const radarProducts = useMemo(() => {
    const products = hunt?.products || [];
    const q = radarQuery.trim().toLowerCase();
    return products.filter((p) => {
      const marketOk = radarMarket === "ALL" || String(p.market || regionFocus).toUpperCase().includes(radarMarket);
      const queryOk = !q || [p.title,p.category,p.problemSolved,p.trendStatus,p.whyTrending?.summary].filter(Boolean).join(" ").toLowerCase().includes(q);
      return marketOk && queryOk;
    }).sort((a,b) => Number(b.trendScore || 0) - Number(a.trendScore || 0));
  }, [hunt, radarQuery, radarMarket, regionFocus]);

  const filteredHuntProducts = useMemo(() => {
    const list = hunt?.products || [];
    return list.filter((p) => {
      const winOk = winFilter === "ALL" || p.winning?.verdict === winFilter;
      const trendOk = trendFilter === "ALL" || p.trendStatus === trendFilter;
      return winOk && trendOk;
    });
  }, [hunt, winFilter, trendFilter]);

  async function refreshAuth() {
    try {
      const status = await Promise.race([
        api("/api/auth/status"),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth check timed out")), 8000)
        ),
      ]);
      setAuth({ loading: false, ...status });
    } catch {
      setAuth({ loading: false, required: true, authenticated: false });
    }
  }

  useEffect(() => {
    function stopTimers() {
      if (progressRef.current.timer) clearInterval(progressRef.current.timer);
      if (progressRef.current.hideTimer) clearTimeout(progressRef.current.hideTimer);
      progressRef.current.timer = null;
      progressRef.current.hideTimer = null;
    }

    function startTicker(url) {
      stopTimers();
      progressRef.current.startedAt = Date.now();
      progressRef.current.url = url;
      setGlobalProgress({ visible: true, percent: 6, label: actionLabel(url), done: false });
      const expected = expectedMs(url);
      progressRef.current.timer = setInterval(() => {
        const elapsed = Date.now() - progressRef.current.startedAt;
        const eased = 6 + 86 * (1 - Math.exp(-elapsed / Math.max(1200, expected * 0.55)));
        setGlobalProgress((p) => p.done ? p : { ...p, percent: Math.min(92, eased) });
      }, 250);
    }

    function onRequest(e) {
      const d = e.detail || {};
      if (d.phase === "start") {
        progressRef.current.active.set(d.id, d.url);
        startTicker(d.url);
        return;
      }
      if (d.phase === "end") {
        progressRef.current.active.delete(d.id);
        if (progressRef.current.active.size > 0) {
          const nextUrl = [...progressRef.current.active.values()].at(-1) || d.url;
          startTicker(nextUrl);
          return;
        }
        if (progressRef.current.timer) clearInterval(progressRef.current.timer);
        progressRef.current.timer = null;
        setGlobalProgress((p) => ({ ...p, visible: true, percent: 100, done: true }));
        progressRef.current.hideTimer = setTimeout(() => {
          setGlobalProgress({ visible: false, percent: 0, label: "", done: false });
        }, 650);
      }
    }

    window.addEventListener("ph:request-progress", onRequest);
    return () => {
      window.removeEventListener("ph:request-progress", onRequest);
      stopTimers();
    };
  }, []);

  useEffect(() => {
    refreshAuth();
  }, []);

  async function runScout() {
    setError("");
    setLoading("scout");
    setHunt(null);
    setSelectedOpp(null);
    setSelectedIds(new Set());
    setSelectedProduct(null);
    try {
      const data = await api("/api/market/scout", {
        method: "POST",
        body: {
          regionFocus,
          budget: budget ? Number(budget) : undefined,
          nicheHint: nicheHint || undefined,
        },
      });
      setScout(data);
    } catch (e) {
      if (e.needLogin) refreshAuth();
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  async function runHunt(opp) {
    setError("");
    setLoading("hunt");
    setSelectedOpp(opp);
    setSelectedIds(new Set());
    setSelectedProduct(null);
    setWinFilter("ALL");
    setTrendFilter("ALL");
    try {
      const data = await api("/api/products/hunt", {
        method: "POST",
        body: { opportunity: opp, limit: 50 },
      });
      setHunt(data);
      const winners = (data.products || []).filter((p) => p.winning?.verdict === "PASS");
      const pickPool = winners.length ? winners : (data.products || []).filter((p) => !p.rejected);
      setSelectedIds(new Set(pickPool.slice(0, 20).map((p) => p.id)));
      setSelectedProduct(pickPool[0] || data.products?.[0] || null);
    } catch (e) {
      if (e.needLogin) refreshAuth();
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  function toggleProduct(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function exportCsv() {
    setError("");
    setLoading("export");
    try {
      await downloadBlob(
        "/api/products/export",
        {
          products: selectedProducts,
          niche: selectedOpp?.niche || "Store",
          vendor: "AgencyFunnel",
        },
        `${(selectedOpp?.niche || "shopify").toLowerCase().replace(/\s+/g, "-")}-import.csv`
      );
    } catch (e) {
      if (e.needLogin) refreshAuth();
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  async function exportBrief() {
    setError("");
    setLoading("brief");
    try {
      await downloadBlob(
        "/api/export/brief",
        {
          format: "html",
          scout,
          selectedOpp,
          hunt,
          selectedProducts,
        },
        `${(selectedOpp?.niche || "signal-desk").toLowerCase().replace(/\s+/g, "-")}-brief.html`
      );
    } catch (e) {
      if (e.needLogin) refreshAuth();
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  async function saveCurrentProject() {
    if (!scout) {
      setError("Run a scout before saving a project");
      return;
    }
    setError("");
    setLoading("save");
    try {
      const saved = await api("/api/projects", {
        method: "POST",
        body: {
          id: projectId || undefined,
          name: selectedOpp?.niche || hunt?.niche || `Research ${new Date().toLocaleDateString()}`,
          regionFocus,
          budget,
          nicheHint,
          scout,
          selectedOpp,
          hunt,
          selectedProductIds: [...selectedIds],
        },
      });
      setProjectId(saved.id);
    } catch (e) {
      if (e.needLogin) refreshAuth();
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  async function openProject(id) {
    setError("");
    setLoading("load");
    try {
      const p = await api(`/api/projects/${id}`);
      setProjectId(p.id);
      setRegionFocus(p.regionFocus || "Global");
      setBudget(p.budget != null ? String(p.budget) : "500");
      setNicheHint(p.nicheHint || "");
      setScout(p.scout || null);
      setSelectedOpp(p.selectedOpp || null);
      setHunt(p.hunt || null);
      setSelectedIds(new Set(p.selectedProductIds || []));
      setSelectedProduct(p.hunt?.products?.[0] || null);
      setWinFilter("ALL");
      setView("radar");
    } catch (e) {
      if (e.needLogin) refreshAuth();
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: {} });
    setScout(null);
    setHunt(null);
    setProjectId(null);
    setView("home");
    setAuth((a) => ({ ...a, authenticated: false }));
  }

  if (auth.loading) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Signal Desk</h1>
          <p>Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (auth.required && !auth.authenticated) {
    return <Login onSuccess={() => setAuth((a) => ({ ...a, authenticated: true }))} />;
  }

  return (
    <>
    <GlobalActionProgress state={globalProgress} />
    <div className="shell">
      {showOnboarding ? <Onboarding onDone={() => setShowOnboarding(false)} /> : null}
      <header className="topbar">
        <div className="brand-block">
          <h1 className="brand">
            Product <span>Hunter AI</span>
          </h1>
          <p className="tagline">Trend intelligence · evidence → momentum → profit → Shopify</p>
        </div>
        <nav className="top-nav">
          <button type="button" className={view === "home" ? "nav-on" : ""} onClick={() => setView("home")}>
            Home
          </button>
          <button type="button" className={view === "radar" ? "nav-on" : ""} onClick={() => setView("radar")}>
            Product Radar
          </button>
          <button type="button" className={view === "desk" ? "nav-on" : ""} onClick={() => setView("desk")}>
            Discover
          </button>
          <button
            type="button"
            className={view === "settings" ? "nav-on" : ""}
            onClick={() => setView("settings")}
          >
            Settings
          </button>
        </nav>
        <div className="top-actions">
          {auth.required ? (
            <button type="button" className="ghost" onClick={logout}>
              Lock
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div className="error" style={{ margin: "0 1.25rem 0.75rem" }}>{error}</div> : null}

      {view === "home" ? (
        <HomeView
          onOpenDesk={() => {
            setView("desk");
          }}
          onOpenProject={openProject}
        />
      ) : null}

      {view === "radar" ? (
        <main className="radar-page">
          <div className="radar-hero">
            <div><div className="hero-kicker">PRODUCT RADAR</div><h2>See momentum before saturation.</h2><p>Trend, confidence, competition and Shopify readiness in one decision surface.</p></div>
            <button className="btn" style={{width:"auto"}} onClick={() => setView("desk")}>{hunt?.products?.length ? "Run another discovery" : "Discover products"}</button>
          </div>
          <div className="radar-search">
            <input value={radarQuery} onChange={(e)=>setRadarQuery(e.target.value)} placeholder="Search: under $50, TikTok momentum, pet products…" />
            <select value={radarMarket} onChange={(e)=>setRadarMarket(e.target.value)}>
              {["ALL","US","UK","CA","AU","DE","FR"].map(x=><option key={x}>{x}</option>)}
            </select>
          </div>
          {!hunt?.products?.length ? <div className="radar-empty"><h3>Your radar is ready.</h3><p>Run Discover once to populate evidence-based product intelligence.</p><button className="btn" style={{width:"auto"}} onClick={()=>setView("desk")}>Start discovery</button></div> : (
            <>
              <div className="radar-kpis">
                <div><b>{radarProducts.length}</b><span>Products</span></div>
                <div><b>{radarProducts.filter(p=>p.isTopPick).length}</b><span>Top picks</span></div>
                <div><b>{radarProducts.filter(p=>["EMERGING","DISCOVERED"].includes(p.trendStatus)).length}</b><span>Early opportunities</span></div>
                <div><b>{radarProducts.filter(p=>p.trendStatus==="SATURATING"||p.saturation?.risk==="HIGH").length}</b><span>Saturation risks</span></div>
              </div>
              <div className="lifecycle-tabs">
                {["ALL","ACCELERATING","EMERGING","STABLE","SATURATING","DECLINING"].map(s=><button key={s} className={trendFilter===s?"on":""} onClick={()=>setTrendFilter(s)}>{s}</button>)}
              </div>
              <div className="radar-grid">
                {radarProducts.filter(p=>trendFilter==="ALL"||p.trendStatus===trendFilter).map(p=>(
                  <article className="radar-card" key={p.id} data-ai-product-id={p.id}>
                    <div className="radar-card-top"><span className={`winner-pill ${String(p.winnerDecision?.verdict||"validate").toLowerCase()}`}>{p.isTopPick ? `Top pick #${p.winnerRank}` : (p.winnerDecision?.label||"Validate")}</span><span className="confidence">{p.dataConfidence||"LOW"} confidence</span></div>
                    <div className="lifecycle-line"><span className={`lifecycle ${String(p.trendStatus||"discovered").toLowerCase()}`}>{p.trendStatus||"DISCOVERED"}</span><strong>{p.winnerDecision?.score??"—"}/100 winner score</strong></div>
                    <h3>{p.title}</h3><p className="muted">{p.category}</p>
                    <div className="score-quads"><div><b>{p.trendScore??"—"}</b><span>Trend</span></div><div><b>{p.winning?.score??p.profitScore??"—"}</b><span>Profit</span></div><div><b>{p.competitionScore??p.winning?.components?.competition??"—"}</b><span>Competition</span></div><div><b>{p.marginPct??"—"}%</b><span>Margin</span></div></div>
                    <div className="platform-signals">{Object.entries(p.trendComponents||{}).slice(0,4).map(([k,v])=><span key={k}><em>{k}</em><b>{Math.round(Number(v)||0)}</b></span>)}</div>
                    <div className="why-mini"><strong>Why trending</strong><p>{p.whyTrending?.summary||"Not enough cross-platform evidence yet."}</p></div><div className="winner-reason"><strong>{p.isTopPick ? `Ranked #${p.winnerRank} of ${hunt?.products?.length || radarProducts.length}` : `${p.winnerDecision?.verifiedSources||0} verified/recent sources`}</strong><p>{p.winnerDecision?.reason}</p></div>
                    <div className="radar-actions"><button className="ghost" onClick={()=>{setSelectedProduct(p);setView("desk")}}>View intelligence</button><button className="btn" onClick={()=>{setSelectedIds(new Set([p.id]));setSelectedProduct(p);setView("desk")}}>Shopify actions</button></div>
                  </article>
                ))}
              </div>
            </>
          )}
        </main>
      ) : null}

      {view === "settings" ? <SettingsView /> : null}

      <Concierge product={selectedProduct} products={hunt?.products || []} />

      {view === "desk" ? (

      <div className="layout">
        <aside className="side">
          <ol className="steps">
            <li className={step === 1 ? "on" : step > 1 ? "done" : ""}>
              <span className="n">1</span>
              <div>
                <div>Discover markets</div>
                <div className="muted">Demand + cross-platform signals</div>
              </div>
            </li>
            <li className={step === 2 ? "on" : step > 2 ? "done" : ""}>
              <span className="n">2</span>
              <div>
                <div>Validate opportunity</div>
                <div className="muted">Trend + competition + profitability</div>
              </div>
            </li>
            <li className={step === 3 ? "on" : ""}>
              <span className="n">3</span>
              <div>
                <div>Analyze & launch</div>
                <div className="muted">Why Trending → supplier → Shopify</div>
              </div>
            </li>
          </ol>

          <label className="field">
            <span>Region</span>
            <select value={regionFocus} onChange={(e) => setRegionFocus(e.target.value)}>
              <option>Global</option>
              <option>US</option>
              <option>UK</option>
              <option>CA</option>
              <option>AU</option>
              <option>DE</option>
              <option>FR</option>
              <option>Gulf</option>
            </select>
          </label>
          <label className="field">
            <span>Budget USD</span>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
          <label className="field">
            <span>Niche hint</span>
            <input
              value={nicheHint}
              onChange={(e) => setNicheHint(e.target.value)}
              placeholder="pet, fitness…"
            />
          </label>
          <button className="btn" type="button" onClick={runScout} disabled={loading === "scout"}>
            {loading === "scout" ? "Researching…" : "Run market scout"}
          </button>
        </aside>

        <section>
          {error ? <div className="error">{error}</div> : null}
          <div className="desk-actions btn-row" style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              className="ghost"
              onClick={saveCurrentProject}
              disabled={!scout || loading === "save"}
            >
              {loading === "save" ? "Saving…" : projectId ? "Update project" : "Save project"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={exportBrief}
              disabled={!selectedOpp || loading === "brief"}
            >
              {loading === "brief" ? "Brief…" : "Download client brief"}
            </button>
            {projectId ? <span className="muted">Project saved · {projectId}</span> : null}
          </div>

          <div className="main-panel">
            {!scout ? (
              <div className="empty">
                <div>
                  <h2>Where should you sell next?</h2>
                  <p>
                    Set region and budget on the left, then run scout. You’ll get ranked
                    opportunities with hooks, offers, and projected order value.
                  </p>
                </div>
              </div>
            ) : hunt ? null : (
              <>
                <MarketVizBoard
                  opportunities={scout.opportunities}
                  selectedOpp={selectedOpp}
                  keepa={hunt?.keepa || scout.keepa}
                />
                {scout.socialTrends ? (
                  <SocialTrendsBoard
                    trends={scout.socialTrends}
                    onUseNiche={(title) => setNicheHint(String(title).slice(0, 80))}
                  />
                ) : null}
                <div className="section-head">
                  <div>
                    <h2>Ranked opportunities · {scout.count || scout.opportunities?.length || 0} Shopify niches</h2>
                    <p>
                      Source: {scout.source} · physical product niches for turnkey stores (top 10). Research score =
                      model + rules, not live marketplace scrape.
                    </p>
                  </div>
                </div>
                <div className="opp-grid">
                  {scout.opportunities.map((opp, i) => (
                    <article
                      key={opp.id}
                      className={`opp-card ${selectedOpp?.id === opp.id ? "active" : ""}`}
                      style={{ animationDelay: `${i * 40}ms` }}
                      onClick={() => setSelectedOpp(opp)}
                    >
                      <div className="opp-top">
                        <div>
                          <div className="rank-pill">#{opp.rank}</div>
                          <h3>{opp.niche}</h3>
                          <p className="muted">{opp.audience}</p>
                          <div className="flags" style={{ marginTop: "0.35rem" }}>
                            <FreeSignalChip freeSignal={opp.freeSignal} />
                          </div>
                        </div>
                        <div className="muted" style={{ textAlign: "right", fontSize: "0.85rem" }}>
                          <div>{opp.sellWhere?.primary}</div>
                          <div>{(opp.sellWhere?.geos || []).slice(0, 2).join(" · ")}</div>
                        </div>
                      </div>

                      <div className="metrics">
                        <div className="metric">
                          <b>{opp.rankScore}</b>
                          <span>Rank score</span>
                        </div>
                        <div className="metric">
                          <b>{opp.projectedMonthlyOrders?.base ?? "—"}</b>
                          <span>Orders / mo</span>
                        </div>
                        <div className="metric">
                          <b>${opp.estAovUsd}</b>
                          <span>Est. AOV</span>
                        </div>
                        <div className="metric">
                          <b>${Math.round(opp.projectedMonthlyRevenue?.base || 0).toLocaleString()}</b>
                          <span>Rev / mo</span>
                        </div>
                      </div>

                      <div className="bars">
                        <ScoreBar label="Demand" value={opp.scores?.demand} />
                        <ScoreBar label="Marketing" value={opp.marketingStrength || opp.scores?.marketing} />
                        <ScoreBar label="Order val" value={opp.scores?.orderValue} />
                      </div>

                      <div className="hook-box">
                        <strong>Hook</strong>
                        <p>{opp.marketing?.hook}</p>
                      </div>
                      <p className="muted">
                        <strong style={{ color: "var(--ink-soft)" }}>Offer:</strong> {opp.marketing?.offer}
                      </p>
                      <div className="route-grid">
                        <div className="route-box buy">
                          <strong>Where to source</strong>
                          <p>{opp.tradeRoutes?.buyInventoryFrom?.primary}</p>
                          <div className="loc-tags">
                            {(opp.tradeRoutes?.buyInventoryFrom?.platforms || []).map((p) => (
                              <span key={p}>{p}</span>
                            ))}
                          </div>
                        </div>
                        <div className="route-box sell">
                          <strong>Where to sell</strong>
                          <p>
                            {opp.tradeRoutes?.sellOfferOn?.primary}
                            {(opp.tradeRoutes?.sellOfferOn?.geos || []).length
                              ? ` · ${(opp.tradeRoutes.sellOfferOn.geos || []).join(", ")}`
                              : ""}
                          </p>
                          <div className="loc-tags">
                            {(opp.tradeRoutes?.sellOfferOn?.secondaryChannels || []).map((p) => (
                              <span key={p}>{p}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <ul className="angles">
                        {(opp.marketing?.adAngles || []).map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>

                      {(opp.riskFlags || []).length ? (
                        <div className="flags">
                          {opp.riskFlags.map((f) => (
                            <span className="flag" key={f}>
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="card-actions">
                        <button
                          type="button"
                          className="btn copper"
                          onClick={() => runHunt(opp)}
                          disabled={loading === "hunt"}
                        >
                          {loading === "hunt" && selectedOpp?.id === opp.id
                            ? "Hunting products…"
                            : "Hunt products"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {scout.serviceOffers?.length ? (
                  <>
                    <div className="section-head" style={{ marginTop: "1.5rem" }}>
                      <div>
                        <h2>Agency Model 2 · service offers</h2>
                        <p>
                          Not physical products. You sell a <strong>lead automation system</strong> (WordPress +
                          WhatsApp) to local businesses — high ticket. “Hunt products” does not apply.
                        </p>
                      </div>
                    </div>
                    <div className="opp-grid">
                      {scout.serviceOffers.map((opp) => (
                        <article key={opp.id} className="opp-card service-card">
                          <div className="opp-top">
                            <div>
                              <span className="flag">Service · not SKUs</span>
                              <h3>{opp.niche}</h3>
                              <p className="muted">{opp.audience}</p>
                            </div>
                            <div className="muted" style={{ textAlign: "right", fontSize: "0.85rem" }}>
                              <div>{opp.sellWhere?.primary}</div>
                              <div>~${opp.estAovUsd} package</div>
                            </div>
                          </div>
                          <div className="hook-box">
                            <strong>Hook</strong>
                            <p>{opp.marketing?.hook}</p>
                          </div>
                          <p className="muted">{opp.note || opp.whyNow}</p>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>

          {hunt ? (
            <div className="products-panel">
              <div className="toolbar">
                <div>
                  <h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "1.25rem" }}>
                    Products · {hunt.niche || selectedOpp?.niche} · {hunt.count || hunt.products?.length || 0} SKUs
                  </h2>
                  <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                    Winning scorecard + Trend Intelligence V2. Trend score is separate from profitability.{" "}
                    {hunt.note || `${hunt.source} catalog`}
                  </p>
                  <div className="win-summary" style={{ marginTop: "0.5rem" }}>
                    {["ALL","ACCELERATING","EMERGING","STABLE","DECLINING","SATURATING"].map((status) => (
                      <button key={status} type="button" className={`win-chip ${trendFilter === status ? "on" : ""}`} onClick={() => setTrendFilter(status)}>
                        {status === "ALL" ? "All trends" : status}
                      </button>
                    ))}
                  </div>
                  {hunt.winningSummary ? (
                    <div className="win-summary">
                      <button
                        type="button"
                        className={`win-chip ${winFilter === "ALL" ? "on" : ""}`}
                        onClick={() => setWinFilter("ALL")}
                      >
                        All {hunt.winningSummary.total}
                      </button>
                      <button
                        type="button"
                        className={`win-chip pass ${winFilter === "PASS" ? "on" : ""}`}
                        onClick={() => setWinFilter("PASS")}
                      >
                        PASS {hunt.winningSummary.pass}
                      </button>
                      <button
                        type="button"
                        className={`win-chip watch ${winFilter === "WATCH" ? "on" : ""}`}
                        onClick={() => setWinFilter("WATCH")}
                      >
                        WATCH {hunt.winningSummary.watch}
                      </button>
                      <button
                        type="button"
                        className={`win-chip fail ${winFilter === "FAIL" ? "on" : ""}`}
                        onClick={() => setWinFilter("FAIL")}
                      >
                        FAIL {hunt.winningSummary.fail}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setHunt(null);
                      setSelectedProduct(null);
                      setSelectedIds(new Set());
                    }}
                  >
                    Back to categories
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={saveCurrentProject}
                    disabled={!scout || loading === "save"}
                  >
                    {loading === "save" ? "Saving…" : projectId ? "Update project" : "Save project"}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={exportBrief}
                    disabled={!selectedOpp || loading === "brief"}
                  >
                    {loading === "brief" ? "Brief…" : "Client brief"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "auto" }}
                    onClick={exportCsv}
                    disabled={!selectedProducts.length || loading === "export"}
                  >
                    {loading === "export"
                      ? "Exporting…"
                      : `Export ${selectedProducts.length} SKUs`}
                  </button>
                </div>
              </div>

              <ProductDetailPanel
                key={selectedProduct?.id || "none"}
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
              />

              {filteredHuntProducts.length ? (
                <div className="table-wrap" style={{ marginTop: selectedProduct ? "1rem" : 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th></th>
                        <th>#</th>
                        <th>Win</th>
                        <th>Trend</th>
                        <th>Product</th>
                        <th>Buy cost</th>
                        <th>Sell</th>
                        <th>Margin</th>
                        <th>Source</th>
                        <th>Links</th>
                        <th>Sell on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHuntProducts.map((p) => (
                        <tr
                          key={p.id}
                          className={`${p.rejected ? "rejected" : ""} ${selectedProduct?.id === p.id ? "row-active" : ""} win-row-${(p.winning?.verdict || "none").toLowerCase()}`}
                          onClick={() => setSelectedProduct(p)}
                          style={{ cursor: "pointer" }}
                        >
                          <td
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={() => toggleProduct(p.id)}
                            />
                          </td>
                          <td>{p.rank}</td>
                          <td>
                            <WinningBadge winning={p.winning} />
                          </td>
                          <td>
                            <strong>{p.trendScore ?? "—"}</strong>
                            <div className="prod-cat">{p.trendStatus || "DISCOVERED"} · {p.dataConfidence || "LOW"} confidence</div>
                          </td>
                          <td>
                            <div className="prod-title">{p.title}</div>
                            <div className="prod-cat">{p.category}</div>
                            {p.problemSolved ? (
                              <div className="prod-problem">Solves: {p.problemSolved}</div>
                            ) : null}
                            {p.rejected ? <span className="gate">Gate fail</span> : null}
                          </td>
                          <td>
                            <strong>${Number(p.estCostUsd).toFixed(2)}</strong>
                            <div className="prod-cat">est. supplier</div>
                          </td>
                          <td>
                            <strong>${Number(p.estSellPriceUsd).toFixed(2)}</strong>
                            <div className="prod-cat">AOV ~${p.estAovUsd}</div>
                          </td>
                          <td>{p.marginPct}%</td>
                          <td>
                            <div className="loc-block">
                              <strong>{(p.sourceFrom?.platforms || []).slice(0, 2).join(" / ") || "AutoDS"}</strong>
                              <div className="prod-cat">{p.sourceFrom?.searchQuery}</div>
                            </div>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="link-row">
                              {(p.productLinks?.links || [])
                                .filter((l) => ["aliexpress", "amazon", "cj"].includes(l.id))
                                .map((l) => (
                                  <a
                                    key={l.id}
                                    className="ext-link"
                                    href={l.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {l.label}
                                  </a>
                                ))}
                            </div>
                          </td>
                          <td>
                            <div className="loc-block">
                              <strong>{p.soldOn?.yourChannel || "Shopify"}</strong>
                              <div className="prod-cat">
                                {(p.soldOn?.whereCompetitorsSell || []).slice(0, 2).join(" · ")}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : hunt.products?.length ? (
                <p className="muted" style={{ marginTop: "1rem" }}>
                  No products in this filter. Switch to All / PASS / WATCH / FAIL.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
      ) : null}
    </div>
    </>
  );
}
