/**
 * SystemsMap — the labelled systems view of a map state.
 *
 * A decision-relevant overview drawn with the visual vocabulary: each element
 * is its registry glyph + state treatment + overlay badges; each connection
 * is a labelled line whose pattern says what it is (solid = existing,
 * dashed = proposed or uncertain, dotted = scenario assumption). Line width
 * is constant — it never stands for causal strength — and an arrow is a
 * dependency to check, never a measured effect.
 *
 * Changes from the shown option / scenario get a persistent label under the
 * node, so nothing depends on animation; the ripple along affected
 * connections is decorative and skipped for reduced motion.
 *
 * Fills its container: the whole model fits at first; the wheel, a pinch or
 * the zoom buttons (via the ref handle) zoom in around the pointer, and
 * dragging pans through it. A drag never counts as a click.
 *
 * Accessible: every node and connection is a focusable button (Enter /
 * Space to inspect, Escape to clear); the List view is the full non-visual
 * alternative.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { getConnectionType, getElementType, getOverlay, getState, type Tone } from "@/lib/visuals/registry";
import type { MapEdge, MapNode, MapState, MarkTone } from "@/lib/lead/mapState";
import type { ImpactRoute } from "@/lib/lead/types";
import { Badge, Glyph } from "./Glyph";

export type MapSelection = { kind: "node" | "edge"; id: string } | null;

interface Props {
  state: MapState;
  selected: MapSelection;
  /** Called with the selection and, for clicks, the point (px) within the map where it happened. */
  onSelect: (s: MapSelection, point?: { x: number; y: number }) => void;
  /** Increment to play the ripple along highlighted connections. */
  rippleKey: number;
  reducedMotion: boolean;
  route: ImpactRoute | null;
  allLabels: boolean;
  /** Pixels at the top / right of the container covered by other controls; the fitted model sits clear of them. */
  padTop?: number;
  padRight?: number;
}

export interface SystemsMapHandle { zoom: (factor: number) => void; reset: () => void }

const ZMIN = 0.6, ZMAX = 6;
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
type Pad = { top: number; right: number };
/** Pixels per model unit at zoom z (z = 1 fits the whole model in the area not covered by other controls). */
const scaleOf = (z: number, w: number, h: number, pad: Pad) => Math.min(Math.max(160, w - pad.right) / VW, Math.max(80, h - pad.top) / VH) * 0.96 * z;
/** The screen point (px) where the view centre is drawn: the middle of the uncovered area. */
const centreOf = (w: number, h: number, pad: Pad) => ({ x: (w - (w - pad.right >= 160 ? pad.right : 0)) / 2, y: (h + pad.top) / 2 });

const VW = 1200, VH = 740, PADX = 112, PADY = 62, NW = 200;
const MW = 104, MH = 44; // group member chip

const TONE_OF_MARK: Record<MarkTone, Tone> = { neutral: "neutral", risk: "negative", benefit: "positive", mixed: "caution", proposed: "proposed", scenario: "scenario" };

function wrap(text: string, max: number, lines: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim();
    else { if (cur) out.push(cur); cur = w; }
    if (out.length === lines) break;
  }
  if (out.length < lines && cur) out.push(cur);
  const used = out.join(" ").length;
  if (used < text.length && out.length) out[out.length - 1] = out[out.length - 1].slice(0, Math.max(1, max - 1)).trim() + "…";
  return out.slice(0, lines);
}
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trim() + "…" : s);

interface Box { id: string; x: number; y: number; w: number; h: number; node: MapNode; group?: boolean; member?: boolean; label: string[]; sub: string[] }

function nodeTone(n: MapNode): Tone {
  if (n.origin === "pathway") return "proposed";
  if (n.origin === "scenario") return "scenario";
  return n.el ? getState(n.el.visual, n.el.state).t.tone ?? "neutral" : "neutral";
}

