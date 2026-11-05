/**
 * Field definitions for every editable section of a lead case in /prepare.
 * Options that depend on the case (ids of elements, teams, sources, numbers)
 * are computed from the case being edited.
 */
import { CATEGORIES, CONNECTION_TYPES, ELEMENT_TYPES, OVERLAYS, getElementType } from "@/lib/visuals/registry";
import { ORG_TYPES, THEMES } from "@/lib/lead/orgTypes";
import { blankAdjustment, blankComponent, blankConstraint, blankEffect, blankElement, blankFact, blankLedgerCheck, blankMapChange, blankMetric, blankPlanStep, blankRelationship, blankSpot, blankView } from "@/lib/lead/blank";
import type { LeadCase } from "@/lib/lead/types";
import type { FieldDef, Opt } from "./FieldEditor";

type F = FieldDef<any, LeadCase>;

export const EVIDENCE_OPTS: Opt[] = [
  { value: "", label: "Not stated" }, { value: "observed", label: "Observed (in a source)" }, { value: "synthetic", label: "Synthetic baseline (made-up demo data)" }, { value: "stakeholder", label: "Stakeholder view (attributed)" },
  { value: "assumption", label: "Assumption" }, { value: "illustrative", label: "Illustrative scenario" },
];
export const CONF_OPTS: Opt[] = [{ value: "unknown", label: "Not stated" }, { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }];
const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
export const VISUAL_OPTS: Opt[] = ELEMENT_TYPES.map((e) => ({ value: e.id, label: e.label, group: catLabel(e.category) }));
const stateOpts = (_: LeadCase, row: { visual?: string }): Opt[] => (getElementType(row.visual)?.states ?? []).map((s) => ({ value: s.id, label: s.label }));
const OVERLAY_OPTS: Opt[] = OVERLAYS.map((o) => ({ value: o.id, label: o.label, group: o.meaning }));
const targets = (c: LeadCase): Opt[] => [{ value: "org", label: "The organisation" }, ...c.teams.filter((t) => t.name).map((t) => ({ value: t.id, label: t.name, group: "Teams" })), ...c.elements.filter((e) => e.label).map((e) => ({ value: e.id, label: e.label, group: "Elements" }))];
const sourceOpts = (c: LeadCase): Opt[] => c.sources.map((s) => ({ value: s.id, label: `${s.id}${s.title ? " · " + s.title : ""}` }));
const numberOpts = (c: LeadCase): Opt[] => c.numbers.map((n) => ({ value: n.id, label: n.label || n.id }));
/** Targets including elements that only exist while a source, option or scenario is active. */
const anyTargets = (c: LeadCase): Opt[] => {
  const seen = new Set<string>();
  const added = [...c.sources.map((x) => ({ g: `Added by ${x.id}`, a: x.adds })), ...c.pathways.map((x) => ({ g: `Option: ${x.title || x.id}`, a: x.adds })), ...c.scenarios.map((x) => ({ g: "Scenario", a: x.adds }))]
    .flatMap(({ g, a }) => a.elements.filter((e) => e.label).map((e) => ({ value: e.id, label: e.label, group: g })))
    .filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
  return [...targets(c), ...added];
};
const relOpts = (c: LeadCase): Opt[] => c.relationships.map((r) => ({ value: r.id, label: r.label || `${r.from} → ${r.to}`, group: "Connections" }));
const constraintOpts = (c: LeadCase): Opt[] => [{ value: "", label: "—" }, ...(c.planning?.constraints ?? []).map((x) => ({ value: x.id, label: x.label || x.id }))];
const metricOpts = (c: LeadCase): Opt[] => (c.planning?.metrics ?? []).map((x) => ({ value: x.id, label: x.label || x.id }));
const componentOpts = (c: LeadCase): Opt[] => [{ value: "", label: "— none —" }, ...(c.planning?.components ?? []).map((x) => ({ value: x.id, label: x.label || x.id }))];
const SHAPES = ["factory", "hq", "townhall", "fund", "office", "warehouse", "farm", "lab", "tower", "civic", "shop", "homes", "yard", "port", "school", "care", "pavilion",
  "city-amsterdam", "city-london", "city-paris", "city-berlin", "city-brussels", "city-milan", "city-warsaw", "city-valencia", "city-vienna", "city-copenhagen"];
