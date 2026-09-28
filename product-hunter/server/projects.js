/**
 * Saved research projects.
 * Uses Postgres when DATABASE_URL is configured, otherwise local file fallback.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "data", "projects");
let pool = null;
let ready = false;
let attempted = false;

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}
function id() {
  return `proj_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}
async function db() {
  if (attempted) return ready ? pool : null;
  attempted = true;
  if (!process.env.DATABASE_URL) return null;
  try {
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    });
    await pool.query(`
      create table if not exists research_projects(
        id text primary key,
        name text not null,
        payload jsonb not null,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      create index if not exists idx_research_projects_updated on research_projects(updated_at desc);
    `);
    ready = true;
    return pool;
  } catch (err) {
    console.warn("Projects Postgres unavailable, using file fallback:", err.message);
    pool = null;
    ready = false;
    return null;
  }
}
export async function projectStoreMode() {
  return (await db()) ? "postgres" : "file";
}

function summary(p={}) {
  return {
    id:p.id,
    name:p.name,
    createdAt:p.createdAt,
    updatedAt:p.updatedAt,
    regionFocus:p.regionFocus,
    niche:p.selectedOpp?.niche || p.hunt?.niche || null,
    opportunityCount:p.scout?.count || p.scout?.opportunities?.length || 0,
    productCount:p.hunt?.count || p.hunt?.products?.length || 0,
    ruleGatePass:p.hunt?.winningSummary?.pass ?? null,
    topPicks:p.hunt?.winnerSummary?.topPicks ?? null,
  };
}

function buildProject(payload={}) {
  const now=new Date().toISOString();
  const existingId=payload.id && String(payload.id).startsWith("proj_") ? payload.id : null;
  return {
    id:existingId || id(),
    name:payload.name || payload.selectedOpp?.niche || payload.hunt?.niche || `Research ${new Date().toLocaleDateString()}`,
    createdAt:payload.createdAt || now,
    updatedAt:now,
    regionFocus:payload.regionFocus || "Global",
    budget:payload.budget ?? null,
    nicheHint:payload.nicheHint || "",
    scout:payload.scout || null,
    selectedOpp:payload.selectedOpp || null,
    hunt:payload.hunt || null,
    selectedProductIds:[...(payload.selectedProductIds || [])],
  };
}

export async function listProjects() {
  const p=await db();
  if(p){
    const {rows}=await p.query(`select payload from research_projects order by updated_at desc limit 250`);
    return rows.map(r=>summary(r.payload));
  }
  ensureDir();
  const files=readdirSync(DIR).filter(f=>f.endsWith(".json"));
  return files.map(f=>{
    try{return summary(JSON.parse(readFileSync(join(DIR,f),"utf8")));}
    catch{return null;}
  }).filter(Boolean).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
}

export async function getProject(projectId) {
  const p=await db();
  if(p){
    const {rows}=await p.query(`select payload from research_projects where id=$1 limit 1`,[String(projectId)]);
    return rows[0]?.payload || null;
  }
  ensureDir();
  const path=join(DIR,`${projectId}.json`);
  if(!existsSync(path)) return null;
  return JSON.parse(readFileSync(path,"utf8"));
}

export async function saveProject(payload={}) {
  const project=buildProject(payload);
  const p=await db();
  if(p){
    const existing=payload.id ? await getProject(payload.id) : null;
    if(existing?.createdAt) project.createdAt=existing.createdAt;
    await p.query(
      `insert into research_projects(id,name,payload,created_at,updated_at)
       values($1,$2,$3,$4,$5)
       on conflict(id) do update set name=excluded.name,payload=excluded.payload,updated_at=excluded.updated_at`,
      [project.id,project.name,JSON.stringify(project),project.createdAt,project.updatedAt]
    );
    return project;
  }
  ensureDir();
  if(payload.id){
    const old=join(DIR,`${payload.id}.json`);
    if(existsSync(old)){
      try{project.createdAt=JSON.parse(readFileSync(old,"utf8")).createdAt || project.createdAt;}catch{}
    }
  }
  writeFileSync(join(DIR,`${project.id}.json`),JSON.stringify(project,null,2),"utf8");
  return project;
}

export async function deleteProject(projectId) {
  const p=await db();
  if(p){
    const result=await p.query(`delete from research_projects where id=$1`,[String(projectId)]);
    return result.rowCount>0;
  }
  ensureDir();
  const path=join(DIR,`${projectId}.json`);
  if(!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}