function layout(state: MapState): Map<string, Box> {
  const boxes = new Map<string, Box>();
  const els = state.nodes.filter((n) => n.kind === "element" && n.el);
  const groups = new Set(els.map((n) => n.el!.group).filter(Boolean));
  const members = (gid: string) => els.filter((n) => n.el!.group === gid);
  const hasPos = (n: MapNode) => !!n.el!.pos && n.el!.pos.x != null && n.el!.pos.y != null;
  // a hand-laid-out case shows only what was placed (plus group members); other elements live on the map and list views
  const manual = els.some(hasPos);
  const placed = els.filter((n) => (!n.el!.group || !els.some((g) => g.id === n.el!.group)) && (!manual || hasPos(n)));
  const auto = placed.filter((n) => !hasPos(n));
  const cols = Math.max(1, Math.ceil(Math.sqrt(auto.length * 1.7)));
  const rows = Math.max(1, Math.ceil(auto.length / cols));
  placed.forEach((n) => {
    const ai = auto.indexOf(n);
    const pos = ai >= 0 ? { x: ((ai % cols) + 0.5) / cols * 100, y: (Math.floor(ai / cols) + 0.5) / rows * 100 } : n.el!.pos!;
    const cx = PADX + (pos.x / 100) * (VW - 2 * PADX), cy = PADY + (pos.y / 100) * (VH - 2 * PADY);
    if (groups.has(n.id)) {
      const ms = members(n.id), c = Math.min(2, Math.max(1, ms.length)), r = Math.ceil(ms.length / c);
      const w = Math.max(NW + 30, c * MW + (c + 1) * 10), h = 46 + r * MH + (r + 1) * 8;
      const label = wrap(n.label, 30, 1);
      boxes.set(n.id, { id: n.id, x: cx - w / 2, y: cy - h / 2, w, h, node: n, group: true, label, sub: [] });
      ms.forEach((m, i) => boxes.set(m.id, { id: m.id, x: cx - w / 2 + 10 + (i % c) * (MW + 10), y: cy - h / 2 + 46 + Math.floor(i / c) * (MH + 8), w: MW, h: MH, node: m, member: true, label: [clip(m.label, 12)], sub: [] }));
      return;
    }
    const label = wrap(n.label, 19, 2);
    const st = n.el ? getState(n.el.visual, n.el.state) : null;
    const sub = wrap(n.display || st?.label || "", 24, 2);
    const h = Math.max(66, 22 + (label.length + sub.length) * 15);
    boxes.set(n.id, { id: n.id, x: cx - NW / 2, y: cy - h / 2, w: NW, h, node: n, label, sub });
  });
  return boxes;
}

/** Point where the line from the box centre towards (tx, ty) leaves the box. */
function exitPoint(b: Box, tx: number, ty: number) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const s = Math.min(Math.abs((b.w / 2 + 3) / (dx || 1e-6)), Math.abs((b.h / 2 + 3) / (dy || 1e-6)));
  return { x: cx + dx * s, y: cy + dy * s };
}

function edgeGeom(a: Box, b: Box, bend: number) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const mx = (ac.x + bc.x) / 2, my = (ac.y + bc.y) / 2, len = Math.hypot(bc.x - ac.x, bc.y - ac.y) || 1;
  const nx = -(bc.y - ac.y) / len, ny = (bc.x - ac.x) / len, k = Math.min(60, len * 0.12) * bend;
  const c = { x: mx + nx * k, y: my + ny * k };
  const p0 = exitPoint(a, c.x, c.y), p1 = exitPoint(b, c.x, c.y);
  const mid = { x: 0.25 * p0.x + 0.5 * c.x + 0.25 * p1.x, y: 0.25 * p0.y + 0.5 * c.y + 0.25 * p1.y };
  const ang = Math.atan2(p1.y - c.y, p1.x - c.x);
  return { d: `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)}Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`, mid, end: p1, ang, p0, c, p1 };
}

/** How many unrelated boxes a curve passes through (sampled), so a line never seems to connect to a node it only crosses. */
function crossings(g: ReturnType<typeof edgeGeom>, boxes: Box[], skip: Set<string>): number {
  let hits = 0;
  for (const b of boxes) {
    if (skip.has(b.id)) continue;
    for (let i = 2; i <= 22; i++) {
      const t = i / 24, u = 1 - t;
      const x = u * u * g.p0.x + 2 * u * t * g.c.x + t * t * g.p1.x, y = u * u * g.p0.y + 2 * u * t * g.c.y + t * t * g.p1.y;
      if (x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6) { hits++; break; }
    }
  }
  return hits;
}

