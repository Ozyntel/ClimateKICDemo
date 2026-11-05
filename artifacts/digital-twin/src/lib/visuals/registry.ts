/**
 * Visual registry — the reusable visual vocabulary of the Ozy demo.
 *
 * Source of truth: the Notion page "Demo Visual Elements" (visual grammar +
 * five category tables + "Rules for consistent, trustworthy visuals").
 *
 * The grammar, as implemented here:
 *   - Base element  → `ElementType` (what this is). Drawn by a glyph.
 *   - State         → `StateDef` (what is happening to one property). Each
 *                     state is expressed as a `Treatment` (outline pattern,
 *                     fill, level, count, badge, tone) so the SAME glyph can
 *                     show any state without bespoke illustrations.
 *   - Overlay       → `OverlayDef` (small cue attached to a node / edge /
 *                     area: possible risk, active problem, literal fire …).
 *   - Connection    → `ConnectionType` (labelled line; thickness only when
 *                     interaction frequency is known).
 *   - Evidence/time → `EVIDENCE_TYPES`, `CONFIDENCE_LEVELS` (separate
 *                     channels; confidence never shares a channel with
 *                     severity).
 *
 * Rules enforced by the data (and by tests in registry.test.ts):
 *   - Every element gets an `unknown` state. Unknown is grey + dashed + "?",
 *     never low / safe / zero / green.
 *   - Level / count states describe bands, not exact quantities. Bands must
 *     be defined per case (unit, period, source) — the registry never
 *     contains numeric thresholds.
 *   - Colour is always paired with text (state label) and shape/pattern.
 *   - A warning triangle is a *possible* risk; a flame overlay is a confirmed
 *     *active problem* (metaphor) and is labelled as such; literal fire has
 *     its own element + overlay with a different label.
 *   - No element type describes an individual's emotion, mental health or
 *     performance. Sentiment / voice / speaking-up states are attributed,
 *     aggregate views.
 *   - There is deliberately NO "omitted for privacy/safety" overlay. Use the
 *     fixed "Limitations of this baseline" section instead.
 */

// ─── treatments ─────────────────────────────────────────────────────────

export type Tone =
  | "neutral" // plain ink — no judgement
  | "positive" // e.g. approved / passed (always with a check + text)
  | "caution" // e.g. delayed / constrained
  | "negative" // e.g. failed / outage / active problem
  | "proposed" // planned / proposed / not yet real
  | "scenario" // illustrative scenario state
  | "unknown"; // missing information — never green

export type BadgeId =
  | "check"
  | "clock"
  | "pause"
  | "cross"
  | "question"
  | "barrier"
  | "plus"
  | "warning"
  | "scaffold"
  | "magnifier"
  | "broken"
  | "lock"
  | "dots"
  | "speech"
  | "package"
  | "sun"
  | "retry"
  | "calendar"
  | "bell"
  | "flame"
  | "flame-outline";

export interface Treatment {
  /** Stroke pattern of the base glyph. dashed = proposed/planned; dotted = uncertain/partial. */
  outline?: "solid" | "dashed" | "dotted";
  /** Body fill. muted = inactive; hatched = modelled exposure / illustrative. */
  fill?: "solid" | "none" | "muted" | "hatched";
  /** 0..1 — fill level for gauge-like glyphs. Represents a named band, not a measurement. */
  level?: number;
  /** Number of repeated marks (cars, dots, drops). Represents a band, not a count. */
  count?: number;
  badge?: BadgeId;
  /** Decorative only — information is never carried by motion alone. */
  motion?: "flow" | "none";
  tone?: Tone;
}

export interface StateDef {
  id: string;
  label: string;
  t: Treatment;
  /** Plain-language description of the visual change (shown in legends / preview). */
  cue?: string;
}

export type CategoryId = "people-places" | "flows-environment" | "dynamics" | "money-goals-risk" | "evidence-time";

export const CATEGORIES: Array<{ id: CategoryId; label: string; blurb: string }> = [
  { id: "people-places", label: "Organisations, people and places", blurb: "Who and where: organisations, teams, roles, stakeholders, places and infrastructure." },
  { id: "flows-environment", label: "Physical flows, environment and resources", blurb: "What moves and what surrounds: traffic, weather, energy, materials, equipment, output." },
  { id: "dynamics", label: "Organisational and human dynamics", blurb: "How people work together: culture, trust, tension, workload, decisions, dependencies." },
  { id: "money-goals-risk", label: "Money, goals, risks and decisions", blurb: "Cash, budgets, goals, risks, problems, interventions and pathways." },
  { id: "evidence-time", label: "Evidence, uncertainty and time", blurb: "Sources, confidence, missing or conflicting evidence, staleness, milestones, permissions." },
];

/** Canvas building shapes understood by the isometric world-map engine. */
export type EngineShape =
  | "factory" | "hq" | "townhall" | "fund" | "office" | "warehouse" | "farm" | "lab"
  | "tower" | "civic" | "shop" | "homes" | "yard" | "port" | "school" | "care"
  | "pavilion" | "city-amsterdam" | "city-london" | "city-paris" | "city-berlin" | "city-brussels" | "city-milan" | "city-warsaw" | "city-valencia" | "city-vienna" | "city-copenhagen";

/** Default map layer for an element. */
export type Layer = "macro" | "beyond" | "earth" | "force" | "list";

export interface ElementType {
  id: string;
  label: string;
  category: CategoryId;
  /** The recognisable base visual (from the spec's "Base visual cue" column). */
  cue: string;
  glyph: GlyphId;
  states: StateDef[];
  /** Rule reminder shown next to the element wherever it is edited or inspected. */
  rule?: string;
  /** Where it sits on the world map by default. */
  layer: Layer;
  /** Building shape used when the element is drawn on the canvas (macro / beyond). */
  engineShape?: EngineShape;
  /** For `beyond` elements: engine "far" kind. For `earth`: engine global kind. */
  engineKind?: string;
  /** This element needs an attributed holder (whose view it is). */
  attributed?: boolean;
}

export type GlyphId =
  | "building" | "ring" | "team" | "person" | "external" | "community" | "customer" | "supplier" | "city"
  | "district" | "facility" | "home" | "care-home" | "school" | "ward" | "vehicle" | "road" | "tree"
  | "river" | "traffic" | "thermometer" | "flood" | "rain" | "drought" | "canopy" | "air" | "energy"
  | "material" | "machine" | "throughput" | "stock" | "rework" | "goods" | "service-flow" | "queue"
  | "product" | "testing" | "culture" | "trust" | "tension" | "alignment" | "sentiment" | "voice"
  | "speak-up" | "workload" | "staffing" | "skills" | "capacity" | "decision" | "ownership" | "incentive"
  | "handover" | "dependency" | "relationship" | "bottleneck" | "capability" | "readiness" | "cash"
  | "budget" | "funding" | "cost" | "revenue" | "demand" | "price" | "goal" | "impact" | "risk"
  | "problem" | "fire" | "early-warning" | "opportunity" | "intervention" | "pathway" | "trade-off"
  | "regulation" | "driver" | "indicator" | "document" | "missing-evidence" | "conflict" | "coverage"
  | "stale" | "ripple" | "milestone" | "permission";

