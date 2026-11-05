/**
 * VisualNode — one configured element: base glyph + state + overlays +
 * evidence. Renders as a <button> when selectable (keyboard accessible).
 */
import { getElementType, getOverlay, getState, type ConfidenceLevel, type EvidenceType } from "@/lib/visuals/registry";
import { Glyph } from "./Glyph";
import { ConfidenceMeter, EvidenceTag, OverlayChip, StateLabel } from "./parts";

export interface VisualItem {
  id: string;
  label: string;
  visual: string;
  state: string;
  overlays: string[];
  evidence?: EvidenceType | "";
  confidence?: ConfidenceLevel;
  confidenceWhy?: string;
  holder?: string;
  note?: string;
  measure?: { value: string; unit: string; asOf: string };
  sourceIds?: string[];
}

interface Props {
  item: VisualItem;
  size?: number;
  selected?: boolean;
  /** Marks the node as changed in a scenario (dashed scenario border + text). */
  changed?: string | null;
  onSelect?: (id: string) => void;
  compact?: boolean;
}

export function VisualNode({ item, size = 44, selected, changed, onSelect, compact }: Props) {
  const et = getElementType(item.visual);
  const st = getState(item.visual, item.state);
  const overlays = item.overlays.map((o) => getOverlay(o)).filter(Boolean);
  const hasMeasure = !!item.measure && !!item.measure.value.trim();
  const body = (
    <>
      <span className={`ozv-tone-${st.t.tone ?? "neutral"}`}>
        <Glyph glyph={et?.glyph ?? "document"} t={st.t} size={size} overlays={overlays.map((o) => ({ badge: o!.badge, title: o!.label }))} />
      </span>
      <span className="ozv-node-body">
        <span className="ozv-node-label">{item.label || "Unnamed"}</span>
        <span className="ozv-node-type">{et?.label ?? "Unknown element type"}</span>
        <StateLabel state={st} />
        {hasMeasure && (
          <span className="ozv-measure">{item.measure!.value}{item.measure!.unit ? ` ${item.measure!.unit}` : ""}{item.measure!.asOf ? <span className="ozv-muted-text" style={{ fontWeight: 400 }}> · {item.measure!.asOf}</span> : null}</span>
        )}
        {changed ? <span className="ozv-chip ozv-ev-illustrative ozv-tone-scenario">Changed in scenario · {changed}</span> : null}
        {!compact && (
          <span className="ozv-row">
            {item.overlays.map((o) => <OverlayChip key={o} id={o} />)}
            <EvidenceTag type={item.evidence} holder={item.holder} />
            {item.confidence && item.confidence !== "unknown" ? <ConfidenceMeter level={item.confidence} why={item.confidenceWhy} /> : null}
          </span>
        )}
      </span>
    </>
  );
  const a11y = `${item.label || "Unnamed"}, ${et?.label ?? "element"}, state: ${st.label}${overlays.length ? ", " + overlays.map((o) => o!.label).join(", ") : ""}${changed ? ", changed in scenario: " + changed : ""}`;
  if (onSelect) {
    return (
      <button type="button" className="ozv-node" aria-pressed={!!selected} aria-label={a11y} data-changed={!!changed} onClick={() => onSelect(item.id)}>
        {body}
      </button>
    );
  }
  return (
    <div className="ozv-node" data-selected={!!selected} data-changed={!!changed} aria-label={a11y} role="group">
      {body}
    </div>
  );
}
