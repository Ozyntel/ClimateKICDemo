/**
 * Blank lead case + row factories + import normalisation.
 *
 * A blank case contains no facts: empty strings, empty lists, unknown
 * states. `normaliseLeadCase` fills any missing fields of an imported /
 * older JSON file with the same blank defaults, so partial files are safe.
 */
import {
  LEAD_SCHEMA,
  LEAD_SCHEMA_VERSION,
  type AttributedView,
  type Assumption,
  type CaseElement,
  type Effect,
  type ElementFact,
  type Finding,
  type ImpactRoute,
  type LeadCase,
  type LedgerCheck,
  type MapAdds,
  type MissingItem,
  type Notice,
  type NumberFact,
  type Pathway,
  type PathwaySpot,
  type PlanStep,
  type Planning,
  type PlanningAdjustment,
  type PlanningComponent,
  type PlanningConstraint,
  type PlanningMetric,
  type Relationship,
  type Scenario,
  type SourceDoc,
  type SourceMapChange,
  type Team,
} from "./types";

/**
 * Fixed "Limitations of this baseline" section. Always shown (Onboarding,
 * Data management, executive brief and its export). Case-specific entries
 * are appended from `lead.limitations`; these fixed lines cannot be removed
 * in the editor.
 */
export const BASELINE_LIMITATIONS: readonly string[] = [
  "This baseline was prepared by the Ozyntel team for a demo conversation, from the sources listed in the demo. It is not a complete picture of the organisation.",
  "Each item is labelled as observed, stakeholder view, assumption or illustrative scenario where that is known. Items without a label have not been verified.",
  "Scenario effects, pathway timelines and any outcome estimates are illustrative demo results, not validated predictions.",
  "Missing information is shown as unknown. Unknown is not zero, low or safe.",
  "Document uploads in this demo are simulated: the reading of each document was prepared in advance by the team. No automatic extraction runs.",
  "Views of people and groups are attributed and aggregate. The demo does not infer individual emotions, mental health or performance.",
];

