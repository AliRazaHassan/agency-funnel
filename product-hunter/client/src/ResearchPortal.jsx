import { parseEvidenceFile } from "./evidenceImport.js";
import { useEffect, useState, useRef } from "react";
import { api, downloadBlob } from "./api.js";
const ECON = {
  sellingPrice: "",
  discount: 0,
  productCost: "",
  shipping: "",
  landedCost: "",
  duties: 0,
  feesPct: 3.5,
  feeFixed: 0,
  packaging: 0,
  returnsPct: 5,
  adCpa: "",
};
const LABELS = {
  sellingPrice: "Selling price $",
  discount: "Discount %",
  productCost: "Item cost $",
  shipping: "Shipping $",
  landedCost: "Landed cost $ (item + shipping)",
  duties: "Duties / taxes $",
  feesPct: "Payment / platform fees %",
  feeFixed: "Fixed fee $",
  packaging: "Packaging / personalization $",
  returnsPct: "Returns allowance %",
  adCpa: "Advertising CPA $",
};
const emptyObservation = {
  platform: "amazon",
  title: "",
  externalId: "",
  market: "US",
  scope: "product",
  metric: "bought_count",
  value: "",
  unit: "bought in past month",
  dataAt: "",
  sourceUrl: "",
  niche: "",
  identityKey: "",
  tags: "",
};
const money = (v) => (v == null ? "Unknown" : `$${v.toFixed(2)}`);
export function ResearchPortal({ initialQuery = "", autoResearch = false }) {
  const started = useRef(false);
  const revision = useRef(0);
  const [hydrating,setHydrating]=useState(true);
  const [huntJob,setHuntJob]=useState(null);
  const [huntPlatform,setHuntPlatform]=useState("tiktok");
  const [matchSource,setMatchSource]=useState(null);
  const requestId=useRef(null);
  const [query, setQuery] = useState(initialQuery),
    [market, setMarket] = useState("US"),
    [season, setSeason] = useState(
      /christmas/i.test(initialQuery) ? "christmas-2026" : "",
    ),
    [deliveryTarget, setDeliveryTarget] = useState(""),
    [cost, setCost] = useState(""),
    [margin, setMargin] = useState(""),
    [result, setResult] = useState(null),
    [status, setStatus] = useState(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [importMessage,setImportMessage] = useState(""),
    [tab, setTab] = useState("products"),
    [selected, setSelected] = useState(null),
    [econ, setEcon] = useState(ECON),
    [obs, setObs] = useState(emptyObservation),
    [sessions, setSessions] = useState([]),
    [quote, setQuote] = useState({
      supplier: "",
      url: "",
      variant: "",
      quotedAt: "",
      processingDays: "",
      transitDays: "",
      personalizationDays: 0,
      moq: "",
      origin: "",
      warehouse: "",
      service: "",
      stockStatus: "unknown",
    }),
    [test, setTest] = useState({ spend: "", revenue: "", purchases: "" });
  useEffect(() => {
    api("/api/research/status")
      .then(setStatus)
      .catch((e) => setError(e.message));
    api("/api/research/state")
      .then((d) => {
        const pendingHunt=(d.hunts || []).findLast(h=>["RUNNING","STARTING","UNKNOWN"].includes(h.status)) || null;
        setHuntJob(pendingHunt);
        setSessions(current=>[...new Map([...d.sessions,...current].map(s=>[s.id,s])).values()]);
        if (
          d.sessions.length &&
          revision.current === 0 &&
          !autoResearch &&
          !initialQuery
        ) {
          const last = d.sessions.at(-1);
          setResult(last);
          setQuery(last.constraints.query || "");
          setMarket(last.constraints.market);
          setSeason(last.constraints.season || "");
          setCost(last.constraints.maxLandedCost ?? "");
          setMargin(last.constraints.minMargin ?? "");
          setDeliveryTarget(last.constraints.deliveryTarget || "");
        }
        if(pendingHunt && revision.current===0){setQuery(pendingHunt.query);setMarket(pendingHunt.market);setHuntPlatform(pendingHunt.platform || "tiktok");}
      })
      .catch((e) => setError(e.message))
      .finally(()=>setHydrating(false));
  }, []);
  useEffect(() => {
    if (autoResearch && !started.current) {
      started.current = true;
      run(true);
    }
  }, []);
  useEffect(() => {
    if(!["STARTING","RUNNING","UNKNOWN"].includes(huntJob?.status))return;
    let cancelled=false,timer;
    async function poll(){
      try {
        const job=await api(`/api/research/hunt/${huntJob.id}`);
        if(cancelled)return;
        setHuntJob(job);
        if(["STARTING","RUNNING"].includes(job.status)){timer=setTimeout(poll,3000);return;}
        if(job.status==="SUCCEEDED"){
          setImportMessage(`Automatic hunt finished: ${job.acceptedVideos} accepted source records, ${job.count} metrics. Exclusions: ${JSON.stringify(job.rejected)}. No sales inferred.`);
          await run(true);
          setTab("providers");
        } else {
          await run(true);
          setError(job.reason || `Hunt ended: ${job.status}`);
          setTab("providers");
        }
      }catch(e){if(!cancelled){setError(e.message);timer=setTimeout(poll,10000);}}
    }
    poll();return()=>{cancelled=true;clearTimeout(timer);};
  },[huntJob?.id,huntJob?.status]);
  async function startAutomaticHunt(){
    setError("");setBusy("Checking free credits and starting automatic hunt…");
    if(huntJob && !["RUNNING","STARTING","UNKNOWN"].includes(huntJob.status))requestId.current=null;
    requestId.current ||= crypto.randomUUID();
    try {
      const job=await api("/api/research/hunt/start",{method:"POST",body:{query,market,platform:huntPlatform,requestId:requestId.current}});
      setHuntJob(job);setTab("providers");
      if(!["RUNNING","STARTING","UNKNOWN"].includes(job.status))requestId.current=null;
    }catch(e){setError(e.message);}finally{setBusy("");}
  }
  async function syncApify(payload) {
    setBusy("Checking provider dates, market and original links…");
    setError("");
    try {
      const response = await api("/api/research/apify/sync", { method: "POST", body: { ...payload, market, query } });
      await run(false);
      setTab("providers");
      setImportMessage(`Imported ${response.acceptedVideos} recent videos (${response.count} metrics). Excluded: ${Object.entries(response.rejected).map(([reason,count]) => `${count} ${reason}`).join("; ") || "none"}. Videos are discovery signals; exact product and sales remain unverified.`);
    } catch(e) { setError(e.message); } finally { setBusy(""); }
  }
  async function saveMatch(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(""); setBusy("Saving exact product match…");
    try {
      const saved = await api("/api/research/match", { method: "POST", body: {
        observationId: matchSource.id, title: form.get("title"),
        listingUrl: form.get("listingUrl"), variant: form.get("variant"), confirmed: form.get("confirmed") === "on",
      }});
      setMatchSource(null);
      // Unknown costs cannot satisfy a cost/margin filter. Clear those filters
      // visibly while opening the newly matched candidate for quote entry.
      const r = await api("/api/research/research", { method: "POST", body: {
        query, constraints: { market, season, ...(deliveryTarget ? {deliveryTarget} : {}) }, refresh: false,
      }});
      setCost(""); setMargin("");
      setResult(r); setSessions(s => [...s, r]); setTab("products");
      const product = r.products.find(p => p.id === saved.productId);
      if (product) open(product);
      setImportMessage("Product match saved as user supplied. Add an exact supplier quote and advertising CPA before assessing profit.");
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  }
  async function run(refresh = true) {
    const current = ++revision.current;
    setBusy(
      refresh
        ? "Collecting available providers and ranking evidence…"
        : "Applying filters to saved observations…",
    );
    setError("");
    try {
      const r = await api("/api/research/research", {
        method: "POST",
        body: {
          query,
          constraints: {
            market,
            season,
            ...(deliveryTarget ? { deliveryTarget } : {}),
            ...(cost !== "" ? { maxLandedCost: +cost } : {}),
            ...(margin !== "" ? { minMargin: +margin } : {}),
          },
          refresh,
        },
      });
      if (current !== revision.current) return;
      setResult(r);
      setSelected(null);
      setSessions((s) => [...s, r]);
      return r;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function save(body) {
    setError("");
    setBusy("Saving research record…");
    try {
      await api(`/api/research/products/${selected.id}`, {
        method: "POST",
        body,
      });
      const r = await run(false);
      if (r) {
        const next = r.products.find((p) => p.id === selected.id) || null;
        setSelected(next);
        if (next) setEcon({ ...ECON, ...next.economics.inputs });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  function open(p) {
    setSelected(p);
    setQuote({
      supplier: "",
      url: p.productMatch?.listingUrl || "",
      variant: p.productMatch?.variant || "",
      quotedAt: "",
      processingDays: "",
      transitDays: "",
      personalizationDays: 0,
      moq: "",
      origin: "",
      warehouse: "",
      service: "",
      stockStatus: "unknown",
    });
    setEcon({ ...ECON, ...p.economics.inputs });
  }
  async function importRows(rows) {
    setBusy("Validating and saving evidence…");
    setError("");
    try {
      const r = await api("/api/research/import", {
        method: "POST",
        body: { observations: rows },
      });
      setBusy(`${r.count} observations saved`);
      await run(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="stage-page evidence-portal">
      <div className="stage-hero">
        <div className="hero-kicker">SIGNAL DESK · EVIDENCE RESEARCH</div>
        <h2>Find evidence. Compare products. Plan a test.</h2>
        <p>
          Research the US market by default. Supplier catalog facts are not demand proof. Every candidate starts with an
          exact, dated source observation.
        </p>
      </div>
      <form
        className="research-query viz-card"
        onSubmit={(e) => {
          e.preventDefault();
          run(true);
        }}
      >
        <fieldset disabled={hydrating || huntJob?.status === "RUNNING"} className="research-query-fieldset">
        <label className="wide">
          Research request / concierge
          <input
            aria-label="Research request"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find Christmas pet products in the US"
          />
        </label>
        <label>
          Market
          <select
            aria-label="Market"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
          >
            {["US", "UK", "CA", "AU", "DE", "FR"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Season
          <select
            aria-label="Season"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          >
            <option value="">Any season</option>
            <option value="christmas-2026">Christmas 2026</option>
          </select>
        </label>
        <label>
          Customer delivery target
          <input
            type="date"
            value={deliveryTarget}
            onChange={(e) => setDeliveryTarget(e.target.value)}
          />
        </label>
        <label>
          Maximum landed cost $
          <input
            type="number"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </label>
        <label>
          Minimum pre-ad margin %
          <input
            type="number"
            min="0"
            max="100"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
          />
        </label>
        <button className="btn" disabled={!!busy}>
          Research / refresh providers
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!!busy}
          onClick={() => run(false)}
        >
          Filter saved evidence
        </button>
        </fieldset>
      </form>
      <div className="btn-row"><label>Automatic source <select aria-label="Automatic source" value={huntPlatform} onChange={e=>setHuntPlatform(e.target.value)} disabled={!!busy || huntJob?.status==="RUNNING"}><option value="tiktok">TikTok discovery</option><option value="meta">Meta active ads</option><option value="google">Google Trends</option></select></label><button className="btn" onClick={startAutomaticHunt} disabled={hydrating || !!busy || !query.trim() || !status?.apify?.configured || ["RUNNING","STARTING","UNKNOWN"].includes(huntJob?.status)}>Start automatic hunt · free credits only</button></div>
      <p>Checks FREE account and remaining credits; at most $0.50 reserved per hunt, 8 hunts per billing cycle, 10 videos/ads or 1 Google Trends query, 120-second video/ad timeout; Google Trends up to 6 minutes. Available direct providers refresh after completion. Choose Google Trends for a capped credit-backed collection. Missing credentials or unavailable sources are reported.</p>
      {!status?.apify?.configured ? <p>Automatic hunting needs APIFY_TOKEN connected in Render. Your token stays on the server; do not paste it into a query.</p> : null}
      {huntJob ? <p role="status">Hunt: {huntJob.status} · {huntJob.query} {huntJob.reason || ""}</p> : null}
      {busy ? <p role="status">{busy}</p> : null}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {importMessage ? <p role="status">{importMessage}</p> : null}
      <nav className="btn-row" aria-label="Research sections">
        {[
          "products",
          "niches",
          "shortlist",
          "history",
          "providers",
          "import",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "btn" : "ghost"}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button
          className="ghost"
          disabled={!result || !!busy}
          onClick={() =>
            downloadBlob(
              "/api/research/export",
              { sessionId: result.id },
              "signal-desk-research.csv",
            ).catch((e) => setError(e.message))
          }
        >
          Export visible results
        </button>
      </nav>
      {result ? (
        <p>
          {result.count} candidates · {result.constraints.market} ·{" "}
          {new Date(result.createdAt).toLocaleString()} · {result.note}
        </p>
      ) : null}
      {["products", "shortlist"].includes(tab) ? (
        <>
          {!result?.products?.length ? (
            <div className="viz-card">
              <h3>No relevant evidence-backed candidates yet</h3>
              <p>
                Collect observations from available providers or import dated
                product records. Cost and margin filters exclude candidates with
                incomplete economics. An empty shortlist is a source gap to
                resolve.
              </p>
              <button className="ghost" onClick={() => setTab("import")}>
                Add source observations
              </button>
            </div>
          ) : null}
          <div className="christmas-grid">
            {(result?.products || [])
              .filter((p) => tab !== "shortlist" || p.shortlisted)
              .map((p) => (
                <article className="viz-card" key={p.id}>
                  <span className="hero-kicker">
                    {p.niche} · {p.market}
                  </span>
                  <h3>{p.title}</h3>
                  <strong>{p.verdict}</strong>
                  <p>
                    Research confidence {p.confidence}/100 ·{" "}
                    {p.dimensions.platformCoverage} demand platforms
                  </p>
                  {p.dimensions.catalogSources ? <p>Supplier catalog saved · retail prices are not landed costs or shipping quotes.</p> : null}
                  <p>
                    Contribution {money(p.economics.contribution)} · margin{" "}
                    {p.economics.marginPct ?? "Unknown"}% · delivery{" "}
                    {p.delivery.status}
                  </p>
                  <p>Estimated profit after ads {money(p.economics.profitAfterAds)} · break-even CPA {money(p.economics.breakEvenCpa)}</p>
                  <p>{p.mainRisk}</p>
                  <button className="btn" onClick={() => open(p)}>
                    Compare evidence & economics
                  </button>
                </article>
              ))}
          </div>
        </>
      ) : null}
      {tab === "niches" ? (
        <div className="christmas-grid">
          {(result?.niches || []).map((n) => (
            <article className="viz-card" key={n.name}>
              <h3>{n.name}</h3>
              <p>
                {n.count} exact products · {n.platforms.join(", ")}
              </p>
              <p>{n.reason}</p>
              <button
                className="ghost"
                onClick={() => {
                  setQuery(n.name);
                  setTab("products");
                }}
              >
                Research this niche
              </button>
            </article>
          ))}
          {!result?.niches?.length ? (
            <p>No niches supported by product observations in this run.</p>
          ) : null}
        </div>
      ) : null}
      {tab === "history" ? (
        <div className="viz-card">
          <h3>Saved research sessions</h3>
          {sessions
            .slice()
            .reverse()
            .map((s) => (
              <p key={s.id}>
                <button
                  className="ghost"
                  onClick={() => {
                    setResult(s);
                    setQuery(s.constraints.query);
                    setMarket(s.constraints.market);
                    setSeason(s.constraints.season || "");
                    setCost(s.constraints.maxLandedCost ?? "");
                    setMargin(s.constraints.minMargin ?? "");
                    setDeliveryTarget(s.constraints.deliveryTarget || "");
                    setTab("products");
                  }}
                >
                  {new Date(s.createdAt).toLocaleString()} ·{" "}
                  {s.constraints.query || "Broad research"} · {s.count} products
                </button>
              </p>
            ))}
        </div>
      ) : null}
      {tab === "providers" ? (
        <div className="viz-card">
          <h3>Provider health & configuration</h3>
          <p>Free source research: <a target="_blank" rel="noreferrer" href={`https://trends.google.com/trends/explore?geo=${encodeURIComponent(market === "UK" ? "GB" : market)}&date=today%203-m&q=${encodeURIComponent(query)}`}>Google Trends</a> · <a target="_blank" rel="noreferrer" href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(market)}&q=${encodeURIComponent(query)}&search_type=keyword_unordered`}>Meta active ads</a> · <a target="_blank" rel="noreferrer" href="https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en">TikTok Creative Center</a>. Links open research tools; they are not evidence until a dated observation is saved.</p>
          <h4>TikTok / Apify free-credit workflow</h4>
          <p>Import an existing TikTok scraper export or sync a dataset. This action never starts an Actor or buys credits. Only videos published in the last 7 days with a matching source country are accepted. Creation country does not prove buyer location.</p>
          <form onSubmit={e => { e.preventDefault(); const id = new FormData(e.currentTarget).get("datasetId"); syncApify({datasetId:id}); }}>
            <label>Existing Apify dataset ID <input name="datasetId" required minLength={10} maxLength={40} disabled={!!busy || !status?.apify?.configured} /></label>
            <button disabled={!!busy || !status?.apify?.configured}>Sync existing dataset</button>
          </form>
          <p>{status?.apify?.configured ? "Server connection available." : "Server token not configured. JSON export import works without a token."}</p>
          <label>TikTok JSON export <input type="file" accept=".json,application/json" disabled={!!busy} onChange={async e => {
            const file=e.target.files?.[0]; if(!file) return;
            try { if(file.size > 2000000) throw new Error("Use a JSON export smaller than 2 MB"); const items=JSON.parse(await file.text()); await syncApify({items}); } catch(error) { setError(error.message); }
            e.target.value="";
          }} /></label>
          <h4>Discovery evidence</h4>
          <p>These are query/video signals, separate from verified exact products. Search indices and engagement are not sales.</p>
          {(result?.discoveries || []).map(o => <div key={o.id}><p><a href={o.sourceUrl} target="_blank" rel="noreferrer">{o.title}</a> · {o.value} {o.unit} · {new Date(o.dataAt).toLocaleDateString()} · {Date.now()-Date.parse(o.dataAt)>(o.platform === "google" ? 14 : 7)*86400000 ? "Check freshness" : "Recent"}</p>{["tiktok","meta"].includes(o.platform) ? <button className="ghost" disabled={!!busy} onClick={()=>setMatchSource(o)}>Match exact product</button> : null}</div>)}
          {matchSource ? <form className="research-query" onSubmit={saveMatch} aria-label="Match discovery to exact product">
            <h4>Match discovery to exact product</h4>
            <p>Inspect the original video/ad and supplier listing. Match the same item and variant. This records your assertion and preserves the original signal; it does not verify sales.</p>
            <a href={matchSource.sourceUrl} target="_blank" rel="noreferrer">Inspect original discovery</a>
            <label>Matched product title<input name="title" required maxLength={300} /></label>
            <label>Exact supplier listing URL<input name="listingUrl" type="url" required /></label>
            <label>Exact variant / size / pack<input name="variant" required maxLength={300} /></label>
            <label><input name="confirmed" type="checkbox" required />I checked that this is the same item and variant</label>
            <button className="btn" disabled={!!busy}>Save product match</button>
            <button type="button" className="ghost" onClick={()=>setMatchSource(null)}>Cancel match</button>
          </form> : null}

          <p>
            Storage: {status?.storage || "checking"} · {status?.monitoring}
          </p>
          {status?.googleTrends ? (
            <p className="muted">
              Google Trends direct: {status.googleTrends.directEnabled ? "ON (ENABLE_GOOGLE_TRENDS=1)" : "OFF"} · {status.googleTrends.semantics}
            </p>
          ) : null}
          {status?.providers.map((p) => (
            <div key={p.platform}>
              <h4>
                {p.platform.toUpperCase()} ·{" "}
                <span className={`source-status ${String(p.mode || "UNAVAILABLE").toLowerCase()}`}>
                  {p.mode || "UNAVAILABLE"}
                </span>
                {" · "}
                {p.configured ? "adapter available" : "configuration required"}
              </h4>
              <p>{p.note}</p>
              {p.preferredPath ? <p className="muted">Preferred path: {p.preferredPath}</p> : null}
              {result?.providers
                ?.filter((r) => r.platform === p.platform)
                .map((r) => (
                  <p key={r.platform}>
                    <span className={`source-status ${String(r.mode || r.status || "unavailable").toLowerCase()}`}>
                      {r.mode || r.status}
                    </span>
                    {": "}
                    {r.reason || `${r.count} observations`} · {r.completedAt}
                  </p>
                ))}
            </div>
          ))}
        </div>
      ) : null}
      {tab === "import" ? (
        <section className="viz-card">
          <h3>Add a source observation</h3>
          <p>
            Use original listing/ad IDs and underlying observation dates.
            Imports are labeled user supplied. Shared identity keys explicitly
            link the same exact variant across platforms; leave blank when
            unsure.
          </p>
          <p>For supplier pages choose supplier and use catalog_price (USD retail price) or rating_count (cumulative reviews). These records never count as sales, attention or cross-platform demand. Keep exact variant and shipping limitations in the imported limitations field.</p>
          <form
            className="research-query"
            onSubmit={(e) => {
              e.preventDefault();
              importRows([
                {
                  ...obs,
                  tags: obs.tags.split(",").map((t) => t.trim()),
                  identityKey: obs.identityKey || undefined,
                },
              ]);
            }}
          >
            {Object.keys(emptyObservation).map((k) => (
              <label key={k}>
                {{
                  externalId: "Exact listing / ad ID",
                  dataAt: "Underlying data date",
                  sourceUrl: "Original source URL",
                  identityKey: "Shared exact identity key (optional)",
                  tags: "Tags (comma separated)",
                }[k] || k}
                {k === "platform" ? (
                  <select
                    value={obs[k]}
                    onChange={(e) => setObs({ ...obs, [k]: e.target.value,
                      ...(e.target.value === "supplier" ? { scope: "product", metric: "catalog_price", unit: "USD retail price" } : {}),
                    })}
                  >
                    {["amazon", "meta", "tiktok", "google", "supplier"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                ) : k === "scope" ? (
                  <select
                    value={obs[k]}
                    onChange={(e) => setObs({ ...obs, [k]: e.target.value })}
                  >
                    <option>product</option>
                    <option>niche</option>
                  </select>
                ) : (
                  <input
                    type={
                      k === "dataAt"
                        ? "datetime-local"
                        : k === "value"
                          ? "number"
                          : "text"
                    }
                    required={!["identityKey", "tags", "niche"].includes(k)}
                    value={obs[k]}
                    onChange={(e) => setObs({ ...obs, [k]: e.target.value })}
                  />
                )}
              </label>
            ))}
            <button className="btn" disabled={!!busy}>
              Save observation
            </button>
          </form>
          <label>
            Import structured CSV / JSON file
            <input
              aria-label="Import evidence JSON"
              type="file"
              accept=".json,.csv"
              onChange={async (e) => {
                try {
                  const f = e.target.files[0];
                  await importRows(parseEvidenceFile(await f.text(), f.name));
                } catch {
                  setError("Invalid CSV / JSON evidence file");
                }
              }}
            />
          </label>
          <p>
            Required fields: platform, externalId, title, market, scope, metric,
            value, unit, dataAt, sourceUrl. Optional: niche, tags, identityKey,
            correlationKey, period, currency, limitations.
          </p>
        </section>
      ) : null}
      {selected ? (
        <section
          className="viz-card research-detail"
          aria-label="Product research detail"
        >
          <div className="btn-row">
            <h3>{selected.title}</h3>
            <button className="ghost" onClick={() => setSelected(null)}>
              Close product
            </button>
            <button
              className="btn"
              disabled={!!busy}
              onClick={() => save({ shortlisted: !selected.shortlisted })}
            >
              {selected.shortlisted
                ? "Remove from shortlist"
                : "Save to shortlist"}
            </button>
          </div>
          <p>
            <strong>{selected.verdict}</strong> · {selected.matchExplanation}
          </p>
          <p>{selected.nextAction}</p>
          <p>{selected.conditions}</p>
          {selected.productMatch ? <p>User-confirmed match: <a href={selected.productMatch.listingUrl} target="_blank" rel="noreferrer">Supplier listing</a> · {selected.productMatch.variant}. Costs and delivery still require a quote.</p> : null}
          <h4>Original observations</h4>
          <div className="research-table">
            <table>
              <thead>
                <tr>
                  {[
                    "Platform",
                    "Metric",
                    "Observed",
                    "Underlying date",
                    "Freshness",
                    "Provenance",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.observations.map((o) => (
                  <tr key={o.id}>
                    <td>{o.platform}</td>
                    <td>{o.metric}</td>
                    <td>
                      {o.value} {o.unit}
                    </td>
                    <td>{o.dataAt}</td>
                    <td>
                      {o.freshness.status} · {o.scope}
                    </td>
                    <td>
                      <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                        Original source
                      </a>
                      <p>
                        {o.provider} · {o.dataStatus}
                      </p>
                      <p>{o.limitations}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Scoring inputs and assumptions</summary>
            <p>
              Version {selected.scoreVersion}. Confidence weights: 15 per fresh
              platform (max 4), 20 for observed positive sales, 10 each for
              competition, complete economics and dated delivery; cap 100.
              Supplier catalog facts, modeled and stale records excluded from demand scoring. No competition metric means
              unknown competition.
            </p>
          </details>
          <h4>Supplier options</h4>
          {selected.quotes.map((q) => (
            <p key={q.id}>
              <a href={q.url} target="_blank" rel="noreferrer">
                {q.supplier} · {q.variant}
              </a>{" "}
              · {q.quotedAt} · {q.verificationStatus}{" "}
              <button
                className="ghost"
                onClick={() => save({ selectedQuoteId: q.id })}
              >
                Use this quote
              </button>
            </p>
          ))}
          <form
            className="research-query"
            onSubmit={(e) => {
              e.preventDefault();
              save({
                quote: {
                  ...quote,
                  quotedAt: new Date(quote.quotedAt).toISOString(),
                  economics: econ,
                  destination: market,
                  currency: "USD",
                },
              });
            }}
          >
            {Object.keys(quote).map((k) => (
              <label key={k}>
                {k}
                <input
                  required={
                    !["origin", "warehouse", "service", "moq"].includes(k)
                  }
                  type={
                    k === "quotedAt"
                      ? "datetime-local"
                      : /Days|moq/.test(k)
                        ? "number"
                        : "text"
                  }
                  min="0"
                  value={quote[k]}
                  onChange={(e) => setQuote({ ...quote, [k]: e.target.value })}
                />
              </label>
            ))}
            <button className="btn" disabled={!!busy}>
              Save supplier quote with current costs
            </button>
          </form>
          <h4>Unit economics · editable USD assumptions</h4>
          <form
            className="research-query"
            onSubmit={(e) => {
              e.preventDefault();
              save({ economics: econ });
            }}
          >
            {Object.entries(LABELS).map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={econ[k] ?? ""}
                  onChange={(e) => setEcon({ ...econ, [k]: e.target.value })}
                />
              </label>
            ))}
            <button className="btn" disabled={!!busy}>
              Calculate & save economics
            </button>
          </form>
          <p>
            Contribution {money(selected.economics.contribution)} · break-even
            CPA {money(selected.economics.breakEvenCpa)} · target CPA{" "}
            {money(selected.economics.targetCpa)} · break-even ROAS{" "}
            {selected.economics.breakEvenRoas ?? "Unknown"} · profit after ads{" "}
            {money(selected.economics.profitAfterAds)}
          </p>
          <p>
            {selected.economics.complete
              ? selected.economics.assumptions
              : `Missing inputs: ${selected.economics.missing.join(", ")}`}
          </p>
          <p>
            Delivery: {selected.delivery.status}. {selected.delivery.reason}{" "}
            Latest planned order{" "}
            {selected.delivery.latestOrderDate || "unknown"}; test deadline{" "}
            {selected.delivery.testDeadline || "unknown"}.
          </p>
          <h4>Recorded test</h4>
          <form
            className="research-query"
            onSubmit={(e) => {
              e.preventDefault();
              save({ test });
            }}
          >
            {Object.keys(test).map((k) => (
              <label key={k}>
                {k}
                <input
                  required
                  min="0"
                  type="number"
                  step="0.01"
                  value={test[k]}
                  onChange={(e) => setTest({ ...test, [k]: e.target.value })}
                />
              </label>
            ))}
            <button className="btn" disabled={!!busy}>
              Record test results
            </button>
          </form>
          <p>
            {selected.tests.length} tests · {selected.history.length} saved
            changes. Evidence refresh preserves quotes and tests.
          </p>
        </section>
      ) : null}
    </main>
  );
}
