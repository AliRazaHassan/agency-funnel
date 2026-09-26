import { useMemo, useState } from "react";

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v === 0) return "$0";
  return `$${Math.round(v * 100) / 100}`;
}

function resolveUnitEconomics(item = {}) {
  const aov = Number(item.estAovUsd) || Number(item.estSellPriceUsd) || 0;
  const sell = Number(item.estSellPriceUsd) || aov;
  let cost = Number(item.estCostUsd);
  if (!Number.isFinite(cost) || cost <= 0) {
    const fromSource = Number(item.sourceFrom?.unitCostUsd);
    const fromOption = Number(item.supplierOptions?.[0]?.unitCostUsd);
    if (Number.isFinite(fromSource) && fromSource > 0) cost = fromSource;
    else if (Number.isFinite(fromOption) && fromOption > 0) cost = fromOption;
    else if (Number.isFinite(Number(item.estContributionUsd)) && aov > 0) {
      // Niche-level: contribution is profit proxy → implied COGS
      cost = Math.max(0, aov - Number(item.estContributionUsd));
    } else {
      cost = 0;
    }
  }
  return {
    aov: aov || sell,
    sell: sell || aov,
    cost,
    hasRealProductCost: Number(item.estCostUsd) > 0 || Number(item.supplierOptions?.[0]?.unitCostUsd) > 0,
  };
}

export function DataHonestyBanner({ freeSignal, keepa }) {
  const snapCount = keepa?.snapshot?.count || 0;
  return (
    <div className="honesty-banner">
      <strong>Trusted data · free first, Keepa optional one-time</strong>
      <p>
        Live interest: <strong>Wikimedia Pageviews</strong> (free)
        {freeSignal?.providers?.some((p) => p.provider === "Google Trends")
          ? " + Google Trends when reachable"
          : ""}
        . Dollar niches use cited industry models.{" "}
        {snapCount > 0 ? (
          <>
            Amazon proof: <strong>one-time Keepa snapshot</strong> ({snapCount} ASINs on file) — not a live paid feed.
          </>
        ) : (
          <>
            Amazon sold units: paste ASIN + “bought in past month” from amazon.com in the product panel (free,
            one-time, no scrape). Or optional Keepa dump later.
          </>
        )}
      </p>
      {freeSignal?.ok ? (
        <p className="muted" style={{ margin: "0.4rem 0 0" }}>
          Free interest index this niche: {freeSignal.interestScore}/100 ·{" "}
          {(freeSignal.providers || []).map((p) => p.provider).join(" + ")}
        </p>
      ) : null}
    </div>
  );
}

