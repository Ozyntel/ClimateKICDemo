/**
 * Derived, read-only views of a lead case used by the customer-facing pages.
 * Pure functions — no storage access — so they are easy to test.
 */
import { getElementType, getState } from "@/lib/visuals/registry";
import { BASELINE_LIMITATIONS } from "./blank";
import type { CaseElement, EvidenceType, LeadCase, LeadProgress, NumberFact, Pathway, Scenario, SourceDoc } from "./types";

export const ORG_FALLBACK_LABEL = "Organisation (name not set)";

export function orgName(lead: LeadCase): string {
  return lead.organisation.name.trim() || ORG_FALLBACK_LABEL;
}

export interface NumberView {
  fact: NumberFact;
  /** Value to display ("" = unknown). */
  value: string;
  asOf: string;
  unit: string;
  /** Source ids that updated this value (applied uploads). */
  updatedBy: string[];
  /** Baseline value kept as history when updated. */
  was: string | null;
  /** Different applied sources give different values — shown, not resolved. */
  conflict: Array<{ sourceId: string; value: string; asOf: string }> | null;
  evidence: EvidenceType | "";
}

/** Applied sources, in the order they were applied, that exist in this case (each once). */
export function appliedSourceDocs(lead: LeadCase, progress: LeadProgress): SourceDoc[] {
  return Array.from(new Set(progress.appliedSources)).map((id) => lead.sources.find((s) => s.id === id)).filter((s): s is SourceDoc => !!s);
}

/**
 * Number facts after simulated uploads. Comparable updates replace the value
 * (the baseline stays as history). If two applied sources give different
 * values for the same number, both are shown as a conflict — never silently
 * resolved in favour of either.
 */
export function numbersWithUpdates(lead: LeadCase, progress: LeadProgress): NumberView[] {
  const docs = appliedSourceDocs(lead, progress);
  return lead.numbers.map((fact) => {
    const ups = docs.flatMap((d) => d.updates.filter((u) => u.numberId === fact.id && u.value.trim() !== "").map((u) => ({ sourceId: d.id, value: u.value, asOf: u.asOf })));
    const distinct = Array.from(new Set(ups.map((u) => u.value.trim())));
    if (ups.length === 0) return { fact, value: fact.value, asOf: fact.asOf, unit: fact.unit, updatedBy: [], was: null, conflict: null, evidence: fact.evidence };
    if (distinct.length > 1) return { fact, value: fact.value, asOf: fact.asOf, unit: fact.unit, updatedBy: ups.map((u) => u.sourceId), was: null, conflict: ups, evidence: fact.evidence };
    const last = ups[ups.length - 1];
    const synthetic = docs.some((d) => d.id === last.sourceId && d.synthetic);
    return { fact, value: last.value, asOf: last.asOf || fact.asOf, unit: fact.unit, updatedBy: Array.from(new Set(ups.map((u) => u.sourceId))), was: fact.value || null, conflict: null, evidence: synthetic ? "synthetic" : "observed" };
  });
}

export interface SignalView { text: string; src: string; evidence: EvidenceType | ""; confidence: string }

/** "Key signals": findings marked as signals + signals added by applied uploads. */
export function keySignals(lead: LeadCase, progress: LeadProgress): SignalView[] {
  const base = lead.findings.filter((f) => f.kind === "signal" && f.text.trim()).map((f) => ({ text: f.text, src: f.sourceIds.join(", "), evidence: f.evidence, confidence: f.confidence }));
  const added = appliedSourceDocs(lead, progress).flatMap((d) => d.signals.filter((s) => s.trim()).map((s) => ({ text: s, src: d.id, evidence: (d.synthetic ? "synthetic" : "observed") as EvidenceType, confidence: "unknown" })));
  return [...base, ...added];
}

export function limitationsFor(lead: LeadCase): string[] {
  return [...BASELINE_LIMITATIONS, ...lead.limitations.filter((l) => l.trim())];
}

