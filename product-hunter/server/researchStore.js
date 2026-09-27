import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname=dirname(fileURLToPath(import.meta.url));
const FILE=join(__dirname,"data","research-store.json");
let pgPool=null;
let pgReady=false;

function ensureFile(){
  const dir=dirname(FILE);
  if(!existsSync(dir)) mkdirSync(dir,{recursive:true});
  if(!existsSync(FILE)) writeFileSync(FILE,JSON.stringify({products:{},snapshots:[],tests:[]},null,2),"utf8");
}
function readFileStore(){ensureFile();return JSON.parse(readFileSync(FILE,"utf8"));}
function writeFileStore(data){ensureFile();writeFileSync(FILE,JSON.stringify(data,null,2),"utf8");}

export async function initResearchStore(){
  if(!process.env.DATABASE_URL) return {mode:"file"};
  try{
    const {Pool}=await import("pg");
    pgPool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==="disable"?false:{rejectUnauthorized:false}});
    await pgPool.query(`
      create table if not exists tracked_products(
        id text primary key,
        title text not null,
        product jsonb not null,
        validation_status text default 'NEEDS_DATA',
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      create table if not exists product_snapshots(
        id bigserial primary key,
        product_id text not null,
        captured_at timestamptz default now(),
        trend_score numeric,
        winner_score numeric,
        margin_pct numeric,
        confidence text,
        lifecycle text,
        payload jsonb not null
      );
      create index if not exists idx_snapshots_product_time on product_snapshots(product_id,captured_at desc);
      create table if not exists ad_tests(
        id bigserial primary key,
        product_id text not null,
        created_at timestamptz default now(),
        metrics jsonb not null,
        derived jsonb not null
      );
    `);
    pgReady=true;
    return {mode:"postgres"};
  }catch(err){
    console.warn("Research store Postgres unavailable, using file fallback:",err.message);
    pgPool=null;pgReady=false;
    return {mode:"file"};
  }
}
export function researchStoreMode(){return pgReady?"postgres":"file";}

function normalizeProduct(p={}){
  return {
    id:String(p.id||p.title||Date.now()),
    title:String(p.title||"Untitled product"),
    product:p,
    validationStatus:p.validationStatus||"NEEDS_DATA",
  };
}

export async function trackProducts(products=[],context={}){
  const now=new Date().toISOString();
  if(pgReady){
    for(const raw of products){
      const p=normalizeProduct(raw);
      await pgPool.query(
        `insert into tracked_products(id,title,product,validation_status,updated_at)
         values($1,$2,$3,$4,now())
         on conflict(id) do update set title=excluded.title,product=excluded.product,updated_at=now()`,
        [p.id,p.title,JSON.stringify({...p.product,trackingContext:context}),p.validationStatus]
      );
      await pgPool.query(
        `insert into product_snapshots(product_id,trend_score,winner_score,margin_pct,confidence,lifecycle,payload)
         values($1,$2,$3,$4,$5,$6,$7)`,
        [p.id,Number(raw.trendScore)||0,Number(raw.winnerDecision?.score)||0,Number(raw.marginPct)||0,raw.dataConfidence||"LOW",raw.trendStatus||"DISCOVERED",JSON.stringify(raw)]
      );
    }
    return {ok:true,count:products.length,mode:"postgres",capturedAt:now};
  }
  const db=readFileStore();
  for(const raw of products){
    const p=normalizeProduct(raw);
    const existing=db.products[p.id]||{};
    db.products[p.id]={...existing,...p,product:{...p.product,trackingContext:context},updatedAt:now,createdAt:existing.createdAt||now};
    db.snapshots.push({
      productId:p.id,capturedAt:now,trendScore:Number(raw.trendScore)||0,winnerScore:Number(raw.winnerDecision?.score)||0,
      marginPct:Number(raw.marginPct)||0,confidence:raw.dataConfidence||"LOW",lifecycle:raw.trendStatus||"DISCOVERED",payload:raw
    });
  }
  if(db.snapshots.length>5000) db.snapshots=db.snapshots.slice(-5000);
  writeFileStore(db);
  return {ok:true,count:products.length,mode:"file",capturedAt:now};
}

