/**
 * Lead-case checks shown in /prepare. Errors break something visible;
 * warnings flag gaps or rule risks (unlabelled facts, missing holders …).
 */
import { CONNECTION_TYPES, getElementType, getOverlay } from "@/lib/visuals/registry";
import type { Effect, LeadCase } from "./types";

export interface Issue { level: "error" | "warning"; section: string; message: string }

export function validateLeadCase(c: LeadCase): Issue[] {
  const out: Issue[] = [];
  const add = (level: Issue["level"], section: string, message: string) => out.push({ level, section, message });

  const elIds = c.elements.map((e) => e.id);
  const teamIds = c.teams.map((t) => t.id);
  const all = [...elIds, ...teamIds];
  const targets = new Set(["org", ...all]);
  const srcIds = new Set(c.sources.map((s) => s.id));
  const numIds = new Set(c.numbers.map((n) => n.id));

  const dupes = all.filter((id, i) => all.indexOf(id) !== i);
  if (dupes.length) add("error", "elements", `Duplicate ids: ${Array.from(new Set(dupes)).join(", ")}. Each element and team needs its own id.`);
  const srcDupes = c.sources.map((s) => s.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (srcDupes.length) add("error", "sources", `Duplicate source ids: ${Array.from(new Set(srcDupes)).join(", ")}.`);

  if (!c.organisation.name.trim()) add("warning", "organisation", "Organisation name is empty — the demo will show “Organisation (name not set)”.");
  if (!c.decision.question.trim()) add("warning", "decision", "No decision or challenge yet — Pathways and the brief will show an empty state.");

  const checkSources = (section: string, label: string, ids: string[]) => {
    const bad = ids.filter((id) => !srcIds.has(id));
    if (bad.length) add("warning", section, `${label}: unknown source id(s) ${bad.join(", ")}.`);
  };

  c.numbers.forEach((n) => {
    if (!n.label.trim()) add("warning", "numbers", "A number has no label.");
    if (n.value.trim() && !n.evidence && n.sourceIds.length === 0) add("warning", "numbers", `“${n.label || "number"}” has a value but no source or evidence label.`);
    checkSources("numbers", n.label || "number", n.sourceIds);
  });

  c.elements.forEach((e) => {
    const et = getElementType(e.visual);
    const name = e.label || e.id;
    if (!e.label.trim()) add("warning", "elements", `Element ${e.id} has no label and will not be shown.`);
    if (!et) { add("error", "elements", `“${name}”: unknown visual type “${e.visual}”.`); return; }
    if (e.state && !et.states.some((s) => s.id === e.state)) add("warning", "elements", `“${name}”: state “${e.state}” is not defined for ${et.label}; it will show as unknown.`);
    e.overlays.forEach((o) => { if (!getOverlay(o)) add("warning", "elements", `“${name}”: unknown overlay “${o}”.`); });
    if (et.attributed && !e.holder.trim()) add("warning", "elements", `“${name}” (${et.label}) needs a holder — whose view is it?`);
    if (e.near && !targets.has(e.near)) add("warning", "elements", `“${name}”: “near” points at an unknown id (${e.near}).`);
    if (e.overlays.includes("active-problem") && e.overlays.includes("possible-risk")) add("warning", "elements", `“${name}” is marked both a possible risk and an active problem — pick one.`);
    checkSources("elements", name, e.sourceIds);
  });

  c.teams.forEach((t) => { if (!t.name.trim()) add("warning", "teams", `Team ${t.id} has no name and will not be shown.`); });

  c.relationships.forEach((r) => {
    const name = r.label || `${r.from} → ${r.to}`;
    if (!r.from || !r.to) add("warning", "relationships", `“${name}”: choose both ends.`);
    else if (!targets.has(r.from) || !targets.has(r.to)) add("warning", "relationships", `“${name}”: one end is not an element, team or the organisation.`);
    const ct = CONNECTION_TYPES.find((x) => x.id === r.type);
    if (ct && r.state && !ct.states.some((s) => s.id === r.state)) add("warning", "relationships", `“${name}”: state “${r.state}” is not defined for ${ct.label}.`);
    if ((r.type === "trust" || r.type === "tension") && r.perspectives.length === 0 && !r.evidence) add("warning", "relationships", `“${name}”: ${r.type} should be attributed (add a perspective or evidence label).`);
    checkSources("relationships", name, r.sourceIds);
  });

  c.sources.forEach((s) => {
    if (!s.title.trim()) add("warning", "sources", `Source ${s.id} has no title.`);
    if (!s.date.trim()) add("warning", "sources", `Source ${s.id}: add a date.`);
    if (!s.scope.trim()) add("warning", "sources", `Source ${s.id}: describe its scope (what it covers).`);
    s.updates.forEach((u) => { if (!numIds.has(u.numberId)) add("warning", "sources", `Source ${s.id} updates an unknown number (${u.numberId || "none chosen"}).`); });
  });

  c.findings.forEach((f) => checkSources("findings", f.text.slice(0, 40) || "finding", f.sourceIds));

  const checkEffects = (section: string, owner: string, effects: Effect[]) =>
    effects.forEach((e) => { if (!targets.has(e.target)) add("warning", section, `${owner}: effect “${e.label || "?"}” targets an unknown id (${e.target || "none"}).`); });

  const titled = c.pathways.filter((p) => p.title.trim());
  if (titled.length > 3) add("warning", "pathways", "Only the first three pathways are shown.");
  c.pathways.forEach((p) => {
    const name = p.title || p.id;
    checkEffects("pathways", name, p.effects);
    [...p.wins, ...p.risks].forEach((s) => {
      if (s.near && !targets.has(s.near)) add("warning", "pathways", `${name}: “${s.label}” is placed near an unknown id.`);
      if (s.until != null && s.until < s.from) add("warning", "pathways", `${name}: “${s.label}” closes before it starts.`);
    });
    checkSources("pathways", name, p.sourceIds);
  });

  if (c.outcomeEstimate && c.outcomeEstimate.question.trim() && !c.outcomeEstimate.basis.trim()) add("warning", "pathways", "Outcome estimate needs a basis (it is shown as a demo assumption, never as a prediction).");
  c.scenarios.forEach((s) => checkEffects("scenarios", s.question.slice(0, 40) || "scenario", s.effects));
  c.notices.forEach((n) => { if (!n.text.trim()) add("warning", "limitations", "A notice is empty — add the approved wording or remove it."); });

  // ── map additions, source map changes, planning ledger, impact routes
  const addsOf = [...c.sources.map((s) => s.adds), ...c.pathways.map((p) => p.adds), ...c.scenarios.map((s) => s.adds)];
  const anyEl = new Set(["org", ...all, ...addsOf.flatMap((a) => a.elements.map((e) => e.id))]);
  const anyRel = new Set([...c.relationships.map((r) => r.id), ...addsOf.flatMap((a) => a.relationships.map((r) => r.id))]);
  addsOf.forEach((a) => a.relationships.forEach((r) => { if (!anyEl.has(r.from) || !anyEl.has(r.to)) add("warning", "relationships", `Added connection “${r.label || r.id}” points at an unknown id.`); }));
  c.elements.forEach((e) => { if (e.group && !elIds.includes(e.group)) add("warning", "elements", `“${e.label || e.id}” is grouped under an unknown element (${e.group}).`); });
  c.sources.forEach((s) => {
    s.mapChanges.forEach((m) => {
      if (!anyEl.has(m.target) && !anyRel.has(m.target)) add("warning", "sources", `Source ${s.id}: map change “${m.label || "?"}” targets an unknown id (${m.target || "none"}).`);
      m.overlays.forEach((o) => { if (!getOverlay(o)) add("warning", "sources", `Source ${s.id}: unknown overlay “${o}”.`); });
    });
  });
  c.pathways.forEach((p) => {
    const own = new Set([...all, "org", ...p.adds.elements.map((e) => e.id)]);
    p.plan.forEach((st) => st.showsOn.forEach((id) => { if (!own.has(id)) add("warning", "pathways", `${p.title || p.id}: step “${st.title}” shows on an unknown id (${id}).`); }));
  });
  c.scenarios.forEach((s) => s.highlight.forEach((id) => { if (!anyRel.has(id)) add("warning", "scenarios", `Scenario “${s.question.slice(0, 40)}”: highlights an unknown connection (${id}).`); }));
  const pl = c.planning;
  if (pl) {
    const cons = new Set(pl.constraints.map((x) => x.id)), mets = new Set(pl.metrics.map((x) => x.id)), comps = new Set(pl.components.map((x) => x.id));
    pl.constraints.forEach((k) => { if (k.elementId && !elIds.includes(k.elementId)) add("warning", "planning", `Constraint “${k.label}” is shown on an unknown element (${k.elementId}).`); });
    pl.metrics.forEach((k) => { if (k.elementId && !elIds.includes(k.elementId)) add("warning", "planning", `Metric “${k.label}” is shown on an unknown element (${k.elementId}).`); });
    pl.components.forEach((k) => {
      k.costs.forEach((x) => { if (!cons.has(x.constraintId)) add("error", "planning", `Component “${k.label}” costs against an unknown constraint (${x.constraintId}).`); });
      k.adds.forEach((x) => { if (!mets.has(x.metricId)) add("error", "planning", `Component “${k.label}” adds to an unknown metric (${x.metricId}).`); });
    });
    c.pathways.forEach((p) => p.components.forEach((x) => { if (!comps.has(x.componentId)) add("error", "pathways", `${p.title || p.id}: unknown planning component (${x.componentId}).`); }));
    c.scenarios.forEach((s) => {
      if (s.requiresComponent && !comps.has(s.requiresComponent)) add("warning", "scenarios", `Scenario “${s.question.slice(0, 40)}”: requires an unknown component (${s.requiresComponent}).`);
      s.adjustments.forEach((a) => {
        if (!cons.has(a.constraintId)) add("error", "scenarios", `Scenario “${s.question.slice(0, 40)}”: adjustment on an unknown constraint (${a.constraintId}).`);
        if (a.componentId && !comps.has(a.componentId)) add("warning", "scenarios", `Scenario “${s.question.slice(0, 40)}”: adjustment tied to an unknown component (${a.componentId}).`);
      });
    });
    c.sources.forEach((s) => s.ledgerChecks.forEach((k) => {
      const ok = (comps.has(k.target) && (cons.has(k.field) || mets.has(k.field))) || (cons.has(k.target) && k.field === "cap");
      if (!ok) add("warning", "sources", `Source ${s.id}: planning check “${k.ref || k.target}” does not match a component / constraint field.`);
    }));
  } else if (c.pathways.some((p) => p.components.length) || c.scenarios.some((s) => s.adjustments.length)) {
    add("warning", "planning", "Pathway components or scenario adjustments are set, but the case has no planning ledger.");
  }
  c.impactRoutes.forEach((r) => r.steps.forEach((st) => { if (st.nodeId && !anyEl.has(st.nodeId)) add("warning", "elements", `Impact route “${r.title}”: step “${st.label}” points at an unknown element (${st.nodeId}).`); }));

  return out;
}