// ─── state helpers ─────────────────────────────────────────────────────

const S = (id: string, label: string, t: Treatment, cue?: string): StateDef => ({ id, label, t, cue });
const solid = (tone: Tone = "neutral", extra: Treatment = {}): Treatment => ({ outline: "solid", fill: "solid", tone, ...extra });
const outlined = (extra: Treatment = {}): Treatment => ({ outline: "dashed", fill: "none", tone: "proposed", ...extra });
const dotted = (extra: Treatment = {}): Treatment => ({ outline: "dotted", fill: "none", tone: "neutral", ...extra });
const muted = (extra: Treatment = {}): Treatment => ({ outline: "solid", fill: "muted", tone: "neutral", ...extra });
const badge = (b: BadgeId, tone: Tone = "neutral", extra: Treatment = {}): Treatment => ({ outline: "solid", fill: "solid", tone, badge: b, ...extra });
const level = (l: number, tone: Tone = "neutral", extra: Treatment = {}): Treatment => ({ outline: "solid", fill: "solid", tone, level: l, ...extra });
const count = (n: number, tone: Tone = "neutral", extra: Treatment = {}): Treatment => ({ outline: "solid", fill: "solid", tone, count: n, ...extra });

/** Unknown — added to every element. Grey, dashed, "?" — never green, low, safe or zero. */
export const UNKNOWN_STATE: StateDef = S("unknown", "Unknown", { outline: "dashed", fill: "none", badge: "question", tone: "unknown" }, "Dashed outline with a question mark. Missing information is shown as unknown — not low, safe, zero or green.");

type Def = Omit<ElementType, "states"> & { states: StateDef[] };
const E = (d: Def): ElementType => ({ ...d, states: [UNKNOWN_STATE, ...d.states] });

// ─── 1. Organisations, people and places ──────────────────────────────

const PEOPLE_PLACES: ElementType[] = [
  E({ id: "organisation", label: "Organisation / institution", category: "people-places", cue: "Distinctive building with its name", glyph: "building", layer: "macro", engineShape: "hq",
    states: [S("operating", "Operating", solid(), "Complete building"), S("proposed", "Proposed", outlined(), "Outline only"), S("inactive", "Inactive", muted(), "Muted, with label")] }),
  E({ id: "portfolio", label: "Portfolio / group", category: "people-places", cue: "Large ring containing smaller holdings", glyph: "ring", layer: "macro", engineShape: "fund",
    states: [S("full-coverage", "All holdings shown", solid()), S("partial-coverage", "Partial coverage", { outline: "dotted", fill: "none", tone: "neutral", level: 0.35 }, "Labelled partial ring — state the numerator / denominator")],
    rule: "A partial ring shows which holdings are covered; it is not the whole portfolio." }),
  E({ id: "team", label: "Department / team", category: "people-places", cue: "Small grouped figures or a labelled pod", glyph: "team", layer: "list",
    states: [S("active", "Active", solid()), S("proposed", "Proposed", outlined(), "Outline only — proposed, not yet formed or approved"), S("forming", "Being formed", outlined()), S("constrained", "Constrained", badge("warning", "caution"), "Filled, with a workload overlay")] }),
  E({ id: "role", label: "Role / decision owner", category: "people-places", cue: "Single neutral silhouette with a role label", glyph: "person", layer: "list",
    states: [S("assigned", "Assigned", { outline: "solid", fill: "none", tone: "neutral" }), S("unassigned", "Owner needed", { outline: "dashed", fill: "none", tone: "caution", badge: "question" }, "Empty outline, “owner needed”"), S("multiple", "Multiple roles", badge("plus"), "Group icon")],
    rule: "A role, not a real person. Never score or rate individuals." }),
  E({ id: "external-stakeholder", label: "External stakeholder / partner", category: "people-places", cue: "Person or building outside the organisation boundary", glyph: "external", layer: "macro", engineShape: "office",
    states: [S("engaged", "Engaged", solid()), S("proposed", "Proposed", outlined()), S("unavailable", "Unavailable", badge("pause", "caution"), "Paused connection")] }),
  E({ id: "community", label: "Residents / community", category: "people-places", cue: "Small group of diverse abstract figures", glyph: "community", layer: "macro", engineShape: "homes",
    states: [S("represented", "Represented", solid()), S("partially-represented", "Partially represented", dotted()), S("not-heard", "Not yet heard", { outline: "dashed", fill: "none", tone: "caution", badge: "question" })],
    rule: "Consultation markers describe whose voice is represented — never individual faces or feelings." }),
  E({ id: "customer", label: "Customer / buyer", category: "people-places", cue: "Storefront with a receipt", glyph: "customer", layer: "macro", engineShape: "shop",
    states: [S("prospect", "Prospect", dotted()), S("negotiating", "Negotiating", badge("speech")), S("signed", "Agreement signed", badge("check", "positive")), S("delivered", "Order delivered", badge("package", "positive"))] }),
  E({ id: "supplier", label: "Supplier / provider", category: "people-places", cue: "Warehouse linked to the customer", glyph: "supplier", layer: "macro", engineShape: "warehouse",
    states: [S("available", "Available", solid()), S("qualification-pending", "Qualification pending", dotted()), S("disrupted", "Disruption", badge("broken", "negative"), "Broken-link overlay")] }),
  E({ id: "city", label: "City / municipality", category: "people-places", cue: "Compact city silhouette inside a boundary", glyph: "city", layer: "macro", engineShape: "townhall",
    states: [S("established", "Established", solid()), S("planned-development", "Planned development", outlined()), S("active-works", "Active works", badge("scaffold", "caution"))] }),
  E({ id: "district", label: "Neighbourhood / district", category: "people-places", cue: "Labelled cluster of streets and buildings", glyph: "district", layer: "macro", engineShape: "homes",
    states: [S("few-affected", "Few locations affected", count(1)), S("more-affected", "More locations affected", count(3)), S("partial-evidence", "Partial evidence", { outline: "dotted", fill: "solid", tone: "neutral", count: 2 }, "Labelled boundary — evidence covers part of the area")] }),
  E({ id: "facility", label: "Facility / site", category: "people-places", cue: "Building matched to type (factory, office, school …)", glyph: "facility", layer: "macro", engineShape: "factory",
    states: [S("operating", "Operating", solid()), S("under-construction", "Under construction", badge("scaffold", "caution")), S("unavailable", "Temporarily unavailable", badge("pause", "caution"))] }),
  E({ id: "home", label: "Home / housing", category: "people-places", cue: "Simple house", glyph: "home", layer: "macro", engineShape: "homes",
    states: [S("accessible", "Accessible", solid()), S("access-disrupted", "Access disrupted", badge("barrier", "caution")), S("support-proposed", "Support proposed", outlined())] }),
  E({ id: "care-home", label: "Care home", category: "people-places", cue: "Care building", glyph: "care-home", layer: "macro", engineShape: "care",
    states: [S("accessible", "Accessible", solid()), S("access-disrupted", "Access disrupted", badge("barrier", "caution")), S("support-proposed", "Support proposed", outlined())] }),
  E({ id: "school", label: "School", category: "people-places", cue: "School building with a flag", glyph: "school", layer: "macro", engineShape: "school",
    states: [S("accessible", "Accessible", solid()), S("access-disrupted", "Access disrupted", badge("barrier", "caution")), S("support-proposed", "Support proposed", outlined())] }),
  E({ id: "ward", label: "Ward / care service", category: "people-places", cue: "Bed cluster", glyph: "ward", layer: "macro", engineShape: "care",
    states: [S("staffed", "Staffed beds", level(1), "Filled beds = staffed capacity"), S("partly-staffed", "Some beds unstaffed", level(0.5, "caution"), "Unstaffed beds outlined"), S("unavailable", "Service unavailable", badge("pause", "caution"))],
    rule: "Use staffed capacity, not physical beds, when the source says so." }),
  E({ id: "vehicle", label: "Vehicle / transport service", category: "people-places", cue: "Small bus or van on a route", glyph: "vehicle", layer: "macro", engineShape: "yard",
    states: [S("running", "Running", solid("neutral", { motion: "flow" })), S("delayed", "Delayed", badge("clock", "caution")), S("unavailable", "Unavailable", badge("cross", "negative"))] }),
  E({ id: "road", label: "Road / route", category: "people-places", cue: "Road with lane markings", glyph: "road", layer: "macro", engineShape: "yard",
    states: [S("open", "Open", solid()), S("works", "Works", badge("barrier", "caution")), S("limited", "Access limited", badge("broken", "caution")), S("alternative", "Alternative route", outlined(), "Outlined detour")] }),
  E({ id: "green-space", label: "Land / green space", category: "people-places", cue: "Tree, park patch or canopy", glyph: "tree", layer: "macro", engineShape: "farm",
    states: [S("existing", "Existing", solid()), S("planned", "Planned", outlined()), S("maintenance-uncertain", "Maintenance uncertain", badge("question", "caution"))] }),
  E({ id: "river", label: "River / drainage", category: "people-places", cue: "River line, drain or rain garden", glyph: "river", layer: "macro", engineShape: "yard",
    states: [S("normal", "Normal flow", level(0.35, "neutral", { motion: "flow" })), S("rising", "Rising water", level(0.85, "caution")), S("blocked", "Blocked", badge("barrier", "negative")), S("modelled-exposure", "Modelled exposure", { outline: "dotted", fill: "hatched", tone: "scenario" }, "Hatched area — a model, not an event")] }),
];