const SHAPE_OPTS: Opt[] = [{ value: "", label: "Default for this type" }, ...SHAPES.map((x) => ({ value: x, label: x.startsWith("city-") ? `City-style · ${x.slice(5)}` : x, group: x.startsWith("city-") ? "City-style offices" : "Buildings" }))];
const months = (label: string, help?: string): F => ({ key: label === "Until month" ? "until" : "from", label, kind: label === "Until month" ? "nullnumber" : "number", min: 0, max: 12, help });

const VIEW_FIELDS: F[] = [
  { key: "text", label: "What they say", kind: "textarea" },
  { key: "holder", label: "Whose view (group or role)", kind: "text", placeholder: "e.g. Production team (survey)" },
  { key: "evidence", label: "Evidence type", kind: "select", options: EVIDENCE_OPTS },
  { key: "sourceIds", label: "Sources", kind: "checks", options: sourceOpts },
];
const EFFECT_FIELDS: F[] = [
  { key: "target", label: "Where it shows", kind: "select", options: targets },
  { key: "label", label: "Short label on the map", kind: "text", placeholder: "e.g. Cash gap · month 3" },
  { key: "tone", label: "Reads as", kind: "select", options: [{ value: "risk", label: "Risk (red pulse)" }, { value: "benefit", label: "Benefit" }, { value: "mixed", label: "Mixed" }, { value: "neutral", label: "Neutral change" }] },
  { key: "direction", label: "Direction (only if known)", kind: "select", options: [{ value: "", label: "Not stated" }, { value: "increase", label: "Increase" }, { value: "decrease", label: "Decrease" }] },
  { key: "overlay", label: "Overlay while shown (optional)", kind: "select", options: [{ value: "", label: "—" }, ...OVERLAYS.map((o) => ({ value: o.id, label: o.label }))] },
];
const SPOT_FIELDS: F[] = [
  { key: "label", label: "Label", kind: "text" },
  { key: "near", label: "Shown near", kind: "select", options: targets },
  months("From month", "0 = now, 12 = one year"),
  months("Until month", "Leave empty if still open at month 12"),
];

export const PRESENTATION_FIELDS: F[] = [
  { key: "orgType", label: "Organisation type (presentation rules)", kind: "select", options: ORG_TYPES.map((o) => ({ value: o.id, label: o.label })), help: "Sets the world look, the building and the map legend. It adds no facts." },
  { key: "theme", label: "World look (optional override)", kind: "select", options: [{ value: "", label: "Use the organisation type's default" }, ...THEMES.map((t) => ({ value: t.id, label: t.label }))] },
  { key: "defaultView", label: "First view of the organisational model", kind: "select", options: [{ value: "", label: "Isometric map" }, { value: "systems", label: "Systems view (labelled connections)" }] },
];

export const CASE_NOTICE_FIELDS: F[] = [
  { key: "caseNotice", label: "Case notice (shown prominently on every demo page; empty = none)", kind: "textarea", help: "e.g. that this is a demonstration case and which parts are synthetic." },
];

export const ORGANISATION_FIELDS: F[] = [
  { key: "name", label: "Organisation name", kind: "text" },
  { key: "sector", label: "Sector", kind: "text" },
  { key: "place", label: "Where it operates", kind: "text" },
  { key: "size", label: "Size", kind: "select", options: [{ value: "", label: "Not stated" }, { value: "1-50", label: "1–50" }, { value: "51-200", label: "51–200" }, { value: "201-1000", label: "201–1,000" }, { value: "1001-5000", label: "1,001–5,000" }, { value: "5000+", label: "5,000+" }] },
  { key: "overview", label: "Overview (2–3 sentences)", kind: "textarea" },
  { key: "context", label: "Context", kind: "textarea" },
  { key: "visual", label: "Building / base visual", kind: "select", options: VISUAL_OPTS.filter((o) => ["organisation", "facility", "portfolio", "city", "care-home", "school", "ward"].includes(o.value)) },
  { key: "state", label: "State", kind: "select", options: stateOpts },
  { key: "shape", label: "Building on the map (optional)", kind: "select", options: SHAPE_OPTS },
];

export const RESPONDENT_FIELDS: F[] = [
  { key: "role", label: "Main contact's role", kind: "text" },
  { key: "accountableFor", label: "What they are accountable for", kind: "textarea" },
  { key: "goals", label: "What they want to be different", kind: "textarea" },
];

