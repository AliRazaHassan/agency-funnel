import { chatJson } from "./openai.js";

function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,Number(n)||0));}

export function buildFallback(product={}){
  const price=Number(product.estSellPriceUsd)||0;
  const cost=Number(product.estCostUsd)||0;
  const margin=Number(product.marginPct)||0;
  const trend=Number(product.trendScore)||0;
  const confidence=String(product.dataConfidence||"LOW").toUpperCase();
  const verified=Number(product.winnerDecision?.verifiedSources)||0;
  const productVerified=Number(product.winnerDecision?.productVerifiedSources)||0;
  const risks=[...(product.winnerDecision?.hardFails||[]),...(product.winning?.softWarnings||[]),...(product.riskFlags||[])];
  const missing=Object.entries(product.dataStatus||{}).filter(([,v])=>!["LIVE","RECENT","MANUAL"].includes(v)).map(([k])=>k);
  const suggestedPrice=price ? Math.round(price*100)/100 : Math.max(19.99,Math.round(cost*2.5*100)/100);
  const testBudget=Math.max(20,Math.min(100,Math.round((suggestedPrice*1.5)/5)*5));
  const blocked=(product.winnerDecision?.hardFails||[]).length>0 || product.saturation?.risk==="HIGH" || product.trendStatus==="DECLINING";
  const status=(!blocked&&margin>=50&&trend>=55&&confidence!=="LOW"&&verified>=1&&productVerified>=1)?"READY_TO_TEST":"NEEDS_DATA";
  return {
    status,
    opportunity: product.whyTrending?.summary || `Trend score ${trend}/100 with ${margin}% estimated margin.`,
    biggestRisk: risks[0] || (productVerified<1 ? "Product-specific verified evidence is missing; niche momentum alone is not enough." : verified<2 ? "Evidence is still thin; verify another independent source before scaling." : "Creative-market fit is not yet proven with paid traffic."),
    missingEvidence: missing.length ? missing.slice(0,4) : ["Paid traffic conversion", "Supplier quality / delivery consistency"],
    plan:{
      suggestedSellingPrice:suggestedPrice,
      targetMarginPct:Math.max(50,Math.round(margin)),
      testBudgetUsd:testBudget,
      creativeAngle:product.hook || product.problemSolved || "Lead with the clearest problem/solution transformation.",
      hook:product.offerLine || product.hook || `Show ${product.problemSolved || "the problem"} and the product solving it fast.`,
      nextStep: productVerified<1 ? "Add product-specific proof (for example an ASIN/manual Amazon observation) before paid testing." : verified<2 ? "Verify at least one more independent recent source, then launch a small creative test." : "Launch 2–3 creatives with one audience and controlled spend.",
      stopCondition:`Stop if there is no meaningful add-to-cart/checkout intent after roughly $${testBudget}–$${testBudget*2} spend, or if CPA cannot support the margin.`,
      scaleCondition:"Scale only after repeatable purchases show acceptable CPA, conversion rate and contribution margin.",
    },
    checklist:[
      {id:"supplier",label:"Supplier cost & availability verified",done:Boolean(product.supplierVerified===true || ["LIVE","RECENT","MANUAL"].includes(product.sourceFrom?.status)),kind:"manual"},
      {id:"shipping",label:"Shipping risk acceptable",done:["low","med","medium"].includes(String(product.shippingDifficulty||"").toLowerCase()),kind:"auto"},
      {id:"trend",label:"Trend evidence strong enough",done:trend>=55,kind:"auto"},
      {id:"competition",label:"Competition manageable",done:Number(product.competitionScore||product.winnerDecision?.components?.competition||0)>=45,kind:"auto"},
      {id:"margin",label:"Margin safety gate",done:margin>=50,kind:"auto"},
      {id:"creative",label:"Creative angle available",done:Boolean(product.hook||product.problemSolved),kind:"auto"},
      {id:"productProof",label:"Product-specific evidence verified",done:productVerified>=1,kind:"auto"},
      {id:"confidence",label:"Evidence confidence sufficient",done:confidence!=="LOW"||verified>=2,kind:"auto"},
    ]
  };
}

export async function buildValidationPlan(product={}){
  const fallback=buildFallback(product);
  const ai=await chatJson(
    `You are an ecommerce product validation analyst. Use the supplied evidence conservatively.
Never guarantee sales or profit. Distinguish estimated evidence from verified/recent evidence.
Return strict JSON:
{
 "status":"NEEDS_DATA|READY_TO_TEST",
 "opportunity":"short string",
 "biggestRisk":"short string",
 "missingEvidence":["..."],
 "plan":{
   "suggestedSellingPrice":number,
   "targetMarginPct":number,
   "testBudgetUsd":number,
   "creativeAngle":"...",
   "hook":"...",
   "nextStep":"...",
   "stopCondition":"...",
   "scaleCondition":"..."
 }
}
Keep test budget modest and validation-focused. Do not invent live evidence.`,
    JSON.stringify({
      title:product.title, category:product.category, cost:product.estCostUsd, price:product.estSellPriceUsd,
      marginPct:product.marginPct, trendScore:product.trendScore, trendStatus:product.trendStatus,
      confidence:product.dataConfidence, saturation:product.saturation, winnerDecision:product.winnerDecision,
      dataStatus:product.dataStatus, whyTrending:product.whyTrending, riskFlags:product.riskFlags,
      hook:product.hook, problemSolved:product.problemSolved, sourceFrom:product.sourceFrom
    })
  );
  if(!ai) return {...fallback,mode:"rules"};
  const aiStatus = ai.status === "NEEDS_DATA" ? "NEEDS_DATA" : fallback.status;
  const aiPlan = ai.plan || {};
  const safeNumber = (value, fallbackValue, min, max) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallbackValue;
  };
  return {
    ...fallback,
    ...ai,
    status: aiStatus,
    checklist:fallback.checklist,
    plan:{
      ...fallback.plan,
      ...aiPlan,
      suggestedSellingPrice:safeNumber(aiPlan.suggestedSellingPrice,fallback.plan.suggestedSellingPrice,5,5000),
      targetMarginPct:safeNumber(aiPlan.targetMarginPct,fallback.plan.targetMarginPct,0,95),
      testBudgetUsd:safeNumber(aiPlan.testBudgetUsd,fallback.plan.testBudgetUsd,10,500)
    },
    mode:"ai"
  };
}
