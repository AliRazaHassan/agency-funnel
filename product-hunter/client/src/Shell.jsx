import { useEffect, useState } from "react";
import { api } from "./api.js";

export function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "Welcome to Product Hunter AI",
      body: "Discover products, understand why they are trending, compare market signals, validate profitability, and export winners to Shopify.",
    },
    {
      title: "1 · Scout markets",
      body: "Get 10 ranked Shopify niches + TikTok/Meta trending board. Service (agency) offers stay separate.",
    },
    {
      title: "2 · Trend intelligence",
      body: "Score products across Amazon, TikTok, Meta, Google and cross-platform momentum with confidence and saturation signals.",
    },
    {
      title: "3 · Validate & launch",
      body: "Inspect Why Trending evidence, profitability and suppliers, then save, export Matrixify CSV, or launch the Shopify workflow.",
    },
  ];

  function finish() {
    localStorage.setItem("sd_onboarded", "1");
    onDone?.();
  }

  const s = steps[step];
  return (
    <div className="onboard-overlay">
      <div className="onboard-card">
        <p className="muted">
          Step {step + 1} / {steps.length}
        </p>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        <div className="btn-row">
          {step > 0 ? (
            <button type="button" className="ghost" onClick={() => setStep((n) => n - 1)}>
              Back
            </button>
          ) : (
            <button type="button" className="ghost" onClick={finish}>
              Skip
            </button>
          )}
          {step < steps.length - 1 ? (
            <button type="button" className="btn" style={{ width: "auto" }} onClick={() => setStep((n) => n + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="btn" style={{ width: "auto" }} onClick={finish}>
              Start workspace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function HomeView({ onOpenDesk, onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api("/api/projects");
        setProjects(data.projects || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function remove(id) {
    if (!confirm("Delete this saved project?")) return;
    await api(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((list) => list.filter((p) => p.id !== id));
  }

  return (
    <div className="home-view">
      <div className="home-hero">
        <div className="hero-kicker">PRODUCT INTELLIGENCE V2</div>
        <h2>Find products before the market gets crowded.</h2>
        <p className="muted">Discover → understand why it is trending → measure momentum and saturation → validate profit → export to Shopify.</p>
        <div className="intelligence-feature-grid">
          <div><strong>Trend Score</strong><span>Amazon · TikTok · Meta · Google</span></div>
          <div><strong>Why Trending</strong><span>Evidence, not a black-box score</span></div>
          <div><strong>Lifecycle</strong><span>Emerging · Accelerating · Saturating</span></div>
          <div><strong>Shopify Ready</strong><span>Source, validate and export</span></div>
        </div>
        <button type="button" className="btn" style={{ width: "auto" }} onClick={onOpenDesk}>
          Launch Product Hunter
        </button>
      </div>

      <div className="section-head">
        <div>
          <h2>Saved projects</h2>
          <p>Resume a scout/hunt later from this workspace.</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && !projects.length ? (
        <div className="viz-card">
          <p className="muted" style={{ margin: 0 }}>
            No saved projects yet. Run a scout, then hit <strong>Save project</strong> in the desk.
          </p>
        </div>
      ) : null}

      <div className="project-grid">
        {projects.map((p) => (
          <article key={p.id} className="viz-card project-card">
            <h3>{p.name}</h3>
            <p className="muted">
              {p.niche || "No niche yet"} · {p.regionFocus || "Global"}
            </p>
            <p className="muted" style={{ fontSize: "0.82rem" }}>
              {p.opportunityCount || 0} niches · {p.productCount || 0} products
              {p.winningPass != null ? ` · ${p.winningPass} PASS` : ""}
            </p>
            <p className="muted" style={{ fontSize: "0.78rem" }}>
              Updated {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}
            </p>
            <div className="btn-row">
              <button type="button" className="btn" style={{ width: "auto" }} onClick={() => onOpenProject(p.id)}>
                Open
              </button>
              <button type="button" className="ghost" onClick={() => remove(p.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function SettingsView() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setStatus(await api("/api/workspace/status"));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const mods = status?.modules || {};

  return (
    <div className="settings-view">
      <div className="section-head">
        <div>
          <h2>Workspace settings</h2>
          <p>Module status and data modes for this Signal Desk install.</p>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="viz-card">
        <div className="viz-head">
          <h3>
            {status?.label || "Signal Desk"} · v{status?.version || "—"}
          </h3>
          <p className="muted">OpenAI: {status?.openai ? "connected" : "seed fallback"}</p>
        </div>
        <ul className="module-list">
          {Object.entries(mods).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <strong className={v ? "on" : "off"}>{v ? "ON" : "OFF"}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="viz-card" style={{ marginTop: "0.75rem" }}>
        <div className="viz-head">
          <h3>Data modes</h3>
          <p className="muted">Free first. Paid Keepa only if you drop a one-time snapshot.</p>
        </div>
        <p>
          Keepa snapshot:{" "}
          <strong>
            {status?.keepa?.snapshot?.ok
              ? `${status.keepa.snapshot.count} ASINs`
              : "empty — use Amazon manual paste"}
          </strong>
        </p>
        <p className="muted">{status?.keepa?.recommendation}</p>
      </div>
    </div>
  );
}
