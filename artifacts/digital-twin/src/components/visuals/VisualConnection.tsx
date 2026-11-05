/**
 * VisualConnection — a labelled connection between two elements.
 *
 * Rules (Notion "Demo Visual Elements"):
 *   - Thickness = interaction frequency, only when it is known. Unknown →
 *     neutral width and the text says "frequency not known".
 *   - A line never proves causality: the label states the relationship.
 *   - Dependency is directed; tension is a zigzag; trust is a bridge; a
 *     blocked state adds a barrier. Dashed = proposed / uncertain.
 */
import { getConnectionType, strokeForFrequency, type Frequency } from "@/lib/visuals/registry";
import { Badge } from "./Glyph";
import { EvidenceTag, StateLabel } from "./parts";
import type { EvidenceType } from "@/lib/visuals/registry";

export interface ConnectionItem {
  id: string;
  fromLabel: string;
  toLabel: string;
  type: string;
  state: string;
  label: string;
  frequency: Frequency;
  evidence?: EvidenceType | "";
}

const FREQ_TEXT: Record<Frequency, string> = { unknown: "frequency not known", low: "less frequent", medium: "regular", high: "frequent" };

/** A horizontal SVG sample of the connection (used in lists, legends and the preview). */
export function ConnectionGlyph({ type, state, frequency, width = 120 }: { type: string; state: string; frequency: Frequency; width?: number }) {
  const ct = getConnectionType(type);
  const st = ct.states.find((s) => s.id === state) ?? ct.states[0];
  const sw = strokeForFrequency(frequency);
  const dash = st.t.outline === "dashed" ? "6 5" : st.t.outline === "dotted" ? "1.5 4" : undefined;
  const y = 14, x0 = 6, x1 = width - 6;
  let path = `M${x0} ${y}H${x1}`;
  if (ct.pattern === "zigzag") {
    const k = Math.max(2, st.t.count ?? 3);
    const w = (x1 - x0 - 30) / k;
    path = `M${x0} ${y}H${x0 + 15}` + Array.from({ length: k }, (_, i) => `l${w / 2} ${i % 2 ? 5 : -5}l${w / 2} ${i % 2 ? -5 : 5}`).join("") + `H${x1}`;
  }
  if (ct.pattern === "bridge") path = `M${x0} ${y + 6}Q${width / 2} ${y - 12} ${x1} ${y + 6}M${x0} ${y + 6}H${x1}`;
  return (
    <svg width={width} height={28} viewBox={`0 0 ${width} 28`} className={`ozv-glyph ozv-tone-${st.t.tone ?? "neutral"}`} aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round" className={ct.pattern === "flow" && st.t.motion === "flow" ? "ozv-dash" : undefined} />
      {ct.directed && <path d={`M${x1 - 7} ${y - 5}L${x1} ${y}L${x1 - 7} ${y + 5}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      {st.t.badge && <g transform={`translate(${width / 2 - 39} 5)`}><Badge id={st.t.badge} /></g>}
    </svg>
  );
}

export function VisualConnection({ item }: { item: ConnectionItem }) {
  const ct = getConnectionType(item.type);
  const st = ct.states.find((s) => s.id === item.state) ?? ct.states[0];
  return (
    <div className="ozv-conn" role="group" aria-label={`${item.fromLabel} to ${item.toLabel}: ${ct.label}, ${st.label}, ${FREQ_TEXT[item.frequency]}${item.label ? ", " + item.label : ""}`}>
      <ConnectionGlyph type={item.type} state={item.state} frequency={item.frequency} width={96} />
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <b style={{ font: "600 12.5px/1.3 var(--font-body)" }}>{item.fromLabel} {ct.directed ? "→" : "↔"} {item.toLabel}</b>
        <span>{item.label || ct.label}</span>
        <span className="ozv-row">
          <StateLabel state={st} />
          <span className="ozv-muted-text" style={{ font: "500 11px/1.3 var(--font-body)" }}>{ct.label} · {FREQ_TEXT[item.frequency]}</span>
          <EvidenceTag type={item.evidence} />
        </span>
      </span>
    </div>
  );
}