export function KeepaSnapshotCard({ keepa }) {
  if (!keepa) return null;
  const k = keepa.keepa || keepa;
  if (!k?.asin && k?.monthlySold == null && k?.salesRank == null) {
    return (
      <div className="viz-card">
        <div className="viz-head">
          <h3>Amazon (one-time)</h3>
          <p className="muted">No snapshot yet — paste numbers from Amazon below (we don’t scrape)</p>
        </div>
      </div>
    );
  }
  return (
    <div className="viz-card">
      <div className="viz-head">
        <h3>Amazon · one-time data</h3>
        <p className="muted">
          {k.source === "manual-amazon-paste"
            ? "Manual paste from amazon.com"
            : k.match === "asin"
              ? "ASIN match"
              : `Title match ${Math.round((k.matchScore || 0) * 100)}%`}
        </p>
      </div>
      <div className="unit-strip">
        <div>
          <span>ASIN</span>
          <b>{k.asin || "—"}</b>
        </div>
        <div>
          <span>Bought / mo</span>
          <b>{k.monthlySold != null ? `${k.monthlySold}+` : "—"}</b>
        </div>
        <div>
          <span>Sales rank</span>
          <b>{k.salesRank != null ? k.salesRank.toLocaleString() : "—"}</b>
        </div>
        <div>
          <span>Buy box</span>
          <b>{k.buyBoxUsd != null ? `$${k.buyBoxUsd}` : "—"}</b>
        </div>
      </div>
      {k.amazonUrl ? (
        <div className="card-actions" style={{ marginTop: "0.75rem" }}>
          <a className="btn" href={k.amazonUrl} target="_blank" rel="noreferrer">
            Open Amazon ASIN
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** Paste ASIN + “bought in past month” from Amazon in your browser — free one-time proof */
export function ManualAmazonPasteForm({ product, onSaved }) {
  const [asin, setAsin] = useState(product?.asin || product?.keepa?.asin || "");
  const [boughtText, setBoughtText] = useState(
    product?.keepa?.monthlySold != null ? `${product.keepa.monthlySold}+` : ""
  );
  const [salesRank, setSalesRank] = useState(product?.keepa?.salesRank ?? "");
  const [priceUsd, setPriceUsd] = useState(product?.keepa?.buyBoxUsd ?? product?.estSellPriceUsd ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/amazon/manual", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asin,
          title: product?.title,
          niche: product?.category,
          boughtText,
          salesRank: salesRank === "" ? null : Number(salesRank),
          priceUsd: priceUsd === "" ? null : Number(priceUsd),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg(`Saved. Snapshot now has ${data.snapshot?.products?.length || 0} rows. Re-hunt to rematch.`);
      onSaved?.(data);
    } catch (ex) {
      setErr(ex.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="viz-card" onSubmit={save}>
      <div className="viz-head">
        <h3>Add Amazon one-time data (free)</h3>
        <p className="muted">
          Open Amazon search → copy ASIN + “bought in past month” (e.g. 1K+) into here. We never scrape Amazon.
        </p>
      </div>
      <div className="manual-amazon-grid">
        <label className="field">
          <span>ASIN</span>
          <input
            value={asin}
            onChange={(ev) => setAsin(ev.target.value)}
            placeholder="B0XXXXXXXXX"
            required
          />
        </label>
        <label className="field">
          <span>Bought / mo (from Amazon)</span>
          <input
            value={boughtText}
            onChange={(ev) => setBoughtText(ev.target.value)}
            placeholder="1000+ or 1K+"
          />
        </label>
        <label className="field">
          <span>BSR / sales rank (optional)</span>
          <input
            value={salesRank}
            onChange={(ev) => setSalesRank(ev.target.value)}
            placeholder="12450"
            type="number"
          />
        </label>
        <label className="field">
          <span>Price USD (optional)</span>
          <input
            value={priceUsd}
            onChange={(ev) => setPriceUsd(ev.target.value)}
            placeholder="24.99"
            type="number"
            step="0.01"
          />
        </label>
      </div>
      {err ? <div className="error">{err}</div> : null}
      {msg ? <p className="muted">{msg}</p> : null}
      <div className="card-actions">
        <button className="btn" type="submit" disabled={busy || !asin}>
          {busy ? "Saving…" : "Save one-time Amazon row"}
        </button>
        <a
          className="ghost"
          href={`https://www.amazon.com/s?k=${encodeURIComponent(product?.title || "")}`}
          target="_blank"
          rel="noreferrer"
        >
          Open Amazon search
        </a>
      </div>
    </form>
  );
}

export function FreeSignalChip({ freeSignal }) {
  if (!freeSignal) return null;
  if (!freeSignal.ok) {
    return <span className="flag">Free feed offline · benchmarks only</span>;
  }
  return (
    <span className="flag" style={{ borderColor: "var(--ok, #2a7)" }}>
      Free trusted · interest {freeSignal.interestScore}
    </span>
  );
}

export function WinningBadge({ winning, compact = false }) {
  if (!winning?.verdict) return null;
  const v = winning.verdict;
  const cls =
    v === "PASS" ? "win-badge pass" : v === "WATCH" ? "win-badge watch" : "win-badge fail";
  return (
    <span className={cls} title={winning.summary}>
      {v}
      {!compact ? ` · ${winning.total}` : ""}
    </span>
  );
}

export function WinningScorecardPanel({ product }) {
  const w = product?.winning;
  if (!w) return null;
  return (
    <div className="viz-card winning-card">
      <div className="viz-head">
        <h3>
          Winning scorecard <WinningBadge winning={w} />
        </h3>
        <p className="muted">{w.summary}</p>
      </div>
      <div className="vol-chart">
        {(w.pillars || []).map((p) => (
          <div key={p.id} className="vol-row platform-row">
            <div className="vol-label" title={p.note}>
              {p.label}
              <em>weight {Math.round((p.weight || 0) * 100)}%</em>
            </div>
            <div className="vol-track">
              <div className="vol-fill" style={{ width: `${p.score}%` }} />
            </div>
            <div className="vol-val">{p.score}</div>
          </div>
        ))}
      </div>
      <div className="win-meta">
        <div>
          <strong>Why it can win</strong>
          <ul>
            {(w.passReasons || []).length
              ? w.passReasons.map((r) => <li key={r}>{r}</li>)
              : <li className="muted">No strong pass reasons yet</li>}
          </ul>
        </div>
        <div>
          <strong>Hard fails</strong>
          <ul>
            {(w.hardFails || []).length
              ? w.hardFails.map((r) => (
                  <li key={r} className="fail-li">
                    {r}
                  </li>
                ))
              : <li className="muted">None</li>}
          </ul>
        </div>
        <div>
          <strong>Warnings</strong>
          <ul>
            {(w.softWarnings || []).length
              ? w.softWarnings.map((r) => <li key={r}>{r}</li>)
              : <li className="muted">None</li>}
          </ul>
        </div>
      </div>
      <p className="viz-disclaimer">{w.keepaGap?.note}</p>
    </div>
  );
}

export function buildSalesFunnel(item) {
  const { aov, sell, cost, hasRealProductCost } = resolveUnitEconomics(item);
  const orders = item?.projectedMonthlyOrders || {};
  const base = Number(orders.base) || 40;
  const conservative = Number(orders.conservative) || Math.round(base * 0.5);
  const aggressive = Number(orders.aggressive) || Math.round(base * 2);

  const visitors = Math.round(base / 0.025);
  const views = Math.round(visitors * 0.45);
  const carts = Math.round(views * 0.22);
  const checkouts = Math.round(carts * 0.55);

  const stages = [
    { id: "visit", label: "Store visitors / mo", value: visitors, note: "Planning assumption (~2.5% close)" },
    { id: "pdp", label: "Product page views", value: views, note: "~45% of visitors" },
    { id: "cart", label: "Add to cart", value: carts, note: "~22% of views" },
    { id: "checkout", label: "Checkouts started", value: checkouts, note: "~55% of carts" },
    { id: "orders", label: "Paid orders", value: base, note: "Your store planning volume" },
    {
      id: "revenue",
      label: "Gross revenue / mo",
      value: base * aov,
      note: `AOV ${money(aov)}`,
      isMoney: true,
    },
  ];

  if (cost > 0) {
    stages.push(
      {
        id: "cogs",
        label: hasRealProductCost ? "Est. COGS / mo" : "Implied COGS / mo",
        value: base * cost,
        note: hasRealProductCost
          ? `Unit cost ${money(cost)} × orders`
          : `Implied from AOV − contribution (${money(cost)}/unit) — not a supplier quote`,
        isMoney: true,
      },
      {
        id: "gross",
        label: "Est. gross profit / mo",
        value: base * (sell - cost),
        note: "Before ads, apps, returns",
        isMoney: true,
      }
    );
  }

  return {
    cost,
    sell,
    aov,
    hasRealProductCost,
    orders: { conservative, base, aggressive },
    unitEconomics: {
      cost,
      sell,
      marginPct: sell > 0 && cost > 0 ? Math.round(((sell - cost) / sell) * 1000) / 10 : null,
      profitPerOrder: cost > 0 ? Math.round((sell - cost) * 100) / 100 : null,
    },
    stages,
  };
}

export function DemandBreakdown({ research, score }) {
  if (!research?.factors?.length) return null;
  return (
    <div className="viz-card">
      <div className="viz-head">
        <h3>Demand index = {research.demandScore ?? score}</h3>
        <p className="muted">{research.method}</p>
      </div>
      <div className="vol-chart">
        {research.factors.map((f) => (
          <div key={f.id} className="vol-row platform-row">
            <div className="vol-label" title={f.evidence}>
              {f.label}
              <em>weight {Math.round((f.weight || 0) * 100)}%</em>
            </div>
            <div className="vol-track">
              <div className="vol-fill" style={{ width: `${f.score}%` }} />
            </div>
            <div className="vol-val">{f.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlatformMixViz({ sales, title = "Where demand sits by platform" }) {
  if (!sales?.byPlatform?.length) return null;
  return (
    <div className="viz-card">
      <div className="viz-head">
        <h3>{title}</h3>
        <p className="muted">
          Relative mix only (%). Not live GMV. {sales.dataQuality ? `Confidence: ${sales.dataQuality}.` : ""}
        </p>
      </div>
      <div className="vol-chart">
        {sales.byPlatform.map((p) => (
          <div key={p.platform} className="vol-row platform-row">
            <div className="vol-label">
              {p.platform}
              <em>share of online niche</em>
            </div>
            <div className="vol-track">
              <div className="vol-fill" style={{ width: `${(p.share || 0) * 100}%` }} />
            </div>
            <div className="vol-val">{Math.round((p.share || 0) * 100)}%</div>
          </div>
        ))}
      </div>
      {sales.sources?.[0] ? (
        <p className="viz-disclaimer">
          Benchmark reference: {sales.sources[0].name} ({sales.sources[0].year}). Used for context —
          platform % is a model split, not scraped sales.
        </p>
      ) : null}
    </div>
  );
}

export function FunnelViz({ item, title }) {
  const funnel = buildSalesFunnel(item);
  const max = Math.max(...funnel.stages.map((s) => s.value), 1);
  const ue = funnel.unitEconomics;

  return (
    <div className="viz-card">
      <div className="viz-head">
        <h3>{title || `Funnel · ${item?.title || item?.niche || "Selected"}`}</h3>
        <p className="muted">
          {ue.cost > 0
            ? `Unit economics: buy ~${money(ue.cost)} → sell ~${money(ue.sell)}${
                ue.marginPct != null ? ` · margin ${ue.marginPct}%` : ""
              }${ue.profitPerOrder != null ? ` · profit/order ~${money(ue.profitPerOrder)}` : ""}`
            : "No unit cost on this view — open a product and select a supplier source"}
        </p>
      </div>
      {ue.cost > 0 ? (
        <div className="unit-strip">
          <div>
            <span>{funnel.hasRealProductCost ? "Est. buy cost" : "Implied buy cost"}</span>
            <b>{money(ue.cost)}</b>
          </div>
          <div>
            <span>Est. sell / AOV</span>
            <b>{money(ue.sell)}</b>
          </div>
          <div>
            <span>Margin</span>
            <b>{ue.marginPct != null ? `${ue.marginPct}%` : "—"}</b>
          </div>
          <div>
            <span>Profit / order</span>
            <b>{ue.profitPerOrder != null ? money(ue.profitPerOrder) : "—"}</b>
          </div>
        </div>
      ) : (
        <div className="honesty-banner" style={{ marginBottom: "0.85rem" }}>
          <strong>Cost was $0 here before — bug</strong>
          <p>
            Niche funnels don’t have a supplier SKU cost. Click a <strong>product</strong>, pick AutoDS /
            Zendrop / CJ / AliExpress — then cost + shipping days drive this funnel.
          </p>
        </div>
      )}
      <div className="funnel">
        {funnel.stages.map((s, i) => (
          <div key={s.id} className="funnel-step" style={{ width: `${94 - i * 7}%` }}>
            <div className="funnel-label">
              <span>{s.label}</span>
              <strong>{s.isMoney ? money(s.value) : s.value.toLocaleString()}</strong>
            </div>
            <div className="funnel-bar-wrap">
              <div className="funnel-bar" style={{ width: `${Math.max(10, (s.value / max) * 100)}%` }} />
            </div>
            <div className="funnel-note">{s.note}</div>
          </div>
        ))}
      </div>
      <p className="viz-disclaimer">
        Order volume is planning math until Keepa/supplier APIs are connected. Product costs update when
        you select a source on the product panel.
      </p>
    </div>
  );
}

export function MarketVizBoard({ opportunities, selectedOpp, keepa }) {
  if (!opportunities?.length) return null;
  const focus = selectedOpp || opportunities[0];

  return (
    <div className="viz-board">
      <div className="viz-board-head">
        <h2>Market view · {focus.niche}</h2>
        <p className="muted">Demand index + platform mix. Click a product later for its own funnel.</p>
      </div>
      <DataHonestyBanner freeSignal={focus.freeSignal} keepa={keepa} />
      <div className="viz-grid two">
        <DemandBreakdown research={focus.demandResearch} score={focus.scores?.demand} />
        <PlatformMixViz sales={focus.marketplaceSales} title={`Platform mix · ${focus.niche}`} />
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <FunnelViz item={focus} title={`Planning funnel · your store in ${focus.niche}`} />
      </div>
    </div>
  );
}

function ScoreBarMini({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="bar-row"><span>{label}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${v}%` }} /></div><span>{Math.round(v)}</span></div>;
}

export function ProductDetailPanel({ product, onClose }) {
  if (!product) return null;
  const options = product.supplierOptions || [];
  const [sourceId, setSourceId] = useState(options[0]?.id || "autods");
  const selected = useMemo(
    () => options.find((o) => o.id === sourceId) || options[0],
    [options, sourceId]
  );
  const src = product.sourceFrom || {};
  const sell = Number(product.estSellPriceUsd) || 0;
  const buy = Number(selected?.unitCostUsd ?? product.estCostUsd) || 0;
  const margin = sell > 0 ? Math.round(((sell - buy) / sell) * 1000) / 10 : 0;
  const funnelProduct = {
    ...product,
    estCostUsd: buy,
  };

  return (
    <div className="product-detail">
      <div className="product-detail-head">
        <div>
          <h2>{product.title}</h2>
          <p className="muted">
            #{product.rank} · {product.category} · score {product.rankScore}
          </p>
          {product.problemSolved || product.hook ? (
            <div className="hook-box" style={{ marginTop: "0.55rem" }}>
              <strong>Problem → pitch</strong>
              <p>
                {product.problemSolved ? (
                  <>
                    <em>Solves:</em> {product.problemSolved}
                    <br />
                  </>
                ) : null}
                {product.hook ? (
                  <>
                    <em>Hook:</em> {product.hook}
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
          {product.productLinks?.links?.length ? (
            <div className="link-row" style={{ marginTop: "0.5rem" }}>
              {product.productLinks.links.map((l) => (
                <a key={l.id} className="ext-link" href={l.url} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              ))}
            </div>
          ) : null}
          <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.8rem" }}>
            {product.productLinks?.note ||
              "Links open marketplace search for this title (no locked ASIN without Keepa/supplier API)."}
          </p>
        </div>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="viz-grid two">
        <div className="viz-card">
          <div className="viz-head">
            <h3>Select source · cost + shipping</h3>
            <p className="muted">Pick a supplier channel to see estimated unit cost and delivery window</p>
          </div>

          <div className="source-pick">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`source-option ${selected?.id === o.id ? "on" : ""}`}
                onClick={() => setSourceId(o.id)}
              >
                <strong>{o.name}</strong>
                <span>
                  {money(o.unitCostUsd)} · {o.shippingDaysMin}–{o.shippingDaysMax} days
                </span>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="selected-source">
              <div className="unit-strip">
                <div>
                  <span>Est. unit cost</span>
                  <b>{money(selected.unitCostUsd)}</b>
                </div>
                <div>
                  <span>Shipping days</span>
                  <b>
                    {selected.shippingDaysMin}–{selected.shippingDaysMax}
                  </b>
                </div>
                <div>
                  <span>Your sell price</span>
                  <b>{money(sell)}</b>
                </div>
                <div>
                  <span>Margin @ this source</span>
                  <b>{margin}%</b>
                </div>
              </div>
              <p>
                <strong>Warehouse:</strong> {selected.warehouse}
              </p>
              <p className="muted">{selected.includes}</p>
              <p className="muted">Search: “{selected.searchHint || src.searchQuery}”</p>
              <div className="card-actions">
                <a className="btn" href={selected.verifyUrl} target="_blank" rel="noreferrer">
                  Verify on {selected.name}
                </a>
              </div>
              <p className="viz-disclaimer">
                Costs and shipping windows are catalog estimates ({selected.dataQuality}). Live quotes
                appear inside AutoDS / Zendrop / CJ / AliExpress after you search the SKU.
              </p>
            </div>
          ) : null}
        </div>
        <FunnelViz item={funnelProduct} title={`Funnel · ${product.title}`} />
      </div>

      <div className="viz-card" style={{ marginTop: "0.75rem" }}>
        <div className="viz-head">
          <h3>Trend Intelligence · {product.trendScore ?? "—"}/100</h3>
          <p className="muted">{product.trendStatus || "DISCOVERED"} · {product.dataConfidence || "LOW"} confidence</p>
        </div>
        <div className="unit-strip">
          <div><span>7-day</span><b>{product.momentum?.d7 == null ? "—" : `${product.momentum.d7}%`}</b></div>
          <div><span>14-day</span><b>{product.momentum?.d14 == null ? "—" : `${product.momentum.d14}%`}</b></div>
          <div><span>30-day</span><b>{product.momentum?.d30 == null ? "—" : `${product.momentum.d30}%`}</b></div>
          <div><span>Saturation</span><b>{product.saturation?.risk || "—"}</b></div>
        </div>
        <div className="bars" style={{ marginTop: "0.75rem" }}>
          {Object.entries(product.trendComponents || {}).map(([key,value]) => <ScoreBarMini key={key} label={key} value={value} />)}
        </div>
        <div className="hook-box" style={{ marginTop: "0.75rem" }}>
          <strong>Why is this trending?</strong>
          <p>{product.whyTrending?.summary || "Not enough cross-platform evidence yet."}</p>
          {(product.whyTrending?.evidence || []).map((e) => <p key={e.source} className="muted"><b>{e.source}</b>: {e.reason} · {e.value}/100 · {e.status}</p>)}
        </div>
        <p className="viz-disclaimer">Trend score is an evidence index, not a claim of verified unit sales. Missing sources stay unavailable.</p>
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <WinningScorecardPanel product={product} />
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <KeepaSnapshotCard keepa={product} />
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <ManualAmazonPasteForm product={product} />
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <PlatformMixViz
          sales={product.marketplaceSales}
          title="Where similar products sell (platform mix)"
        />
      </div>
    </div>
  );
}

export function SocialTrendsBoard({ trends, onUseNiche }) {
  if (!trends) return null;
  const tiktok = trends.tiktok || [];
  const meta = trends.meta || [];
  const manual = trends.manual || [];

  return (
    <div className="viz-board social-trends">
      <div className="viz-board-head">
        <h2>Trending · TikTok & Meta</h2>
        <p className="muted">{trends.honesty}</p>
      </div>
      <div className="honesty-banner">
        <strong>Creatives ≠ sold units</strong>
        <p>
          Sources: TikTok {trends.sources?.tiktok} · Meta {trends.sources?.meta}
          {manual.length ? ` · ${manual.length} manual` : ""}. Open hub links to verify live charts.
        </p>
        <div className="link-row" style={{ marginTop: "0.5rem" }}>
          {trends.hubs?.tiktokCreativeCenter ? (
            <a className="ext-link" href={trends.hubs.tiktokCreativeCenter} target="_blank" rel="noreferrer">
              TikTok Creative Center
            </a>
          ) : null}
          {trends.hubs?.metaAdLibrary ? (
            <a className="ext-link" href={trends.hubs.metaAdLibrary} target="_blank" rel="noreferrer">
              Meta Ad Library
            </a>
          ) : null}
        </div>
      </div>

      <div className="viz-grid two" style={{ marginTop: "0.75rem" }}>
        <TrendColumn title="TikTok" items={tiktok} onUseNiche={onUseNiche} />
        <TrendColumn title="Meta / Facebook" items={meta} onUseNiche={onUseNiche} />
      </div>

      {manual.length ? (
        <div style={{ marginTop: "0.75rem" }}>
          <TrendColumn title="Your manual social notes" items={manual} onUseNiche={onUseNiche} />
        </div>
      ) : null}

      <ManualSocialTrendForm region={trends.regionFocus} />
    </div>
  );
}

function TrendColumn({ title, items, onUseNiche }) {
  return (
    <div className="viz-card">
      <div className="viz-head">
        <h3>{title}</h3>
        <p className="muted">{items.length} ideas · click research link</p>
      </div>
      <ul className="trend-list">
        {items.map((t, i) => (
          <li key={`${t.platform}-${t.title}-${i}`}>
            <div className="trend-top">
              <strong>
                #{t.rank || i + 1} {t.title}
              </strong>
              <span className={`win-badge ${t.platform === "tiktok" ? "watch" : "pass"}`}>
                {t.platform}
              </span>
            </div>
            <p className="muted" style={{ margin: "0.2rem 0" }}>
              {t.category} · {t.metric || t.trendSignal}
            </p>
            <p className="prod-problem">{t.why || t.note}</p>
            <div className="link-row" style={{ marginTop: "0.35rem" }}>
              {t.researchUrl ? (
                <a className="ext-link" href={t.researchUrl} target="_blank" rel="noreferrer">
                  Research
                </a>
              ) : null}
              {onUseNiche ? (
                <button type="button" className="ext-link" onClick={() => onUseNiche(t.title)}>
                  Use as niche hint
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ManualSocialTrendForm({ region }) {
  const [platform, setPlatform] = useState("tiktok");
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/trends/social/manual", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, title, metric, region }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg("Saved. Run scout again to refresh the board.");
      setTitle("");
      setMetric("");
    } catch (ex) {
      setMsg(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="viz-card" style={{ marginTop: "0.75rem" }} onSubmit={save}>
      <div className="viz-head">
        <h3>Add TikTok / Meta trend (manual)</h3>
        <p className="muted">Saw it in Creative Center or Ad Library? Paste here — free, no scrape.</p>
      </div>
      <div className="manual-amazon-grid">
        <label className="field">
          <span>Platform</span>
          <select value={platform} onChange={(ev) => setPlatform(ev.target.value)}>
            <option value="tiktok">TikTok</option>
            <option value="meta">Meta</option>
          </select>
        </label>
        <label className="field">
          <span>Product / angle</span>
          <input value={title} onChange={(ev) => setTitle(ev.target.value)} required placeholder="LED neck fan" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>What you saw (optional)</span>
          <input
            value={metric}
            onChange={(ev) => setMetric(ev.target.value)}
            placeholder="Top products US · high post volume"
          />
        </label>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}
      <button className="btn" type="submit" disabled={busy || !title} style={{ width: "auto" }}>
        {busy ? "Saving…" : "Save social trend note"}
      </button>
    </form>
  );
}