// ─── 2. Physical flows, environment and infrastructure ────────────────

const FLOWS: ElementType[] = [
  E({ id: "traffic", label: "Road traffic", category: "flows-environment", cue: "Small cars travelling along a road", glyph: "traffic", layer: "list",
    states: [S("light", "Light", count(2, "neutral", { motion: "flow" })), S("moderate", "Moderate", count(4, "neutral", { motion: "flow" })), S("heavy", "Heavy", count(7, "caution", { motion: "flow" })), S("queue", "Stationary queue", count(7, "caution", { badge: "pause" }))],
    rule: "The number of cars represents a band, not an exact vehicle count." }),
  E({ id: "heat", label: "Temperature / heat", category: "flows-environment", cue: "Thermometer beside a place", glyph: "thermometer", layer: "earth", engineKind: "climate",
    states: [S("cooler", "Cooler", level(0.25)), S("warmer", "Warmer", level(0.6, "caution")), S("hotter", "Hotter", level(0.9, "negative")), S("heat-event", "Heat event", level(0.9, "negative", { badge: "sun" }))],
    rule: "Show °C and period where known. Bands are case-specific." }),
  E({ id: "flooding", label: "Flooding / surface water", category: "flows-environment", cue: "Waterline around the affected area", glyph: "flood", layer: "earth", engineKind: "climate",
    states: [S("dry", "Dry", { outline: "solid", fill: "none", tone: "neutral", level: 0 }), S("exposure", "Elevated exposure", { outline: "dotted", fill: "hatched", tone: "caution", level: 0.5 }, "Hatched outline — exposure, not an event"), S("active", "Active flooding", level(0.75, "negative"))] }),
  E({ id: "rainfall", label: "Rainfall / storm", category: "flows-environment", cue: "Cloud with falling drops", glyph: "rain", layer: "earth", engineKind: "climate",
    states: [S("light", "Light", count(3)), S("heavy", "Heavy", count(8, "caution")), S("disruption", "Disrupting routes", count(8, "negative", { badge: "barrier" }))] }),
  E({ id: "drought", label: "Drought / water constraint", category: "flows-environment", cue: "Water droplet with a reservoir gauge", glyph: "drought", layer: "earth", engineKind: "biodiversity",
    states: [S("available", "Available", level(0.9)), S("constrained", "Constrained", level(0.45, "caution")), S("very-constrained", "Very constrained", level(0.15, "negative"))] }),
  E({ id: "canopy", label: "Shade / tree canopy", category: "flows-environment", cue: "Tree casting a visible shadow", glyph: "canopy", layer: "list",
    states: [S("low", "Low canopy", level(0.3)), S("medium", "Medium canopy", level(0.6)), S("high", "High canopy", level(1))], rule: "Tie bands to a stated measure." }),
  E({ id: "air-quality", label: "Air pollution / air quality", category: "flows-environment", cue: "Air swirl with a small monitor", glyph: "air", layer: "earth", engineKind: "pollution",
    states: [S("lower", "Lower measured level", count(2)), S("higher", "Higher measured level", count(7, "caution"))],
    rule: "Show pollutant, reading and location — not a health diagnosis." }),
  E({ id: "energy", label: "Electricity / energy", category: "flows-environment", cue: "Lightning bolt with a supply line", glyph: "energy", layer: "list",
    states: [S("available", "Available", solid()), S("constrained", "Constrained", { outline: "dashed", fill: "solid", tone: "caution" }, "Intermittent line"), S("outage", "Outage", badge("broken", "negative"))], rule: "Price is a separate € tag." }),
  E({ id: "material", label: "Material / feedstock", category: "flows-environment", cue: "Stack of material pieces", glyph: "material", layer: "list",
    states: [S("available", "Available", level(1)), S("limited", "Limited", level(0.4, "caution")), S("quality-uncertain", "Quality uncertain", level(0.7, "neutral", { badge: "question" })), S("delivered", "Delivered", level(1, "positive", { badge: "package" }))] }),
  E({ id: "machine", label: "Machine / equipment", category: "flows-environment", cue: "Machine with a conveyor", glyph: "machine", layer: "list",
    states: [S("running", "Running", solid("neutral", { motion: "flow" })), S("awaiting-installation", "Waiting for installation", outlined({ badge: "clock" })), S("delayed", "Delayed", badge("clock", "caution")), S("unavailable", "Unavailable", badge("pause", "caution"))] }),
  E({ id: "throughput", label: "Production / throughput", category: "flows-environment", cue: "Conveyor carrying product squares", glyph: "throughput", layer: "list",
    states: [S("lower", "Lower throughput", count(2, "neutral", { motion: "flow" })), S("higher", "Higher throughput", count(5, "neutral", { motion: "flow" })), S("bottleneck", "Bottleneck", count(5, "caution", { badge: "warning" }), "Queue before a narrow point")] }),
  E({ id: "stock", label: "Stock / warehouse", category: "flows-environment", cue: "Shelves with boxes", glyph: "stock", layer: "list",
    states: [S("low", "Low", level(0.2, "caution")), S("sufficient", "Sufficient", level(0.6)), S("full", "Full", level(1))], rule: "Shelf fill follows stock bands defined for this case." }),
  E({ id: "rework", label: "Waste / rework", category: "flows-environment", cue: "Circular arrow beside material or product", glyph: "rework", layer: "list",
    states: [S("less", "Less recorded rework", count(1)), S("more", "More recorded rework", count(3, "caution"))], rule: "Show the trial or sample scope." }),
  E({ id: "goods", label: "Goods / deliveries", category: "flows-environment", cue: "Package moving along a connection", glyph: "goods", layer: "list",
    states: [S("planned", "Planned", outlined()), S("in-transit", "In transit", solid("neutral", { motion: "flow" })), S("delayed", "Delayed", badge("clock", "caution")), S("received", "Received", badge("check", "positive"))] }),
  E({ id: "service-flow", label: "Patients / service flow", category: "flows-environment", cue: "Neutral moving dots between service stages", glyph: "service-flow", layer: "list",
    states: [S("smooth", "Smooth", count(3, "neutral", { motion: "flow" })), S("queued", "Queued at handover", count(6, "caution"))], rule: "Aggregate process data only — never patient-level." }),
  E({ id: "queue", label: "Queue / waiting", category: "flows-environment", cue: "Short row of dots in front of a node", glyph: "queue", layer: "list",
    states: [S("short", "Short wait", count(2)), S("longer", "Longer wait", count(5, "caution")), S("blocked", "Blocked", count(5, "negative", { badge: "barrier" }))] }),
  E({ id: "product", label: "Product / output", category: "flows-environment", cue: "Named product icon", glyph: "product", layer: "list",
    states: [S("prototype", "Prototype", outlined()), S("testing", "Testing", badge("magnifier")), S("approved", "Approved", badge("check", "positive")), S("delivery-pending", "Delivery pending", badge("clock", "caution"))],
    rule: "Show “approved” only when approval is evidenced." }),
  E({ id: "testing", label: "Quality / testing", category: "flows-environment", cue: "Magnifier over a test card", glyph: "testing", layer: "list",
    states: [S("not-started", "Not started", outlined()), S("in-progress", "In progress", badge("dots")), S("passed", "Passed (stated test)", badge("check", "positive")), S("unresolved", "Unresolved", badge("question", "caution")), S("failed", "Failed (with scope)", badge("cross", "negative"))] }),
];

