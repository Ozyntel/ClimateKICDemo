/**
 * Map state — one composed, inspectable picture of the case for a chosen stage.
 *
 *   baseline  the case as prepared (no uploads, no pathway, no scenario)
 *   evidence  baseline + only the source documents actually added
 *   pathway   evidence + the shown pathway's proposed additions and effects
 *   future    evidence (+ the shown pathway, if any) + the active scenario
 *
 * A scenario ("quick change") does not need a pathway: on its own it is
 * applied to the current plan (the baseline components), with a pathway
 * shown it is applied on top of that pathway.
 *
 * The isometric map, the systems view, the list view and every detail card
 * read this one structure, so they cannot disagree. Pure function: switching
 * stage or pathway rebuilds the state from the case, so nothing from a
 * previous pathway or scenario is left behind.
 *
 * Every change carries a mark saying who caused it (source id + heading/row,
 * pathway, or scenario assumption). Marks never resolve a condition: an
 * upload can add a "pending" or "missing evidence" overlay, but nothing here
 * turns a proposed or unknown item into an approved or known one.
 */
import { activePathways, appliedSourceDocs, nameOf } from "./derive";
import { baselineComponentRefs, baselineLedger, componentCount, computeLedger, formatAmount, hasPlanning, pathwayLedger, totalSentence, type Ledger } from "./planning";
import type { CaseElement, Effect, ElementFact, LeadCase, LeadProgress, Pathway, Relationship, Scenario, SourceDoc } from "./types";

export type MapStage = "baseline" | "evidence" | "pathway" | "future";

export const STAGE_ORDER: MapStage[] = ["baseline", "evidence", "pathway", "future"];
export const STAGE_LABEL: Record<MapStage, string> = { baseline: "Baseline", evidence: "Evidence", pathway: "Pathway", future: "Scenario" };

export type MarkTone = "neutral" | "risk" | "benefit" | "mixed" | "proposed" | "scenario";

export interface MapMark {
  kind: "source" | "pathway" | "scenario" | "ledger";
  /** Who caused it: a source id, a pathway title or a scenario question. */
  by: string;
  /** Short label for the map. */
  label: string;
  /** Longer explanation for the detail card. */
  text: string;
  /** Heading or row in the source (sources only). */
  ref: string;
  tone: MarkTone;
}

export interface MapNode {
  id: string;
  kind: "org" | "element" | "team";
  label: string;
  /** The element as it reads at this stage (overlays merged). null for the organisation and teams. */
  el: CaseElement | null;
  origin: "baseline" | "source" | "pathway" | "scenario";
  overlays: string[];
  facts: ElementFact[];
  sourceIds: string[];
  marks: MapMark[];
  /** Allocation line for a ledger element, e.g. "€240,000 of €300,000 · €60,000 headroom". */
  display: string;
}

export interface MapEdge {
  rel: Relationship;
  origin: MapNode["origin"];
  marks: MapMark[];
  /** Affected by the current pathway / scenario (ripple + persistent emphasis). */
  highlight: boolean;
}

export interface StageInfo { id: MapStage; label: string; available: boolean; why: string }

export interface MapState {
  stage: MapStage;
  stages: StageInfo[];
  nodes: MapNode[];
  edges: MapEdge[];
  pathway: Pathway | null;
  /** Scenarios applied at this stage (future only). */
  scenarios: Scenario[];
  /** Active scenarios that do not apply to the plan shown, with the reason. */
  notApplied: Array<{ scenarioId: string; scenarioTitle: string; reason: string }>;
  sources: SourceDoc[];
  /** Ledger for this stage (baseline ledger, or the pathway's or the current plan's ledger incl. scenario adjustments). */
  ledger: Ledger | null;
  baseline: Ledger | null;
  /** Ids of nodes changed by the shown pathway or scenario. */
  changed: string[];
}

export interface MapStateOptions {
  stage: MapStage;
  /** Pathway shown on the map (previewed or selected). */
  pathwayId: string | null;
  /** Scenarios to apply at the future stage — with or without a pathway. */
  scenarioIds: string[];
}

const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));
const effectTone = (e: Effect): MarkTone => e.tone;

