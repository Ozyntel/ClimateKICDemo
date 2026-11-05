/**
 * Lead case — the single, editable content source for one lead's demo.
 *
 * Everything the customer-facing demo shows about an organisation comes from
 * one LeadCase object. Nothing case-specific lives in page code. A blank case
 * (see blank.ts) has empty strings, empty lists and "unknown" states — never
 * invented facts.
 *
 * Provenance rules carried by the schema:
 *   - Every number, element, finding and relationship can carry
 *     `evidence` (observed / stakeholder view / assumption / illustrative)
 *     and `sourceIds` pointing at `sources[]`.
 *   - Unknown is a first-class value: empty `value`, `state: "unknown"`,
 *     `confidence: "unknown"`, `frequency: "unknown"`.
 *   - Scenario effects and pathway outcomes are always illustrative.
 */
import type { ConfidenceLevel, EvidenceType, Frequency } from "@/lib/visuals/registry";

export type { ConfidenceLevel, EvidenceType, Frequency };

export const LEAD_SCHEMA = "ozy-lead-case" as const;
export const LEAD_SCHEMA_VERSION = 1 as const;

/** Organisation-type presentation rules (see orgTypes.ts). */
export type OrgTypeId = "company" | "enterprise" | "public" | "portfolio" | "care" | "network" | "other";
/** World-map look. "" = use the org type's default. */
export type ThemeId = "" | "town" | "canal-city" | "innovation" | "portfolio" | "industrial" | "campus";

export type SizeBand = "" | "1-50" | "51-200" | "201-1000" | "1001-5000" | "5000+";
export type Level3 = "" | "Low" | "Medium" | "High";
export type IntakeSectionId = "organisation" | "respondent" | "change" | "people" | "constraints" | "world";

/** How an effect reads on the map. risk = red pulse; benefit; mixed; neutral change. */
export type EffectTone = "risk" | "benefit" | "mixed" | "neutral";

export interface Effect {
  /** Element id, team id or "org". */
  target: string;
  /** Short word(s) shown on the map, e.g. "Cash gap". */
  label: string;
  tone: EffectTone;
  /** Direction only when known. */
  direction?: "" | "increase" | "decrease";
  /** Optional overlay id (registry) shown on the target while the effect is active, e.g. "possible-risk". */
  overlay?: string;
}

/** A stated value attached to a map element, with where it came from. */
export interface ElementFact {
  label: string;
  value: string;
  evidence: EvidenceType | "";
  sourceIds: string[];
  /** Heading, row or section inside the source, e.g. "Partner baseline · row A". */
  ref: string;
}

/** Map additions that exist only while their owner (a source, pathway or scenario) is active. */
export interface MapAdds {
  elements: CaseElement[];
  relationships: Relationship[];
}

export interface NumberFact {
  id: string;
  label: string;
  /** Free text so units / ranges / "≈" are possible. Empty = unknown. */
  value: string;
  unit: string;
  /** Date or period this value describes, e.g. "2026-09-30" or "FY2025". */
  asOf: string;
  evidence: EvidenceType | "";
  sourceIds: string[];
  note: string;
}