// ─── 3. Organisational and human dynamics ─────────────────────────────

const DYNAMICS: ElementType[] = [
  E({ id: "culture", label: "Culture", category: "dynamics", cue: "Pattern around a group with a short descriptive label", glyph: "culture", layer: "force", attributed: true,
    states: [S("described", "Described (supported)", solid()), S("mixed", "Mixed views", dotted({ badge: "speech" }), "Mixed views can coexist")],
    rule: "Change the pattern or label only when evidence supports it." }),
  E({ id: "trust", label: "Trust", category: "dynamics", cue: "Two figures connected by a bridge", glyph: "trust", layer: "force", attributed: true,
    states: [S("reported-strong", "Reported stronger trust", solid()), S("reported-strained", "Reported strained trust", badge("broken", "caution"))], rule: "Attributed label required. Unknown = dotted bridge." }),
  E({ id: "tension", label: "Tension / friction", category: "dynamics", cue: "Small zigzag on a relationship", glyph: "tension", layer: "force", attributed: true,
    states: [S("mild", "Mild reported friction", count(2, "caution")), S("significant", "Significant reported friction", count(4, "negative")), S("unresolved", "Unresolved differences", badge("speech", "caution"), "Two labelled viewpoints")] }),
  E({ id: "alignment", label: "Alignment / disagreement", category: "dynamics", cue: "Two arrows indicating direction", glyph: "alignment", layer: "force", attributed: true,
    states: [S("aligned", "Aligned", { outline: "solid", fill: "solid", tone: "neutral", level: 0 }), S("differing", "Differing priorities", { outline: "solid", fill: "solid", tone: "caution", level: 1 }), S("unresolved", "Unresolved", badge("question", "caution"))],
    rule: "Agreement is not the absence of dissent." }),
  E({ id: "sentiment", label: "Sentiment / emotion (attributed)", category: "dynamics", cue: "Speech bubble with a named, attributed sentiment", glyph: "sentiment", layer: "force", attributed: true,
    states: [S("concern", "Reported concern", solid("caution")), S("excitement", "Reported excitement", solid()), S("uncertain", "Reported uncertainty", dotted()), S("mixed", "Mixed views", dotted({ badge: "speech" }))],
    rule: "Only show sentiment stated by an identified group or source. Never infer an individual's emotions." }),
  E({ id: "voice", label: "Voice / participation", category: "dynamics", cue: "Speech bubble with a group label", glyph: "voice", layer: "list", attributed: true,
    states: [S("heard", "Heard", solid()), S("partially-heard", "Partially heard", dotted()), S("missing", "Missing perspective", { outline: "dashed", fill: "none", tone: "caution", badge: "question" })], rule: "Show sample coverage." }),
  E({ id: "speaking-up", label: "Speaking up / psychological safety", category: "dynamics", cue: "Open speech bubble with a small shield", glyph: "speak-up", layer: "list", attributed: true,
    states: [S("reported-concern", "Reported concern", badge("warning", "caution")), S("supportive", "Supportive conditions reported", badge("check"))], rule: "No individual score. Insufficient evidence = unknown." }),
  E({ id: "workload", label: "Workload / pressure", category: "dynamics", cue: "Stack of tasks on a team", glyph: "workload", layer: "list",
    states: [S("lower", "Lower reported load", level(0.3)), S("higher", "Higher reported load", level(0.7, "caution")), S("overload", "Overload reported", level(1, "negative", { badge: "warning" }))], rule: "Survey-based where applicable; aggregate only." }),
  E({ id: "staffing", label: "Staffing / vacancies", category: "dynamics", cue: "Row of role silhouettes (roles, not individuals)", glyph: "staffing", layer: "list",
    states: [S("filled", "Roles filled", solid()), S("vacant", "Vacant roles", { outline: "solid", fill: "none", tone: "caution" }), S("planned-hire", "Planned hire", outlined())], rule: "Keep counts labelled." }),
  E({ id: "skills", label: "Skills / training readiness", category: "dynamics", cue: "Skill card", glyph: "skills", layer: "list",
    states: [S("needed", "Needed", outlined()), S("scheduled", "Scheduled", badge("calendar")), S("completed", "Completed", badge("check", "positive"))], rule: "Coverage as a labelled fraction if known." }),
  E({ id: "capacity", label: "Capacity / availability", category: "dynamics", cue: "Capacity gauge or container", glyph: "capacity", layer: "list",
    states: [S("spare", "Spare", level(0.3)), S("constrained", "Constrained", level(0.75, "caution")), S("full", "Full", level(1, "negative")), S("unavailable", "Unavailable", badge("pause", "caution"))], rule: "State the unit and period." }),
  E({ id: "decision", label: "Decision / approval", category: "dynamics", cue: "Diamond with a check box", glyph: "decision", layer: "list",
    states: [S("open", "Open", outlined()), S("pending", "Pending", badge("clock", "caution")), S("approved", "Approved", badge("check", "positive")), S("declined", "Declined", badge("cross", "negative")), S("blocked", "Blocked", badge("barrier", "negative"))] }),
  E({ id: "ownership", label: "Ownership / responsibility", category: "dynamics", cue: "Key or flag attached to a role", glyph: "ownership", layer: "list",
    states: [S("clear", "Clear owner", solid()), S("unresolved", "Unresolved", badge("question", "caution")), S("disputed", "Disputed (two claims)", badge("speech", "caution"))], rule: "No inference of authority." }),
  E({ id: "incentive", label: "Incentive / target", category: "dynamics", cue: "Target symbol", glyph: "incentive", layer: "list",
    states: [S("reinforcing", "Reinforcing targets", { outline: "solid", fill: "solid", tone: "neutral", level: 0 }), S("conflicting", "Conflicting targets", { outline: "solid", fill: "solid", tone: "caution", level: 1 })], rule: "No automatic judgement." }),
  E({ id: "handover", label: "Handover / coordination", category: "dynamics", cue: "Arrows between teams", glyph: "handover", layer: "list",
    states: [S("clear", "Clear", solid()), S("delayed", "Delayed", badge("clock", "caution")), S("incomplete", "Incomplete", badge("broken", "caution")), S("proposed", "Proposed improvement", outlined())] }),
  E({ id: "bottleneck", label: "Bottleneck", category: "dynamics", cue: "Narrow passage or pinch point", glyph: "bottleneck", layer: "list",
    states: [S("flowing", "Flowing", level(1)), S("constrained", "Constrained", level(0.4, "caution", { badge: "dots" })), S("blocked", "Blocked", level(0.1, "negative", { badge: "barrier" }))], rule: "Say why, and whether observed or hypothesised." }),
  E({ id: "capability", label: "Capability / strength", category: "dynamics", cue: "Star attached to a node", glyph: "capability", layer: "list",
    states: [S("available", "Available", solid()), S("emerging", "Emerging", outlined()), S("needs-support", "Needs support", badge("plus", "caution"))], rule: "Show what supports the designation." }),
  E({ id: "readiness", label: "Change readiness", category: "dynamics", cue: "Checklist attached to a team or intervention", glyph: "readiness", layer: "list",
    states: [S("incomplete", "Prerequisites incomplete", level(0.4, "caution")), S("ready-for-review", "Ready for review", level(1))],
    rule: "“Ready for review” means all specified prerequisites are checked — it is not an approval. Not assessed = unknown." }),
];

