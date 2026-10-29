import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGoogleTrendsExport} from '../../server/apifyEvidence.js';
const now=new Date('2026-10-25T12:00:00Z');
const options={query:'pet hair remover',market:'US',now,observedAt:now.toISOString()};
const row={searchTerm:options.query,interestOverTime_timelineData:[10,20,30,40].map((n,i)=>({time:String((+now-(4-i)*86400000)/1000),hasData:[true],value:[n]}))};
test('Google import preserves actual dates and relative indices, never product sales',()=>{const r=normalizeGoogleTrendsExport([row],options);assert.equal(r.acceptedVideos,1);assert.equal(r.observations.length,2);assert.equal(r.observations[0].value,25);assert.equal(r.observations[0].scope,'niche');assert.equal(r.observations[1].value,133.3);assert.equal(r.observations[0].market,'US');});
test('mismatched queries, stale timelines and missing run provenance excluded',()=>{for(const [r,o] of [[{...row,searchTerm:'wrong'},options],[row,{...options,observedAt:null}],[{...row,interestOverTime_timelineData:[{time:'1',hasData:[true],value:[50]}]},options]])assert.equal(normalizeGoogleTrendsExport([r],o).observations.length,0);});
test('zero is data; partial, missing and out-of-range values excluded',()=>{const r=normalizeGoogleTrendsExport([{...row,interestOverTime_timelineData:[{time:String((+now-86400000)/1000),hasData:[true],value:[0]},{time:String(+now/1000),hasData:[true],value:[99],isPartial:true}]}],options);assert.equal(r.observations.length,1);assert.equal(r.observations[0].value,0);});

import {completeTrendsPoints} from '../../server/freeSignals.js';
test('direct Google collection excludes partial missing invalid and future points, retaining genuine zero',()=>{
  const point={time:String((+now-86400000)/1000),hasData:[true],value:[0]};
  const rows=[{...point,value:[30],isPartial:true},{...point,value:[null]},{...point,hasData:[false]}, {...point,time:String((+now+86400000)/1000)},point];
  assert.deepEqual(completeTrendsPoints(rows,now),[point]);
  assert.deepEqual(completeTrendsPoints(null,now),[]);
});
