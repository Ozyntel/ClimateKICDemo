/**
 * Planning ledger arithmetic — pure functions, no storage access.
 *
 * Every resource figure the demo shows for a case with `planning` (baseline
 * headroom, pathway totals, scenario results) is derived here from one
 * place: the case's constraints (caps), components (baseline + candidates)
 * and the components each pathway consists of. Nothing is typed twice.
 *
 * Rules:
 *   - Constraints (e.g. cash and specialist hours) are separate and are never
 *     added together.
 *   - Capacity metrics (cohorts, target teams …) are ceilings, not
 *     participation, completions or outcomes.
 *   - Scenario adjustments are assumptions. Each active scenario is applied
 *     once, to the current plan or to the shown pathway; an adjustment tied
 *     to a component applies only when that plan includes the component, and
 *     says so when it does not.
 *   - Nothing is forecast: no probabilities, scores or impact quantities.
 */
import type { LeadCase, Pathway, Planning, PlanningComponent, PlanningConstraint, PlanningMetric, Scenario, SourceDoc } from "./types";

export interface LedgerLine {
  component: PlanningComponent;
  count: number;
  /** Cost per constraint id for this line (amount × count). */
  costs: Record<string, number>;
  /** Capacity per metric id for this line (amount × count). */
  adds: Record<string, number>;
}

export interface LedgerAdjustmentLine {
  scenarioId: string;
  scenarioTitle: string;
  label: string;
  constraintId: string;
  amount: number;
  target: "total" | "cap";
  note: string;
}

export interface ConstraintTotal {
  constraint: PlanningConstraint;
  /** Allocated by components, before scenario adjustments. */
  base: number;
  /** Allocated including "total" adjustments. */
  allocated: number;
  /** Planning cap (null = not known). */
  cap: number | null;
  /** Added to the cap by "cap" adjustments (e.g. a conditional sponsor). */
  capAdded: number;
  /** cap + capAdded (null when the cap is unknown). */
  available: number | null;
  /** available − allocated. Negative = over. null when the cap is unknown. */
  headroom: number | null;
}

export interface Ledger {
  lines: LedgerLine[];
  adjustments: LedgerAdjustmentLine[];
  /** Active scenarios that do not apply to this option, with the reason. */
  notApplied: Array<{ scenarioId: string; scenarioTitle: string; reason: string }>;
  totals: ConstraintTotal[];
  metrics: Array<{ metric: PlanningMetric; value: number }>;
}

