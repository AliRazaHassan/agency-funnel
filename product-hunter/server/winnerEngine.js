const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const round=(n)=>Math.round(Number(n)||0);

export const WINNER_WEIGHTS={trend:0.30,profit:0.22,competition:0.15,confidence:0.15,supplier:0.10,creative:0.08};

function pillar(product,id){
  return Number(product.winning?.pillars?.find?.(p=>p.id===id)?.score||0);
}
function evidenceQuality(product){
  const statuses=Object.values(product.dataStatus||{});
  if(!statuses.length)return 0;
  const score=statuses.reduce((s,x)=>s+(x==="LIVE"?100:x==="RECENT"?85:x==="MANUAL"?70:x==="ESTIMATED"?35:0),0)/statuses.length;
  const independent=Object.values(product.trendComponents||{}).filter(v=>Number(v)>=45).length;
  return clamp(score+(independent>=3?10:independent>=2?5:0));
}

export function buildWinnerDecision(product={}){
  const trend=clamp(product.trendScore);
  const profit=clamp(product.winning?.pillars?.find?.(p=>p.id==="margin")?.score ?? product.marginPct);
  const competition=clamp(pillar(product,"competition")||product.competitionScore||50);
  const supplier=clamp(product.supplierEase||pillar(product,"shipping")||50);
  const creative=clamp(pillar(product,"creative")||50);
  const evidence=evidenceQuality(product);
  const declaredConfidence=product.dataConfidence==="HIGH"?90:product.dataConfidence==="MEDIUM"?60:30;
  const confidence=round((evidence*.7)+(declaredConfidence*.3));
  const components={trend,profit,competition,confidence,supplier,creative};
  const score=round(Object.entries(WINNER_WEIGHTS).reduce((s,[k,w])=>s+components[k]*w,0));

  const hardFails=[];
  if(Number(product.marginPct)<45)hardFails.push("Margin below 45% safety gate");
  if(product.winning?.hardFails?.length)hardFails.push(...product.winning.hardFails);
  if(product.trendStatus==="DECLINING")hardFails.push("Trend lifecycle is declining");
  if(product.saturation?.risk==="HIGH")hardFails.push("High saturation risk");

  const verified=Object.values(product.dataStatus||{}).filter(x=>["LIVE","RECENT","MANUAL"].includes(x)).length;
  let verdict="VALIDATE";
  let label="Validate before spend";
  if(hardFails.length){verdict="AVOID";label="Avoid for now";}
  else if(score>=72&&trend>=60&&profit>=55&&confidence>=55&&verified>=2){verdict="STRONG_CANDIDATE";label="Strong candidate";}
  else if(score<52||trend<40){verdict="AVOID";label="Weak evidence";}

  return {version:"winner/v2",score,verdict,label,components,weights:WINNER_WEIGHTS,verifiedSources:verified,hardFails:[...new Set(hardFails)],reason:verdict==="STRONG_CANDIDATE"?"Cross-platform momentum, economics and evidence quality clear the winner gates.":verdict==="VALIDATE"?"Promising signals exist, but more verified evidence is required before ad spend.":"One or more demand, economics or saturation gates failed."};
}

export function summarizeWinnerDecisions(products=[]){
  return {strong:products.filter(p=>p.winnerDecision?.verdict==="STRONG_CANDIDATE").length,validate:products.filter(p=>p.winnerDecision?.verdict==="VALIDATE").length,avoid:products.filter(p=>p.winnerDecision?.verdict==="AVOID").length,total:products.length};
}


export function selectFinalWinners(products=[], limit=2){
  const max=Math.max(1,Math.min(5,Number(limit)||2));
  const eligible=products
    .filter(p=>{
      const d=p.winnerDecision||{};
      const margin=Number(p.marginPct)||0;
      const trend=Number(p.trendScore)||0;
      return d.verdict!=="AVOID" &&
        !(d.hardFails||[]).length &&
        margin>=45 &&
        trend>=45 &&
        p.trendStatus!=="DECLINING" &&
        p.saturation?.risk!=="HIGH";
    })
    .sort((a,b)=>{
      const ad=a.winnerDecision||{}, bd=b.winnerDecision||{};
      return (Number(bd.score)||0)-(Number(ad.score)||0) ||
        (Number(b.trendScore)||0)-(Number(a.trendScore)||0) ||
        (Number(bd.verifiedSources)||0)-(Number(ad.verifiedSources)||0) ||
        (Number(b.marginPct)||0)-(Number(a.marginPct)||0);
    });

  const winnerIds=new Set(eligible.slice(0,max).map(p=>p.id));
  let rank=0;

  return products.map(p=>{
    const current=p.winnerDecision||{};
    const isFinalWinner=winnerIds.has(p.id);
    if(isFinalWinner){
      rank++;
      return {
        ...p,
        isFinalWinner:true,
        winnerRank:rank,
        winnerDecision:{
          ...current,
          verdict:"STRONG_CANDIDATE",
          label:`Final winner #${rank}`,
          reason:"Selected as one of the top 2 products after comparing all 50 candidates on trend, economics, competition, evidence quality, supplier ease and creative potential."
        }
      };
    }

    if(current.verdict==="STRONG_CANDIDATE"){
      return {
        ...p,
        isFinalWinner:false,
        winnerRank:null,
        winnerDecision:{
          ...current,
          verdict:"VALIDATE",
          label:"Shortlisted — not top 2",
          reason:"This product cleared base winner gates but ranked below the final top-2 selection across the full 50-product hunt."
        }
      };
    }

    return {...p,isFinalWinner:false,winnerRank:null};
  });
}