// ─── 4. Money, goals, risks and decisions ─────────────────────────────

const MONEY: ElementType[] = [
  E({ id: "cash", label: "Cash / available funds", category: "money-goals-risk", cue: "Coin stack with € label", glyph: "cash", layer: "list",
    states: [S("lower", "Lower balance", level(0.3, "caution")), S("higher", "Higher balance", level(0.8)), S("restricted", "Includes restricted funds", level(0.7, "neutral", { badge: "lock" }), "Separate locked compartment")], rule: "Time and amount visible." }),
  E({ id: "budget", label: "Budget / allocation", category: "money-goals-risk", cue: "Segmented budget bar", glyph: "budget", layer: "list",
    states: [S("allocated", "Committed / uncommitted / proposed", level(0.6)), S("overspend", "Overspend", level(1, "negative", { badge: "warning" }), "Extension beyond the outline")] }),
  E({ id: "funding", label: "Funding / grant", category: "money-goals-risk", cue: "Funding document with a coin", glyph: "funding", layer: "list",
    states: [S("proposed", "Proposed", outlined()), S("pending", "Pending", badge("clock", "caution")), S("approved", "Approved", badge("check", "positive")), S("received", "Received", solid("positive"))],
    rule: "Never count proposed money as cash." }),
  E({ id: "cost", label: "Cost / spending", category: "money-goals-risk", cue: "Outgoing coin arrow", glyph: "cost", layer: "list",
    states: [S("lower", "Lower cost", level(0.3)), S("higher", "Higher cost", level(0.9, "caution"))], rule: "Show one-time and recurring separately." }),
  E({ id: "revenue", label: "Revenue / payment", category: "money-goals-risk", cue: "Incoming coin arrow with calendar", glyph: "revenue", layer: "list",
    states: [S("expected", "Expected", dotted()), S("invoiced", "Invoiced", badge("calendar")), S("received", "Received", solid("positive"))], rule: "Show payment timing." }),
  E({ id: "demand", label: "Market demand", category: "money-goals-risk", cue: "Basket with a direction arrow", glyph: "demand", layer: "beyond", engineShape: "shop", engineKind: "city",
    states: [S("falling", "Falling", { outline: "solid", fill: "solid", tone: "neutral", level: 0 }), S("stable", "Stable", { outline: "solid", fill: "solid", tone: "neutral", level: 0.5 }), S("rising", "Rising", { outline: "solid", fill: "solid", tone: "neutral", level: 1 }), S("uncertain", "Uncertain", dotted({ level: 0.5 }))] }),
  E({ id: "price", label: "Price / market volatility", category: "money-goals-risk", cue: "Price tag with a small line", glyph: "price", layer: "list",
    states: [S("lower", "Lower", { outline: "solid", fill: "solid", tone: "neutral", level: 0 }), S("stable", "Stable", { outline: "solid", fill: "solid", tone: "neutral", level: 0.5 }), S("higher", "Higher", { outline: "solid", fill: "solid", tone: "caution", level: 1 }), S("volatile", "More volatile", count(4, "caution"))], rule: "State the period." }),
  E({ id: "goal", label: "Goal / target", category: "money-goals-risk", cue: "Flag at the end of a path", glyph: "goal", layer: "list",
    states: [S("not-started", "Not started", outlined()), S("in-progress", "In progress", level(0.5)), S("achieved", "Achieved (evidenced)", badge("check", "positive"))], rule: "Target date labelled; “achieved” only when evidenced." }),
  E({ id: "impact", label: "Impact / intended benefit", category: "money-goals-risk", cue: "Leaf beside a goal", glyph: "impact", layer: "earth", engineKind: "biodiversity",
    states: [S("intended", "Intended", outlined()), S("emerging", "Evidence emerging", level(0.5)), S("supported", "Supported (with source)", solid()), S("unverified", "Unverified", badge("question", "caution"))] }),
  E({ id: "risk", label: "Risk / possible future harm", category: "money-goals-risk", cue: "Warning triangle next to the affected element", glyph: "risk", layer: "list",
    states: [S("identified", "Possible risk identified", solid("caution")), S("assessed-lower", "Assessed lower severity", count(1, "caution")), S("assessed-higher", "Assessed higher severity", count(3, "negative"))],
    rule: "A triangle means possible risk, not an event already happening. Severity bars only where assessed." }),
  E({ id: "active-problem", label: "Active problem / incident", category: "money-goals-risk", cue: "Small flame (metaphor) labelled “active problem”", glyph: "problem", layer: "list",
    states: [S("current", "Current confirmed problem", solid("negative")), S("resolved", "Resolved", badge("check")), S("hypothetical", "Scenario problem (illustrative)", { outline: "dashed", fill: "none", tone: "scenario" })],
    rule: "The flame is a problem metaphor — never confuse with literal fire." }),
  E({ id: "literal-fire", label: "Literal fire / wildfire", category: "money-goals-risk", cue: "Flame placed on a specific site or landscape", glyph: "fire", layer: "earth", engineKind: "climate",
    states: [S("observed", "Observed fire", solid("negative")), S("exposure", "Wildfire exposure", { outline: "dashed", fill: "none", tone: "caution" }), S("scenario", "Fire scenario (illustrative)", { outline: "dotted", fill: "hatched", tone: "scenario" })],
    rule: "Literal fire is labelled “Fire (literal)” and kept distinct from the problem metaphor." }),
  E({ id: "early-warning", label: "Early-warning signal", category: "money-goals-risk", cue: "Bell beside a risk", glyph: "early-warning", layer: "list",
    states: [S("monitoring", "Monitoring", outlined({ tone: "neutral" })), S("threshold-met", "Stated threshold met", solid("caution"))], rule: "The threshold must be stated." }),
  E({ id: "opportunity", label: "Opportunity / leverage", category: "money-goals-risk", cue: "Small spark beside an element", glyph: "opportunity", layer: "list",
    states: [S("identified", "Identified idea", outlined({ tone: "neutral" })), S("being-tested", "Being tested", dotted()), S("supported", "Supported strength", solid())] }),
  E({ id: "intervention", label: "Intervention / action", category: "money-goals-risk", cue: "Wrench on the affected connection", glyph: "intervention", layer: "list",
    states: [S("proposed", "Proposed", outlined()), S("approved", "Approved", badge("check")), S("underway", "Underway", level(0.5)), S("completed", "Completed", badge("check", "positive"))], rule: "Effectiveness is shown separately." }),
  E({ id: "pathway", label: "Pathway / option", category: "money-goals-risk", cue: "Coloured route connecting proposed actions", glyph: "pathway", layer: "list",
    states: [S("alternative", "Alternative", dotted()), S("selected", "Selected", solid()), S("not-selected", "Not selected", muted())], rule: "Future results are marked illustrative." }),
  E({ id: "trade-off", label: "Trade-off", category: "money-goals-risk", cue: "Balance scale with named sides", glyph: "trade-off", layer: "list",
    states: [S("named", "Named sides", { outline: "solid", fill: "solid", tone: "neutral", level: 0.5 }), S("shifted", "Shifted (explicit basis)", { outline: "solid", fill: "solid", tone: "neutral", level: 0.85 })], rule: "Shift only when the comparison has an explicit basis." }),
  E({ id: "regulation", label: "Regulation / governance", category: "money-goals-risk", cue: "Document with a label", glyph: "regulation", layer: "beyond", engineShape: "civic", engineKind: "institution",
    states: [S("relevant", "Relevant to review", solid()), S("review-underway", "Review underway", badge("clock")), S("verified", "Obligation verified (after review)", badge("check")), S("uncertain", "Uncertain", badge("question", "caution"))], rule: "A checklist, not legal advice." }),
  E({ id: "external-driver", label: "External driver", category: "money-goals-risk", cue: "Globe — a contextual force", glyph: "driver", layer: "earth", engineKind: "climate",
    states: [S("contextual", "Contextual driver", solid())] }),
  E({ id: "indicator", label: "Indicator / projection", category: "money-goals-risk", cue: "Gauge for a measured value; dotted continuation for a projection", glyph: "indicator", layer: "list",
    states: [S("measured", "Measured (value + unit + date)", level(0.6)), S("projection", "Projection (illustrative)", { outline: "dashed", fill: "hatched", tone: "scenario", level: 0.6 })], rule: "Projections show their assumptions." }),
];