export interface CaseElement {
  id: string;
  label: string;
  /** Visual registry element type id (e.g. "facility", "supplier", "risk"). */
  visual: string;
  /** State id from that element type. Default "unknown". */
  state: string;
  /** Overlay ids from the registry (possible-risk, active-problem, literal-fire …). */
  overlays: string[];
  /** Where it sits: macro (on the map), beyond (outside the boundary), earth (global systems), force (hovering intangible), list (cards / list only). "" = registry default. */
  layer: "" | "macro" | "beyond" | "earth" | "force" | "list";
  /** For forces / attached overlays: which element or team it hovers near. */
  near: string;
  note: string;
  /** Whose view this is (required for attributed visuals: culture, trust, sentiment …). */
  holder: string;
  evidence: EvidenceType | "";
  confidence: ConfidenceLevel;
  confidenceWhy: string;
  sourceIds: string[];
  /** Optional measured value shown with the element. */
  measure: { value: string; unit: string; asOf: string };
  /** Only for the portfolio org type. */
  portfolio: { tier: "" | "ozy" | "fund" | "dd" | "other"; health: "" | "good" | "mixed" | "risk"; status: string };
  /** Position on the systems view, 0–100 on each axis. null = placed automatically. */
  pos: { x: number; y: number } | null;
  /** Id of a group element this one is drawn inside on the systems view (e.g. one partner inside "Partners A–D"). */
  group: string;
  /** Stated values with their source and row / heading. */
  facts: ElementFact[];
  /** What is not known or would need confirmation. */
  unknowns: string[];
  /** Planning constraint id whose allocation / headroom is shown on this element (see LeadCase.planning). */
  ledger: string;
  /** Building on the isometric map ("" = the element type's default), e.g. "city-paris". */
  shape: string;
  /** On the islands look: "inner" ring (e.g. offices) or "outer" ring (programmes, partners). "" = default. */
  ring: "" | "inner" | "outer";
}

export interface AttributedView {
  text: string;
  holder: string;
  evidence: EvidenceType | "";
  sourceIds: string[];
}

export interface Team {
  id: string;
  name: string;
  purpose: string;
  /** null = not stated (never shown as 0). */
  headcount: number | null;
  roles: string[];
  /** Hierarchy tier for the inside view (0 = top). null = single tier. */
  tier: number | null;
  views: AttributedView[];
  visual: string;
  state: string;
  overlays: string[];
  /** Links between roles in this team (micro level): who needs a decision or hand-over from whom. Roles, not people. */
  roleLinks: Array<{ from: string; to: string; kind: "decision" | "handover" | "trust"; label: string }>;
}

export type RelationshipType = "relationship" | "dependency" | "flow" | "handover" | "decision" | "information" | "trust" | "tension";

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: RelationshipType;
  label: string;
  /** Connection state id from the registry connection type. */
  state: string;
  /** How it reads on the map: tension / synergy / mixed / neutral. */
  tone: "neutral" | "tension" | "synergy" | "mixed";
  frequency: Frequency;
  evidence: EvidenceType | "";
  sourceIds: string[];
  /** Differing perspectives on this relationship. */
  perspectives: AttributedView[];
  /** What this connection represents and what would need confirming. A line is a dependency to check, never a measured effect. */
  note: string;
}

export interface SourceDoc {
  /** Short source id, e.g. "S-01". */
  id: string;
  title: string;
  fileName: string;
  date: string;
  docType: string;
  /** What the source covers (population, period, sample). */
  scope: string;
  owner: string;
  excerpt: string;
  /** Full text of the source (pasted or loaded from a .md / .txt file). */
  fullText: string;
  /** The team's prepared reading — shown separately from the source itself. */
  reading: { extracted: string[]; changes: string[]; affected: string[]; uncertainties: string[] };
  /** When "uploaded" in the demo, these replace comparable number facts (history kept). */
  updates: Array<{ numberId: string; value: string; asOf: string }>;
  /** Signals this source adds to "Key signals". */
  signals: string[];
  /** Made-up demo material — shown with a SYNTHETIC label. */
  synthetic: boolean;
  /** What the source says about map elements / connections, each with its heading or row. Applied only once uploaded. */
  mapChanges: SourceMapChange[];
  /** Planning values the source states; compared with the planning ledger (match or conflict), never added to it. */
  ledgerChecks: LedgerCheck[];
  /** Connections or elements the source describes that are not in the baseline (e.g. a proposed escalation route). */
  adds: MapAdds;
}

export interface SourceMapChange {
  /** Element id, relationship id or "org". */
  target: string;
  /** Heading or row in the source. */
  ref: string;
  /** Short label for the map, e.g. "2 interested · none contracted". */
  label: string;
  /** What the source says. */
  text: string;
  /** Overlays added to the target (never removes a condition). */
  overlays: string[];
  evidence: EvidenceType | "";
}