const nf = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** "€300,000", "420 hours", "−€8,000". */
export function formatAmount(c: Pick<PlanningConstraint, "prefix" | "unit">, n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${c.prefix}${nf.format(Math.abs(n))}${c.unit ? " " + c.unit : ""}`;
}

export function formatMetric(m: Pick<PlanningMetric, "unit">, n: number): string {
  return `${nf.format(n)}${m.unit ? " " + m.unit : ""}`;
}

export function hasPlanning(lead: LeadCase): lead is LeadCase & { planning: Planning } {
  return !!lead.planning && lead.planning.constraints.length > 0;
}

export function baselineComponentRefs(planning: Planning): Array<{ componentId: string; count: number }> {
  return planning.components.filter((c) => c.kind === "baseline").map((c) => ({ componentId: c.id, count: 1 }));
}

/** The case's planning scenarios that are switched on and exist, de-duplicated, in case order. */
export function activeStressTests(lead: LeadCase, ids: string[]): Scenario[] {
  const on = new Set(ids);
  return lead.scenarios.filter((s) => s.kind === "stress-test" && on.has(s.id));
}

/** Switch a stress test on or off. Non-combinable tests are exclusive: switching one on switches the others off. */
export function toggleStressTest(lead: LeadCase, ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  const s = lead.scenarios.find((x) => x.id === id);
  if (!s || s.kind !== "stress-test") return ids;
  const keep = s.combinable ? ids.filter((x) => lead.scenarios.find((y) => y.id === x)?.combinable) : [];
  return [...keep, id];
}

export function componentCount(refs: Array<{ componentId: string; count: number }>, componentId: string): number {
  return refs.filter((r) => r.componentId === componentId).reduce((a, r) => a + r.count, 0);
}

export function computeLedger(planning: Planning, refs: Array<{ componentId: string; count: number }>, scenarios: Scenario[] = []): Ledger {
  const lines: LedgerLine[] = refs
    .map((r) => ({ r, component: planning.components.find((c) => c.id === r.componentId) }))
    .filter((x): x is { r: { componentId: string; count: number }; component: PlanningComponent } => !!x.component && x.r.count > 0)
    .map(({ r, component }) => ({
      component,
      count: r.count,
      costs: Object.fromEntries(component.costs.map((c) => [c.constraintId, c.amount * r.count])),
      adds: Object.fromEntries(component.adds.map((a) => [a.metricId, a.amount * r.count])),
    }));

  const adjustments: LedgerAdjustmentLine[] = [];
  const notApplied: Ledger["notApplied"] = [];
  const seen = new Set<string>();
  for (const s of scenarios) {
    if (seen.has(s.id)) continue; // a scenario is applied once, however often it is switched on
    seen.add(s.id);
    const title = s.question;
    if (s.requiresComponent && componentCount(refs, s.requiresComponent) === 0) {
      const comp = planning.components.find((c) => c.id === s.requiresComponent);
      notApplied.push({ scenarioId: s.id, scenarioTitle: title, reason: `Does not apply: the plan shown includes no ${comp?.label.toLowerCase() || s.requiresComponent}.` });
      continue;
    }
    for (const a of s.adjustments) {
      if (!planning.constraints.some((c) => c.id === a.constraintId)) continue;
      let amount = a.amount;
      if (a.componentId) {
        const n = componentCount(refs, a.componentId);
        if (n === 0) continue;
        amount = a.per === "each" ? a.amount * n : a.amount;
      }
      adjustments.push({ scenarioId: s.id, scenarioTitle: title, label: a.label, constraintId: a.constraintId, amount, target: a.target, note: a.note });
    }
  }

  const totals: ConstraintTotal[] = planning.constraints.map((c) => {
    const base = lines.reduce((sum, l) => sum + (l.costs[c.id] ?? 0), 0);
    const plus = adjustments.filter((a) => a.constraintId === c.id && a.target === "total").reduce((s, a) => s + a.amount, 0);
    const capAdded = adjustments.filter((a) => a.constraintId === c.id && a.target === "cap").reduce((s, a) => s + a.amount, 0);
    const allocated = base + plus;
    const available = c.cap == null ? null : c.cap + capAdded;
    return { constraint: c, base, allocated, cap: c.cap, capAdded, available, headroom: available == null ? null : available - allocated };
  });

  const metrics = planning.metrics.map((m) => ({ metric: m, value: lines.reduce((sum, l) => sum + (l.adds[m.id] ?? 0), 0) }));
  return { lines, adjustments, notApplied, totals, metrics };
}

export function baselineLedger(lead: LeadCase): Ledger | null {
  if (!hasPlanning(lead)) return null;
  return computeLedger(lead.planning, baselineComponentRefs(lead.planning));
}

export function pathwayLedger(lead: LeadCase, pathway: Pathway | null | undefined, scenarios: Scenario[] = []): Ledger | null {
  if (!hasPlanning(lead) || !pathway || pathway.components.length === 0) return null;
  return computeLedger(lead.planning, pathway.components, scenarios);
}

/** "€240,000 of €300,000 allocated · €60,000 headroom" (or "… over the cap"). */
export function totalSentence(t: ConstraintTotal): string {
  const c = t.constraint;
  if (t.available == null) return `${formatAmount(c, t.allocated)} allocated · cap not known`;
  const head = t.headroom ?? 0;
  return `${formatAmount(c, t.allocated)} of ${formatAmount(c, t.available)} · ${head < 0 ? formatAmount(c, -head) + " over" : formatAmount(c, head) + " headroom"}`;
}

/** Plain-text arithmetic for one constraint, e.g. "€240,000 + 2 × €30,000 = €300,000". */
export function arithmetic(ledger: Ledger, constraintId: string): string {
  const t = ledger.totals.find((x) => x.constraint.id === constraintId);
  if (!t) return "";
  const c = t.constraint;
  const parts = ledger.lines.filter((l) => (l.costs[constraintId] ?? 0) !== 0).map((l) => {
    const per = l.component.costs.find((x) => x.constraintId === constraintId)?.amount ?? 0;
    return l.count > 1 ? `${l.count} × ${formatAmount(c, per)}` : formatAmount(c, per);
  });
  ledger.adjustments.filter((a) => a.constraintId === constraintId && a.target === "total").forEach((a) => parts.push(`${formatAmount(c, a.amount)} (assumed)`));
  const sum = `${parts.join(" + ") || formatAmount(c, 0)} = ${formatAmount(c, t.allocated)}`;
  if (t.available == null) return sum;
  const cap = t.capAdded ? `${formatAmount(c, t.cap ?? 0)} + ${formatAmount(c, t.capAdded)} (assumed) = ${formatAmount(c, t.available)}` : formatAmount(c, t.available);
  return `${sum}; available ${cap}; ${(t.headroom ?? 0) < 0 ? "over by " + formatAmount(c, -(t.headroom ?? 0)) : "headroom " + formatAmount(c, t.headroom ?? 0)}`;
}

// ─── source cross-checks ──────────────────────────────────────────────

export interface LedgerCheckResult {
  sourceId: string;
  ref: string;
  /** What the check is about, e.g. "Existing commitments · Flexible planning envelope". */
  about: string;
  stated: string;
  current: string;
  match: boolean;
}

/** Compare the planning values a source states with the ledger. Never changes the ledger. */
export function ledgerCheckResults(lead: LeadCase, doc: SourceDoc): LedgerCheckResult[] {
  if (!hasPlanning(lead)) return [];
  const p = lead.planning;
  return doc.ledgerChecks.map((ch) => {
    const comp = p.components.find((c) => c.id === ch.target);
    const cons = p.constraints.find((c) => c.id === ch.target);
    let current: number | null = null, fmt = (n: number) => nf.format(n), about = ch.target;
    if (comp) {
      const fc = p.constraints.find((c) => c.id === ch.field), fm = p.metrics.find((m) => m.id === ch.field);
      if (fc) { current = comp.costs.find((x) => x.constraintId === fc.id)?.amount ?? null; fmt = (n) => formatAmount(fc, n); about = `${comp.label} · ${fc.label}`; }
      else if (fm) { current = comp.adds.find((x) => x.metricId === fm.id)?.amount ?? null; fmt = (n) => formatMetric(fm, n); about = `${comp.label} · ${fm.label}`; }
    } else if (cons && ch.field === "cap") {
      current = cons.cap; fmt = (n) => formatAmount(cons, n); about = `${cons.label} · cap`;
    }
    return { sourceId: doc.id, ref: ch.ref, about, stated: fmt(ch.value), current: current == null ? "not in the planning baseline" : fmt(current), match: current != null && current === ch.value };
  });
}