/** The gentlest bend (preferring the usual side) whose curve crosses the fewest unrelated nodes. */
function routeEdge(a: Box, b: Box, all: Box[], prefer: number) {
  const skip = new Set([a.id, b.id]);
  // a member's own group container (and a group's members) don't count as obstacles
  for (const x of [a, b]) {
    if (x.member) all.forEach((g) => { if (g.group && g.node.id === x.node.el?.group) skip.add(g.id); });
    if (x.group) all.forEach((m) => { if (m.member && m.node.el?.group === x.node.id) skip.add(m.id); });
  }
  const obstacles = all.filter((x) => !skip.has(x.id));
  let best = edgeGeom(a, b, prefer), bestHits = crossings(best, obstacles, skip);
  for (const k of [prefer, -prefer, 2 * prefer, -2 * prefer, 3.2 * prefer, -3.2 * prefer, 4.5 * prefer, -4.5 * prefer]) {
    if (bestHits === 0) break;
    const g = edgeGeom(a, b, k), h = crossings(g, obstacles, skip);
    if (h < bestHits) { best = g; bestHits = h; }
  }
  return best;
}

function edgeStyle(e: MapEdge): { tone: Tone; dash?: string; label: string } {
  const ct = getConnectionType(e.rel.type);
  const st = ct.states.find((s) => s.id === e.rel.state) ?? ct.states[0];
  if (e.origin === "scenario") return { tone: "scenario", dash: "1.5 5", label: "Scenario assumption" };
  if (e.origin === "pathway") return { tone: "proposed", dash: "7 5", label: "Proposed" };
  const dash = st.t.outline === "dashed" ? "7 5" : st.t.outline === "dotted" ? "1.5 5" : undefined;
  const tone: Tone = st.id === "unknown" ? "unknown" : st.t.tone ?? "neutral";
  return { tone, dash, label: st.id === "unknown" ? "State not known" : dash ? st.label : "Existing" };
}

/** The persistent change label drawn under a node (risk first, then option / scenario effects). */
function effectOf(n: MapNode) {
  return n.marks.find((m) => m.kind !== "source" && m.tone === "risk" && !(m.kind === "ledger" && m.label === n.display)) ?? n.marks.find((m) => (m.kind === "pathway" || m.kind === "scenario") && m.label !== "Proposed" && !m.label.startsWith("Proposed:"));
}
type Rect = { x0: number; y0: number; x1: number; y1: number };
/** Change label lines, kept within the node's width (two lines at most). */
function effectBox(label: string, risk: boolean) {
  const lines = wrap((risk ? "⚠ " : "") + label, 31, 2);
  return { lines, w: Math.max(...lines.map((l) => l.length)) * 5.6 + 16, h: lines.length * 12 + 7 };
}
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