function stageInfo(lead: LeadCase, progress: LeadProgress, o: MapStateOptions, pathway: Pathway | null, scenarios: Scenario[]): StageInfo[] {
  const docs = appliedSourceDocs(lead, progress);
  return [
    { id: "baseline", label: STAGE_LABEL.baseline, available: true, why: "The case as prepared, before documents, pathways or scenarios." },
    { id: "evidence", label: STAGE_LABEL.evidence, available: docs.length > 0, why: docs.length ? `Baseline plus ${docs.map((d) => d.id).join(", ")}.` : "No documents added yet — add one on Data management." },
    { id: "pathway", label: pathway ? `Pathway · ${pathway.title}` : STAGE_LABEL.pathway, available: !!pathway, why: pathway ? "The pathway's proposed changes, under consideration." : "Preview or select a pathway first." },
    {
      id: "future", label: STAGE_LABEL.future, available: scenarios.length > 0,
      why: scenarios.length === 0 ? (lead.scenarios.length ? "Run one of the prepared scenarios first." : "No scenarios were prepared for this case.") : pathway ? "The shown pathway plus the scenario assumption." : "The current plan plus the scenario assumption.",
    },
  ];
}

export function buildMapState(lead: LeadCase, progress: LeadProgress, o: MapStateOptions): MapState {
  const pathways = activePathways(lead);
  const pathway = pathways.find((p) => p.id === o.pathwayId) ?? null;
  const wanted = uniq(o.scenarioIds).map((id) => lead.scenarios.find((s) => s.id === id)).filter((s): s is Scenario => !!s);
  const stages = stageInfo(lead, progress, o, pathway, wanted);
  // Fall back to the highest available stage at or below the one asked for.
  let si = STAGE_ORDER.indexOf(o.stage);
  while (si > 0 && !stages[si].available) si--;
  const stage = STAGE_ORDER[si];
  const atLeast = (s: MapStage) => STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(s);

  const nodes = new Map<string, MapNode>();
  const edges = new Map<string, MapEdge>();
  const changed = new Set<string>();

  const addElement = (e: CaseElement, origin: MapNode["origin"]) => {
    if (!e.label.trim() || nodes.has(e.id)) return;
    nodes.set(e.id, { id: e.id, kind: "element", label: e.label, el: { ...e }, origin, overlays: [...e.overlays], facts: [...e.facts], sourceIds: [...e.sourceIds], marks: [], display: "" });
  };
  const addRel = (r: Relationship, origin: MapEdge["origin"]) => {
    if (!r.from || !r.to || r.from === r.to || edges.has(r.id)) return;
    edges.set(r.id, { rel: r, origin, marks: [], highlight: origin === "pathway" || origin === "scenario" });
  };
  const mark = (target: string, m: MapMark, overlays: Array<string | undefined> = []) => {
    const n = nodes.get(target);
    if (n) {
      n.marks.push(m);
      overlays.forEach((ov) => { if (ov && !n.overlays.includes(ov)) n.overlays.push(ov); });
      if (m.kind === "source" && !n.sourceIds.includes(m.by)) n.sourceIds.push(m.by);
      if (m.kind === "pathway" || m.kind === "scenario") changed.add(target);
      return;
    }
    const e = edges.get(target);
    if (e) { e.marks.push(m); if (m.kind === "pathway" || m.kind === "scenario") e.highlight = true; }
  };

  nodes.set("org", { id: "org", kind: "org", label: nameOf(lead, "org"), el: null, origin: "baseline", overlays: [], facts: [], sourceIds: [], marks: [], display: "" });
  lead.elements.forEach((e) => addElement(e, "baseline"));
  lead.teams.filter((t) => t.name.trim()).forEach((t) => nodes.set(t.id, { id: t.id, kind: "team", label: t.name, el: null, origin: "baseline", overlays: [...t.overlays], facts: [], sourceIds: uniq(t.views.flatMap((v) => v.sourceIds)), marks: [], display: "" }));
  lead.relationships.forEach((r) => addRel(r, "baseline"));

  // ── evidence: only documents actually added, in the order they were added
  const sources = atLeast("evidence") ? appliedSourceDocs(lead, progress) : [];
  for (const d of sources) {
    d.adds.elements.forEach((e) => { addElement(e, "source"); mark(e.id, { kind: "source", by: d.id, label: `Added by ${d.id}`, text: `Described in ${d.id} · ${d.title}.`, ref: "", tone: "neutral" }); });
    d.adds.relationships.forEach((r) => { addRel(r, "source"); mark(r.id, { kind: "source", by: d.id, label: `Added by ${d.id}`, text: `Described in ${d.id} · ${d.title}.`, ref: "", tone: "proposed" }); });
    for (const c of d.mapChanges) {
      const risk = c.overlays.includes("possible-risk") || c.overlays.includes("active-problem");
      mark(c.target, { kind: "source", by: d.id, label: c.label, text: c.text, ref: c.ref, tone: risk ? "risk" : "neutral" }, c.overlays);
    }
  }

  // ── pathway: proposed additions, effects and plan steps
  const shown = atLeast("pathway") ? pathway : null;
  if (shown) {
    const by = shown.title;
    shown.adds.elements.forEach((e) => { addElement(e, "pathway"); mark(e.id, { kind: "pathway", by, label: "Proposed", text: `Proposed in “${by}” — under consideration, not approved, staffed or delivering.`, ref: "", tone: "proposed" }); });
    shown.adds.relationships.forEach((r) => { addRel(r, "pathway"); mark(r.id, { kind: "pathway", by, label: "Proposed", text: `Proposed connection in “${by}”. A dependency to confirm, not a measured effect.`, ref: "", tone: "proposed" }); });
    shown.effects.forEach((e) => { if (e.target && e.label.trim()) mark(e.target, { kind: "pathway", by, label: e.label, text: `${e.label} — shown for “${by}” (illustrative, not a prediction).`, ref: "", tone: effectTone(e) }, [e.overlay]); });
    shown.plan.forEach((s) => s.showsOn.forEach((t) => mark(t, { kind: "pathway", by, label: `Proposed: ${s.title}`, text: s.what, ref: "", tone: "proposed" })));
  }

  // ── future: scenario assumptions on top of the shown pathway, or of the current plan when none is shown
  const applied: Scenario[] = [];
  const notApplied: MapState["notApplied"] = [];
  const planOn = hasPlanning(lead);
  const refs = shown && shown.components.length ? shown.components : planOn ? baselineComponentRefs(lead.planning!) : [];
  const scenOn = atLeast("future") ? wanted : [];
  if (atLeast("future")) {
    for (const s of wanted) {
      if (s.requiresComponent && planOn && componentCount(refs, s.requiresComponent) === 0) continue; // reported via the ledger below
      applied.push(s);
      const by = s.question;
      s.adds.elements.forEach((e) => { addElement(e, "scenario"); mark(e.id, { kind: "scenario", by, label: "Assumed (scenario)", text: `Introduced by the scenario “${by}”. An assumption, not an estimate.`, ref: "", tone: "scenario" }); });
      s.adds.relationships.forEach((r) => { addRel(r, "scenario"); mark(r.id, { kind: "scenario", by, label: "Assumed (scenario)", text: `Connection assumed by “${by}”.`, ref: "", tone: "scenario" }); });
      s.effects.forEach((e) => { if (e.target && e.label.trim()) mark(e.target, { kind: "scenario", by, label: e.label, text: `${e.label} — scenario assumption “${by}” (illustrative).`, ref: "", tone: e.tone === "neutral" ? "scenario" : effectTone(e) }, [e.overlay]); });
      s.highlight.forEach((id) => { const e = edges.get(id); if (e) e.highlight = true; });
    }
  }

  // ── ledger: allocation and headroom on the elements that carry a constraint
  const base = baselineLedger(lead);
  const ledger = !planOn ? base : shown && shown.components.length ? pathwayLedger(lead, shown, scenOn) ?? base : scenOn.length ? computeLedger(lead.planning!, refs, scenOn) : base;
  const by = shown?.title ?? applied[0]?.question ?? "";
  const withWhat = [shown ? `“${shown.title}”` : "the current plan", applied.length ? `the scenario “${applied[0].question}”` : ""].filter(Boolean).join(" and ");
  if (ledger) {
    notApplied.push(...ledger.notApplied);
    for (const t of ledger.totals) {
      const n = nodes.get(t.constraint.elementId);
      if (!n) continue;
      n.display = totalSentence(t);
      const b = base?.totals.find((x) => x.constraint.id === t.constraint.id);
      const head = t.headroom ?? 0;
      if (ledger !== base && b && (b.allocated !== t.allocated || b.available !== t.available)) {
        mark(n.id, { kind: "ledger", by, label: n.display, text: `Baseline: ${totalSentence(b)}. With ${withWhat}: ${n.display}.`, ref: "", tone: head < 0 ? "risk" : "neutral" });
        changed.add(n.id);
      }
      if (t.available != null && head < 0) mark(n.id, { kind: "ledger", by, label: `${formatAmount(t.constraint, -head)} over the cap`, text: `Allocation exceeds what is available by ${formatAmount(t.constraint, -head)}.`, ref: "", tone: "risk" }, ["possible-risk"]);
      else if (t.available != null && head === 0 && ledger !== base) mark(n.id, { kind: "ledger", by, label: "No headroom left", text: `Nothing is left of the ${t.constraint.label.toLowerCase()} for contingencies or unpriced costs.`, ref: "", tone: "risk" }, ["possible-risk"]);
    }
    // capacity ceilings (cohorts, target places …) on the element that carries them
    const byEl = new Map<string, string[]>();
    for (const m of ledger.metrics) if (m.metric.elementId) byEl.set(m.metric.elementId, [...(byEl.get(m.metric.elementId) ?? []), `${m.value} ${m.metric.label.toLowerCase()}`]);
    for (const [id, parts] of byEl) {
      const n = nodes.get(id);
      if (!n) continue;
      const line = parts.join(" · ");
      const b = base ? base.metrics.filter((m) => m.metric.elementId === id).map((m) => `${m.value} ${m.metric.label.toLowerCase()}`).join(" · ") : "";
      n.display = n.display ? `${n.display} · ${line}` : line;
      if (ledger !== base && b && b !== line) { mark(id, { kind: "ledger", by, label: `Up to ${line}`, text: `Capacity ceiling with ${withWhat}: ${line} (baseline: ${b}). Planned places, not applications, participation or outcomes.`, ref: "", tone: "proposed" }); changed.add(id); }
    }
  }

  return {
    stage, stages,
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()).filter((e) => nodes.has(e.rel.from) && nodes.has(e.rel.to)),
    pathway: shown, scenarios: applied, notApplied, sources, ledger, baseline: base, changed: Array.from(changed),
  };
}

