import { useEffect, useState } from "react";
import { api } from "./api.js";

const STATUS_ORDER=["NEEDS_DATA","READY_TO_TEST","TESTING","VALIDATED"];

export function ValidationPanel({ product, open, onClose, onStatusChange }) {
  const [data,setData]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!open||!product) return;
    let alive=true;
    setBusy(true);setError("");setData(null);
    api("/api/products/validate",{method:"POST",body:{product}})
      .then(d=>{if(alive)setData(d)})
      .catch(e=>{if(alive)setError(e.message||"Validation failed")})
      .finally(()=>{if(alive)setBusy(false)});
    return()=>{alive=false};
  },[open,product?.id]);

  if(!open||!product) return null;
  const current=data?.status||product.validationStatus||"NEEDS_DATA";

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

      {busy ? <div className="validation-loading"><b>Building validation plan…</b><p>Reviewing evidence, economics and risks.</p></div> : null}
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

        <div className="validation-plan">
          <div><small>Creative angle</small><p>{data.plan?.creativeAngle}</p></div>
          <div><small>Hook</small><p>{data.plan?.hook}</p></div>
          <div><small>Next step</small><p>{data.plan?.nextStep}</p></div>
          <div><small>Stop condition</small><p>{data.plan?.stopCondition}</p></div>
          <div><small>Scale condition</small><p>{data.plan?.scaleCondition}</p></div>
        </div>

        <div className="validation-checklist">
          {(data.checklist||[]).map(x=><div key={x.id} className={x.done?"done":"todo"}><span>{x.done?"✓":"•"}</span><p>{x.label}</p></div>)}
        </div>

        <p className="validation-note">{data.mode==="ai"?"AI-assisted validation plan":"Rules-based validation plan"} · validate real results before scaling.</p>
      </> : null}
    </aside>
  );
}