export const SystemsMap = forwardRef<SystemsMapHandle, Props>(function SystemsMap({ state, selected, onSelect, rippleKey, reducedMotion, route, allLabels, padTop = 0, padRight = 0 }, ref) {
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // ── zoom & pan: (cx, cy) is the model point shown at the centre of the uncovered area
  const [size, setSize] = useState({ w: VW, h: VH });
  const [view, setView] = useState({ z: 1, cx: VW / 2, cy: VH / 2 });
  const pad = useMemo(() => ({ top: padTop, right: padRight }), [padTop, padRight]);
  const geo = useRef({ size, pad });
  geo.current = { size, pad };
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { const r = e.contentRect; if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const zoomAt = useCallback((f: number, px?: number, py?: number) => setView((v) => {
    const { size: sz, pad: pd } = geo.current, z = clampN(v.z * f, ZMIN, ZMAX);
    const s0 = scaleOf(v.z, sz.w, sz.h, pd), s1 = scaleOf(z, sz.w, sz.h, pd), c = centreOf(sz.w, sz.h, pd);
    const x = (px ?? c.x) - c.x, y = (py ?? c.y) - c.y;
    const mx = v.cx + x / s0, my = v.cy + y / s0; // the model point under the pointer stays where it is
    return { z, cx: clampN(mx - x / s1, 0, VW), cy: clampN(my - y / s1, 0, VH) };
  }), []);
  useImperativeHandle(ref, () => ({ zoom: (f) => zoomAt(f), reset: () => setView({ z: 1, cx: VW / 2, cy: VH / 2 }) }), [zoomAt]);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; x: number; y: number; d: number } | null>(null);
  const dragged = useRef(false);
  const [grabbing, setGrabbing] = useState(false);
  const pairDist = () => { const [a, b] = Array.from(ptrs.current.values()); return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragged.current = false;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { moved: drag.current?.moved ?? false, x: e.clientX, y: e.clientY, d: pairDist() };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId), d = drag.current;
    if (!prev || !d) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svgRef.current!.getBoundingClientRect();
    if (ptrs.current.size >= 2) {
      const [a, b] = Array.from(ptrs.current.values()), nd = pairDist();
      if (d.d > 0 && nd > 0) zoomAt(nd / d.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      d.d = nd; d.moved = true;
      return;
    }
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    if (!d.moved) { d.moved = true; setGrabbing(true); svgRef.current?.setPointerCapture?.(e.pointerId); }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    setView((v) => { const { size: sz, pad: pd } = geo.current, s = scaleOf(v.z, sz.w, sz.h, pd); return { ...v, cx: clampN(v.cx - dx / s, 0, VW), cy: clampN(v.cy - dy / s, 0, VH) }; });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (drag.current?.moved) dragged.current = true;
    if (ptrs.current.size === 0) { drag.current = null; setGrabbing(false); }
  };
  const sc = scaleOf(view.z, size.w, size.h, pad), ctr = centreOf(size.w, size.h, pad);
  const vb = { w: size.w / sc, h: size.h / sc, x: view.cx - ctr.x / sc, y: view.cy - ctr.y / sc };

  const at = (ev: React.MouseEvent) => { const r = svgRef.current?.getBoundingClientRect(); return r ? { x: ev.clientX - r.left, y: ev.clientY - r.top } : undefined; };
  const isRisk = (n: MapNode) => n.marks.some((m) => m.tone === "risk");
  const riskIds = new Set(state.nodes.filter(isRisk).map((n) => n.id));
  const boxes = useMemo(() => layout(state), [state]);
  const changed = new Set(state.changed);
  const selNode = selected?.kind === "node" ? selected.id : null;
  const focusNode = selNode ?? hover;
  const anyHighlight = state.edges.some((e) => e.highlight);
  const routeIds = route ? route.steps.map((s) => s.nodeId).filter((id) => boxes.has(id)) : [];
  const routePairs = routeIds.slice(1).map((id, i) => [routeIds[i], id] as const).filter(([a, b]) => a !== b);
  const onRoute = (a: string, b: string) => routePairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  const key = (e: React.KeyboardEvent, s: MapSelection) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s); }
    if (e.key === "Escape") onSelect(null);
  };

  // a group member's connection that its group already has to the same element is drawn once, on the group
  const edges = useMemo(() => {
    const groupOf = (id: string) => (boxes.get(id)?.member ? boxes.get(id)!.node.el?.group || "" : "");
    const has = (a: string, b: string) => state.edges.some((x) => (x.rel.from === a && x.rel.to === b) || (x.rel.from === b && x.rel.to === a));
    return state.edges.filter((e) => boxes.has(e.rel.from) && boxes.has(e.rel.to) && !(groupOf(e.rel.from) && has(groupOf(e.rel.from), e.rel.to)) && !(groupOf(e.rel.to) && has(groupOf(e.rel.to), e.rel.from)));
  }, [state.edges, boxes]);
  const allBoxes = useMemo(() => Array.from(boxes.values()), [boxes]);
  const geoms = useMemo(() => {
    const pairCount = new Map<string, number>();
    return new Map(edges.map((e) => {
      const pk = [e.rel.from, e.rel.to].sort().join("|");
      const n = pairCount.get(pk) ?? 0; pairCount.set(pk, n + 1);
      return [e.rel.id, routeEdge(boxes.get(e.rel.from)!, boxes.get(e.rel.to)!, allBoxes, n === 0 ? 1 : -1.6)] as const;
    }));
  }, [edges, boxes, allBoxes]);

  // ── connection labels: priority order, never on top of each other or of a node
  const lit = (e: MapEdge) => (selected?.kind === "edge" && selected.id === e.rel.id ? 3 : focusNode && (e.rel.from === focusNode || e.rel.to === focusNode) ? 2 : e.highlight || onRoute(e.rel.from, e.rel.to) ? 1 : allLabels ? 0 : -1);
  const labels = new Map<string, { x: number; y: number; text: string; tw: number }>();
  {
    const placed: Rect[] = [];
    const nodeRects: Rect[] = allBoxes.filter((b) => !b.group).map((b) => ({ x0: b.x - 2, y0: b.y - 2, x1: b.x + b.w + 2, y1: b.y + b.h + 2 }));
    allBoxes.forEach((b) => { const ef = !b.member && !b.group ? effectOf(b.node) : undefined; if (ef) { const { w, h } = effectBox(ef.label, ef.tone === "risk"); placed.push({ x0: b.x + b.w / 2 - w / 2, y0: b.y + b.h + 3, x1: b.x + b.w / 2 + w / 2, y1: b.y + b.h + 4 + h }); } });
    const items = edges.map((e) => ({ e, pri: lit(e) })).filter((x) => x.pri >= 0).sort((a, b) => b.pri - a.pri);
    for (const { e, pri } of items) {
      const g = geoms.get(e.rel.id)!, text = clip(e.rel.label || getConnectionType(e.rel.type).label, 38), tw = text.length * 5.9 + 16;
      for (const dy of [0, -15, 15, -30, 30]) {
        const r = { x0: g.mid.x - tw / 2 - 2, y0: g.mid.y + dy - 11, x1: g.mid.x + tw / 2 + 2, y1: g.mid.y + dy + 11 };
        if (pri >= 3 || (!placed.some((q) => overlaps(q, r)) && !nodeRects.some((q) => overlaps(q, r)))) { placed.push(r); labels.set(e.rel.id, { x: g.mid.x, y: g.mid.y + dy, text, tw }); break; }
      }
    }
  }

  return (
    <svg ref={svgRef} viewBox={`${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`} width="100%" height="100%" style={{ display: "block", touchAction: "none", cursor: grabbing ? "grabbing" : "grab", userSelect: "none" }} role="group" aria-label="Systems view: elements and labelled connections. Drag to move, scroll or pinch to zoom. Use Tab to move between items and Enter to inspect one." onClick={() => onSelect(null)} onClickCapture={(e) => { if (dragged.current) { dragged.current = false; e.stopPropagation(); e.preventDefault(); } }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} data-testid="systems-map" data-zoom={view.z.toFixed(2)}>
      <defs>
        <pattern id="ozv-sys-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v6" stroke="currentColor" strokeWidth={1.4} strokeOpacity={0.35} /></pattern>
      </defs>

      {/* groups first (behind) */}
      {Array.from(boxes.values()).filter((b) => b.group).map((b) => (
        <g key={b.id} className="ozv-tone-neutral">
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={16} style={{ fill: "rgba(255,255,255,0.03)", stroke: selNode === b.id ? "var(--ozv-focus)" : "var(--ozv-line)" }} strokeWidth={1.4} />
        </g>
      ))}

      {/* connections */}
      {edges.map((e) => {
        const a = boxes.get(e.rel.from)!, b = boxes.get(e.rel.to)!;
        const g = geoms.get(e.rel.id)!;
        const st = edgeStyle(e);
        const ct = getConnectionType(e.rel.type);
        const isSel = selected?.kind === "edge" && selected.id === e.rel.id;
        const touches = !!focusNode && (e.rel.from === focusNode || e.rel.to === focusNode);
        const routeHl = onRoute(e.rel.from, e.rel.to);
        const on = isSel || touches || e.highlight || routeHl;
        const dim = (anyHighlight || !!focusNode || !!route) && !on;
        const badge = (ct.states.find((s) => s.id === e.rel.state) ?? ct.states[0]).t.badge;
        const tone = e.highlight && (riskIds.has(e.rel.from) || riskIds.has(e.rel.to)) ? "negative" : routeHl && !e.highlight ? "scenario" : st.tone;
        return (
          <g key={e.rel.id} opacity={dim ? 0.32 : 1} role="button" tabIndex={0}
            aria-label={`Connection: ${a.node.label} ${ct.directed ? "to" : "and"} ${b.node.label}. ${e.rel.label || ct.label}. ${st.label}.${e.highlight ? " Affected by the shown option or scenario." : ""}`}
            aria-pressed={isSel} onClick={(ev) => { ev.stopPropagation(); onSelect({ kind: "edge", id: e.rel.id }, at(ev)); }} onKeyDown={(ev) => key(ev, { kind: "edge", id: e.rel.id })} style={{ cursor: "pointer", outline: "none" }} className={`ozv-tone-${tone} ozv-sys-edge`}>
            <path d={g.d} fill="none" stroke="transparent" strokeWidth={14} />
            <path d={g.d} fill="none" stroke="currentColor" strokeWidth={1.8} strokeDasharray={st.dash} strokeLinecap="round" className={e.highlight && !reducedMotion ? "ozv-dash" : undefined} />
            {ct.directed && <path d="M-8 -4.5L0 0L-8 4.5" transform={`translate(${g.end.x.toFixed(1)} ${g.end.y.toFixed(1)}) rotate(${(g.ang * 180 / Math.PI).toFixed(1)})`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
            {e.highlight && !reducedMotion && rippleKey > 0 && (
              <circle key={rippleKey} r={4.5} fill="currentColor">
                <animateMotion dur="1.6s" repeatCount={2} path={g.d} fill="freeze" />
                <animate attributeName="opacity" values="1;1;0" dur="3.2s" fill="freeze" />
              </circle>
            )}
            {badge && !labels.has(e.rel.id) && <g transform={`translate(${g.mid.x - 39} ${g.mid.y - 9})`}><Badge id={badge} /></g>}
          </g>
        );
      })}

      {/* impact route connectors (questions to validate, not results) */}
      {routePairs.map(([from, to], i) => {
        const a = boxes.get(from)!, b = boxes.get(to)!;
        const exists = edges.some((e) => (e.rel.from === from && e.rel.to === to) || (e.rel.from === to && e.rel.to === from));
        if (exists) return null;
        const g = routeEdge(a, b, allBoxes, 0.6);
        return (
          <g key={`route-${i}`} className="ozv-tone-scenario" pointerEvents="none">
            <path d={g.d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeDasharray="2 6" strokeLinecap="round" />
            <path d="M-8 -4.5L0 0L-8 4.5" transform={`translate(${g.end.x.toFixed(1)} ${g.end.y.toFixed(1)}) rotate(${(g.ang * 180 / Math.PI).toFixed(1)})`} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          </g>
        );
      })}

      {/* nodes */}
      {Array.from(boxes.values()).map((b) => {
        const n = b.node, el = n.el!;
        const et = getElementType(el.visual), st = getState(el.visual, el.state);
        const tone = nodeTone(n);
        const isSel = selNode === b.id;
        const isChanged = changed.has(b.id);
        const risk = riskIds.has(b.id);
        const dim = !!route && !routeIds.includes(b.id) && !b.group;
        const overlays = n.overlays.map((o) => getOverlay(o)).filter((o): o is NonNullable<typeof o> => !!o);
        const srcIds = Array.from(new Set(n.marks.filter((m) => m.kind === "source").map((m) => m.by)));
        const effect = effectOf(n);
        const stroke = isSel ? "var(--ozv-focus)" : risk ? "var(--ozv-negative)" : n.origin === "pathway" ? "var(--ozv-proposed)" : n.origin === "scenario" ? "var(--ozv-scenario)" : isChanged ? "var(--ozv-scenario)" : "var(--ozv-line)";
        const dash = n.origin === "pathway" ? "6 4" : n.origin === "scenario" ? "2 4" : isChanged ? "5 3" : undefined;
        const stepNo = route ? route.steps.findIndex((s) => s.nodeId === b.id) : -1;
        const a11y = `${n.label}, ${et?.label ?? "element"}, state: ${st.label}${n.display ? ", " + n.display : ""}${overlays.length ? ", " + overlays.map((o) => o.label).join(", ") : ""}${n.origin === "pathway" ? ", proposed in the shown option" : n.origin === "scenario" ? ", scenario assumption" : ""}${srcIds.length ? ", sources " + srcIds.join(", ") : ""}${effect ? ". " + effect.label : ""}`;
        const sel = (ev: React.MouseEvent) => { ev.stopPropagation(); onSelect({ kind: "node", id: b.id }, at(ev)); };
        if (b.group) {
          return (
            <g key={b.id} role="button" tabIndex={0} aria-label={a11y + ". A group — open a member to compare."} aria-pressed={isSel} onClick={sel} onKeyDown={(ev) => key(ev, { kind: "node", id: b.id })} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer", outline: "none" }} opacity={dim ? 0.35 : 1} className="ozv-sys-node">
              <g className={`ozv-tone-${tone}`} transform={`translate(${b.x + 8} ${b.y + 6})`}><Glyph glyph={et?.glyph ?? "document"} t={st.t} size={26} overlays={overlays.map((o) => ({ badge: o.badge, title: o.label }))} /></g>
              <text x={b.x + 42} y={b.y + 21} style={{ fill: "var(--ozv-ink)", font: "600 13.5px var(--font-body)" }}>{b.label[0]}</text>
              <text x={b.x + 42} y={b.y + 36} style={{ fill: "var(--ozv-muted)", font: "400 11.5px var(--font-body)" }}>{clip(n.display || "Click a partner to compare", 30)}</text>
              {srcIds.length > 0 && <SrcTags ids={srcIds} x={b.x + b.w - 6} y={b.y - 9} />}
            </g>
          );
        }
        return (
          <g key={b.id} role="button" tabIndex={0} aria-label={a11y} aria-pressed={isSel} onClick={sel} onKeyDown={(ev) => key(ev, { kind: "node", id: b.id })} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer", outline: "none" }} opacity={dim ? 0.35 : 1} className="ozv-sys-node">
            {isChanged && rippleKey > 0 && !reducedMotion && (
              <rect key={`p${rippleKey}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={14} fill="none" style={{ stroke: "var(--ozv-scenario)" }} strokeWidth={2}>
                <animate attributeName="opacity" values="0.9;0" dur="1.4s" repeatCount={2} fill="freeze" />
              </rect>
            )}
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.member ? 10 : 14} style={{ fill: n.origin === "scenario" ? "url(#ozv-sys-hatch)" : risk ? "rgba(70,18,12,0.96)" : "rgba(17,21,31,0.96)", stroke }} strokeWidth={isSel || risk ? 2.2 : 1.4} strokeDasharray={risk ? undefined : dash} className={n.origin === "scenario" ? "ozv-tone-scenario" : undefined} />
            {risk && !reducedMotion && <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} rx={16} fill="none" style={{ stroke: "var(--ozv-negative)" }} strokeWidth={1.5} className="ozv-pulse" />}
            {n.origin === "scenario" && <rect x={b.x + 1} y={b.y + 1} width={b.w - 2} height={b.h - 2} rx={13} style={{ fill: "rgba(17,21,31,0.82)" }} />}
            <g className={`ozv-tone-${tone}`} transform={`translate(${b.x + (b.member ? 4 : 8)} ${b.y + (b.member ? 6 : 10)})`}><Glyph glyph={et?.glyph ?? "document"} t={st.t} size={b.member ? 26 : 32} overlays={overlays.map((o) => ({ badge: o.badge, title: o.label }))} /></g>
            {b.label.map((l, i) => <text key={i} x={b.x + (b.member ? 38 : 48)} y={b.y + (b.member ? 27 : 23) + i * 15} style={{ fill: "var(--ozv-ink)", font: `600 ${b.member ? 13 : 13.5}px var(--font-body)` }}>{l}</text>)}
            {b.sub.map((l, i) => <text key={i} x={b.x + 48} y={b.y + 23 + (b.label.length + i) * 15} style={{ fill: n.display ? "var(--ozv-ink)" : "var(--ozv-muted)", font: `${n.display ? 600 : 400} 11.5px var(--font-body)` }}>{l}</text>)}
            {srcIds.length > 0 && (b.member ? <DocDot ids={srcIds} x={b.x + b.w - 2} y={b.y + 2} /> : <SrcTags ids={srcIds} x={b.x + b.w - 6} y={b.y - 9} />)}
            {(n.origin === "pathway" || n.origin === "scenario") && !b.member && (
              <g transform={`translate(${b.x + 10} ${b.y - 9})`} className={`ozv-tone-${tone}`}>
                <rect width={n.origin === "pathway" ? 62 : 70} height={16} rx={8} style={{ fill: "rgba(11,15,23,0.95)", stroke: "currentColor" }} strokeDasharray="3 2" />
                <text x={n.origin === "pathway" ? 31 : 35} y={11.5} textAnchor="middle" style={{ fill: "currentColor", font: "700 9.5px var(--font-body)" }}>{n.origin === "pathway" ? "PROPOSED" : "ASSUMED"}</text>
              </g>
            )}
            {effect && !b.member && (() => {
              const { lines, w, h } = effectBox(effect.label, effect.tone === "risk"), tt = TONE_OF_MARK[effect.tone];
              return (
                <g transform={`translate(${b.x + b.w / 2} ${b.y + b.h + 4})`} className={`ozv-tone-${tt}`}>
                  <rect x={-w / 2} y={0} width={w} height={h} rx={8} style={{ fill: effect.tone === "risk" ? "rgba(40,14,10,0.96)" : "rgba(11,15,23,0.96)", stroke: "currentColor" }} strokeDasharray={effect.tone === "risk" ? undefined : "3 2"} />
                  {lines.map((l, i) => <text key={i} textAnchor="middle" y={12.5 + i * 12} style={{ fill: "currentColor", font: "600 10px var(--font-body)" }}>{l}</text>)}
                </g>
              );
            })()}
            {stepNo >= 0 && (
              <g transform={`translate(${b.x - 6} ${b.y - 6})`} className="ozv-tone-scenario">
                <circle r={10} style={{ fill: "rgba(11,15,23,0.98)", stroke: "currentColor" }} strokeWidth={1.6} />
                <text textAnchor="middle" y={4} style={{ fill: "currentColor", font: "700 11px var(--font-body)" }}>{stepNo + 1}</text>
              </g>
            )}
          </g>
        );
      })}

      {/* connection labels on top, placed without overlaps */}
      {edges.filter((e) => labels.has(e.rel.id)).map((e) => {
        const l = labels.get(e.rel.id)!, st = edgeStyle(e), isSel = selected?.kind === "edge" && selected.id === e.rel.id;
        const ct = getConnectionType(e.rel.type);
        const badge = (ct.states.find((s) => s.id === e.rel.state) ?? ct.states[0]).t.badge;
        const tone = onRoute(e.rel.from, e.rel.to) && !e.highlight ? "scenario" : st.tone;
        return (
          <g key={`l-${e.rel.id}`} transform={`translate(${l.x} ${l.y})`} className={`ozv-tone-${tone}`} onClick={(ev) => { ev.stopPropagation(); onSelect({ kind: "edge", id: e.rel.id }); }} style={{ cursor: "pointer" }} aria-hidden>
            <rect x={-l.tw / 2} y={-10} width={l.tw} height={20} rx={10} style={{ fill: "rgba(11,15,23,0.94)", stroke: "currentColor" }} strokeWidth={isSel ? 1.8 : 1} strokeDasharray={st.dash ? "3 2" : undefined} />
            <text textAnchor="middle" y={4} style={{ fill: "var(--ozv-ink)", font: "500 10.5px var(--font-body)" }}>{l.text}</text>
            {badge && <g transform={`translate(${-l.tw / 2 - 48} -9)`}><Badge id={badge} /></g>}
          </g>
        );
      })}
    </svg>
  );
});

/** A numbered dot for items too small for a badge (group members). */
function DocDot({ ids, x, y }: { ids: string[]; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <title>{`From ${ids.join(", ")}`}</title>
      <circle r={8} style={{ fill: "#9B7BFF" }} />
      <text y={3.5} textAnchor="middle" style={{ fill: "#0E1A21", font: "700 10px var(--font-mono, monospace)" }}>{ids.length}</text>
    </g>
  );
}

/** One small document badge: the source id, or how many documents mention this item. */
function SrcTags({ ids, x, y }: { ids: string[]; x: number; y: number }) {
  const text = ids.length === 1 ? ids[0] : `${ids.length} docs`, w = text.length * 6 + 12;
  return (
    <g transform={`translate(${x - w} ${y})`}>
      <title>{`From ${ids.join(", ")}`}</title>
      <rect width={w} height={17} rx={5} style={{ fill: "#9B7BFF" }} />
      <text x={w / 2} y={12.5} textAnchor="middle" style={{ fill: "#0E1A21", font: "700 10px var(--font-mono, monospace)" }}>{text}</text>
    </g>
  );
}
