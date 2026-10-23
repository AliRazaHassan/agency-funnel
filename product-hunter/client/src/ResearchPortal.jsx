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
  adCpa: 0,
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
          Research the US market by default. Every candidate starts with an
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
        <fieldset disabled={hydrating} className="research-query-fieldset">
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
      {busy ? <p role="status">{busy}</p> : null}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
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
                    {p.dimensions.platformCoverage} platforms
                  </p>
                  <p>
                    Contribution {money(p.economics.contribution)} · margin{" "}
                    {p.economics.marginPct ?? "Unknown"}% · delivery{" "}
                    {p.delivery.status}
                  </p>
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
          <p>
            Storage: {status?.storage || "checking"} · {status?.monitoring}
          </p>
          {status?.providers.map((p) => (
            <div key={p.platform}>
              <h4>
                {p.platform.toUpperCase()} ·{" "}
                {p.configured ? "adapter available" : "configuration required"}
              </h4>
              <p>{p.note}</p>
              {result?.providers
                ?.filter((r) => r.platform === p.platform)
                .map((r) => (
                  <p key={r.platform}>
                    {r.status}: {r.reason || `${r.count} observations`} ·{" "}
                    {r.completedAt}
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
                    onChange={(e) => setObs({ ...obs, [k]: e.target.value })}
                  >
                    {["amazon", "meta", "tiktok", "google"].map((x) => (
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
              Modeled and stale records excluded. No competition metric means
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
