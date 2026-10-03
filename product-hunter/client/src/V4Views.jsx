import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

function money(v){const n=Number(v);return Number.isFinite(n)?`$${n.toFixed(2)}`:"—";}
function statusClass(v){return String(v||"UNAVAILABLE").toLowerCase().replace(/[^a-z0-9]+/g,"-");}

export function OpportunityFinder({ onFind, busy }) {
  const [q,setQ]=useState("");
  const examples=[
    "USA products under $15 landed cost with 60%+ margin and low Meta competition",
    "Trending dog-owner products that are not saturated",
    "Christmas gift products with light shipping and $30-$60 selling price"
  ];
  return <section className="v4-finder">
    <div><div className="hero-kicker">MARKET OPPORTUNITY FINDER</div><h2>Describe the product opportunity, not the product name.</h2>
      <p>AI converts your request into a research brief, then discovery uses current evidence inputs.</p></div>
    <form onSubmit={(e)=>{e.preventDefault();if(q.trim())onFind?.(q.trim());}} className="v4-finder-form">
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Find me products for USA under $15 landed cost with 60%+ margin…" />
      <button className="btn" disabled={busy||!q.trim()}>{busy?"Researching…":"Find opportunities"}</button>
    </form>
    <div className="finder-examples">{examples.map(x=><button type="button" key={x} onClick={()=>setQ(x)}>{x}</button>)}</div>
  </section>;
}

export function EvidencePanel({ product }) {
  if(!product) return null;
  const components=product.trendComponents||{};
  const statuses=product.dataStatus||{};
  const rows=[
    ["TikTok velocity",components.tiktok,statuses.tiktok,product.discoveryEvidence?.referencedObservations?.find(x=>x.platform==="tiktok")?.metric],
    ["Meta advertiser signal",components.meta,statuses.meta,product.discoveryEvidence?.referencedObservations?.find(x=>x.platform==="meta")?.metric],
    ["Google interest",components.google,statuses.google,product.discoveryEvidence?.evidence?.find(x=>x.source==="Google Trends")?.value],
    ["Amazon demand",components.amazon,statuses.amazon,product.keepa?.monthlySold!=null?`${product.keepa.monthlySold}+ bought/mo`:"No product-level Amazon proof"],
    ["Supplier landed cost",product.supplierVerification?.landedCostUsd??product.supplierOptions?.[0]?.landedCostUsd,product.supplierVerified?"VERIFIED":"MODELED",product.supplierVerified?product.supplierVerification?.source:"Supplier estimate"],
    ["Selling price",product.estSellPriceUsd,"MODELED","Current pricing assumption"]
  ];
  return <div className="viz-card evidence-ledger">
    <div className="viz-head"><h3>Sources & Evidence</h3><p className="muted">Every decision input keeps its provenance. Missing proof stays unavailable.</p></div>
    <div className="evidence-table">
      {rows.map(([label,value,status,note])=><div className="evidence-row" key={label}>
        <div><strong>{label}</strong><small>{note||"—"}</small></div>
        <b>{typeof value==="number"?Math.round(value*10)/10:(value??"—")}</b>
        <span className={`source-status ${statusClass(status)}`}>{status||"UNAVAILABLE"}</span>
      </div>)}
    </div>
    {(product.discoveryEvidence?.evidence||[]).length?<details><summary>Discovery evidence trail</summary>
      <div className="evidence-links">{product.discoveryEvidence.evidence.map((e,i)=><div key={i}><b>{e.source}</b><span className={`source-status ${statusClass(e.status)}`}>{e.status}</span><p>{e.value}</p>{e.url?<a href={e.url} target="_blank" rel="noreferrer">Open source</a>:null}</div>)}</div>
    </details>:null}
  </div>;
}

function Spark({points=[],field,label}){
  const vals=points.map(x=>Number(x[field])).filter(Number.isFinite);
  if(vals.length<2)return <div className="history-empty">{label}: collect at least 2 snapshots</div>;
  const min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;
  const coords=vals.map((v,i)=>`${(i/(vals.length-1))*100},${38-((v-min)/span)*34}`).join(" ");
  return <div className="spark"><div><strong>{label}</strong><span>{vals.at(-1).toFixed(1)}</span></div><svg viewBox="0 0 100 42" preserveAspectRatio="none"><polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2"/></svg></div>
}

export function HistoryPanel({ product }) {
  const [days,setDays]=useState(30);
  const [history,setHistory]=useState([]);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{let alive=true;if(!product?.id){setHistory([]);return;}
    setBusy(true);api(`/api/tracking/${encodeURIComponent(product.id)}/history?days=${days}`)
      .then(d=>{if(alive)setHistory(d.history||[])})
      .catch(()=>{if(alive)setHistory([])})
      .finally(()=>{if(alive)setBusy(false)});
    return()=>{alive=false};
  },[product?.id,days]);
  return <div className="viz-card">
    <div className="viz-head"><h3>Historical Trends</h3><div className="history-tabs">{[7,30,90].map(d=><button key={d} className={days===d?"on":""} onClick={()=>setDays(d)}>{d}D</button>)}</div></div>
    {busy?<p className="muted">Loading history…</p>:<div className="history-charts">
      <Spark points={history} field="trendScore" label="Trend Score"/>
      <Spark points={history} field="winnerScore" label="Winner Score"/>
      <Spark points={history} field="marginPct" label="Margin %"/>
    </div>}
    <p className="viz-disclaimer">History reflects captured research snapshots. Additional source-specific series appear as those providers supply verified data.</p>
  </div>;
}