export const DECISION_FIELDS: F[] = [
  { key: "question", label: "The decision or challenge (one sentence)", kind: "textarea" },
  { key: "challenge", label: "Why it is hard", kind: "textarea" },
  { key: "objectives", label: "Objectives", kind: "lines" },
  { key: "timeHorizon", label: "Time horizon", kind: "text", placeholder: "e.g. next 12 months" },
  { key: "inScope", label: "In scope (boundaries)", kind: "lines" },
  { key: "outOfScope", label: "Out of scope (boundaries)", kind: "lines" },
  { key: "workingWell", label: "What's already working well", kind: "lines" },
  { key: "underway", label: "Already in flight", kind: "lines" },
  { key: "whereStalls", label: "Where it slows down", kind: "textarea" },
  { key: "rights", label: "Who decides or checks what (say whether proposed or verified)", kind: "lines" },
];

export const INTAKE_FIELDS: F[] = [
  { key: "constraints", label: "What's holding things back", kind: "group", fields: [
    { key: "capacityLimits", label: "Capacity limits", kind: "bool" }, { key: "governanceBottlenecks", label: "Governance bottlenecks", kind: "bool" },
    { key: "decisionLatency", label: "Decision latency", kind: "bool" }, { key: "unclearOwnership", label: "Unclear ownership", kind: "bool" },
  ] },
  { key: "constraintNotes", label: "Anything else worth knowing", kind: "textarea" },
  { key: "externalNotes", label: "External context in the case's own words", kind: "textarea" },
  { key: "external", label: "The world around (leave blank if unknown)", kind: "group", fields: [
    { key: "marketVolatility", label: "Market volatility", kind: "select", options: [{ value: "", label: "Unknown" }, { value: "Low", label: "Low" }, { value: "Medium", label: "Medium" }, { value: "High", label: "High" }] },
    { key: "demandOutlook", label: "Demand outlook", kind: "select", options: [{ value: "", label: "Unknown" }, { value: "Down", label: "Heading down" }, { value: "Stable", label: "Roughly steady" }, { value: "Up", label: "Heading up" }] },
    { key: "regulatoryPressure", label: "Regulatory pressure", kind: "select", options: [{ value: "", label: "Unknown" }, { value: "Low", label: "Low" }, { value: "Medium", label: "Medium" }, { value: "High", label: "High" }] },
    { key: "supplyDisruptionRisk", label: "Supply disruption risk", kind: "select", options: [{ value: "", label: "Unknown" }, { value: "Low", label: "Low" }, { value: "Medium", label: "Medium" }, { value: "High", label: "High" }] },
    { key: "environmentalFactor", label: "Environmental factor", kind: "select", options: [{ value: "", label: "Unknown" }, { value: "none", label: "Nothing pressing" }, { value: "flooding", label: "Flooding" }, { value: "storm", label: "Storm" }, { value: "drought", label: "Drought" }, { value: "heatwave", label: "Heatwave" }] },
  ] },
  { key: "omitSections", label: "Hide intake sections that are not relevant for this lead", kind: "checks", options: [
    { value: "organisation", label: "The organisation" }, { value: "respondent", label: "About you" }, { value: "change", label: "The decision" },
    { value: "people", label: "The people" }, { value: "constraints", label: "What's in the way" }, { value: "world", label: "The world around you" },
  ] },
];

export const NUMBER_FIELDS: F[] = [
  { key: "label", label: "Label", kind: "text", placeholder: "e.g. Available cash" },
  { key: "value", label: "Value (empty = unknown)", kind: "text" },
  { key: "unit", label: "Unit", kind: "text", placeholder: "e.g. € / month" },
  { key: "asOf", label: "Date or period", kind: "date" },
  { key: "evidence", label: "Evidence type", kind: "select", options: EVIDENCE_OPTS },
  { key: "sourceIds", label: "Sources", kind: "checks", options: sourceOpts },
  { key: "note", label: "Note", kind: "textarea" },
];

