/**
 * InspectPanel — the inspectable detail for a selected element: what it is,
 * its state and what that state means visually, overlays, evidence type,
 * confidence (separate from severity), holder, measured value and the
 * sources behind it (title, date, scope). Private material is never shown —
 * only what the team entered for the demo.
 */
import { getElementType, getOverlay, getState } from "@/lib/visuals/registry";
import { Glyph } from "./Glyph";
import { ConfidenceMeter, EvidenceTag, StateLabel } from "./parts";
import type { VisualItem } from "./VisualNode";

export interface SourceRef { id: string; title: string; date: string; scope: string; docType?: string; owner?: string }

export function InspectPanel({ item, sources, onClose, extra }: { item: VisualItem; sources: SourceRef[]; onClose?: () => void; extra?: React.ReactNode }) {
  const et = getElementType(item.visual);
  const st = getState(item.visual, item.state);
  const refs = (item.sourceIds ?? []).map((id) => sources.find((s) => s.id === id) ?? { id, title: "", date: "", scope: "" });
  return (
    <section className="ozv-panel" aria-label={`Details: ${item.label}`}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span className={`ozv-tone-${st.t.tone ?? "neutral"}`}><Glyph glyph={et?.glyph ?? "document"} t={st.t} size={40} /></span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span className="ozv-node-type">{et?.label ?? "Element"}{et ? ` · ${et.cue}` : ""}</span>
          <h3 style={{ font: "600 16px/1.3 var(--font-display, var(--font-body))" }}>{item.label || "Unnamed"}</h3>
        </div>
        {onClose && <button type="button" className="ozv-btn" onClick={onClose} aria-label="Close details">Close</button>}
      </div>
      {item.note ? <p style={{ margin: 0, font: "400 13px/1.5 var(--font-body)" }}>{item.note}</p> : null}
      <dl className="ozv-dl">
        <dt>State</dt>
        <dd><StateLabel state={st} />{st.cue ? <div className="ozv-rule">{st.cue}</div> : null}</dd>
        {item.measure && item.measure.value.trim() ? (<><dt>Value</dt><dd>{item.measure.value}{item.measure.unit ? ` ${item.measure.unit}` : ""}{item.measure.asOf ? ` · ${item.measure.asOf}` : ""}</dd></>) : null}
        <dt>Overlays</dt>
        <dd>{item.overlays.length ? item.overlays.map((o) => { const d = getOverlay(o); return d ? <div key={o}><b>{d.label}</b> — {d.meaning}</div> : null; }) : <span className="ozv-muted-text">None</span>}</dd>
        <dt>Evidence</dt>
        <dd><EvidenceTag type={item.evidence} holder={item.holder} />{item.holder ? <div className="ozv-muted-text">View held by: {item.holder}</div> : null}</dd>
        <dt>Confidence</dt>
        <dd><ConfidenceMeter level={item.confidence} why={item.confidenceWhy} />{item.confidenceWhy ? <div className="ozv-muted-text">{item.confidenceWhy}</div> : null}</dd>
        <dt>Sources</dt>
        <dd style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {refs.length ? refs.map((s) => (
            <div key={s.id} className="ozv-src">
              <b>{s.id}{s.title ? ` · ${s.title}` : ""}</b>
              <span>{[s.docType, s.date ? `Dated ${s.date}` : "Date not given", s.owner ? `Owner: ${s.owner}` : ""].filter(Boolean).join(" · ")}</span>
              <span>Scope: {s.scope || "not described"}</span>
            </div>
          )) : <span className="ozv-muted-text">No source linked yet.</span>}
        </dd>
      </dl>
      {et?.rule ? <p className="ozv-rule" style={{ margin: 0 }}>Rule: {et.rule}</p> : null}
      {extra}
    </section>
  );
}