/** Effects for the isometric engine: one label per target (pathway / scenario / ledger marks), risk targets pulse. */
export function engineEffects(state: MapState): { map: Record<string, [string, string]>; hot: Array<{ near: string; label: string }> } {
  const CAT: Record<MarkTone, string> = { risk: "harm", benefit: "earth", mixed: "trust", neutral: "direction", proposed: "decision", scenario: "direction" };
  const map: Record<string, [string, string]> = {};
  const hot: Array<{ near: string; label: string }> = [];
  for (const n of state.nodes) {
    const ms = n.marks.filter((m) => m.kind !== "source");
    if (!ms.length) continue;
    const risk = ms.find((m) => m.tone === "risk");
    const first = risk ?? ms[0];
    const label = n.display && ms.some((m) => m.kind === "ledger") ? n.display : first.label;
    map[n.id] = [label, CAT[first.tone]];
    // the hot spot uses the short risk ("4 hours over the cap"), not the full allocation line
    if (risk) hot.push({ near: n.id, label: (ms.find((m) => m.tone === "risk" && !(m.kind === "ledger" && m.label === n.display)) ?? risk).label });
  }
  return { map, hot };
}

/** Default stage: the furthest stage the current progress supports (selected pathway > evidence > baseline). */
export function defaultStage(lead: LeadCase, progress: LeadProgress): MapStage {
  if (progress.pathwayPick && activePathways(lead).some((p) => p.id === progress.pathwayPick)) return "pathway";
  if (appliedSourceDocs(lead, progress).length) return "evidence";
  return "baseline";
}