export const ELEMENT_FIELDS: F[] = [
  { key: "label", label: "Label", kind: "text" },
  { key: "visual", label: "Visual element type", kind: "select", options: VISUAL_OPTS, help: "From the Demo Visual Elements vocabulary." },
  { key: "state", label: "State", kind: "select", options: stateOpts, help: "Unknown unless a source or labelled assumption supports it." },
  { key: "layer", label: "Where it appears", kind: "select", options: [
    { value: "", label: "Default for this type" }, { value: "macro", label: "On the map (a place)" }, { value: "beyond", label: "Beyond the boundary" },
    { value: "earth", label: "Earth / global systems" }, { value: "force", label: "Hovering force (intangible)" }, { value: "list", label: "List and cards only" },
  ] },
  { key: "near", label: "Near (for forces)", kind: "select", options: (c) => [{ value: "", label: "—" }, ...targets(c)] },
  { key: "overlays", label: "Overlays", kind: "checks", options: OVERLAY_OPTS, help: "Possible risk ≠ active problem. Literal fire is labelled separately." },
  { key: "note", label: "Description", kind: "textarea" },
  { key: "holder", label: "Whose view (required for culture, trust, sentiment …)", kind: "text" },
  { key: "evidence", label: "Evidence type", kind: "select", options: EVIDENCE_OPTS },
  { key: "confidence", label: "Confidence in the claim", kind: "select", options: CONF_OPTS },
  { key: "confidenceWhy", label: "Why this confidence", kind: "text" },
  { key: "sourceIds", label: "Sources", kind: "checks", options: sourceOpts },
  { key: "measure", label: "Measured value (optional)", kind: "group", fields: [{ key: "value", label: "Value", kind: "text" }, { key: "unit", label: "Unit", kind: "text" }, { key: "asOf", label: "Date or period", kind: "date" }] },
  { key: "portfolio", label: "Portfolio view only (fund / portfolio organisation type)", kind: "group", fields: [
    { key: "tier", label: "Data tier", kind: "select", options: [{ value: "", label: "Not a holding" }, { value: "ozy", label: "Shares a live twin" }, { value: "fund", label: "Own data only" }, { value: "dd", label: "Due diligence" }, { value: "other", label: "Other" }] },
    { key: "health", label: "Status ring (only if stated)", kind: "select", options: [{ value: "", label: "Unknown — no ring" }, { value: "good", label: "On track" }, { value: "mixed", label: "Needs support" }, { value: "risk", label: "Intervene now" }] },
    { key: "status", label: "Status text", kind: "text" },
  ] },
  { key: "unknowns", label: "Not known / would need confirmation", kind: "lines" },
  { key: "facts", label: "Stated values (with source and row / heading)", kind: "sublist", fields: [
    { key: "label", label: "Label", kind: "text" }, { key: "value", label: "Value", kind: "text" }, { key: "ref", label: "Row / heading in the source", kind: "text" },
    { key: "evidence", label: "Evidence type", kind: "select", options: EVIDENCE_OPTS }, { key: "sourceIds", label: "Sources", kind: "checks", options: sourceOpts },
  ], blank: blankFact, itemLabel: (f) => f.label ? `${f.label}: ${f.value}` : "", addLabel: "Add a value" },
  { key: "pos", label: "Systems view position (0–100 each; leave empty to place automatically)", kind: "group", fields: [{ key: "x", label: "Across", kind: "nullnumber", min: 0, max: 100 }, { key: "y", label: "Down", kind: "nullnumber", min: 0, max: 100 }] },
  { key: "group", label: "Drawn inside group (systems view)", kind: "select", options: (c) => [{ value: "", label: "—" }, ...c.elements.filter((e) => e.label).map((e) => ({ value: e.id, label: e.label }))] },
  { key: "ledger", label: "Shows allocation of planning constraint", kind: "select", options: constraintOpts },
  { key: "shape", label: "Building on the map (optional)", kind: "select", options: SHAPE_OPTS },
  { key: "ring", label: "Islands look: ring", kind: "select", options: [{ value: "", label: "Default" }, { value: "inner", label: "Inner ring (e.g. offices)" }, { value: "outer", label: "Outer ring (programmes, partners)" }] },
];

