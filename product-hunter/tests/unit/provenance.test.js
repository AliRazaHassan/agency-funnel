import test from "node:test";
import assert from "node:assert/strict";
import { amazonEvidenceStatus, amazonSignalScore, dedupeProductCandidates } from "../../server/productHunt.js";

test("manual Amazon evidence stays MANUAL and is quantitatively scored", () => {
  const p={keepa:{
    source:"manual-amazon-paste",
    capturedAt:new Date().toISOString(),
    monthlySold:500,
    salesRank:12000,
    reviewCount:800
  }};
  assert.equal(amazonEvidenceStatus(p),"MANUAL");
  const score=amazonSignalScore(p);
  assert.ok(score>=0&&score<=100);
  assert.ok(score>50);
});

test("recent Keepa evidence is RECENT and missing evidence is UNAVAILABLE", () => {
  const recent={keepa:{
    source:"keepa-api-one-time",
    capturedAt:new Date().toISOString(),
    monthlySold:100,
    salesRank:4000
  }};
  assert.equal(amazonEvidenceStatus(recent),"RECENT");
  assert.ok(amazonSignalScore(recent)>0);
  assert.equal(amazonEvidenceStatus({}),"UNAVAILABLE");
  assert.equal(amazonSignalScore({}),0);
});

test("stale Keepa snapshot cannot be labeled recent", () => {
  const old=new Date(Date.now()-45*86400000).toISOString();
  assert.equal(amazonEvidenceStatus({keepa:{source:"keepa-api-one-time",capturedAt:old}}),"ESTIMATED");
});


test("product candidate dedupe removes blanks and case-insensitive duplicates", () => {
  const out=dedupeProductCandidates([
    {title:" Alpha "},
    {title:"alpha"},
    {title:"Beta"},
    {title:""},
    {},
    {title:"BETA"}
  ]);
  assert.deepEqual(out.map(x=>x.title),["Alpha","Beta"]);
});
