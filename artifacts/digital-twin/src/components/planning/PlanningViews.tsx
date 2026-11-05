/**
 * Planning baseline panel — available, committed and headroom for each
 * separate constraint, plus capacity ceilings and plain notes.
 *
 * Every figure comes from src/lib/lead/planning.ts (derived from the case's
 * planning ledger). Cash, hours … are separate constraints and are never
 * added together. Capacity is labelled as a ceiling.
 */
import { EvidenceTag } from "@/components/visuals/parts";
import { baselineLedger, formatAmount, formatMetric, type Ledger } from "@/lib/lead/planning";
import type { LeadCase } from "@/lib/lead/types";

const C = (dark?: boolean) => dark
  ? { ink: "#F6F3EC", sub: "#C3CFD4", mute: "#9FB3BC", line: "rgba(195,207,212,0.16)", card: "rgba(17,21,31,0.92)", chip: "rgba(255,255,255,0.05)", track: "rgba(195,207,212,0.14)", ok: "#9FD3C7", warn: "#F5CF5B", bad: "#FF7A5C", accent: "#C4B5FD" }
  : { ink: "#221E2E", sub: "#453E54", mute: "#6A6376", line: "#E9E2D4", card: "#FFFFFF", chip: "#F4F1EA", track: "#ECE6DA", ok: "#0E8C72", warn: "#A76100", bad: "#C8321B", accent: "#6236E8" };

/** Baseline: available, committed and headroom per constraint, plus capacity (ceilings) and plain notes. */
export function PlanningBaseline({ lead, dark }: { lead: LeadCase; dark?: boolean }) {
  const b = baselineLedger(lead);
  if (!b || !lead.planning) return null;
  const c = C(dark);
  const pl = lead.planning;
  const ev = pl.constraints[0]?.evidence || pl.components[0]?.evidence || "";
  const cell: React.CSSProperties = { padding: "10px 12px", borderTop: `1px solid ${c.line}`, verticalAlign: "top", textAlign: "left" };
  const big: React.CSSProperties = { font: "700 18px/1.2 var(--font-display)", color: c.ink, whiteSpace: "nowrap" };
  return (
    <section aria-labelledby="plan-base-h" data-testid="planning-baseline" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", borderRadius: 16, background: c.card, border: `1px solid ${c.line}` }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h2 id="plan-base-h" style={{ margin: 0, font: "700 17px/1.3 var(--font-display)", color: c.ink }}>Planning baseline{pl.period ? ` · ${pl.period}` : ""}</h2>
        <span className={`ozv${dark ? " ozv-dark" : ""}`}><EvidenceTag type={ev} /></span>
      </div>
      {pl.note && <p style={{ margin: 0, font: "400 13.5px/1.5 var(--font-body)", color: c.sub }}>{pl.note}</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse", font: "400 13px/1.4 var(--font-body)", color: c.sub }}>
          <caption className="ozv-sr">Baseline resources: available, committed and headroom for each separate constraint</caption>
          <thead><tr>{["Constraint (separate)", "Available", "Committed by existing delivery", "Headroom"].map((h) => <th key={h} scope="col" style={{ ...cell, borderTop: "none", font: "600 12px/1.3 var(--font-body)", color: c.mute }}>{h}</th>)}</tr></thead>
          <tbody>
            {b.totals.map((t) => (
              <tr key={t.constraint.id}>
                <th scope="row" style={{ ...cell, font: "600 13px/1.35 var(--font-body)", color: c.ink }}>{t.constraint.label}</th>
                <td style={cell}><span style={big}>{t.cap == null ? "Unknown" : formatAmount(t.constraint, t.cap)}</span></td>
                <td style={cell}><span style={big}>{formatAmount(t.constraint, t.allocated)}</span></td>
                <td style={cell}><span style={{ ...big, color: (t.headroom ?? 0) < 0 ? c.bad : c.ink }}>{t.headroom == null ? "Unknown" : formatAmount(t.constraint, t.headroom)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {b.metrics.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {b.metrics.map((m) => (
            <span key={m.metric.id} title={m.metric.note} style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "7px 11px", borderRadius: 12, background: c.chip, color: c.sub, font: "500 12.5px/1.3 var(--font-body)" }}>
              <b style={{ font: "700 16px/1 var(--font-display)", color: c.ink }}>{formatMetric(m.metric, m.value)}</b>{m.metric.label.toLowerCase()}
            </span>
          ))}
          <PerUnit ledger={b} color={c.mute} />
        </div>
      )}
      {pl.notes.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, font: "400 12.5px/1.5 var(--font-body)", color: c.sub }}>
          {pl.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </section>
  );
}

/**
 * "= 12 target founder teams per cohort": the ratio of the first two metrics shown on the
 * same element, when it divides evenly. Derived, never typed.
 */
function PerUnit({ ledger, color }: { ledger: Ledger; color: string }) {
  const shared = ledger.metrics.filter((m) => m.metric.elementId && ledger.metrics.filter((x) => x.metric.elementId === m.metric.elementId).length >= 2);
  const [unit, per] = shared;
  if (!unit || !per || unit.metric.elementId !== per.metric.elementId || !unit.value || per.value % unit.value !== 0) return null;
  return <span style={{ alignSelf: "center", font: "400 12px/1.3 var(--font-body)", color }}>= {per.value / unit.value} {per.metric.label.toLowerCase()} per {unit.metric.label.toLowerCase().replace(/s$/, "")}</span>;
}