// ─── 5. Evidence, uncertainty and map-wide states ─────────────────────

const EVIDENCE: ElementType[] = [
  E({ id: "evidence", label: "Evidence / source document", category: "evidence-time", cue: "Small document attached to a claim or node", glyph: "document", layer: "list",
    states: [S("available", "Available", solid()), S("new", "Newly added", solid("neutral", { badge: "plus" })), S("failed", "Processing failed", badge("retry", "caution"))] }),
  E({ id: "missing-evidence", label: "Missing evidence / signal", category: "evidence-time", cue: "Empty document outline with a question mark", glyph: "missing-evidence", layer: "list",
    states: [S("missing", "Missing", { outline: "dashed", fill: "none", tone: "caution", badge: "question" }), S("requested", "Requested", outlined({ badge: "clock", tone: "neutral" })), S("supplied", "Supplied (linked)", solid())],
    rule: "Uploading a document does not automatically resolve a gap." }),
  E({ id: "conflicting-accounts", label: "Conflicting accounts", category: "evidence-time", cue: "Two labelled speech bubbles with opposing arrows", glyph: "conflict", layer: "list",
    states: [S("unresolved", "Different accounts", solid("caution")), S("reviewed", "Reviewed conclusion", badge("check"))], rule: "A reviewed conclusion only after appropriate human review." }),
  E({ id: "coverage", label: "Source coverage", category: "evidence-time", cue: "Partial ring with numerator / denominator", glyph: "coverage", layer: "list",
    states: [S("partial", "Partial coverage", level(0.35)), S("full", "Full coverage", level(1))], rule: "State population and period explicitly." }),
  E({ id: "stale", label: "Stale information", category: "evidence-time", cue: "Clock beside a value", glyph: "stale", layer: "list",
    states: [S("current", "Current (date shown)", solid()), S("stale", "Stale — last updated shown", badge("clock", "caution"))], rule: "Never silently substitute a newer, incompatible measure." }),
  E({ id: "scenario-effect", label: "Scenario effect / ripple", category: "evidence-time", cue: "Subtle wave along affected connections", glyph: "ripple", layer: "list",
    states: [S("changed", "Changed in scenario", { outline: "dotted", fill: "hatched", tone: "scenario", motion: "flow" }), S("unchanged", "Unchanged", { outline: "solid", fill: "none", tone: "neutral" })], rule: "Scenario banner stays visible; unchanged nodes stay neutral." }),
  E({ id: "milestone", label: "Time / milestone", category: "evidence-time", cue: "Calendar tick", glyph: "milestone", layer: "list",
    states: [S("planned", "Planned", outlined()), S("due", "Due", badge("clock")), S("delayed", "Delayed", badge("clock", "caution")), S("completed", "Completed", badge("check", "positive"))], rule: "Estimates retain their assumptions." }),
  E({ id: "permission", label: "Permission / sharing boundary", category: "evidence-time", cue: "Soft boundary with a lock", glyph: "permission", layer: "list",
    states: [S("shared", "Shared", solid()), S("private", "Private", badge("lock")), S("pending", "Permission pending", outlined({ badge: "lock" }))], rule: "Never expose private material in a visual or tooltip." }),
];

