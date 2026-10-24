import { observation } from './evidence.js';

// Reading an existing dataset consumes no Actor runs. Never start paid Actors here.
export const apifyConfigured = () => !!process.env.APIFY_TOKEN;
export function normalizeTikTokExport(items, { market = 'US', query = '', now = new Date() } = {}) {
  if (!Array.isArray(items) || items.length > 1000) throw new Error('Provide at most 1000 TikTok records');
  const observations = [], rejected = {};
  const reject = reason => { rejected[reason] = (rejected[reason] || 0) + 1; };
  for (const p of items) {
    if (!p || typeof p !== 'object') { reject('invalid record'); continue; }
    const timestamp = Number(p.createTime) * 1000;
    const dataAt = p.createTimeISO || (p.createTime && Number.isFinite(timestamp) && Math.abs(timestamp) <= 8640000000000000 ? new Date(timestamp).toISOString() : null);
    if (!dataAt || !Number.isFinite(Date.parse(dataAt)) || Date.parse(dataAt) > +now || +now - Date.parse(dataAt) > 7 * 86400000) { reject('old or invalid publication date'); continue; }
    if (String(p.locationCreated || '').toUpperCase() !== market) { reject('market not confirmed by source'); continue; }
    let url;
    try { url = new URL(p.webVideoUrl); } catch { reject('missing original video URL'); continue; }
    if (!['www.tiktok.com','tiktok.com'].includes(url.hostname) || !/^\/@[^/]+\/video\/\d+$/.test(url.pathname)) { reject('invalid TikTok video URL'); continue; }
    if (p.error || !p.id || String(p.id) !== url.pathname.split('/').at(-1) || !p.text) { reject('incomplete video record'); continue; }
    // A video is niche discovery until a human matches an exact listing/variant.
    for (const [metric, value] of [['views',p.playCount],['likes',p.diggCount],['shares',p.shareCount],['comments',p.commentCount]]) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
      observations.push(observation({ platform:'tiktok', provider:'Apify / clockworks TikTok export', externalId:String(p.id), title:String(p.text).slice(0,500), sourceUrl:url.href, market, scope:'niche', niche:query || 'TikTok discovery', metric, value, unit:metric, dataAt, collectionMethod:'api', limitations:'Video engagement only. Source location is creation location, not buyer location. Exact product, sales and profitability unverified.' }, now));
    }
  }
  return { observations, rejected, acceptedVideos:new Set(observations.map(o=>o.externalId)).size };
}
export async function readApifyDataset(datasetId, options = {}, request = fetch) {
  if (!apifyConfigured()) throw new Error('Add APIFY_TOKEN in server environment, or import a TikTok JSON export. Never paste tokens into research fields.');
  if (!/^[a-zA-Z0-9]{10,40}$/.test(datasetId || '')) throw new Error('Valid Apify dataset ID required');
  const response = await request(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&limit=1000`, { headers:{Authorization:`Bearer ${process.env.APIFY_TOKEN}`}, signal:AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Apify dataset unavailable (HTTP ${response.status}); verify dataset access.`);
  const data = await response.json();
  return options.platform === "meta" ? normalizeMetaExport(data, options) : normalizeTikTokExport(data, options);
}

export function normalizeMetaExport(items,{market='US',query='',now=new Date(),observedAt}={}){
  if(!Array.isArray(items)||items.length>1000)throw new Error('Provide at most 1000 Meta records');
  const observations=[],rejected={};
  for(const p of items){
    let input;try{input=new URL(p?.inputUrl);}catch{}
    const id=String(p?.adArchiveID || p?.adArchiveId || '');
    // Observation time comes from the completed provider run, never the ad launch date.
    if(!p || p.isActive!==true || !/^\d+$/.test(id) || input?.hostname!=='www.facebook.com' || input.pathname!=='/ads/library/' || input.searchParams.get('country')!==market || !observedAt || !Number.isFinite(Date.parse(observedAt)) || +now-Date.parse(observedAt)>7*86400000 || Date.parse(observedAt)>+now){rejected['invalid, inactive, undated or market-unconfirmed ad']=(rejected['invalid, inactive, undated or market-unconfirmed ad']||0)+1;continue;}
    const title=p.snapshot?.body?.text || p.snapshot?.title || p.pageName;
    if(!title)continue;
    observations.push(observation({platform:'meta',provider:'Apify / Facebook Ads Library',externalId:id,title:String(title).slice(0,500),scope:'niche',niche:query,market,metric:'active_ads',value:1,unit:'active ad',dataAt:observedAt,sourceUrl:`https://www.facebook.com/ads/library/?id=${id}`,collectionMethod:'api',correlationKey:`meta:${p.collationId || id}`,limitations:'Ad observed active in a country-filtered library search. Neither sales nor profitability verified. Multiple creatives may belong to one advertiser.'},now));
  }
  return {observations,rejected,acceptedVideos:new Set(observations.map(o=>o.externalId)).size};
}