export const TEAM_FIELDS: F[] = [
  { key: "name", label: "Team name", kind: "text" },
  { key: "purpose", label: "What they aim for", kind: "text" },
  { key: "headcount", label: "Headcount", kind: "nullnumber", min: 0, help: "Leave empty if not stated." },
  { key: "tier", label: "Hierarchy tier (0 = top)", kind: "nullnumber", min: 0, max: 5 },
  { key: "roles", label: "Roles (not names of people)", kind: "lines" },
  { key: "state", label: "State", kind: "select", options: (_c, row) => stateOpts(_c, { visual: row.visual || "team" }) },
  { key: "overlays", label: "Overlays", kind: "checks", options: OVERLAY_OPTS.filter((o) => ["workload", "possible-risk", "active-problem", "delay", "missing-evidence", "conflicting-accounts", "intervention"].includes(o.value)) },
  { key: "views", label: "Attributed views", kind: "sublist", fields: VIEW_FIELDS, blank: blankView, itemLabel: (v) => v.text ? `${v.holder || "?"}: ${v.text}` : "", addLabel: "Add a view" },
  { key: "roleLinks", label: "Links between roles (micro level)", kind: "sublist", fields: [
    { key: "from", label: "From role", kind: "select", options: (_c, row) => (row.roles ?? []).map((r: string) => ({ value: r, label: r })) },
    { key: "to", label: "To role", kind: "select", options: (_c, row) => (row.roles ?? []).map((r: string) => ({ value: r, label: r })) },
    { key: "kind", label: "Kind", kind: "select", options: [{ value: "decision", label: "Decision / sign-off" }, { value: "handover", label: "Hand-over" }, { value: "trust", label: "Trust" }] },
    { key: "label", label: "Label", kind: "text" },
  ], blank: () => ({ from: "", to: "", kind: "decision", label: "" }), itemLabel: (l) => l.from && l.to ? `${l.from} → ${l.to}` : "", addLabel: "Add a role link" },
];

export const RELATIONSHIP_FIELDS: F[] = [
  { key: "from", label: "From", kind: "select", options: targets },
  { key: "to", label: "To", kind: "select", options: targets },
  { key: "type", label: "Type", kind: "select", options: CONNECTION_TYPES.map((c) => ({ value: c.id, label: c.label })) },
  { key: "state", label: "State", kind: "select", options: (_c, row) => (CONNECTION_TYPES.find((c) => c.id === row.type)?.states ?? []).map((s) => ({ value: s.id, label: s.label })) },
  { key: "label", label: "Label (who depends on what, etc.)", kind: "text" },
  { key: "tone", label: "On the map reads as", kind: "select", options: [{ value: "neutral", label: "Neutral connection" }, { value: "tension", label: "Tension" }, { value: "synergy", label: "Synergy" }, { value: "mixed", label: "Mixed" }] },
  { key: "frequency", label: "Interaction frequency", kind: "select", options: [{ value: "unknown", label: "Not known (neutral line)" }, { value: "low", label: "Less frequent" }, { value: "medium", label: "Regular" }, { value: "high", label: "Frequent" }], help: "Thickness only — it never implies causality." },
  { key: "evidence", label: "Evidence type", kind: "select", options: EVIDENCE_OPTS },
  { key: "sourceIds", label: "Sources", kind: "checks", options: sourceOpts },
  { key: "perspectives", label: "Different perspectives", kind: "sublist", fields: VIEW_FIELDS, blank: blankView, itemLabel: (v) => v.text ? `${v.holder || "?"}: ${v.text}` : "", addLabel: "Add a perspective" },
  { key: "note", label: "What it represents / what would need confirming", kind: "textarea" },
];

/** Element and connection lists for map additions (sources, options, scenarios). */
const addsField = (label: string): F => ({ key: "adds", label, kind: "group", fields: [
  { key: "elements", label: "Elements", kind: "sublist", fields: ELEMENT_FIELDS, blank: blankElement, itemLabel: (e) => e.label, addLabel: "Add an element" },
  { key: "relationships", label: "Connections", kind: "sublist", fields: RELATIONSHIP_FIELDS.map((f) => (f.key === "from" || f.key === "to" ? { ...f, options: anyTargets } as F : f)), blank: blankRelationship, itemLabel: (r) => r.label || (r.from && r.to ? `${r.from} → ${r.to}` : ""), addLabel: "Add a connection" },
] });