export function UnitEconomicsSimulator({ product }) {
  const defaults=useMemo(()=>({
    price:Number(product?.estSellPriceUsd)||34.99,
    cogs:Number(product?.supplierVerification?.landedCostUsd)||Number(product?.estCostUsd)||8.2,
    shipping:Number(product?.supplierVerification?.shippingCostUsd)||4.1,
    fees:1.5,
    cpa:Number(product?.unitEconomics?.targetCpaUsd)||13
  }),[product?.id]);
  const [v,setV]=useState(defaults);
  useEffect(()=>setV(defaults),[defaults]);
  if(!product)return null;
  const contribution=v.price-v.cogs-v.shipping-v.fees;
  const profit=contribution-v.cpa;
  const scenarios=[10,50,100].map(n=>({n,month:profit*n*30}));
  return <div className="viz-card economics-sim">
    <div className="viz-head"><h3>Unit Economics Simulator</h3><p className="muted">Edit assumptions and see break-even immediately.</p></div>
    <div className="economics-inputs">
      {Object.entries({price:"Selling price",cogs:"COGS",shipping:"Shipping",fees:"Fees",cpa:"Expected CPA"}).map(([k,l])=><label key={k}><span>{l}</span><input type="number" step="0.01" value={v[k]} onChange={e=>setV({...v,[k]:Number(e.target.value)})}/></label>)}
    </div>
    <div className="unit-strip">
      <div><span>Contribution</span><b>{money(contribution)}</b></div>
      <div><span>Break-even CPA</span><b>{money(contribution)}</b></div>
      <div><span>Profit / order</span><b>{money(profit)}</b></div>
      <div><span>Expected ROAS</span><b>{v.cpa>0?(v.price/v.cpa).toFixed(2)+"x":"—"}</b></div>
    </div>
    <div className="scenario-grid">{scenarios.map(s=><div key={s.n}><b>{money(s.month)}</b><span>{s.n} orders/day · monthly</span></div>)}</div>
  </div>;
}

export function WinnerBoard({ products=[], externalFilters={}, onOpen, onValidate, onShopify, watchIds=new Set(), onWatch }) {
  const [filter,setFilter]=useState("ALL");
  const today=new Date().toISOString().slice(0,10);
  const filtered=products.filter(p=>{
    const cost=Number(p.supplierVerification?.landedCostUsd ?? p.supplierOptions?.[0]?.landedCostUsd ?? p.estCostUsd);
    if(externalFilters.maxCost!=null && cost>Number(externalFilters.maxCost))return false;
    if(externalFilters.minMargin!=null && Number(p.marginPct)<Number(externalFilters.minMargin))return false;
    const comp=Number(p.winnerDecision?.components?.competition ?? p.pillars?.competitionEase ?? 0);
    if(externalFilters.minCompetitionEase!=null && comp<Number(externalFilters.minCompetitionEase))return false;
    if((externalFilters.excludeLifecycle||[]).includes(p.trendStatus))return false;
    const risk=(p.riskFlags||[]).join(" ").toLowerCase();
    if((externalFilters.excludeRisk||[]).some(x=>risk.includes(String(x).toLowerCase())))return false;
    if(filter==="ALL")return true;
    if(filter==="NEW")return String(p.discoveredAt||"").startsWith(today);
    if(filter==="EMERGING")return ["EMERGING","ACCELERATING"].includes(p.trendStatus);
    if(filter==="MARGIN")return Number(p.marginPct)>=60;
    if(filter==="LOW_COMP")return Number(p.winnerDecision?.components?.competition??p.competitionEase??p.pillars?.competitionEase)>=65;
    if(filter==="SHOPIFY")return !p.rejected && Number(p.marginPct)>=50 && Boolean(p.image?.url);
    if(filter==="TESTED")return ["TESTING","VALIDATED"].includes(p.validationStatus);
    return true;
  }).sort((a,b)=>Number(b.winnerDecision?.score||0)-Number(a.winnerDecision?.score||0))
    .slice(0,externalFilters.limit||products.length);
  const filters=[["ALL","All"],["NEW","New today"],["EMERGING","Emerging"],["MARGIN","High margin"],["LOW_COMP","Low competition"],["SHOPIFY","Shopify ready"],["TESTED","Tested"]];
  return <main className="winner-page">
    <div className="radar-hero"><div><div className="hero-kicker">WINNING PRODUCTS</div><h2>Shortlist decisions, not 50-row homework.</h2><p>Ranked by winner score while preserving evidence quality and lifecycle.</p></div></div>
    {Object.keys(externalFilters||{}).length?<div className="ai-filter-banner"><strong>AI filters active</strong><span>{JSON.stringify(externalFilters)}</span></div>:null}
    <div className="winner-filters">{filters.map(([k,l])=><button key={k} className={filter===k?"on":""} onClick={()=>setFilter(k)}>{l}</button>)}</div>
    <div className="winner-table-wrap"><table className="winner-table"><thead><tr><th>Watch</th><th>Product</th><th>Score</th><th>Trend</th><th>Margin</th><th>Competition</th><th>Proof</th><th>Actions</th></tr></thead>
      <tbody>{filtered.map(p=><tr key={p.id}>
        <td><button className={watchIds.has(p.id)?"table-watch on":"table-watch"} onClick={()=>onWatch?.(p.id)}>{watchIds.has(p.id)?"★":"☆"}</button></td>
        <td><div className="winner-product">{p.image?.url?<img src={p.image.url} alt="" loading="lazy"/>:null}<div><strong>{p.title}</strong><small>{p.category}</small></div></div></td>
        <td><b>{p.winnerDecision?.score??"—"}</b></td>
        <td><span className={`lifecycle ${String(p.trendStatus||"discovered").toLowerCase()}`}>{p.trendStatus||"DISCOVERED"}</span></td>
        <td>{p.marginPct??"—"}%</td>
        <td>{Math.round(Number(p.winnerDecision?.components?.competition??p.pillars?.competitionEase)||0)}</td>
        <td><span className={`proof-pill ${String(p.dataConfidence||"low").toLowerCase()}`}>{p.dataConfidence||"LOW"}</span></td>
        <td><div className="winner-actions"><button onClick={()=>onOpen?.(p)}>Open</button><button onClick={()=>onValidate?.(p)}>Validate</button><button onClick={()=>onShopify?.(p)}>Shopify</button></div></td>
      </tr>)}</tbody></table></div>
    {!filtered.length?<div className="radar-empty"><h3>No products match this filter.</h3><p>Run discovery or change the winner filter.</p></div>:null}
  </main>;
}