/** Display name for any id referenced by effects / spots / relationships. */
export function nameOf(lead: LeadCase, id: string): string {
  if (!id) return "";
  if (id === "org") return orgName(lead);
  const t = lead.teams.find((x) => x.id === id); if (t) return t.name || "Unnamed team";
  const e = lead.elements.find((x) => x.id === id); if (e) return e.label || "Unnamed element";
  return id;
}

export function elementStateLabel(e: Pick<CaseElement, "visual" | "state">): string {
  return getState(e.visual, e.state).label;
}

export function elementTypeLabel(visual: string): string {
  return getElementType(visual)?.label ?? "Element";
}

/** Usable pathways (with a title), max three — the compare layout shows three columns. */
export function activePathways(lead: LeadCase): Pathway[] {
  return lead.pathways.filter((p) => p.title.trim()).slice(0, 3);
}

/** Outcome estimate for a pathway, or null when not provided (never invented). */
export function outcomeFor(lead: LeadCase, pathwayId: string): number | null {
  const oe = lead.outcomeEstimate;
  if (!oe || !oe.question.trim()) return null;
  const v = oe.values[pathwayId];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Open risk spots at month 12 — a plain count, not a severity band. */
export function openRisksAt12(p: Pathway): number {
  return p.risks.filter((r) => r.until == null).length;
}

/** True when nothing customer-facing has been entered yet. */
export function isBlankCase(lead: LeadCase): boolean {
  return !lead.organisation.name.trim() && !lead.decision.question.trim() && lead.elements.length === 0 && lead.teams.length === 0 && lead.numbers.length === 0 && lead.pathways.length === 0 && lead.sources.length === 0;
}

/** A short checklist of what is still empty, for helpful empty states. */
export function completeness(lead: LeadCase): Array<{ label: string; done: boolean; section: string }> {
  return [
    { label: "Organisation name and overview", done: !!(lead.organisation.name.trim() && lead.organisation.overview.trim()), section: "organisation" },
    { label: "The decision or challenge", done: !!lead.decision.question.trim(), section: "decision" },
    { label: "Important numbers", done: lead.numbers.some((n) => n.label.trim()) || !!lead.planning?.constraints.length, section: lead.planning?.constraints.length ? "planning" : "numbers" },
    { label: "Places, stakeholders and system elements", done: lead.elements.some((e) => e.label.trim()), section: "elements" },
    { label: "Teams", done: lead.teams.some((t) => t.name.trim()), section: "teams" },
    { label: "Relationships", done: lead.relationships.some((r) => r.from && r.to), section: "relationships" },
    { label: "Evidence and source documents", done: lead.sources.some((s) => s.title.trim()), section: "sources" },
    { label: "Findings and key signals", done: lead.findings.some((f) => f.text.trim()), section: "findings" },
    { label: "Pathway options", done: activePathways(lead).length > 0, section: "pathways" },
    { label: "Prepared what-if scenarios", done: lead.scenarios.some((s) => s.question.trim()), section: "scenarios" },
  ];
}

const STOP = new Set(["the", "and", "for", "with", "what", "if", "our", "we", "is", "are", "be", "more", "less", "new", "one", "get", "gets", "would", "will", "that", "this", "from", "by", "into", "than", "then", "when", "how", "does", "do", "can", "could", "should", "need", "needs"]);

/**
 * Prepared scenarios that match what someone typed into the scenario box,
 * best first. Free text is not analysed: it only picks among the scenarios the
 * team prepared (keywords count most, then words in the question and effects).
 */
export function matchScenarios(lead: LeadCase, text: string): Array<{ scenario: Scenario; score: number }> {
  const words = text.toLowerCase().split(/[^a-z0-9€]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  if (!words.length) return [];
  return lead.scenarios.filter((s) => s.question.trim()).map((s) => {
    const kw = s.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    const hay = [s.question, ...s.assumptions, ...s.effects.map((e) => e.label)].join(" ").toLowerCase();
    let score = 0;
    for (const w of words) { if (kw.some((k) => k.includes(w) || w.includes(k))) score += 3; else if (hay.includes(w)) score += 1; }
    return { scenario: s, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}