export const ELEMENT_TYPES: ElementType[] = [...PEOPLE_PLACES, ...FLOWS, ...DYNAMICS, ...MONEY, ...EVIDENCE];

const BY_ID: Record<string, ElementType> = Object.fromEntries(ELEMENT_TYPES.map((e) => [e.id, e]));

export function getElementType(id: string | undefined | null): ElementType | undefined {
  return id ? BY_ID[id] : undefined;
}

export function getState(typeId: string | undefined | null, stateId: string | undefined | null): StateDef {
  const et = getElementType(typeId);
  if (!et || !stateId) return UNKNOWN_STATE;
  return et.states.find((s) => s.id === stateId) ?? UNKNOWN_STATE;
}

// ─── overlays ──────────────────────────────────────────────────────────

export interface OverlayDef {
  id: string;
  label: string;
  /** Badge glyph drawn on the node / edge. */
  badge: BadgeId;
  tone: Tone;
  meaning: string;
  attachTo: Array<"node" | "edge" | "area">;
}

export const OVERLAYS: OverlayDef[] = [
  { id: "possible-risk", label: "Possible risk", badge: "warning", tone: "caution", meaning: "Warning triangle: a possible future harm, not an event already happening.", attachTo: ["node", "edge", "area"] },
  { id: "active-problem", label: "Active problem", badge: "flame", tone: "negative", meaning: "Flame used as a metaphor for a confirmed, current problem. Not a literal fire.", attachTo: ["node", "edge"] },
  { id: "scenario-problem", label: "Scenario problem (illustrative)", badge: "flame-outline", tone: "scenario", meaning: "Outlined flame: a problem that appears only in an illustrative scenario.", attachTo: ["node", "edge"] },
  { id: "problem-resolved", label: "Problem resolved", badge: "check", tone: "positive", meaning: "A previously active problem has been resolved.", attachTo: ["node", "edge"] },
  { id: "literal-fire", label: "Fire (literal)", badge: "flame", tone: "negative", meaning: "An actual fire on a site or landscape — labelled separately from the problem metaphor.", attachTo: ["node", "area"] },
  { id: "early-warning", label: "Early-warning signal", badge: "bell", tone: "caution", meaning: "A stated threshold is being monitored or has been met.", attachTo: ["node"] },
  { id: "delay", label: "Delay", badge: "clock", tone: "caution", meaning: "Something is later than planned.", attachTo: ["node", "edge"] },
  { id: "pending", label: "Pending — not confirmed", badge: "clock", tone: "caution", meaning: "Discussed, requested or expected, but not yet confirmed, contracted or in place.", attachTo: ["node", "edge"] },
  { id: "blocked", label: "Blocked", badge: "barrier", tone: "negative", meaning: "Flow or access is blocked.", attachTo: ["node", "edge"] },
  { id: "workload", label: "Workload pressure (reported)", badge: "warning", tone: "caution", meaning: "Reported, aggregate workload pressure on a team.", attachTo: ["node"] },
  { id: "opportunity", label: "Opportunity", badge: "plus", tone: "neutral", meaning: "An identified opportunity or lever.", attachTo: ["node", "edge"] },
  { id: "intervention", label: "Intervention", badge: "plus", tone: "proposed", meaning: "A proposed or active action on this node or connection.", attachTo: ["node", "edge"] },
  { id: "stale", label: "Stale information", badge: "clock", tone: "caution", meaning: "The information is older than its context; the last-updated date is shown.", attachTo: ["node"] },
  { id: "missing-evidence", label: "Missing evidence", badge: "question", tone: "caution", meaning: "Evidence that would change this view is missing.", attachTo: ["node", "edge"] },
  { id: "conflicting-accounts", label: "Different accounts", badge: "speech", tone: "caution", meaning: "Sources or stakeholders disagree; both accounts stay visible.", attachTo: ["node", "edge"] },
  { id: "new-evidence", label: "Newly added evidence", badge: "plus", tone: "neutral", meaning: "A source was just added to the model.", attachTo: ["node"] },
];

