/**
 * MapDetail — the "Read more" card for one node or connection of a map state.
 *
 * Deliberately short: what it is, where it stands now (value, unit, period),
 * what changed at this stage and why (source + heading / row, pathway or
 * scenario), what is proposed there, and what is still to confirm. The
 * arithmetic behind a planning figure is one line.
 */
import { getConnectionType, getElementType, getState } from "@/lib/visuals/registry";
import { arithmetic } from "@/lib/lead/planning";
import type { MapMark, MapState } from "@/lib/lead/mapState";
import type { LeadCase } from "@/lib/lead/types";
import type { SourceRef } from "./InspectPanel";
import { EvidenceTag } from "./parts";
import type { MapSelection } from "./SystemsMap";

const TAG: Record<MapMark["kind"], string> = { source: "", pathway: "Pathway", scenario: "Scenario", ledger: "Calculated" };

const h4: React.CSSProperties = { margin: 0, font: "600 11.5px/1.3 var(--font-body)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ozv-muted)" };
const body: React.CSSProperties = { margin: 0, font: "400 13px/1.5 var(--font-body)" };

function Changes({ marks }: { marks: MapMark[] }) {
  if (!marks.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h4 style={h4}>What changed</h4>
      {marks.slice(0, 4).map((m, i) => (
        <div key={i} className={m.tone === "risk" ? "ozv-tone-negative" : undefined} style={{ display: "flex", gap: 8, alignItems: "baseline", font: "500 13px/1.45 var(--font-body)" }}>
          <span style={{ flexShrink: 0, padding: "1px 6px", borderRadius: 5, background: "var(--ozv-chip)", font: "600 10.5px/1.5 var(--font-mono, monospace)", color: "var(--ozv-muted)" }}>{m.kind === "source" ? m.by : TAG[m.kind]}</span>
          <span style={{ color: m.tone === "risk" ? "currentColor" : "var(--ozv-ink)" }}>{m.label}{m.kind === "source" && m.ref ? <span className="ozv-muted-text" style={{ fontWeight: 400 }}> · {m.ref}</span> : null}</span>
        </div>
      ))}
      {marks.length > 4 && <span className="ozv-muted-text" style={{ font: "400 12px/1.4 var(--font-body)" }}>+ {marks.length - 4} more</span>}
    </div>
  );
}