export async function listTrackedProducts(){
  if(pgReady){
    const {rows}=await pgPool.query(`select id,title,product,validation_status as "validationStatus",created_at as "createdAt",updated_at as "updatedAt" from tracked_products order by updated_at desc limit 500`);
    return rows;
  }
  const db=readFileStore();
  return Object.values(db.products).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
}

export async function getHistory(productId,days=30){
  const since=new Date(Date.now()-Math.max(1,Number(days)||30)*86400000).toISOString();
  if(pgReady){
    const {rows}=await pgPool.query(
      `select captured_at as "capturedAt",trend_score as "trendScore",winner_score as "winnerScore",margin_pct as "marginPct",confidence,lifecycle
       from product_snapshots where product_id=$1 and captured_at >= $2 order by captured_at asc`,
      [String(productId),since]
    );
    return rows;
  }
  const db=readFileStore();
  return db.snapshots.filter(x=>String(x.productId)===String(productId)&&x.capturedAt>=since).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));
}

export async function updateValidationStatus(productId,status){
  const allowed=["NEEDS_DATA","READY_TO_TEST","TESTING","VALIDATED"];
  if(!allowed.includes(status)) throw new Error("Invalid validation status");
  if(pgReady){
    await pgPool.query(`update tracked_products set validation_status=$2,updated_at=now() where id=$1`,[String(productId),status]);
    return {ok:true,status};
  }
  const db=readFileStore();
  if(!db.products[productId]) db.products[productId]={id:productId,title:productId,product:{}};
  db.products[productId].validationStatus=status;
  db.products[productId].updatedAt=new Date().toISOString();
  writeFileStore(db);
  return {ok:true,status};
}

function deriveTest(metrics={}){
  const spend=Number(metrics.spendUsd)||0, impressions=Number(metrics.impressions)||0, clicks=Number(metrics.clicks)||0;
  const atc=Number(metrics.addToCarts)||0, purchases=Number(metrics.purchases)||0, revenue=Number(metrics.revenueUsd)||0;
  const ctr=impressions?clicks/impressions*100:0, cpc=clicks?spend/clicks:0, atcRate=clicks?atc/clicks*100:0;
  const cvr=clicks?purchases/clicks*100:0, cpa=purchases?spend/purchases:0, roas=spend?revenue/spend:0;
  const proofScore=Math.round(Math.max(0,Math.min(100,(Math.min(ctr,3)/3)*20+(Math.min(atcRate,10)/10)*20+(Math.min(cvr,4)/4)*25+(Math.min(roas,3)/3)*35)));
  const status=purchases>=3&&roas>=1.5?"VALIDATED":spend>0?"TESTING":"READY_TO_TEST";
  const recommendation=purchases===0&&spend>=50?"Pause and review creative, offer and landing-page friction before more spend.":status==="VALIDATED"?"Evidence is promising; increase spend gradually while watching CPA and contribution margin.":"Keep the test controlled until purchases are repeatable.";
  return {ctr,cpc,atcRate,cvr,cpa,roas,proofScore,status,recommendation};
}
export async function addAdTest(productId,metrics={}){
  const derived=deriveTest(metrics);
  if(pgReady){
    const {rows}=await pgPool.query(`insert into ad_tests(product_id,metrics,derived) values($1,$2,$3) returning id,created_at as "createdAt"`,[String(productId),JSON.stringify(metrics),JSON.stringify(derived)]);
    await updateValidationStatus(productId,derived.status);
    return {...rows[0],metrics,derived};
  }
  const db=readFileStore();
  const row={id:"test_"+Date.now().toString(36),productId:String(productId),createdAt:new Date().toISOString(),metrics,derived};
  db.tests.push(row);
  if(db.products[productId]) db.products[productId].validationStatus=derived.status;
  writeFileStore(db);
  return row;
}
export async function getAdTests(productId){
  if(pgReady){
    const {rows}=await pgPool.query(`select id,created_at as "createdAt",metrics,derived from ad_tests where product_id=$1 order by created_at desc limit 100`,[String(productId)]);
    return rows;
  }
  return readFileStore().tests.filter(x=>String(x.productId)===String(productId)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
