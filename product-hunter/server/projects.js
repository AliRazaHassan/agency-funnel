/**
 * Saved research projects (file store under data/projects/).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "data", "projects");

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

function id() {
  return `proj_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

export function listProjects() {
  ensureDir();
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  const items = files
    .map((f) => {
      try {
        const p = JSON.parse(readFileSync(join(DIR, f), "utf8"));
        return {
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          regionFocus: p.regionFocus,
          niche: p.selectedOpp?.niche || p.hunt?.niche || null,
          opportunityCount: p.scout?.count || p.scout?.opportunities?.length || 0,
          productCount: p.hunt?.count || p.hunt?.products?.length || 0,
          winningPass: p.hunt?.winningSummary?.pass ?? null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  items.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return items;
}

export function getProject(projectId) {
  ensureDir();
  const path = join(DIR, `${projectId}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveProject(payload = {}) {
  ensureDir();
  const now = new Date().toISOString();
  const existingId = payload.id && String(payload.id).startsWith("proj_") ? payload.id : null;
  const project = {
    id: existingId || id(),
    name:
      payload.name ||
      payload.selectedOpp?.niche ||
      payload.hunt?.niche ||
      `Research ${new Date().toLocaleDateString()}`,
    createdAt: payload.createdAt || now,
    updatedAt: now,
    regionFocus: payload.regionFocus || "Global",
    budget: payload.budget ?? null,
    nicheHint: payload.nicheHint || "",
    scout: payload.scout || null,
    selectedOpp: payload.selectedOpp || null,
    hunt: payload.hunt || null,
    selectedProductIds: [...(payload.selectedProductIds || [])],
  };
  writeFileSync(join(DIR, `${project.id}.json`), JSON.stringify(project, null, 2), "utf8");
  return project;
}

export function deleteProject(projectId) {
  ensureDir();
  const path = join(DIR, `${projectId}.json`);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}
