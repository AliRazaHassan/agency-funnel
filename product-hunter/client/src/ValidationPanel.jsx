import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const STATUS_ORDER=["NEEDS_DATA","READY_TO_TEST","TESTING","VALIDATED"];
const EMPTY_TEST={spendUsd:"",impressions:"",clicks:"",addToCarts:"",purchases:"",revenueUsd:""};

export function ValidationPanel({ product, open, onClose, onStatusChange }) {
  const [data,setData]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [days,setDays]=useState(30);
  const [history,setHistory]=useState([]);
  const [tests,setTests]=useState([]);
  const [test,setTest]=useState(EMPTY_TEST);
  const [savingTest,setSavingTest]=useState(false);

  async function loadHistory(targetDays=days){
    if(!product?.id) return;
    const h=await api(`/api/tracking/${encodeURIComponent(product.id)}/history?days=${targetDays}`);
    setHistory(h.history||[]);
  }
  async function loadTests(){
    if(!product?.id) return;
    const t=await api(`/api/tracking/${encodeURIComponent(product.id)}/tests`);
    setTests(t.tests||[]);
  }

  useEffect(()=>{
    if(!open||!product) return;
    let alive=true;
    setBusy(true);setError("");setData(null);
    Promise.all([
      api("/api/products/validate",{method:"POST",body:{product}}),
      api(`/api/tracking/${encodeURIComponent(product.id)}/history?days=30`),
      api(`/api/tracking/${encodeURIComponent(product.id)}/tests`)
    ])
      .then(([plan,h,t])=>{if(alive){setData(plan);setHistory(h.history||[]);setTests(t.tests||[]);setDays(30)}})
      .catch(e=>{if(alive)setError(e.message||"Validation failed")})
      .finally(()=>{if(alive)setBusy(false)});
    return()=>{alive=false};
  },[open,product?.id]);

  const historyStats=useMemo(()=>{
    if(!history.length) return null;
    const first=history[0], last=history[history.length-1];
    return {
      count:history.length,
      trendDelta:Math.round((Number(last.trendScore)||0)-(Number(first.trendScore)||0)),
      winnerDelta:Math.round((Number(last.winnerScore)||0)-(Number(first.winnerScore)||0)),
      latest:last
    };
  },[history]);

  async function changeDays(n){
    setDays(n);
    try{await loadHistory(n)}catch(e){setError(e.message||"History failed")}
  }

  async function saveTest(e){
    e.preventDefault();
    if(!product?.id||savingTest) return;
    setSavingTest(true);setError("");
    try{
      const payload=Object.fromEntries(Object.entries(test).map(([k,v])=>[k,Number(v)||0]));
      const saved=await api(`/api/tracking/${encodeURIComponent(product.id)}/tests`,{method:"POST",body:payload});
      setTests((list)=>[saved,...list]);
      setTest(EMPTY_TEST);
      if(saved.derived?.status) onStatusChange?.(saved.derived.status,true);
    }catch(e){setError(e.message||"Ad test save failed")}
    finally{setSavingTest(false)}
  }

  if(!open||!product) return null;
  const latestTest=tests[0];
  const current=latestTest?.derived?.status||data?.status||product.validationStatus||"NEEDS_DATA";

  return (
    <aside className="validation-panel">
      <div className="validation-head">
        <div>
          <small>PRODUCT VALIDATION</small>
          <strong>{product.title}</strong>
        </div>
        <button type="button" className="concierge-close" onClick={onClose}>×</button>
      </div>

      <div className="validation-flow">
        {STATUS_ORDER.map((s,i)=><button key={s} type="button" className={current===s?"on":""} onClick={()=>onStatusChange?.(s)}><span>{i+1}</span>{s.replaceAll("_"," ")}</button>)}
      </div>

      {busy ? <div className="validation-loading"><b>Building validation plan…</b><p>Reviewing evidence, history and risks.</p></div> : null}
      {error ? <div className="error">{error}</div> : null}

      {data ? <>
        <div className="validation-summary">
          <div><small>Opportunity</small><p>{data.opportunity}</p></div>
          <div className="risk"><small>Biggest risk</small><p>{data.biggestRisk}</p></div>
          <div><small>Missing evidence</small><p>{(data.missingEvidence||[]).join(" · ")||"None flagged"}</p></div>
        </div>

        <div className="validation-numbers">
          <div><b>{"$"+Number(data.plan?.suggestedSellingPrice||0).toFixed(2)}</b><span>Suggested price</span></div>
          <div><b>{Math.round(Number(data.plan?.targetMarginPct||0))+"%"}</b><span>Target margin</span></div>
          <div><b>{"$"+Math.round(Number(data.plan?.testBudgetUsd||0))}</b><span>Test budget</span></div>
        </div>

        <div className="history-card">
          <div className="history-head"><div><small>TRACKED MOMENTUM</small><b>{days}-day history</b></div><div className="history-tabs">{[7,14,30].map(n=><button key={n} className={days===n?"on":""} onClick={()=>changeDays(n)}>{n}d</button>)}</div></div>
          {historyStats ? <div className="history-grid">
            <div><b>{historyStats.count}</b><span>Snapshots</span></div>
            <div><b>{historyStats.trendDelta>0?"+":""}{historyStats.trendDelta}</b><span>Trend Δ</span></div>
            <div><b>{historyStats.winnerDelta>0?"+":""}{historyStats.winnerDelta}</b><span>Winner Δ</span></div>
            <div><b>{historyStats.latest.lifecycle||"—"}</b><span>Latest lifecycle</span></div>
          </div> : <p className="muted">First snapshot captured. Re-run research over time to build trend history.</p>}
        </div>

        <div className="validation-plan">
          <div><small>Creative angle</small><p>{data.plan?.creativeAngle}</p></div>
          <div><small>Hook</small><p>{data.plan?.hook}</p></div>
          <div><small>Next step</small><p>{data.plan?.nextStep}</p></div>
          <div><small>Stop condition</small><p>{data.plan?.stopCondition}</p></div>
          <div><small>Scale condition</small><p>{data.plan?.scaleCondition}</p></div>
        </div>

        <div className="ad-test-card">
          <div className="history-head"><div><small>MARKET FEEDBACK</small><b>Ad test results</b></div>{latestTest?.derived ? <span className="proof-pill">{latestTest.derived.proofScore}/100 proof</span>:null}</div>
          {latestTest?.derived ? <div className="history-grid">
            <div><b>{Number(latestTest.derived.ctr||0).toFixed(1)}%</b><span>CTR</span></div>
            <div><b>{latestTest.derived.cpa==null?"—":"$"+Number(latestTest.derived.cpa).toFixed(2)}</b><span>CPA</span></div>
            <div><b>{latestTest.derived.roas==null?"—":Number(latestTest.derived.roas).toFixed(2)+"x"}</b><span>ROAS</span></div>
            <div><b>{latestTest.derived.status?.replaceAll("_"," ")}</b><span>Status</span></div>
          </div>:null}
          <form className="ad-test-form" onSubmit={saveTest}>
            {[
              ["spendUsd","Spend $"],["impressions","Impressions"],["clicks","Clicks"],
              ["addToCarts","Add to carts"],["purchases","Purchases"],["revenueUsd","Revenue $"]
            ].map(([key,label])=><label key={key}><span>{label}</span><input type="number" min="0" step="any" value={test[key]} onChange={e=>setTest({...test,[key]:e.target.value})}/></label>)}
            <button className="btn" type="submit" disabled={savingTest}>{savingTest?"Saving…":"Save test & re-score"}</button>
          </form>
          {latestTest?.derived?.recommendation ? <p className="test-recommendation">{latestTest.derived.recommendation}</p>:null}
        </div>

        <div className="validation-checklist">
          {(data.checklist||[]).map(x=><div key={x.id} className={x.done?"done":"todo"}><span>{x.done?"✓":"•"}</span><p>{x.label}</p></div>)}
        </div>

        <p className="validation-note">{data.mode==="ai"?"AI-assisted validation plan":"Rules-based validation plan"} · tracked evidence + real test results should drive scaling decisions.</p>
      </> : null}
    </aside>
  );
}