export const SOURCE_FIELDS: F[] = [
  { key: "id", label: "Source id", kind: "text", help: "Short and unique, e.g. S-01." },
  { key: "title", label: "Title", kind: "text" },
  { key: "fileName", label: "File name", kind: "text" },
  { key: "date", label: "Date", kind: "date" },
  { key: "docType", label: "Document type", kind: "text" },
  { key: "owner", label: "Owner (role)", kind: "text" },
  { key: "scope", label: "Scope — what it covers (population, period, sample)", kind: "textarea" },
  { key: "excerpt", label: "One-line excerpt", kind: "text", wide: true },
  { key: "fullText", label: "Source text", kind: "textfile", nameKey: "fileName" },
  { key: "reading", label: "Prepared reading (shown separately from the source)", kind: "group", fields: [
    { key: "extracted", label: "What we read", kind: "lines" }, { key: "changes", label: "What changes in the model", kind: "lines" },
    { key: "affected", label: "Teams and decisions it touches", kind: "lines" }, { key: "uncertainties", label: "Still uncertain", kind: "lines" },
  ] },
  { key: "updates", label: "Number updates when applied", kind: "sublist", fields: [
    { key: "numberId", label: "Number", kind: "select", options: numberOpts }, { key: "value", label: "New value", kind: "text" }, { key: "asOf", label: "As of", kind: "date" },
  ], blank: () => ({ numberId: "", value: "", asOf: "" }), itemLabel: (u) => u.value ? `→ ${u.value}` : "", addLabel: "Add an update" },
  { key: "signals", label: "Key signals it adds", kind: "lines" },
  { key: "synthetic", label: "Synthetic demo document (shown with a SYNTHETIC label)", kind: "bool" },
  { key: "mapChanges", label: "What it says about map elements (applied only once uploaded)", kind: "sublist", fields: [
    { key: "target", label: "Element or connection", kind: "select", options: (c) => [...anyTargets(c), ...relOpts(c)] },
    { key: "ref", label: "Heading or row in the source", kind: "text" },
    { key: "label", label: "Short label on the map", kind: "text" },
    { key: "text", label: "What the source says", kind: "textarea" },
    { key: "overlays", label: "Overlays it adds (never removes a condition)", kind: "checks", options: OVERLAY_OPTS },
    { key: "evidence", label: "Evidence type", kind: "select", options: EVIDENCE_OPTS },
  ], blank: blankMapChange, itemLabel: (m) => m.label ? `${m.ref ? m.ref + ": " : ""}${m.label}` : "", addLabel: "Add a map change" },
  { key: "ledgerChecks", label: "Planning values it states (compared with the ledger, never added)", kind: "sublist", fields: [
    { key: "target", label: "Component or constraint", kind: "select", options: (c) => [...componentOpts(c).slice(1), ...constraintOpts(c).slice(1).map((o) => ({ ...o, label: o.label + " (cap)" }))] },
    { key: "field", label: "Field", kind: "select", options: (c) => [{ value: "cap", label: "Cap (for a constraint)" }, ...constraintOpts(c).slice(1), ...metricOpts(c)] },
    { key: "value", label: "Stated value", kind: "number" },
    { key: "ref", label: "Heading or row", kind: "text" },
  ], blank: blankLedgerCheck, itemLabel: (k) => k.ref ? `${k.ref} · ${k.target}/${k.field} = ${k.value}` : "", addLabel: "Add a planning check" },
  addsField("Connections or elements it describes (shown once uploaded)"),
];

export const FINDING_FIELDS: F[] = [
  { key: "text", label: "Finding", kind: "textarea" },
  { key: "kind", label: "Show as", kind: "select", options: [{ value: "signal", label: "Key signal (on the map + brief)" }, { value: "finding", label: "Finding (brief only)" }] },
  { key: "about", label: "About", kind: "select", options: (c) => [{ value: "", label: "—" }, ...targets(c)] },
  { key: "evidence", label: "Evidence type", kind: "select", options: EVIDENCE_OPTS },
  { key: "confidence", label: "Confidence", kind: "select", options: CONF_OPTS },
  { key: "confidenceWhy", label: "Why this confidence", kind: "text" },
  { key: "sourceIds", label: "Sources", kind: "checks", options: sourceOpts },
];

export const ASSUMPTION_FIELDS: F[] = [
  { key: "text", label: "Assumption", kind: "textarea" },
  { key: "basis", label: "Basis", kind: "text" },
  { key: "sourceIds", label: "Sources", kind: "checks", options: sourceOpts },
];

export const MISSING_FIELDS: F[] = [
  { key: "title", label: "What is missing", kind: "text" },
  { key: "status", label: "Status", kind: "select", options: [{ value: "missing", label: "Missing" }, { value: "requested", label: "Requested" }, { value: "supplied", label: "Supplied" }] },
  { key: "why", label: "Why it matters", kind: "textarea" },
  { key: "sharpens", label: "What it would sharpen", kind: "text" },
];

export const NOTICE_FIELDS: F[] = [
  { key: "kind", label: "Kind", kind: "select", options: [{ value: "normative", label: "Normative assumption" }, { value: "contestation", label: "Active contestation" }] },
  { key: "approvedRef", label: "Approval reference", kind: "text", help: "Use only approved wording." },
  { key: "text", label: "Approved wording", kind: "textarea" },
];

