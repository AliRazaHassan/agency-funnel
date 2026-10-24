import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTikTokExport, readApifyDataset } from '../../server/apifyEvidence.js';
const now = new Date('2026-10-24T12:00:00Z');
const video = {id:'123456789', text:'Reusable hair remover', locationCreated:'US', createTimeISO:'2026-10-23T12:00:00Z', webVideoUrl:'https://www.tiktok.com/@brand/video/123456789',playCount:1000,diggCount:0};
test('recent exact video preserves zero and remains niche discovery, never sales',()=>{
 const r=normalizeTikTokExport([video],{now});
 assert.equal(r.acceptedVideos,1); assert.equal(r.observations.length,2);
 assert.equal(r.observations[1].value,0); assert.ok(r.observations.every(o=>o.scope==='niche' && o.metric!=='sales'));
});
test('stale, future, wrong-market, invalid-date and spoofed URLs excluded independently',()=>{
 const bad=[{...video,createTimeISO:'2022-06-01'}, {...video,createTimeISO:'2027-01-01'}, {...video,locationCreated:'GB'}, {...video,locationCreated:undefined}, {...video,createTimeISO:null,createTime:'bad'}, {...video,webVideoUrl:'https://tiktok.com.evil.test/@a/video/123456789'},null];
 const r=normalizeTikTokExport([...bad,video],{now}); assert.equal(r.acceptedVideos,1); assert.equal(Object.values(r.rejected).reduce((a,b)=>a+b,0),7);
});
test('dataset sync validates ID before any request and never starts an Actor',async()=>{
 const old=process.env.APIFY_TOKEN; process.env.APIFY_TOKEN='test-secret';
 try { let calls=0; await assert.rejects(()=>readApifyDataset('../bad',{},()=>{calls++}),/dataset ID/); assert.equal(calls,0);
 const r=await readApifyDataset('abcDEF123456',{now},async(url,opts)=>{calls++;assert.ok(url.includes('/datasets/'));assert.ok(!url.includes('test-secret'));assert.equal(opts.headers.Authorization,'Bearer test-secret');return {ok:true,json:async()=>[video]};});
 assert.equal(calls,1);assert.equal(r.acceptedVideos,1);
 } finally {if(old===undefined)delete process.env.APIFY_TOKEN;else process.env.APIFY_TOKEN=old;}
});

test('Meta active observation uses run completion date and does not count repeated creatives as independent proof', async()=>{
 const {normalizeMetaExport}=await import('../../server/apifyEvidence.js');
 const r=normalizeMetaExport([{adArchiveID:'123',isActive:true,inputUrl:'https://www.facebook.com/ads/library/?country=US',snapshot:{body:{text:'Reusable remover'}},collationId:'same'}],{now,observedAt:'2026-10-24T11:00:00Z'});
 assert.equal(r.observations.length,1);assert.equal(r.observations[0].scope,'niche');assert.equal(r.observations[0].correlationKey,'meta:same');
 assert.equal(normalizeMetaExport([{adArchiveID:'123',isActive:true,inputUrl:'https://www.facebook.com/ads/library/?country=ALL'}],{now,observedAt:now.toISOString()}).observations.length,0);
});
