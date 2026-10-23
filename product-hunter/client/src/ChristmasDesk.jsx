import { useEffect, useState } from "react";
import { api, downloadBlob } from "./api.js";

export function ChristmasDesk({ onResearch, busy }) {
  const [market,setMarket] = useState("US");
  const [data,setData] = useState(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const [revision,setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setData(null);
    api(`/api/christmas/shortlist?market=${market}`).then(d=>{if(active)setData(d);})
      .catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[market,revision]);
  async function exportList() {
    try { await downloadBlob("/api/christmas/export",{market},`christmas-2026-${market}.csv`); }
    catch(e) { setError(e.message); }
  }
  return <main className="stage-page christmas-desk">
    <div className="stage-hero"><div className="hero-kicker">CHRISTMAS 2026 · DECEMBER 25</div><h2>Choose what deserves a Christmas test.</h2><p>Start with sourced demand themes, then prove the exact product, supplier and delivery window.</p></div>
    <div className="btn-row"><label>Target market <select value={market} onChange={e=>setMarket(e.target.value)}>{["US","UK","CA","AU","DE","FR"].map(x=><option key={x}>{x}</option>)}</select></label><button className="ghost" onClick={()=>setRevision(x=>x+1)} disabled={loading}>Refresh readiness</button><button className="btn" onClick={exportList} disabled={!data}>Download shortlist CSV</button></div>
    {error?<div role="alert" className="error">{error}</div>:null}
    {loading?<p role="status">Checking Christmas shortlist…</p>:null}
    {data?<>
      <div className="viz-card"><strong>{data.summary.candidates} research priorities · {data.summary.readyToTest} ready to test · {data.summary.verifiedWinners} verified winners</strong><p>{data.note}</p><a href={data.source.url} target="_blank" rel="noreferrer">Read the source report</a><p className="muted">Published {data.source.publishedAt} · underlying data {data.source.dataAsOf} · reviewed {data.source.reviewedAt}. Category evidence is separate from current SKU proof.</p>{data.expired?<p role="alert">The 2026 season has ended. These candidates need a fresh seasonal review.</p>:null}</div>
      <div className="christmas-grid">{data.products.map(p=><article className="viz-card christmas-candidate" key={p.id}>
        <span className="hero-kicker">RESEARCH PRIORITY {p.priority}</span><h3>{p.title}</h3><strong>{p.verifiedWinner?"VERIFIED WINNER":p.verdict.replaceAll("_"," ")}</strong>
        <p>{p.evidence.summary}</p><p><b>Offer idea:</b> {p.angle}</p><p><b>Check:</b> {p.risk}</p>
        <p><b>Delivery:</b> {p.delivery.status.replaceAll("_"," ")}{p.delivery.latestOrderDate?` · planned last order ${p.delivery.latestOrderDate}`:" · supplier quote needed"}</p>
        {p.delivery.startTestBy?<p>Start test by {p.delivery.startTestBy}. Customer delivery target: {p.delivery.deliveryTarget}.</p>:null}
        <ul>{p.nextSteps.map(s=><li key={s}>{s}</li>)}</ul>
        <div className="btn-row">{Object.entries(p.links).map(([label,url])=><a key={label} href={url} target="_blank" rel="noreferrer">{label === "meta"?"Ad competition":label === "amazon"?"Market listings":"Find supplier"}</a>)}</div>
        <button className="btn" disabled={busy||data.expired} onClick={()=>onResearch?.(p.researchQuery,market)}>{busy?"Researching…":"Research this product"}</button>
      </article>)}</div>
    </>:null}
  </main>;
}