export const PATHWAY_FIELDS: F[] = [
  { key: "title", label: "Title", kind: "text" },
  { key: "summary", label: "One-line summary", kind: "text" },
  { key: "idea", label: "The idea", kind: "textarea" },
  { key: "horizon", label: "How long", kind: "text" },
  { key: "cost", label: "Costs", kind: "text" },
  { key: "needs", label: "What must be true", kind: "lines" },
  { key: "conditions", label: "Conditions", kind: "lines" },
  { key: "interventions", label: "Interventions", kind: "lines" },
  { key: "watch", label: "How you'd know it's working", kind: "text", wide: true },
  { key: "sourceIds", label: "Based on sources", kind: "checks", options: sourceOpts },
  { key: "wins", label: "Benefits on the 12-month timeline (illustrative)", kind: "sublist", fields: SPOT_FIELDS.slice(0, 3), blank: () => ({ ...blankSpot(), until: null }), itemLabel: (s) => s.label, addLabel: "Add a benefit" },
  { key: "risks", label: "Risks on the 12-month timeline (illustrative)", kind: "sublist", fields: SPOT_FIELDS, blank: blankSpot, itemLabel: (s) => s.label, addLabel: "Add a risk" },
  { key: "effects", label: "Effects painted on the map when played (illustrative)", kind: "sublist", fields: EFFECT_FIELDS, blank: blankEffect, itemLabel: (e) => e.label, addLabel: "Add an effect" },
  { key: "tradeOff", label: "Main trade-off", kind: "textarea" },
  { key: "evidenceNeeded", label: "Evidence that would be needed", kind: "lines" },
  { key: "components", label: "Planning components (incl. the baseline) — totals are calculated", kind: "sublist", fields: [
    { key: "componentId", label: "Component", kind: "select", options: componentOpts }, { key: "count", label: "How many", kind: "number", min: 0 },
  ], blank: () => ({ componentId: "", count: 1 }), itemLabel: (x) => x.componentId ? `${x.count} × ${x.componentId}` : "", addLabel: "Add a component" },
  { key: "plan", label: "Proposed actions (up to three, previewable before selection)", kind: "sublist", fields: [
    { key: "title", label: "Title", kind: "text" }, { key: "what", label: "What it involves (never described as done)", kind: "textarea" },
    { key: "showsOn", label: "Shows on", kind: "checks", options: anyTargets }, { key: "dependsOn", label: "Depends on", kind: "lines" }, { key: "evidence", label: "Evidence needed", kind: "lines" },
  ], blank: blankPlanStep, itemLabel: (x) => x.title, addLabel: "Add an action" },
  addsField("Proposed elements and connections drawn while this option is shown"),
];

export const SCENARIO_FIELDS: F[] = [
  { key: "question", label: "Prepared what-if question", kind: "textarea" },
  { key: "kind", label: "Kind", kind: "select", options: [{ value: "", label: "Prepared what-if (map effects only)" }, { value: "stress-test", label: "Quick change with planning figures (applies to the current plan or the shown pathway)" }] },
  { key: "combinable", label: "Can be combined with other quick changes (the Twin page plays one at a time)", kind: "bool" },
  { key: "requiresComponent", label: "Applies only when the option includes", kind: "select", options: componentOpts },
  { key: "assumptions", label: "Assumptions behind it", kind: "lines" },
  { key: "unchanged", label: "What it does NOT change", kind: "lines" },
  { key: "keywords", label: "Words that match it in the scenario box", kind: "lines" },
  { key: "adjustments", label: "Ledger adjustments (assumed)", kind: "sublist", fields: [
    { key: "label", label: "Label", kind: "text" }, { key: "constraintId", label: "Constraint", kind: "select", options: constraintOpts }, { key: "amount", label: "Amount", kind: "number" },
    { key: "target", label: "Adds to", kind: "select", options: [{ value: "total", label: "What is allocated" }, { value: "cap", label: "What is available (cap)" }] },
    { key: "componentId", label: "Only with component", kind: "select", options: componentOpts },
    { key: "per", label: "Applies", kind: "select", options: [{ value: "once", label: "Once per option" }, { value: "each", label: "For each unit of that component" }] },
    { key: "note", label: "Note", kind: "text" },
  ], blank: blankAdjustment, itemLabel: (a) => a.label, addLabel: "Add an adjustment" },
  { key: "highlight", label: "Connections highlighted when applied", kind: "checks", options: relOpts },
  { key: "effects", label: "Illustrative effects", kind: "sublist", fields: EFFECT_FIELDS, blank: blankEffect, itemLabel: (e) => e.label, addLabel: "Add an effect" },
  addsField("Elements and connections the scenario introduces"),
];

