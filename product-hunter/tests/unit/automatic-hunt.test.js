import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutomaticHunter} from '../../server/automaticHunt.js';
function setup({paid=false,remaining=5,lost=false}={}){
 const db={hunts:[],observations:[]};let starts=0;
 const store={read:async()=>structuredClone(db),mutate:async fn=>fn(db)};
 const request=async(url,opts)=>{
  if(url.endsWith('/users/me'))return {ok:true,json:async()=>({data:{isPaying:paid,plan:{tier:paid?'STARTER':'FREE',monthlyUsageCreditsUsd:5}}})};
  if(url.endsWith('/users/me/limits'))return {ok:true,json:async()=>({data:{monthlyUsageCycle:{startAt:'2026-10-01T00:00:00Z'},limits:{maxMonthlyUsageUsd:5},current:{monthlyUsageUsd:5-remaining,activeActorJobCount:0}}})};
  if(url.includes('/runs?')){starts++;assert.ok(url.includes('maxTotalChargeUsd=0.5'));assert.ok(url.includes('timeout=120'));assert.equal(JSON.parse(opts.body).resultsPerPage || JSON.parse(opts.body).resultsLimit,10);if(lost)throw Error('timeout');return {ok:true,json:async()=>({data:{id:'run123'}})};}
  return {ok:true,json:async()=>({data:{status:'SUCCEEDED',defaultDatasetId:'dataset123456'}})};
 };
 const hunter=createAutomaticHunter(store,request,{APIFY_TOKEN:'fixture'},async()=>({observations:[{id:'proof1',scope:'niche'}],acceptedVideos:1,rejected:{}}));
 return {hunter,db,starts:()=>starts};
}
const input={query:'pet hair remover',market:'US',requestId:'12345678-1234-1234-1234-123456789012'};
test('free start is idempotent and completion imports once after restart-compatible polling',async()=>{const t=setup();const a=await t.hunter.start(input);await t.hunter.start(input);assert.equal(t.starts(),1);assert.equal(a.status,'RUNNING');const done=await t.hunter.poll(a.id);assert.equal(done.status,'SUCCEEDED');await t.hunter.poll(a.id);assert.equal(t.db.observations.length,1);});
test('paid and insufficient-credit accounts cannot start runs',async()=>{for(const config of [{paid:true},{remaining:0.49}]){const t=setup(config);await assert.rejects(()=>t.hunter.start(input),/Free-only/);assert.equal(t.starts(),0);}});
test('uncertain start retains reservation and blocks any new charge',async()=>{const t=setup({lost:true});const job=await t.hunter.start(input);assert.equal(job.status,'UNKNOWN');await t.hunter.start(input);await assert.rejects(()=>t.hunter.start({...input,requestId:'22345678-1234-1234-1234-123456789012'}),/already active/);assert.equal(t.starts(),1);});
test('Meta uses capped country-filtered active ad collection',async()=>{const t=setup();const job=await t.hunter.start({...input,platform:'meta'});assert.equal(job.platform,'meta');assert.equal(t.starts(),1);});
test('interrupted start lease expires to UNKNOWN without launching again',async()=>{const t=setup();t.db.hunts.push({id:'interrupted',status:'STARTING',createdAt:'2020-01-01T00:00:00Z'});assert.equal((await t.hunter.poll('interrupted')).status,'UNKNOWN');assert.equal(t.starts(),0);});
