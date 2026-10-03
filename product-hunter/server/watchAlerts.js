import { getHistory, listTrackedProducts } from "./researchStore.js";

function pct(a,b){ if(!Number.isFinite(a)||!Number.isFinite(b)||b===0) return null; return ((a-b)/Math.abs(b))*100; }

export async function buildWatchAlerts({ ids = [], days = 30 } = {}) {
  const tracked = await listTrackedProducts();
  const wanted = new Set((ids||[]).map(String));
  const products = wanted.size ? tracked.filter((p)=>wanted.has(String(p.id))) : tracked.slice(0,100);
  const alerts = [];
  for (const row of products) {
    const history = await getHistory(row.id, days);
    if (history.length < 2) continue;
    const prev = history[history.length-2];
    const curr = history[history.length-1];
    const title = row.title || row.product?.title || row.id;
    if (prev.lifecycle && curr.lifecycle && prev.lifecycle !== curr.lifecycle) {
      alerts.push({productId:row.id,title,type:"LIFECYCLE",severity:curr.lifecycle==="ACCELERATING"?"high":"medium",message:`${title} moved from ${prev.lifecycle} → ${curr.lifecycle}`,capturedAt:curr.capturedAt});
    }
    const winnerDelta = Number(curr.winnerScore)-Number(prev.winnerScore);
    if (Math.abs(winnerDelta) >= 8) {
      alerts.push({productId:row.id,title,type:"WINNER_SCORE",severity:winnerDelta>0?"high":"medium",message:`${title} winner score ${winnerDelta>0?"+":""}${Math.round(winnerDelta)} points`,capturedAt:curr.capturedAt});
    }
    const trendDelta = pct(Number(curr.trendScore),Number(prev.trendScore));
    if (trendDelta != null && Math.abs(trendDelta) >= 15) {
      alerts.push({productId:row.id,title,type:"TREND",severity:trendDelta>0?"high":"medium",message:`${title} trend changed ${trendDelta>0?"+":""}${Math.round(trendDelta)}%`,capturedAt:curr.capturedAt});
    }
    const metaDelta = pct(Number(curr.metaSignal),Number(prev.metaSignal));
    if (metaDelta != null && Math.abs(metaDelta) >= 20) {
      alerts.push({productId:row.id,title,type:"META_COMPETITION",severity:metaDelta>0?"medium":"high",message:`${title} Meta advertiser signal changed ${metaDelta>0?"+":""}${Math.round(metaDelta)}%`,capturedAt:curr.capturedAt});
    }
    const marginDelta = Number(curr.marginPct)-Number(prev.marginPct);
    if (Number.isFinite(marginDelta) && Math.abs(marginDelta) >= 5) {
      alerts.push({productId:row.id,title,type:"MARGIN",severity:marginDelta<0?"medium":"high",message:`${title} modeled margin changed ${marginDelta>0?"+":""}${marginDelta.toFixed(1)} pts`,capturedAt:curr.capturedAt});
    }
  }
  return alerts.sort((a,b)=>String(b.capturedAt).localeCompare(String(a.capturedAt))).slice(0,100);
}
