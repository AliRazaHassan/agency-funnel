import crypto from 'node:crypto';
import { readApifyDataset } from './apifyEvidence.js';
const CAP = 0.50;
const terminal = new Set(['SUCCEEDED','FAILED','ABORTED','TIMED-OUT']);
export function createAutomaticHunter(store, request = fetch, env = process.env, readDataset = readApifyDataset) {
  async function api(path, options={}) {
    if (!env.APIFY_TOKEN) throw new Error('Connect APIFY_TOKEN in the server environment to enable automatic hunting.');
    const r=await request(`https://api.apify.com/v2/${path}`,{...options,headers:{Authorization:`Bearer ${env.APIFY_TOKEN}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
    if(!r.ok) {
      const detail=await r.json().catch(()=>({}));
      const error=new Error(`Apify HTTP ${r.status}: ${String(detail.error?.message || detail.error?.type || 'request rejected').split(env.APIFY_TOKEN).join('[redacted]').slice(0,300)}`);
      error.definiteRejection=r.status>=400 && r.status<500 && r.status!==408 && r.status!==429;
      throw error;
    }
    return (await r.json()).data;
  }
  async function start({query,market='US',requestId,platform='tiktok'}) {
    query=String(query||'').trim();
    if(!['tiktok','meta','google'].includes(platform)) throw new Error('Select TikTok, Meta or Google Trends');
    if(!query || query.length>160 || !/^[A-Z]{2}$/.test(market) || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId||'')) throw new Error('A query, two-letter market and unique request ID are required.');
    // Stable request ID prevents double click/retry from spending twice, including restarts.
    const old=(await store.read()).hunts?.find(h=>h.requestId===requestId);
    if(old) return old;
    const [user,limits]=await Promise.all([api('users/me'),api('users/me/limits')]);
    const credits=Number(user.plan?.monthlyUsageCreditsUsd), used=Number(limits.current?.monthlyUsageUsd), max=Number(limits.limits?.maxMonthlyUsageUsd);
    if(user.plan?.tier!=='FREE' || user.isPaying!==false || !Number.isFinite(credits) || !Number.isFinite(used) || !Number.isFinite(max) || credits<=0 || used<0 || max>credits || Math.min(credits,max)-used<CAP || Number(limits.current?.activeActorJobCount)!==0) throw new Error('Free-only guard: verify a FREE account, no paid billing, usage cap within free credits, no active runs, and at least $0.50 remaining. No run started.');
    const cycle=limits.monthlyUsageCycle?.startAt;
    if(!cycle || !Number.isFinite(Date.parse(cycle))) throw new Error('Cannot verify the current credit cycle. No run started.');
    const job=await store.mutate(db=>{
      db.hunts??=[];
      const existing=db.hunts.find(h=>h.requestId===requestId); if(existing)return existing;
      if(db.hunts.some(h=>['STARTING','RUNNING','UNKNOWN','IMPORTING'].includes(h.status))) throw new Error('An automatic hunt is already active or needs reconciliation.');
      if(db.hunts.filter(h=>h.cycle===cycle).length>=8) throw new Error('Free-cycle safety limit reached (8 reserved hunts).');
      const h={id:crypto.randomUUID(),requestId,query,market,platform,cycle,reservedUsd:CAP,status:'STARTING',createdAt:new Date().toISOString()};db.hunts.push(h);return {...h,launch:true};
    });
    if(!job.launch)return job;
    try {
      const input={searchQueries:[query],resultsPerPage:10,oldestPostDateUnified:new Date(Date.now()-7*86400000).toISOString().slice(0,10),shouldDownloadVideos:false,shouldDownloadCovers:false,shouldDownloadAvatars:false,shouldDownloadSubtitles:false,scrapeRelatedVideos:false};
      const actor=platform==='google' ? 'apify~google-trends-scraper' : platform==='meta' ? 'apify~facebook-ads-scraper' : 'clockworks~tiktok-scraper';
      const actorInput=platform==='google' ? {searchTerms:[query],geo:market==='UK'?'GB':market,timeRange:'today 3-m',maxItems:1,maxConcurrency:1,maxRequestRetries:0,skipDebugScreen:true} : platform==='meta' ? {startUrls:[{url:`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${market}&q=${encodeURIComponent(query)}&search_type=keyword_unordered`}],resultsLimit:10,activeStatus:'active'} : input;
      const run=await api(`acts/${actor}/runs?timeout=120&memory=4096&maxTotalChargeUsd=0.5`,{method:'POST',body:JSON.stringify(actorInput)});
      if(!run?.id)throw new Error('Run response did not contain an ID.');
      await store.mutate(db=>Object.assign(db.hunts.find(h=>h.id===job.id),{runId:run.id,status:'RUNNING'}));
    } catch (error) {
      // A lost response might follow a successful start. Never automatically start again.
      await store.mutate(db=>Object.assign(db.hunts.find(h=>h.id===job.id),{status:error.definiteRejection?'FAILED':'UNKNOWN',reason:error.definiteRejection?error.message:'Start could not be confirmed. Check Apify Runs before retrying; reservation retained to avoid duplicate charges.'}));
    }
    return (await store.read()).hunts.find(h=>h.id===job.id);
  }
  async function poll(id) {
    let job=(await store.read()).hunts?.find(h=>h.id===id);
    if(!job)throw new Error('Hunt not found');
    if(job.status==='STARTING' && Date.now()-Date.parse(job.createdAt)>180000){
      await store.mutate(db=>{const h=db.hunts.find(h=>h.id===id);if(h.status==='STARTING')Object.assign(h,{status:'UNKNOWN',reason:'Start lease expired; reconcile in Apify Runs before another launch.'});});
      return (await store.read()).hunts.find(h=>h.id===id);
    }
    if(job.status==='UNKNOWN') {
      const actor=job.platform==='google'?'apify~google-trends-scraper':job.platform==='meta'?'apify~facebook-ads-scraper':'clockworks~tiktok-scraper';
      const recent=await api(`acts/${actor}/runs?limit=100&desc=1`);
      if(Array.isArray(recent?.items) && recent.items.every(r=>Number.isFinite(Date.parse(r.startedAt)) && Date.parse(r.startedAt)<Date.parse(job.createdAt)-1000)) {
        await store.mutate(db=>Object.assign(db.hunts.find(h=>h.id===id),{status:'FAILED',reason:'Reconciled provider run history: no run started for this attempt. Credit reservation retained.'}));
        job=(await store.read()).hunts.find(h=>h.id===id);
      }
    }
    if(job.status!=='RUNNING')return job;
    const run=await api(`actor-runs/${encodeURIComponent(job.runId)}`);
    if(!terminal.has(run.status))return job;
    if(run.status!=='SUCCEEDED') {
      await store.mutate(db=>Object.assign(db.hunts.find(h=>h.id===id),{status:run.status,completedAt:new Date().toISOString(),reason:'Provider run did not succeed; no products invented.'}));
    } else {
      const result=await readDataset(run.defaultDatasetId,{market:job.market,query:job.query,platform:job.platform,observedAt:run.finishedAt},request);
      await store.mutate(db=>{
        const h=db.hunts.find(h=>h.id===id);if(h.status!=='RUNNING')return;
        const ids=new Set(db.observations.map(o=>o.id));for(const o of result.observations)if(!ids.has(o.id)){db.observations.push(o);ids.add(o.id);}
        Object.assign(h,{status:'SUCCEEDED',completedAt:new Date().toISOString(),acceptedVideos:result.acceptedVideos,rejected:result.rejected,count:result.observations.length,datasetId:run.defaultDatasetId});
      });
    }
    return (await store.read()).hunts.find(h=>h.id===id);
  }
  return {start,poll};
}