export function WatchAlerts({ ids=[] , onOpen }) {
  const [alerts,setAlerts]=useState([]);
  const [busy,setBusy]=useState(false);
  async function refresh(){setBusy(true);try{const d=await api("/api/watch/alerts",{method:"POST",body:{ids,days:30}});setAlerts(d.alerts||[]);}finally{setBusy(false)}}
  useEffect(()=>{if(ids.length)refresh();else setAlerts([])},[ids.join("|")]);
  return <div className="viz-card watch-alerts"><div className="viz-head"><h3>Watchlist Alerts</h3><button className="ghost" onClick={refresh} disabled={busy}>{busy?"Checking…":"Refresh"}</button></div>
    {!alerts.length?<p className="muted">No material changes detected yet. Alerts appear after repeated research snapshots.</p>:alerts.map((a,i)=><button className={`alert-row ${a.severity}`} key={i} onClick={()=>onOpen?.(a.productId)}><b>{a.type}</b><span>{a.message}</span><small>{new Date(a.capturedAt).toLocaleString()}</small></button>)}
  </div>;
}

export function LaunchKitPanel({ product, onPushShopify }) {
  const [kit,setKit]=useState(null),[busy,setBusy]=useState(false),[err,setErr]=useState("");
  useEffect(()=>{setKit(null);setErr("")},[product?.id]);
  if(!product)return null;
  async function build(){setBusy(true);setErr("");try{setKit(await api("/api/launch-kit",{method:"POST",body:{product}}))}catch(e){setErr(e.message)}finally{setBusy(false)}}
  return <div className="viz-card launch-kit"><div className="viz-head"><div><h3>Shopify Launch Kit</h3><p className="muted">Store copy + offer + ad assets. No fabricated reviews.</p></div><button className="btn" onClick={build} disabled={busy}>{busy?"Building…":"Build Store Assets"}</button></div>
    {err?<div className="error">{err}</div>:null}
    {kit?<div className="launch-grid">
      <div><span>Title</span><strong>{kit.title}</strong></div>
      <div><span>Pricing</span><strong>{money(kit.pricing?.recommended)} · compare {money(kit.pricing?.compareAt)}</strong></div>
      <div className="wide"><span>Description</span><p>{kit.description}</p></div>
      <div className="wide"><span>Benefits</span><ul>{(kit.benefits||[]).map(x=><li key={x}>{x}</li>)}</ul></div>
      <div className="wide"><span>Ad hooks</span><ul>{(kit.adHooks||[]).map(x=><li key={x}>{x}</li>)}</ul></div>
      <div className="wide"><span>UGC script</span><p>{kit.ugcScript}</p></div>
      <div><span>SEO title</span><p>{kit.seoTitle}</p></div><div><span>Meta description</span><p>{kit.metaDescription}</p></div>
      <div className="wide launch-actions"><button className="btn" onClick={()=>onPushShopify?.({...product,launchKit:kit,title:kit.title||product.title})}>Push Draft to Shopify</button></div>
    </div>:<p className="muted">Generate a launch kit after supplier/economics review.</p>}
  </div>;
}