export function newId(prefix: string): string {
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rnd}`;
}

export function createBlankLeadCase(internalLabel = ""): LeadCase {
  const now = new Date().toISOString();
  return {
    schema: LEAD_SCHEMA,
    version: LEAD_SCHEMA_VERSION,
    id: newId("lead"),
    internalLabel,
    createdAt: now,
    updatedAt: now,
    presentation: { orgType: "other", theme: "", defaultView: "" },
    caseNotice: "",
    organisation: { name: "", overview: "", sector: "", place: "", size: "", context: "", visual: "organisation", state: "unknown", shape: "" },
    respondent: { role: "", accountableFor: "", goals: "" },
    decision: { question: "", challenge: "", objectives: [], timeHorizon: "", inScope: [], outOfScope: [], workingWell: [], underway: [], whereStalls: "", rights: [] },
    intake: {
      constraints: { capacityLimits: false, governanceBottlenecks: false, decisionLatency: false, unclearOwnership: false },
      constraintNotes: "",
      externalNotes: "",
      external: { marketVolatility: "", demandOutlook: "", regulatoryPressure: "", supplyDisruptionRisk: "", environmentalFactor: "" },
      omitSections: [],
    },
    numbers: [],
    elements: [],
    teams: [],
    relationships: [],
    sources: [],
    findings: [],
    assumptions: [],
    missingInfo: [],
    limitations: [],
    notices: [],
    pathways: [],
    outcomeEstimate: null,
    scenarios: [],
    planning: null,
    impactRoutes: [],
  };
}

// ─── row factories (used by the editor and by normalisation) ──────────

export const blankNumber = (): NumberFact => ({ id: newId("n"), label: "", value: "", unit: "", asOf: "", evidence: "", sourceIds: [], note: "" });
export const blankElement = (): CaseElement => ({
  id: newId("el"), label: "", visual: "facility", state: "unknown", overlays: [], layer: "", near: "", note: "", holder: "",
  evidence: "", confidence: "unknown", confidenceWhy: "", sourceIds: [], measure: { value: "", unit: "", asOf: "" },
  portfolio: { tier: "", health: "", status: "" }, pos: null, group: "", facts: [], unknowns: [], ledger: "", shape: "", ring: "",
});
export const blankFact = (): ElementFact => ({ label: "", value: "", evidence: "", sourceIds: [], ref: "" });
export const blankAdds = (): MapAdds => ({ elements: [], relationships: [] });
export const blankView = (): AttributedView => ({ text: "", holder: "", evidence: "stakeholder", sourceIds: [] });
export const blankTeam = (): Team => ({ id: newId("team"), name: "", purpose: "", headcount: null, roles: [], tier: null, views: [], visual: "team", state: "unknown", overlays: [], roleLinks: [] });
export const blankRelationship = (): Relationship => ({ id: newId("rel"), from: "", to: "", type: "relationship", label: "", state: "unknown", tone: "neutral", frequency: "unknown", evidence: "", sourceIds: [], perspectives: [], note: "" });
export const blankMapChange = (): SourceMapChange => ({ target: "", ref: "", label: "", text: "", overlays: [], evidence: "" });
export const blankLedgerCheck = (): LedgerCheck => ({ target: "", field: "", value: 0, ref: "" });
export const blankSource = (n = 1): SourceDoc => ({
  id: `S-${String(n).padStart(2, "0")}`, title: "", fileName: "", date: "", docType: "", scope: "", owner: "", excerpt: "", fullText: "",
  reading: { extracted: [], changes: [], affected: [], uncertainties: [] }, updates: [], signals: [],
  synthetic: false, mapChanges: [], ledgerChecks: [], adds: blankAdds(),
});
export const blankFinding = (): Finding => ({ id: newId("f"), text: "", kind: "signal", evidence: "", confidence: "unknown", confidenceWhy: "", sourceIds: [], about: "" });
export const blankAssumption = (): Assumption => ({ id: newId("a"), text: "", basis: "", sourceIds: [] });
export const blankMissing = (): MissingItem => ({ id: newId("m"), title: "", why: "", sharpens: "", status: "missing" });
export const blankNotice = (): Notice => ({ id: newId("notice"), kind: "normative", text: "", approvedRef: "" });
export const blankEffect = (): Effect => ({ target: "", label: "", tone: "neutral", direction: "", overlay: "" });
export const blankSpot = (): PathwaySpot => ({ label: "", near: "", from: 0, until: null });
export const blankPlanStep = (): PlanStep => ({ id: newId("step"), title: "", what: "", showsOn: [], dependsOn: [], evidence: [] });
export const blankPathway = (): Pathway => ({
  id: newId("pw"), title: "", summary: "", idea: "", horizon: "", cost: "", needs: [], conditions: [], interventions: [], watch: "", sourceIds: [], wins: [], risks: [], effects: [],
  components: [], adds: blankAdds(), plan: [], tradeOff: "", evidenceNeeded: [],
});
export const blankAdjustment = (): PlanningAdjustment => ({ label: "", constraintId: "", amount: 0, target: "total", componentId: "", per: "once", note: "" });
export const blankScenario = (): Scenario => ({
  id: newId("sc"), question: "", effects: [], assumptions: [], kind: "", combinable: false, adjustments: [], adds: blankAdds(), highlight: [], unchanged: [], requiresComponent: "", keywords: [],
});
export const blankConstraint = (): PlanningConstraint => ({ id: newId("cap"), label: "", unit: "", prefix: "", cap: null, elementId: "", note: "", evidence: "", sourceIds: [] });
export const blankMetric = (): PlanningMetric => ({ id: newId("metric"), label: "", unit: "", note: "", elementId: "" });
export const blankComponent = (): PlanningComponent => ({ id: newId("comp"), label: "", kind: "candidate", costs: [], adds: [], note: "", evidence: "", sourceIds: [] });
export const blankPlanning = (): Planning => ({ period: "", note: "", constraints: [], metrics: [], components: [], notes: [] });
export const blankRoute = (): ImpactRoute => ({ id: newId("route"), title: "", note: "", steps: [] });

// ─── normalisation ─────────────────────────────────────────────────────

type AnyRec = Record<string, unknown>;
const isRec = (v: unknown): v is AnyRec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter((x) => x.trim() !== "") : typeof v === "string" ? v.split("\n").map((x) => x.trim()).filter(Boolean) : []);
const num = (v: unknown, d: number | null): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
const bool = (v: unknown) => v === true;

/** Merge `raw` over a blank row so every field exists with the right type. */
function rows<T extends object>(raw: unknown, blank: () => T, fix: (r: AnyRec, b: T) => T): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRec).map((r) => fix(r, blank()));
}

const EVID = ["", "observed", "synthetic", "stakeholder", "assumption", "illustrative"] as const;
const CONF = ["unknown", "low", "medium", "high"] as const;
const TONES = ["risk", "benefit", "mixed", "neutral"] as const;
const LAYERS = ["", "macro", "beyond", "earth", "force", "list"] as const;
const REL_TYPES = ["relationship", "dependency", "flow", "handover", "decision", "information", "trust", "tension"] as const;
const finite = (v: unknown, d = 0): number => num(v, d) ?? d;

const fixView = (r: AnyRec): AttributedView => ({ text: str(r.text), holder: str(r.holder), evidence: oneOf(r.evidence, EVID, "stakeholder"), sourceIds: strs(r.sourceIds) });
const fixEffect = (r: AnyRec): Effect => ({ target: str(r.target), label: str(r.label), tone: oneOf(r.tone, TONES, "neutral"), direction: oneOf(r.direction, ["", "increase", "decrease"] as const, ""), overlay: str(r.overlay) });
const fixSpot = (r: AnyRec): PathwaySpot => ({ label: str(r.label), near: str(r.near), from: Math.max(0, Math.min(12, num(r.from, 0) ?? 0)), until: r.until == null || r.until === "" ? null : Math.max(0, Math.min(12, num(r.until, 12) ?? 12)) });
const fixFact = (r: AnyRec): ElementFact => ({ label: str(r.label), value: str(r.value), evidence: oneOf(r.evidence, EVID, ""), sourceIds: strs(r.sourceIds), ref: str(r.ref) });
const fixPos = (v: unknown): CaseElement["pos"] => {
  if (!isRec(v)) return null;
  const x = num(v.x, null), y = num(v.y, null);
  return x == null || y == null ? null : { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
};

function fixElement(r: AnyRec, x: CaseElement): CaseElement {
  const m = isRec(r.measure) ? r.measure : {};
  const p = isRec(r.portfolio) ? r.portfolio : {};
  return {
    ...x, id: str(r.id) || x.id, label: str(r.label), visual: str(r.visual) || x.visual, state: str(r.state) || "unknown", overlays: strs(r.overlays),
    layer: oneOf(r.layer, LAYERS, ""), near: str(r.near), note: str(r.note), holder: str(r.holder),
    evidence: oneOf(r.evidence, EVID, ""), confidence: oneOf(r.confidence, CONF, "unknown"), confidenceWhy: str(r.confidenceWhy), sourceIds: strs(r.sourceIds),
    measure: { value: str(m.value), unit: str(m.unit), asOf: str(m.asOf) },
    portfolio: { tier: oneOf(p.tier, ["", "ozy", "fund", "dd", "other"] as const, ""), health: oneOf(p.health, ["", "good", "mixed", "risk"] as const, ""), status: str(p.status) },
    pos: fixPos(r.pos), group: str(r.group), facts: rows(r.facts, blankFact, (f) => fixFact(f)), unknowns: strs(r.unknowns), ledger: str(r.ledger),
    shape: str(r.shape), ring: oneOf(r.ring, ["", "inner", "outer"] as const, ""),
  };
}

function fixRelationship(r: AnyRec, x: Relationship): Relationship {
  return {
    ...x, id: str(r.id) || x.id, from: str(r.from), to: str(r.to), type: oneOf(r.type, REL_TYPES, "relationship"),
    label: str(r.label), state: str(r.state) || "unknown", tone: oneOf(r.tone, ["neutral", "tension", "synergy", "mixed"] as const, "neutral"),
    frequency: oneOf(r.frequency, ["unknown", "low", "medium", "high"] as const, "unknown"), evidence: oneOf(r.evidence, EVID, ""), sourceIds: strs(r.sourceIds),
    perspectives: rows(r.perspectives, blankView, (v) => fixView(v)), note: str(r.note),
  };
}

const fixAdds = (v: unknown): MapAdds => {
  const a = isRec(v) ? v : {};
  return { elements: rows(a.elements, blankElement, fixElement), relationships: rows(a.relationships, blankRelationship, fixRelationship) };
};

const fixAdjustment = (r: AnyRec): PlanningAdjustment => ({
  label: str(r.label), constraintId: str(r.constraintId), amount: finite(r.amount), target: oneOf(r.target, ["total", "cap"] as const, "total"),
  componentId: str(r.componentId), per: oneOf(r.per, ["once", "each"] as const, "once"), note: str(r.note),
});

const amounts = <K extends string>(v: unknown, key: K): Array<Record<K, string> & { amount: number }> =>
  Array.isArray(v) ? v.filter(isRec).map((a) => ({ [key]: str(a[key]), amount: finite(a.amount) }) as Record<K, string> & { amount: number }) : [];

function fixPlanning(v: unknown): Planning | null {
  if (!isRec(v)) return null;
  return {
    period: str(v.period), note: str(v.note), notes: strs(v.notes),
    constraints: rows(v.constraints, blankConstraint, (r, x) => ({ ...x, id: str(r.id) || x.id, label: str(r.label), unit: str(r.unit), prefix: str(r.prefix), cap: num(r.cap, null), elementId: str(r.elementId), note: str(r.note), evidence: oneOf(r.evidence, EVID, ""), sourceIds: strs(r.sourceIds) })),
    metrics: rows(v.metrics, blankMetric, (r, x) => ({ ...x, id: str(r.id) || x.id, label: str(r.label), unit: str(r.unit), note: str(r.note), elementId: str(r.elementId) })),
    components: rows(v.components, blankComponent, (r, x) => ({
      ...x, id: str(r.id) || x.id, label: str(r.label), kind: oneOf(r.kind, ["baseline", "candidate"] as const, "candidate"),
      costs: amounts(r.costs, "constraintId"), adds: amounts(r.adds, "metricId"), note: str(r.note), evidence: oneOf(r.evidence, EVID, ""), sourceIds: strs(r.sourceIds),
    })),
  };
}

export function normaliseLeadCase(raw: unknown): LeadCase {
  const b = createBlankLeadCase();
  if (!isRec(raw)) return b;
  const o = isRec(raw.organisation) ? raw.organisation : {};
  const rsp = isRec(raw.respondent) ? raw.respondent : {};
  const d = isRec(raw.decision) ? raw.decision : {};
  const it = isRec(raw.intake) ? raw.intake : {};
  const cons = isRec(it.constraints) ? it.constraints : {};
  const ext = isRec(it.external) ? it.external : {};
  const pres = isRec(raw.presentation) ? raw.presentation : {};
  const oe = isRec(raw.outcomeEstimate) ? raw.outcomeEstimate : null;
  return {
    ...b,
    id: str(raw.id) || b.id,
    internalLabel: str(raw.internalLabel),
    createdAt: str(raw.createdAt) || b.createdAt,
    updatedAt: str(raw.updatedAt) || b.updatedAt,
    presentation: {
      orgType: oneOf(pres.orgType, ["company", "enterprise", "public", "portfolio", "care", "network", "other"] as const, "other"),
      theme: oneOf(pres.theme, ["", "town", "canal-city", "innovation", "portfolio", "industrial", "campus"] as const, ""),
      defaultView: oneOf(pres.defaultView, ["", "map", "systems"] as const, ""),
    },
    caseNotice: str(raw.caseNotice),
    organisation: { name: str(o.name), overview: str(o.overview), sector: str(o.sector), place: str(o.place), size: oneOf(o.size, ["", "1-50", "51-200", "201-1000", "1001-5000", "5000+"] as const, ""), context: str(o.context), visual: str(o.visual) || "organisation", state: str(o.state) || "unknown", shape: str(o.shape) },
    respondent: { role: str(rsp.role), accountableFor: str(rsp.accountableFor), goals: str(rsp.goals) },
    decision: { question: str(d.question), challenge: str(d.challenge), objectives: strs(d.objectives), timeHorizon: str(d.timeHorizon), inScope: strs(d.inScope), outOfScope: strs(d.outOfScope), workingWell: strs(d.workingWell), underway: strs(d.underway), whereStalls: str(d.whereStalls), rights: strs(d.rights) },
    intake: {
      constraints: { capacityLimits: bool(cons.capacityLimits), governanceBottlenecks: bool(cons.governanceBottlenecks), decisionLatency: bool(cons.decisionLatency), unclearOwnership: bool(cons.unclearOwnership) },
      constraintNotes: str(it.constraintNotes),
      externalNotes: str(it.externalNotes),
      external: {
        marketVolatility: oneOf(ext.marketVolatility, ["", "Low", "Medium", "High"] as const, ""),
        demandOutlook: oneOf(ext.demandOutlook, ["", "Down", "Stable", "Up"] as const, ""),
        regulatoryPressure: oneOf(ext.regulatoryPressure, ["", "Low", "Medium", "High"] as const, ""),
        supplyDisruptionRisk: oneOf(ext.supplyDisruptionRisk, ["", "Low", "Medium", "High"] as const, ""),
        environmentalFactor: oneOf(ext.environmentalFactor, ["", "none", "flooding", "storm", "drought", "heatwave"] as const, ""),
      },
      omitSections: strs(it.omitSections).filter((s) => ["organisation", "respondent", "change", "people", "constraints", "world"].includes(s)) as LeadCase["intake"]["omitSections"],
    },
    numbers: rows(raw.numbers, blankNumber, (r, x) => ({ ...x, id: str(r.id) || x.id, label: str(r.label), value: str(r.value), unit: str(r.unit), asOf: str(r.asOf), evidence: oneOf(r.evidence, EVID, ""), sourceIds: strs(r.sourceIds), note: str(r.note) })),
    elements: rows(raw.elements, blankElement, fixElement),
    teams: rows(raw.teams, blankTeam, (r, x) => ({
      ...x, id: str(r.id) || x.id, name: str(r.name), purpose: str(r.purpose), headcount: num(r.headcount, null), roles: strs(r.roles), tier: num(r.tier, null),
      views: rows(r.views, blankView, (v) => fixView(v)), visual: str(r.visual) || "team", state: str(r.state) || "unknown", overlays: strs(r.overlays),
      roleLinks: Array.isArray(r.roleLinks) ? r.roleLinks.filter(isRec).map((l) => ({ from: str(l.from), to: str(l.to), kind: oneOf(l.kind, ["decision", "handover", "trust"] as const, "decision"), label: str(l.label) })) : [],
    })),
    relationships: rows(raw.relationships, blankRelationship, fixRelationship),
    sources: rows(raw.sources, () => blankSource(), (r, x) => {
      const rd = isRec(r.reading) ? r.reading : {};
      return {
        ...x, id: str(r.id) || x.id, title: str(r.title), fileName: str(r.fileName), date: str(r.date), docType: str(r.docType), scope: str(r.scope), owner: str(r.owner), excerpt: str(r.excerpt), fullText: str(r.fullText),
        reading: { extracted: strs(rd.extracted), changes: strs(rd.changes), affected: strs(rd.affected), uncertainties: strs(rd.uncertainties) },
        updates: Array.isArray(r.updates) ? r.updates.filter(isRec).map((u) => ({ numberId: str(u.numberId), value: str(u.value), asOf: str(u.asOf) })) : [],
        signals: strs(r.signals),
        synthetic: bool(r.synthetic),
        mapChanges: rows(r.mapChanges, blankMapChange, (c) => ({ target: str(c.target), ref: str(c.ref), label: str(c.label), text: str(c.text), overlays: strs(c.overlays), evidence: oneOf(c.evidence, EVID, "") })),
        ledgerChecks: rows(r.ledgerChecks, blankLedgerCheck, (c) => ({ target: str(c.target), field: str(c.field), value: finite(c.value), ref: str(c.ref) })),
        adds: fixAdds(r.adds),
      };
    }),
    findings: rows(raw.findings, blankFinding, (r, x) => ({ ...x, id: str(r.id) || x.id, text: str(r.text), kind: oneOf(r.kind, ["signal", "finding"] as const, "signal"), evidence: oneOf(r.evidence, EVID, ""), confidence: oneOf(r.confidence, CONF, "unknown"), confidenceWhy: str(r.confidenceWhy), sourceIds: strs(r.sourceIds), about: str(r.about) })),
    assumptions: rows(raw.assumptions, blankAssumption, (r, x) => ({ ...x, id: str(r.id) || x.id, text: str(r.text), basis: str(r.basis), sourceIds: strs(r.sourceIds) })),
    missingInfo: rows(raw.missingInfo, blankMissing, (r, x) => ({ ...x, id: str(r.id) || x.id, title: str(r.title), why: str(r.why), sharpens: str(r.sharpens), status: oneOf(r.status, ["missing", "requested", "supplied"] as const, "missing") })),
    limitations: strs(raw.limitations),
    notices: rows(raw.notices, blankNotice, (r, x) => ({ ...x, id: str(r.id) || x.id, kind: oneOf(r.kind, ["normative", "contestation"] as const, "normative"), text: str(r.text), approvedRef: str(r.approvedRef) })),
    pathways: rows(raw.pathways, blankPathway, (r, x) => ({
      ...x, id: str(r.id) || x.id, title: str(r.title), summary: str(r.summary), idea: str(r.idea), horizon: str(r.horizon), cost: str(r.cost),
      needs: strs(r.needs), conditions: strs(r.conditions), interventions: strs(r.interventions), watch: str(r.watch), sourceIds: strs(r.sourceIds),
      wins: rows(r.wins, blankSpot, (s) => fixSpot(s)), risks: rows(r.risks, blankSpot, (s) => fixSpot(s)), effects: rows(r.effects, blankEffect, (e) => fixEffect(e)),
      components: Array.isArray(r.components) ? r.components.filter(isRec).map((c) => ({ componentId: str(c.componentId), count: Math.max(0, finite(c.count)) })) : [],
      adds: fixAdds(r.adds),
      plan: rows(r.plan, blankPlanStep, (s, y) => ({ ...y, id: str(s.id) || y.id, title: str(s.title), what: str(s.what), showsOn: strs(s.showsOn), dependsOn: strs(s.dependsOn), evidence: strs(s.evidence) })).slice(0, 3),
      tradeOff: str(r.tradeOff), evidenceNeeded: strs(r.evidenceNeeded),
    })),
    outcomeEstimate: oe ? {
      question: str(oe.question), basis: str(oe.basis),
      values: isRec(oe.values) ? Object.fromEntries(Object.entries(oe.values).map(([k, v]) => [k, num(v, null)])) : {},
    } : null,
    scenarios: rows(raw.scenarios, blankScenario, (r, x) => ({
      ...x, id: str(r.id) || x.id, question: str(r.question), effects: rows(r.effects, blankEffect, (e) => fixEffect(e)), assumptions: strs(r.assumptions),
      kind: oneOf(r.kind, ["", "stress-test"] as const, ""), combinable: bool(r.combinable), adjustments: rows(r.adjustments, blankAdjustment, (a) => fixAdjustment(a)),
      adds: fixAdds(r.adds), highlight: strs(r.highlight), unchanged: strs(r.unchanged), requiresComponent: str(r.requiresComponent), keywords: strs(r.keywords),
    })),
    planning: fixPlanning(raw.planning),
    impactRoutes: rows(raw.impactRoutes, blankRoute, (r, x) => ({
      ...x, id: str(r.id) || x.id, title: str(r.title), note: str(r.note),
      steps: Array.isArray(r.steps) ? r.steps.filter(isRec).map((s) => ({ label: str(s.label), nodeId: str(s.nodeId), question: str(s.question), evidence: str(s.evidence) })) : [],
    })),
  };
}