export interface LedgerCheck {
  /** Planning component id or constraint id. */
  target: string;
  /** Constraint id (cost), metric id (capacity) or "cap". */
  field: string;
  value: number;
  ref: string;
}

export interface Finding {
  id: string;
  text: string;
  /** signal = shown in "Key signals" on the map; finding = brief/insight only. */
  kind: "signal" | "finding";
  evidence: EvidenceType | "";
  confidence: ConfidenceLevel;
  confidenceWhy: string;
  sourceIds: string[];
  /** Optional element it is about. */
  about: string;
}

export interface Assumption { id: string; text: string; basis: string; sourceIds: string[] }
export interface MissingItem { id: string; title: string; why: string; sharpens: string; status: "missing" | "requested" | "supplied" }
export interface Notice { id: string; kind: "normative" | "contestation"; text: string; approvedRef: string }

export interface PathwaySpot { label: string; near: string; from: number; until: number | null }

export interface Pathway {
  id: string;
  title: string;
  summary: string;
  idea: string;
  horizon: string;
  cost: string;
  needs: string[];
  conditions: string[];
  interventions: string[];
  watch: string;
  sourceIds: string[];
  wins: PathwaySpot[];
  risks: PathwaySpot[];
  /** Illustrative effects painted on the map when this option is played. */
  effects: Effect[];
  /** Planning components this option consists of (baseline included), for the resource arithmetic. */
  components: Array<{ componentId: string; count: number }>;
  /** Proposed elements and connections drawn on the map only while this option is shown. */
  adds: MapAdds;
  /** Up to three proposed actions, each previewable before selection. */
  plan: PlanStep[];
  /** The main trade-off, in one or two sentences. */
  tradeOff: string;
  /** Evidence that would be needed before or while acting on this option. */
  evidenceNeeded: string[];
}

export interface PlanStep {
  id: string;
  title: string;
  /** What it involves. Never described as done. */
  what: string;
  /** Element ids (baseline or this option's adds) the step attaches to on the map. */
  showsOn: string[];
  dependsOn: string[];
  evidence: string[];
}

export interface Scenario {
  id: string;
  question: string;
  effects: Effect[];
  assumptions: string[];
  /** "stress-test" (historic id): a quick change with planning adjustments, applied to the current plan or the shown pathway. "" = a what-if with map effects only. */
  kind: "" | "stress-test";
  /** Can be active together with other combinable quick changes. */
  combinable: boolean;
  /** Ledger adjustments assumed by this scenario. */
  adjustments: PlanningAdjustment[];
  /** Elements / connections the scenario introduces (e.g. an assumed local cost). */
  adds: MapAdds;
  /** Relationship ids whose connection is highlighted (ripple) when the scenario is applied. */
  highlight: string[];
  /** What this scenario does NOT change, stated explicitly. */
  unchanged: string[];
  /** Only applies when the shown option includes this planning component ("" = always). */
  requiresComponent: string;
  /** Words that match this scenario when someone types a change into the scenario box. */
  keywords: string[];
}

// ─── planning ledger (optional) ───────────────────────────────────────
// Cash, hours … are separate constraints and are never summed together.

export interface PlanningConstraint {
  id: string;
  label: string;
  /** e.g. "hours". Shown after the number. */
  unit: string;
  /** e.g. "€". Shown before the number. */
  prefix: string;
  /** Planning cap for the period. null = not known. */
  cap: number | null;
  /** Element whose card shows allocation and headroom. */
  elementId: string;
  note: string;
  evidence: EvidenceType | "";
  sourceIds: string[];
}

export interface PlanningMetric {
  id: string;
  label: string;
  unit: string;
  /** e.g. "Capacity ceiling — not applications, participation or outcomes." */
  note: string;
  /** Element whose card shows this capacity figure. */
  elementId: string;
}

export interface PlanningComponent {
  id: string;
  label: string;
  kind: "baseline" | "candidate";
  costs: Array<{ constraintId: string; amount: number }>;
  adds: Array<{ metricId: string; amount: number }>;
  note: string;
  evidence: EvidenceType | "";
  sourceIds: string[];
}