function Confirm({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h4 style={h4}>Still to confirm</h4>
      <ul style={{ margin: 0, paddingLeft: 16, font: "400 13px/1.45 var(--font-body)" }}>{items.slice(0, 3).map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

export function MapDetail({ lead, state, sel, sources, onSelect, onClose }: { lead: LeadCase; state: MapState; sel: NonNullable<MapSelection>; sources: SourceRef[]; onSelect: (s: MapSelection) => void; onClose?: () => void }) {
  const name = (id: string) => state.nodes.find((n) => n.id === id)?.label ?? id;
  const close = onClose ? <button type="button" className="ozv-btn" onClick={onClose} aria-label="Close details" style={{ height: 28 }}>Close</button> : null;
  const srcChips = (ids: string[]) => ids.length > 0 && (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
      <h4 style={{ ...h4, marginRight: 4 }}>Sources</h4>
      {ids.map((id) => <span key={id} title={sources.find((s) => s.id === id)?.title} className="ozv-chip">{id}</span>)}
    </div>
  );

  if (sel.kind === "edge") {
    const e = state.edges.find((x) => x.rel.id === sel.id);
    if (!e) return null;
    const r = e.rel, ct = getConnectionType(r.type), st = ct.states.find((s) => s.id === r.state) ?? ct.states[0];
    const dashed = e.origin !== "baseline" || st.t.outline === "dashed" || st.t.outline === "dotted" || st.id === "unknown";
    const link = (id: string) => <button type="button" className="ozv-chipbtn" style={{ background: "none", color: "inherit", padding: 0, textDecoration: "underline", font: "inherit" }} onClick={() => onSelect({ kind: "node", id })}>{name(id)}</button>;
    return (
      <section className="ozv-panel" aria-label={`Connection: ${name(r.from)} to ${name(r.to)}`} style={{ flexShrink: 0, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={h4}>Connection · {dashed ? (e.origin === "scenario" ? "scenario assumption" : "proposed or uncertain") : "existing"}</span>
            <h3 style={{ font: "600 16px/1.35 var(--font-display, var(--font-body))" }}>{link(r.from)}{ct.directed ? " → " : " ↔ "}{link(r.to)}</h3>
          </div>
          {close}
        </div>
        <p style={body}>{r.label || ct.label}{r.note ? <span className="ozv-muted-text"> — {r.note}</span> : null}</p>
        <Changes marks={e.marks} />
        {srcChips(Array.from(new Set([...r.sourceIds, ...e.marks.filter((m) => m.kind === "source").map((m) => m.by)])))}
        <p className="ozv-rule" style={{ margin: 0 }}>A dependency to check — not a measured effect.</p>
      </section>
    );
  }

  const n = state.nodes.find((x) => x.id === sel.id);
  if (!n) return null;
  const el = n.el;
  const st = el ? getState(el.visual, el.state) : null;
  const type = el ? getElementType(el.visual)?.label ?? "Element" : n.kind === "team" ? "Team" : "Organisation";
  const risks = n.marks.filter((m) => m.tone === "risk");
  const ledgerC = lead.planning?.constraints.find((c) => c.elementId === n.id);
  const steps = state.pathway ? state.pathway.plan.filter((s) => s.showsOn.includes(n.id)) : [];
  const members = state.nodes.filter((m) => m.el?.group === n.id);
  const team = n.kind === "team" ? lead.teams.find((t) => t.id === n.id) : null;
  const origin = n.origin === "pathway" ? "Proposed — not approved" : n.origin === "scenario" ? "Scenario assumption" : "";
  return (
    <section className="ozv-panel" aria-label={`Details: ${n.label}`} style={{ flexShrink: 0, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={h4}>{type}{origin ? ` · ${origin}` : ""}</span>
          <h3 style={{ font: "600 18px/1.3 var(--font-display, var(--font-body))" }}>{n.label}</h3>
          {el?.evidence ? <span><EvidenceTag type={el.evidence} holder={el.holder} /></span> : null}
        </div>
        {close}
      </div>
      {(el?.note || team?.purpose || (n.kind === "org" && lead.organisation.overview)) && <p style={body}>{el?.note || team?.purpose || lead.organisation.overview}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h4 style={h4}>Now</h4>
        <span style={{ font: "600 14px/1.4 var(--font-body)" }}>{n.display || st?.label || (team ? `${team.roles.length} roles · headcount not stated` : "—")}</span>
        {ledgerC && state.ledger && <span className="ozv-muted-text" style={{ font: "400 12px/1.45 var(--font-body)" }}>{arithmetic(state.ledger, ledgerC.id)}</span>}
        {risks.map((m, i) => <span key={i} className="ozv-tone-negative" style={{ font: "600 13px/1.4 var(--font-body)" }}>⚠ {m.label}</span>)}
      </div>
      <Changes marks={n.marks.filter((m) => !(m.kind === "ledger" && m.label === n.display) && m.tone !== "risk")} />
      {steps.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h4 style={h4}>Proposed here</h4>
          {steps.map((s) => <span key={s.id} style={{ font: "500 13px/1.45 var(--font-body)" }}>{s.title}</span>)}
        </div>
      )}
      {members.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{members.map((m) => <button key={m.id} type="button" className="ozv-chip ozv-chipbtn" onClick={() => onSelect({ kind: "node", id: m.id })}>{m.label}</button>)}</div>
      )}
      {team && team.roles.length > 0 && <p style={{ ...body, color: "var(--ozv-muted)" }}>Roles: {team.roles.join(", ")}</p>}
      <Confirm items={el?.unknowns ?? []} />
      {srcChips(n.sourceIds)}
    </section>
  );
}