export const PLANNING_FIELDS: F[] = [
  { key: "period", label: "Period", kind: "text", placeholder: "e.g. Illustrative annual cycle (12 months)" },
  { key: "note", label: "Note", kind: "textarea" },
  { key: "notes", label: "Plain statements shown with the baseline", kind: "lines" },
  { key: "constraints", label: "Constraints (kept separate, never added together)", kind: "sublist", fields: [
    { key: "id", label: "Id", kind: "text" }, { key: "label", label: "Label", kind: "text" }, { key: "prefix", label: "Before the number (e.g. €)", kind: "text" }, { key: "unit", label: "After the number (e.g. hours)", kind: "text" },
    { key: "cap", label: "Cap (empty = unknown)", kind: "nullnumber" }, { key: "elementId", label: "Shown on element", kind: "select", options: (c) => [{ value: "", label: "—" }, ...c.elements.filter((e) => e.label).map((e) => ({ value: e.id, label: e.label }))] },
    { key: "evidence", label: "Evidence type", kind: "select", options: EVIDENCE_OPTS }, { key: "note", label: "Note", kind: "text" },
  ], blank: blankConstraint, itemLabel: (x) => x.label, addLabel: "Add a constraint" },
  { key: "metrics", label: "Capacity metrics (ceilings, not participation)", kind: "sublist", fields: [
    { key: "id", label: "Id", kind: "text" }, { key: "label", label: "Label", kind: "text" }, { key: "unit", label: "Unit", kind: "text" },
    { key: "elementId", label: "Shown on element", kind: "select", options: (c) => [{ value: "", label: "—" }, ...c.elements.filter((e) => e.label).map((e) => ({ value: e.id, label: e.label }))] }, { key: "note", label: "Note", kind: "text" },
  ], blank: blankMetric, itemLabel: (x) => x.label, addLabel: "Add a metric" },
  { key: "components", label: "Components (baseline + candidates)", kind: "sublist", fields: [
    { key: "id", label: "Id", kind: "text" }, { key: "label", label: "Label", kind: "text" },
    { key: "kind", label: "Kind", kind: "select", options: [{ value: "baseline", label: "Baseline (existing commitment)" }, { value: "candidate", label: "Candidate addition" }] },
    { key: "costs", label: "Costs", kind: "sublist", fields: [{ key: "constraintId", label: "Constraint", kind: "select", options: constraintOpts }, { key: "amount", label: "Amount", kind: "number" }], blank: () => ({ constraintId: "", amount: 0 }), itemLabel: (x) => x.constraintId ? `${x.constraintId}: ${x.amount}` : "", addLabel: "Add a cost" },
    { key: "adds", label: "Adds capacity", kind: "sublist", fields: [{ key: "metricId", label: "Metric", kind: "select", options: metricOpts }, { key: "amount", label: "Amount", kind: "number" }], blank: () => ({ metricId: "", amount: 0 }), itemLabel: (x) => x.metricId ? `${x.metricId}: +${x.amount}` : "", addLabel: "Add capacity" },
    { key: "evidence", label: "Evidence type", kind: "select", options: EVIDENCE_OPTS }, { key: "note", label: "Note", kind: "text" },
  ], blank: blankComponent, itemLabel: (x) => x.label, addLabel: "Add a component" },
];

export const ROUTE_FIELDS: F[] = [
  { key: "title", label: "Route title", kind: "text" },
  { key: "note", label: "Note", kind: "text" },
  { key: "steps", label: "Steps (each a question to validate, not a result)", kind: "sublist", fields: [
    { key: "label", label: "Step", kind: "text" }, { key: "nodeId", label: "On element", kind: "select", options: (c) => [{ value: "", label: "— not on the map —" }, ...anyTargets(c)] },
    { key: "question", label: "Question to validate", kind: "text" }, { key: "evidence", label: "Evidence status", kind: "text" },
  ], blank: () => ({ label: "", nodeId: "", question: "", evidence: "" }), itemLabel: (x) => x.label, addLabel: "Add a step" },
];