export interface PlanningAdjustment {
  label: string;
  constraintId: string;
  amount: number;
  /** "total" adds to what is allocated; "cap" adds to what is available. */
  target: "total" | "cap";
  /** Applies only when the option includes this component ("" = always). */
  componentId: string;
  /** "once" per option, or "each" per unit of the component. */
  per: "once" | "each";
  note: string;
}

export interface Planning {
  /** e.g. "Illustrative annual cycle (12 months)". */
  period: string;
  note: string;
  constraints: PlanningConstraint[];
  metrics: PlanningMetric[];
  components: PlanningComponent[];
  /** Plain statements shown with the baseline (e.g. "Cash and hours are separate constraints"). */
  notes: string[];
}

/** An illustrative impact route: each step is a dependency to validate, never a guaranteed result. */
export interface ImpactRoute {
  id: string;
  title: string;
  note: string;
  steps: Array<{ label: string; nodeId: string; question: string; evidence: string }>;
}

export interface LeadCase {
  schema: typeof LEAD_SCHEMA;
  version: typeof LEAD_SCHEMA_VERSION;
  id: string;
  /** Team-facing label (only shown in /prepare). */
  internalLabel: string;
  createdAt: string;
  updatedAt: string;
  /** "" = map. "systems" opens the labelled systems view first. */
  presentation: { orgType: OrgTypeId; theme: ThemeId; defaultView: "" | "map" | "systems" };
  /** Prominent notice on every demo page, e.g. that the case is a demonstration with synthetic data. "" = none. */
  caseNotice: string;
  organisation: {
    name: string;
    overview: string;
    sector: string;
    place: string;
    size: SizeBand;
    context: string;
    visual: string;
    state: string;
    /** Building on the map ("" = the organisation type's default), e.g. "city-amsterdam". */
    shape: string;
  };
  respondent: { role: string; accountableFor: string; goals: string };
  decision: {
    question: string;
    challenge: string;
    objectives: string[];
    timeHorizon: string;
    inScope: string[];
    outOfScope: string[];
    workingWell: string[];
    underway: string[];
    whereStalls: string;
    /** Who decides or checks what. State whether these are proposed or verified. */
    rights: string[];
  };
  intake: {
    constraints: { capacityLimits: boolean; governanceBottlenecks: boolean; decisionLatency: boolean; unclearOwnership: boolean };
    constraintNotes: string;
    /** External context in the case's own words (funding timing, availability, access …). */
    externalNotes: string;
    external: { marketVolatility: Level3; demandOutlook: "" | "Down" | "Stable" | "Up"; regulatoryPressure: Level3; supplyDisruptionRisk: Level3; environmentalFactor: "" | "none" | "flooding" | "storm" | "drought" | "heatwave" };
    /** Intake sections hidden for this lead (not relevant). */
    omitSections: IntakeSectionId[];
  };
  numbers: NumberFact[];
  elements: CaseElement[];
  teams: Team[];
  relationships: Relationship[];
  sources: SourceDoc[];
  findings: Finding[];
  assumptions: Assumption[];
  missingInfo: MissingItem[];
  /** Case-specific entries added to the fixed "Limitations of this baseline" section. */
  limitations: string[];
  notices: Notice[];
  pathways: Pathway[];
  /**
   * Optional shared outcome estimate across pathways. Only shown when filled
   * in, and always labelled as a demo assumption — never as a prediction.
   */
  outcomeEstimate: { question: string; basis: string; values: Record<string, number | null> } | null;
  scenarios: Scenario[];
  /** Optional resource ledger: caps, baseline and candidate components. Pathway totals are derived from it. */
  planning: Planning | null;
  /** Illustrative impact routes shown on the systems view (separate from the decision options). */
  impactRoutes: ImpactRoute[];
}

/** Per-case demo progress (kept separate from content, never exported to other cases). */
export interface LeadProgress {
  appliedSources: string[];
  pathwayPick: string | null;
  timelineMonth: number;
  /** Stress tests switched on (scenario ids of kind "stress-test"). */
  stressTests: string[];
}
