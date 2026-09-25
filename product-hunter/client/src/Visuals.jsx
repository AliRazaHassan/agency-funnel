function money(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Math.round(Number(n)).toLocaleString()}`;
}

export function DataHonestyBanner() {
  return (
    <div className="honesty-banner">
      <strong>About these numbers</strong>
      <p>
        Unit costs and sell prices are <em>catalog estimates</em> for planning — confirm the live supplier
        price on AutoDS / Zendrop / AliExpress before you buy. Marketplace bars show{" "}
        <em>relative platform mix (%)</em>, not live scraped Amazon/Etsy/eBay GMV. We do not invent
        “real-time sales volume” without a connected data API (Keepa, Helium 10, etc.).
      </p>
    </div>
  );
}

export function buildSalesFunnel(product) {
  const cost = Number(product?.estCostUsd) || 0;
  const sell = Number(product?.estSellPriceUsd) || Number(product?.estAovUsd) || 0;
  const aov = Number(product?.estAovUsd) || sell;
  const orders = product?.projectedMonthlyOrders || {};
  const base = Number(orders.base) || 40;
  const conservative = Number(orders.conservative) || Math.round(base * 0.5);
  const aggressive = Number(orders.aggressive) || Math.round(base * 2);

  const visitors = Math.round(base / 0.025);
  const views = Math.round(visitors * 0.45);
  const carts = Math.round(views * 0.22);
  const checkouts = Math.round(carts * 0.55);

  return {
    cost,
    sell,
    aov,
    orders: { conservative, base, aggressive },
    unitEconomics: {
      cost,
      sell,
      marginPct: sell > 0 ? Math.round(((sell - cost) / sell) * 1000) / 10 : 0,
      profitPerOrder: Math.round((sell - cost) * 100) / 100,
    },
    stages: [
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
      {
        id: "cogs",
        label: "Est. COGS / mo",
        value: base * cost,
        note: `Unit cost ${money(cost)} × orders`,
        isMoney: true,
      },
      {
        id: "gross",
        label: "Est. gross profit / mo",
        value: base * (sell - cost),
        note: "Before ads, apps, returns",
        isMoney: true,
      },
    ],
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
          Unit economics: buy ~{money(ue.cost)} → sell ~{money(ue.sell)} · margin {ue.marginPct}% ·
          profit/order ~{money(ue.profitPerOrder)}
        </p>
      </div>
      <div className="unit-strip">
        <div>
          <span>Est. buy cost</span>
          <b>{money(ue.cost)}</b>
        </div>
        <div>
          <span>Est. sell price</span>
          <b>{money(ue.sell)}</b>
        </div>
        <div>
          <span>Margin</span>
          <b>{ue.marginPct}%</b>
        </div>
        <div>
          <span>Profit / order</span>
          <b>{money(ue.profitPerOrder)}</b>
        </div>
      </div>
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
        Order volume is a planning scenario from capture assumptions — confirm with ads tests. Buy cost
        must be verified on the supplier before purchase.
      </p>
    </div>
  );
}

export function MarketVizBoard({ opportunities, selectedOpp }) {
  if (!opportunities?.length) return null;
  const focus = selectedOpp || opportunities[0];

  return (
    <div className="viz-board">
      <div className="viz-board-head">
        <h2>Market view · {focus.niche}</h2>
        <p className="muted">Demand index + platform mix. Click a product later for its own funnel.</p>
      </div>
      <DataHonestyBanner />
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

export function ProductDetailPanel({ product, onClose }) {
  if (!product) return null;
  const src = product.sourceFrom || {};
  const aliQuery = encodeURIComponent(src.searchQuery || product.title || "");
  const aliUrl = `https://www.aliexpress.com/w/wholesale-${aliQuery.replace(/%20/g, "-")}.html`;

  return (
    <div className="product-detail">
      <div className="product-detail-head">
        <div>
          <h2>{product.title}</h2>
          <p className="muted">
            #{product.rank} · {product.category} · score {product.rankScore}
          </p>
        </div>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="viz-grid two">
        <div className="viz-card">
          <div className="viz-head">
            <h3>Where to buy · estimated cost</h3>
            <p className="muted">Confirm live price on supplier before ordering</p>
          </div>
          <div className="unit-strip">
            <div>
              <span>Est. unit cost</span>
              <b>{money(product.estCostUsd)}</b>
            </div>
            <div>
              <span>Est. sell price</span>
              <b>{money(product.estSellPriceUsd)}</b>
            </div>
            <div>
              <span>Margin</span>
              <b>{product.marginPct}%</b>
            </div>
            <div>
              <span>Weight</span>
              <b>{product.estWeightKg} kg</b>
            </div>
          </div>
          <p>
            <strong>Primary source:</strong> {src.primary}
          </p>
          <p className="muted">Search: “{src.searchQuery || product.title}”</p>
          <div className="loc-tags">
            {(src.platforms || []).map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
          <ul className="angles">
            {(src.howToFind || []).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <p className="muted">{src.originHint}</p>
          <p className="muted">{src.notes || product.supplierNotes}</p>
          <div className="card-actions">
            <a className="btn" href={aliUrl} target="_blank" rel="noreferrer">
              Open AliExpress search
            </a>
          </div>
          <p className="viz-disclaimer">
            Listed costs are catalog estimates used for ranking — not a live quote. AutoDS/Zendrop show
            the real landed cost.
          </p>
        </div>
        <FunnelViz item={product} title={`Funnel · ${product.title}`} />
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