export function getOverlay(id: string | undefined | null): OverlayDef | undefined {
  return id ? OVERLAYS.find((o) => o.id === id) : undefined;
}

// ─── connections ───────────────────────────────────────────────────────

export interface ConnectionType {
  id: string;
  label: string;
  /** Arrowhead: who depends on / flows to whom. */
  directed: boolean;
  pattern: "line" | "zigzag" | "bridge" | "flow";
  states: StateDef[];
  rule: string;
}

export const CONNECTION_TYPES: ConnectionType[] = ([
  { id: "relationship", label: "Relationship / influence", directed: false, pattern: "line", rule: "Thickness shows interaction frequency only when it is known. It never proves causality.",
    states: [S("active", "Active", { outline: "solid", tone: "neutral" })] },
  { id: "dependency", label: "Dependency", directed: true, pattern: "line", rule: "Label who depends on what.",
    states: [S("active", "Active", { outline: "solid", tone: "neutral" }), S("uncertain", "Proposed or uncertain", { outline: "dashed", tone: "proposed" }), S("blocked", "Blocked", { outline: "solid", tone: "negative", badge: "barrier" })] },
  { id: "flow", label: "Physical flow / deliveries", directed: true, pattern: "flow", rule: "Moving dashes are decorative; the label carries the meaning.",
    states: [S("flowing", "Flowing", { outline: "solid", tone: "neutral", motion: "flow" }), S("delayed", "Delayed", { outline: "solid", tone: "caution", badge: "clock" }), S("blocked", "Blocked", { outline: "solid", tone: "negative", badge: "barrier" })] },
  { id: "handover", label: "Handover / coordination", directed: true, pattern: "line", rule: "A gap means the handover is incomplete.",
    states: [S("clear", "Clear", { outline: "solid", tone: "neutral" }), S("delayed", "Delayed", { outline: "solid", tone: "caution", badge: "clock" }), S("incomplete", "Incomplete", { outline: "dashed", tone: "caution", badge: "broken" }), S("proposed", "Proposed improvement", { outline: "dashed", tone: "proposed" })] },
  { id: "decision", label: "Decision right / approval", directed: true, pattern: "line", rule: "Shows who decides or approves, as stated by a source.",
    states: [S("clear", "Clear", { outline: "solid", tone: "neutral" }), S("unclear", "Unclear", { outline: "dotted", tone: "caution", badge: "question" })] },
  { id: "information", label: "Information", directed: true, pattern: "line", rule: "Who informs whom.",
    states: [S("regular", "Regular", { outline: "solid", tone: "neutral" }), S("late", "Late", { outline: "solid", tone: "caution", badge: "clock" })] },
  { id: "trust", label: "Trust", directed: false, pattern: "bridge", rule: "Attributed label required. Unknown = dotted bridge.",
    states: [S("reported-strong", "Reported stronger", { outline: "solid", tone: "neutral" }), S("reported-strained", "Reported strained", { outline: "solid", tone: "caution", badge: "broken" })] },
  { id: "tension", label: "Tension / friction", directed: false, pattern: "zigzag", rule: "Show both viewpoints. Friction is reported, not inferred.",
    states: [S("mild", "Mild reported friction", { outline: "solid", tone: "caution", count: 2 }), S("significant", "Significant reported friction", { outline: "solid", tone: "negative", count: 4 })] },
] as ConnectionType[]).map((c) => ({ ...c, states: [{ ...UNKNOWN_STATE, cue: "Neutral dashed line — state not known." }, ...c.states] }));

export function getConnectionType(id: string | undefined | null): ConnectionType {
  return CONNECTION_TYPES.find((c) => c.id === id) ?? CONNECTION_TYPES[0];
}

export type Frequency = "unknown" | "low" | "medium" | "high";
/** Stroke width for a connection. Frequency only changes thickness when it is known. */
export function strokeForFrequency(f: Frequency | undefined): number {
  return f === "high" ? 5 : f === "medium" ? 3.2 : 1.8; // low and unknown share the neutral width
}

// ─── evidence types & confidence ──────────────────────────────────────

export type EvidenceType = "observed" | "synthetic" | "stakeholder" | "assumption" | "illustrative";

export const EVIDENCE_TYPES: Array<{ id: EvidenceType; label: string; pattern: "solid" | "double" | "bubble" | "dashed" | "hatched"; meaning: string }> = [
  { id: "observed", label: "Observed", pattern: "solid", meaning: "Recorded in a source (report, data, document)." },
  { id: "synthetic", label: "Synthetic baseline", pattern: "double", meaning: "Made-up planning data for a demonstration case. Not a real record of any organisation." },
  { id: "stakeholder", label: "Stakeholder view", pattern: "bubble", meaning: "What a named group or person says. Attributed, not universal." },
  { id: "assumption", label: "Assumption", pattern: "dashed", meaning: "Taken as true for this demo; not verified." },
  { id: "illustrative", label: "Illustrative scenario", pattern: "hatched", meaning: "A what-if result — not a validated prediction." },
];

export function getEvidenceType(id: string | undefined | null) {
  return EVIDENCE_TYPES.find((e) => e.id === id);
}

export type ConfidenceLevel = "unknown" | "low" | "medium" | "high";
export const CONFIDENCE_LEVELS: Array<{ id: ConfidenceLevel; label: string; segments: number }> = [
  { id: "unknown", label: "Confidence not stated", segments: 0 },
  { id: "low", label: "Low confidence", segments: 1 },
  { id: "medium", label: "Medium confidence", segments: 2 },
  { id: "high", label: "High confidence", segments: 3 },
];

// ─── tones (paired with text + pattern everywhere) ────────────────────

export const TONE_LABEL: Record<Tone, string> = {
  neutral: "",
  positive: "",
  caution: "",
  negative: "",
  proposed: "Proposed",
  scenario: "Illustrative",
  unknown: "Unknown",
};
