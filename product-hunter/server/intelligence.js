const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const avg=(xs)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const pct=(a,b)=>b?((a-b)/Math.abs(b))*100:0;

export const TREND_WEIGHTS={amazon:0.25,tiktok:0.25,meta:0.20,google:0.15,crossPlatform:0.10,confidence:0.05};

export function trendScore(signals={}){
  const parts={
    amazon:clamp(signals.amazon),
    tiktok:clamp(signals.tiktok),
    meta:clamp(signals.meta),
    google:clamp(signals.google),
    crossPlatform:clamp(signals.crossPlatform),
    confidence:clamp(signals.confidence),
  };
  const score=Math.round(Object.entries(TREND_WEIGHTS).reduce((s,[k,w])=>s+parts[k]*w,0));
  return {score,components:parts,weights:TREND_WEIGHTS};
}

export function momentum(history=[]){
  const sorted=[...history].filter(x=>x&&Number.isFinite(Number(x.value))&&!Number.isNaN(new Date(x.date).getTime())).sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(sorted.length<2)return {d7:null,d14:null,d30:null,acceleration:null,status:"DISCOVERED"};
  const latest=sorted.at(-1);
  const latestMs=new Date(latest.date).getTime();
  const oldestMs=new Date(sorted[0].date).getTime();
  const spanDays=(latestMs-oldestMs)/86400000;
  const nearest=(days)=>{
    const target=latestMs-days*86400000;
    return sorted.reduce((best,x)=>Math.abs(new Date(x.date).getTime()-target)<Math.abs(new Date(best.date).getTime()-target)?x:best,sorted[0]);
  };
  const calc=(days,minSpan)=>spanDays>=minSpan?pct(latest.value,nearest(days).value):null;
  const d7=calc(7,5), d14=calc(14,10), d30=calc(30,21);
  const acceleration=d7!=null&&d14!=null?d7-(d14/2):null;
  let status="DISCOVERED";
  if(d30!=null&&d30<-15)status="DECLINING";
  else if(d7!=null&&acceleration!=null&&d7>20&&acceleration>5)status="ACCELERATING";
  else if(d30!=null&&d30>15)status="EMERGING";
  else if(d7!=null||d14!=null||d30!=null)status="STABLE";
  return {
    d7:d7==null?null:+d7.toFixed(1),
    d14:d14==null?null:+d14.toFixed(1),
    d30:d30==null?null:+d30.toFixed(1),
    acceleration:acceleration==null?null:+acceleration.toFixed(1),
    status
  };
}

export function saturation({demandGrowth=0,advertiserGrowth=0}={}){
  const gap=Number(advertiserGrowth)-Number(demandGrowth);
  if(gap>=50)return {status:"SATURATING",risk:"HIGH",reason:"Advertising competition is growing much faster than observed demand."};
  if(Number(demandGrowth)-Number(advertiserGrowth)>=30)return {status:"DEMAND_OUTPACING_AD_COMPETITION",risk:"LOW",reason:"Observed demand is growing faster than advertising competition."};
  return {status:"BALANCED",risk:"MEDIUM",reason:"Demand and advertising competition are moving at similar rates."};
}

export function whyTrending(product={}){
  const s=product.signals||{};
  const evidence=[
    ["Amazon",s.amazon,"Amazon demand / rank signal"],
    ["TikTok",s.tiktok,"TikTok product and ad momentum"],
    ["Meta",s.meta,"Meta advertising activity"],
    ["Google",s.google,"Google search momentum"],
  ].filter(([,v])=>Number(v)>0).map(([source,value,reason])=>({source,value:clamp(value),reason,status:product.dataStatus?.[source.toLowerCase()]||"ESTIMATED"}));
  return {productId:product.id||null,title:product.title||product.name||"Product",trend:trendScore(s),evidence,summary:evidence.length>=3?"Multiple independent platforms show product momentum.":evidence.length?"Some market signals are present; more cross-platform evidence is needed.":"Insufficient evidence.",generatedFromEvidence:true};
}

export function buildIntelligence(product={}){
  const signals=product.signals||{};
  const history=product.history||[];
  const trend=trendScore(signals);
  const movement=momentum(history);
  const sat=saturation({demandGrowth:movement.d30||0,advertiserGrowth:product.advertiserGrowth||0});
  const confidence=clamp(signals.confidence||avg(Object.values(signals).filter(Number.isFinite)));
  return {...product,trendScore:trend.score,trendComponents:trend.components,trendStatus:sat.status==="SATURATING"?"SATURATING":movement.status,dataConfidence:confidence>=75?"HIGH":confidence>=45?"MEDIUM":"LOW",momentum:movement,saturation:sat,whyTrending:whyTrending(product)};
}

export function searchIntelligence(products=[],filters={}){
  return products.map(buildIntelligence).filter(p=>{
    if(filters.market&&p.market&&String(p.market).toUpperCase()!==String(filters.market).toUpperCase())return false;
    if(filters.maxPrice!=null&&Number(p.price)>Number(filters.maxPrice))return false;
    if(filters.minTrendScore!=null&&p.trendScore<Number(filters.minTrendScore))return false;
    if(filters.status&&p.trendStatus!==filters.status)return false;
    return true;
  }).sort((a,b)=>b.trendScore-a.trendScore);
}
