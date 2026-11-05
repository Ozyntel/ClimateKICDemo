/**
 * Lead-case storage — browser localStorage, one key per case.
 *
 *   ozy-lead:v1:index            [{ id, internalLabel, name, updatedAt }]
 *   ozy-lead:v1:case:<id>        LeadCase JSON (content)
 *   ozy-lead:v1:progress:<id>    LeadProgress JSON (uploads applied, pathway pick)
 *   ozy-lead:v1:active           id of the case the customer-facing demo shows
 *
 * Isolation: content and progress are keyed by case id, and every page reads
 * only the active case. Nothing is shared between cases, and the demo never
 * falls back to another case's data.
 *
 * Durability: this is per-browser storage only — it is not a server, not
 * synced, not backed up, and is cleared with site data. Export a case to a
 * JSON file to keep it or move it to the presenting machine.
 */
import { createBlankLeadCase, normaliseLeadCase, newId } from "./blank";
import type { LeadCase, LeadProgress } from "./types";

const P = "ozy-lead:v1:";
const K_INDEX = P + "index";
const K_ACTIVE = P + "active";
const kCase = (id: string) => P + "case:" + id;
const kProgress = (id: string) => P + "progress:" + id;

export const LEAD_STORAGE_PREFIX = P;
export const LEAD_CHANGED_EVENT = "ozy-lead-changed";

export interface LeadSummary { id: string; internalLabel: string; name: string; updatedAt: string }

function ls(): Storage | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}
function read<T>(key: string): T | null {
  const s = ls(); if (!s) return null;
  try { const raw = s.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function write(key: string, v: unknown) {
  const s = ls(); if (!s) return;
  s.setItem(key, JSON.stringify(v));
}
function emit() {
  try { if (typeof window !== "undefined") window.dispatchEvent(new Event(LEAD_CHANGED_EVENT)); } catch { /* ignore */ }
}

export function listCases(): LeadSummary[] {
  const idx = read<LeadSummary[]>(K_INDEX);
  return Array.isArray(idx) ? idx.filter((x) => x && typeof x.id === "string") : [];
}

function writeIndex(list: LeadSummary[]) { write(K_INDEX, list); }

function summary(c: LeadCase): LeadSummary {
  return { id: c.id, internalLabel: c.internalLabel, name: c.organisation.name, updatedAt: c.updatedAt };
}

export function getCase(id: string | null | undefined): LeadCase | null {
  if (!id) return null;
  const raw = read<unknown>(kCase(id));
  return raw ? normaliseLeadCase(raw) : null;
}

export function getActiveCaseId(): string | null {
  const id = ls()?.getItem(K_ACTIVE) ?? null;
  return id && listCases().some((c) => c.id === id) ? id : null;
}

export function setActiveCaseId(id: string | null) {
  const s = ls(); if (!s) return;
  if (id) s.setItem(K_ACTIVE, id); else s.removeItem(K_ACTIVE);
  emit();
}

/** The case the customer-facing demo shows, or null when none is prepared. */
export function getActiveCase(): LeadCase | null {
  return getCase(getActiveCaseId());
}

export function saveCase(c: LeadCase, opts: { touch?: boolean } = {}): LeadCase {
  const next = opts.touch === false ? c : { ...c, updatedAt: new Date().toISOString() };
  write(kCase(next.id), next);
  const list = listCases();
  const i = list.findIndex((x) => x.id === next.id);
  if (i >= 0) list[i] = summary(next); else list.push(summary(next));
  writeIndex(list);
  emit();
  return next;
}

/** Create and store a new blank case. It becomes active if no case is active yet. */
export function createCase(internalLabel = ""): LeadCase {
  const c = saveCase(createBlankLeadCase(internalLabel), { touch: false });
  if (!getActiveCaseId()) setActiveCaseId(c.id);
  return c;
}

/** Permanently remove a case's content and progress from this browser. */
export function deleteCase(id: string) {
  const s = ls(); if (!s) return;
  s.removeItem(kCase(id));
  s.removeItem(kProgress(id));
  writeIndex(listCases().filter((x) => x.id !== id));
  if (s.getItem(K_ACTIVE) === id) s.removeItem(K_ACTIVE);
  emit();
}

// ─── progress (per case) ───────────────────────────────────────────────

const blankProgress = (): LeadProgress => ({ appliedSources: [], pathwayPick: null, timelineMonth: 12, stressTests: [] });

export function getProgress(id: string | null | undefined): LeadProgress {
  if (!id) return blankProgress();
  const p = read<Partial<LeadProgress>>(kProgress(id));
  return {
    appliedSources: Array.isArray(p?.appliedSources) ? p!.appliedSources.filter((x) => typeof x === "string") : [],
    pathwayPick: typeof p?.pathwayPick === "string" ? p!.pathwayPick : null,
    timelineMonth: typeof p?.timelineMonth === "number" && p.timelineMonth >= 0 && p.timelineMonth <= 12 ? p.timelineMonth : 12,
    stressTests: Array.isArray(p?.stressTests) ? Array.from(new Set(p!.stressTests.filter((x) => typeof x === "string"))) : [],
  };
}

export function saveProgress(id: string, p: LeadProgress) { write(kProgress(id), p); emit(); }

export function updateProgress(id: string, fn: (p: LeadProgress) => LeadProgress): LeadProgress {
  const next = fn(getProgress(id));
  saveProgress(id, next);
  return next;
}

/** Reset demo progress (simulated uploads, pathway pick, stress tests) without touching content. */
export function resetProgress(id: string) {
  ls()?.removeItem(kProgress(id));
  emit();
}

/** Simulated upload: mark a prepared source as applied. Idempotent — returns false if already applied. */
export function applySource(caseId: string, sourceId: string): boolean {
  const p = getProgress(caseId);
  if (p.appliedSources.includes(sourceId)) return false;
  saveProgress(caseId, { ...p, appliedSources: [...p.appliedSources, sourceId] });
  return true;
}

// ─── import / export ───────────────────────────────────────────────────

/** JSON file content for a case (content only; progress is never exported). */
export function exportCaseJson(c: LeadCase): string {
  return JSON.stringify(c, null, 2);
}

export function exportFileName(c: LeadCase): string {
  const base = (c.internalLabel || c.organisation.name || "lead-case").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lead-case";
  return `${base}.ozy-lead.json`;
}

/**
 * Import a case from JSON. The imported case always gets a NEW id unless
 * `keepId` is set and no case with that id exists — so importing can never
 * overwrite or merge into another lead's case.
 */
export function importCaseJson(json: string, opts: { keepId?: boolean } = {}): LeadCase {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error("That file is not valid JSON."); }
  if (!raw || typeof raw !== "object" || (raw as { schema?: unknown }).schema !== "ozy-lead-case") {
    throw new Error("That file is not an Ozy lead case (missing \"schema\": \"ozy-lead-case\").");
  }
  const c = normaliseLeadCase(raw);
  const exists = listCases().some((x) => x.id === c.id);
  const id = opts.keepId && !exists ? c.id : newId("lead");
  return saveCase({ ...c, id }, { touch: true });
}
