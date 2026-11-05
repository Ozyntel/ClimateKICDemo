/**
 * Small reusable visual parts: state label, overlay chip, evidence tag,
 * confidence meter. Each pairs colour with text and a pattern / shape.
 */
import {
  CONFIDENCE_LEVELS,
  getEvidenceType,
  getOverlay,
  type ConfidenceLevel,
  type EvidenceType,
  type StateDef,
} from "@/lib/visuals/registry";
import { Badge } from "./Glyph";

export function StateLabel({ state, prefix }: { state: StateDef; prefix?: string }) {
  const t = state.t;
  return (
    <span className={`ozv-state ozv-tone-${t.tone ?? "neutral"}`}>
      <i className="ozv-state-mark" data-outline={t.outline ?? "solid"} data-fill={t.fill ?? "solid"} aria-hidden />
      {prefix ? <span className="ozv-muted-text" style={{ fontWeight: 500 }}>{prefix}</span> : null}
      {state.label}
    </span>
  );
}

export function OverlayChip({ id }: { id: string }) {
  const o = getOverlay(id);
  if (!o) return null;
  return (
    <span className={`ozv-chip ozv-tone-${o.tone}`} title={o.meaning}>
      <svg width="16" height="16" viewBox="31 1 16 16" aria-hidden><Badge id={o.badge} /></svg>
      {o.label}
    </span>
  );
}

export function EvidenceTag({ type, holder }: { type: EvidenceType | "" | undefined; holder?: string }) {
  const ev = getEvidenceType(type);
  if (!ev) return <span className="ozv-chip ozv-ev-none" title="No evidence type recorded for this item.">Source type not stated</span>;
  const tone = ev.id === "illustrative" ? "scenario" : ev.id === "assumption" ? "proposed" : "neutral";
  return (
    <span className={`ozv-chip ozv-ev-${ev.id} ozv-tone-${tone}`} title={ev.meaning}>
      {ev.label}{ev.id === "stakeholder" && holder ? ` · ${holder}` : ""}
    </span>
  );
}

export function ConfidenceMeter({ level, why }: { level: ConfidenceLevel | undefined; why?: string }) {
  const c = CONFIDENCE_LEVELS.find((x) => x.id === level) ?? CONFIDENCE_LEVELS[0];
  return (
    <span className={`ozv-conf ${c.id === "unknown" ? "ozv-tone-unknown" : ""}`} title={why || c.label}>
      {c.id === "unknown" ? <span aria-hidden>?</span> : (
        <span className="ozv-conf-bar" aria-hidden>{[1, 2, 3].map((i) => <i key={i} data-on={i <= c.segments} />)}</span>
      )}
      {c.label}
    </span>
  );
}
