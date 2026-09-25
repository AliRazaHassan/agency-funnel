import { useEffect, useMemo, useState } from "react";

async function api(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.needLogin = data.needLogin;
    throw err;
  }
  return data;
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
  const [regionFocus, setRegionFocus] = useState("Global");
  const [budget, setBudget] = useState("500");
  const [nicheHint, setNicheHint] = useState("");
  const [scout, setScout] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [hunt, setHunt] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const step = hunt ? 3 : scout ? 2 : 1;

  const selectedProducts = useMemo(() => {
    if (!hunt?.products) return [];
    return hunt.products.filter((p) => selectedIds.has(p.id));
  }, [hunt, selectedIds]);

  async function refreshAuth() {
    try {
      const status = await api("/api/auth/status");
      setAuth({ loading: false, ...status });
    } catch {
      setAuth({ loading: false, required: true, authenticated: false });
    }
  }

  useEffect(() => {
    refreshAuth();
  }, []);

  async function runScout() {
    setError("");
    setLoading("scout");
    setHunt(null);
    setSelectedOpp(null);
    setSelectedIds(new Set());
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
    try {
      const data = await api("/api/products/hunt", {
        method: "POST",
        body: { opportunity: opp, limit: 24 },
      });
      setHunt(data);
      setSelectedIds(
        new Set((data.products || []).filter((p) => !p.rejected).slice(0, 12).map((p) => p.id))
      );
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
      const res = await fetch("/api/products/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: selectedProducts,
          niche: selectedOpp?.niche || "Store",
          vendor: "AgencyFunnel",
        }),
      });
      if (res.status === 401) {
        refreshAuth();
        throw new Error("Session expired — log in again");
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(selectedOpp?.niche || "shopify").toLowerCase().replace(/\s+/g, "-")}-import.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: {} });
    setScout(null);
    setHunt(null);
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
    <div className="shell">
      <header className="topbar">
        <div className="brand-block">
          <h1 className="brand">
            Signal <span>Desk</span>
          </h1>
          <p className="tagline">Market demand → marketing → AOV rank → Shopify import</p>
        </div>
        <div className="top-actions">
          {auth.required ? (
            <button type="button" className="ghost" onClick={logout}>
              Lock
            </button>
          ) : null}
        </div>
      </header>

      <div className="layout">
        <aside className="side">
          <ol className="steps">
            <li className={step === 1 ? "on" : step > 1 ? "done" : ""}>
              <span className="n">1</span>
              <div>
                <div>Scout markets</div>
                <div className="muted">Demand, sell-where, marketing</div>
              </div>
            </li>
            <li className={step === 2 ? "on" : step > 2 ? "done" : ""}>
              <span className="n">2</span>
              <div>
                <div>Pick opportunity</div>
                <div className="muted">Ranked by revenue potential</div>
              </div>
            </li>
            <li className={step === 3 ? "on" : ""}>
              <span className="n">3</span>
              <div>
                <div>Hunt & export</div>
                <div className="muted">Products → Shopify CSV</div>
              </div>
            </li>
          </ol>

          <label className="field">
            <span>Region</span>
            <select value={regionFocus} onChange={(e) => setRegionFocus(e.target.value)}>
              <option>Global</option>
              <option>US</option>
              <option>UK</option>
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
            ) : (
              <>
                <div className="section-head">
                  <div>
                    <h2>Ranked opportunities</h2>
                    <p>
                      Source: {scout.source} · research score is model + rules, not live marketplace scrape
                    </p>
                  </div>
                </div>
                <div className="opp-grid">
                  {scout.opportunities.map((opp, i) => (
                    <article
                      key={opp.id}
                      className={`opp-card ${selectedOpp?.id === opp.id ? "active" : ""}`}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="opp-top">
                        <div>
                          <div className="rank-pill">#{opp.rank}</div>
                          <h3>{opp.niche}</h3>
                          <p className="muted">{opp.audience}</p>
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
                          <b>${opp.estAovUsd}</b>
                          <span>Est. AOV</span>
                        </div>
                        <div className="metric">
                          <b>${opp.estContributionUsd}</b>
                          <span>Contribution</span>
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
              </>
            )}
          </div>

          {hunt ? (
            <div className="products-panel">
              <div className="toolbar">
                <div>
                  <h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "1.25rem" }}>
                    Products · {hunt.niche || selectedOpp?.niche}
                  </h2>
                  <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                    {hunt.note || `${hunt.source} research · select winners for Matrixify`}
                  </p>
                </div>
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

              {hunt.products?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th></th>
                        <th>#</th>
                        <th>Product</th>
                        <th>Score</th>
                        <th>AOV</th>
                        <th>Margin</th>
                        <th>Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hunt.products.map((p) => (
                        <tr key={p.id} className={p.rejected ? "rejected" : ""}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={() => toggleProduct(p.id)}
                            />
                          </td>
                          <td>{p.rank}</td>
                          <td>
                            <div className="prod-title">{p.title}</div>
                            <div className="prod-cat">{p.category}</div>
                            {p.rejected ? <span className="gate">Gate fail</span> : null}
                          </td>
                          <td>{p.rankScore}</td>
                          <td>
                            ${p.estAovUsd}
                            <div className="prod-cat">+${p.estContributionUsd}</div>
                          </td>
                          <td>{p.marginPct}%</td>
                          <td>
                            <div>{p.hook}</div>
                            <ul className="angles">
                              {(p.reasons || []).slice(0, 2).map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
