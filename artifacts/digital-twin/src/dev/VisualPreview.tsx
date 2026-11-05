/**
 * /dev/visual-preview — DEVELOPMENT-ONLY visual preview of the Ozy visual
 * vocabulary (registry + components) with synthetic sample data.
 *
 * Not part of the customer flow: the route exists only when
 * import.meta.env.DEV is true (see App.tsx), the sample data lives in
 * src/dev/ and is never written to storage, a lead case or an export.
 */
import { useMemo, useState } from "react";
import { Badge, Glyph } from "@/components/visuals/Glyph";
import { ElementList } from "@/components/visuals/ElementList";
import { InspectPanel } from "@/components/visuals/InspectPanel";
import { ConfidenceMeter, EvidenceTag, OverlayChip, StateLabel } from "@/components/visuals/parts";
import { ConnectionGlyph, VisualConnection } from "@/components/visuals/VisualConnection";
import { VisualNode, type VisualItem } from "@/components/visuals/VisualNode";
import {
  CATEGORIES, CONFIDENCE_LEVELS, CONNECTION_TYPES, ELEMENT_TYPES, EVIDENCE_TYPES, OVERLAYS, getConnectionType, getElementType, getOverlay, getState, strokeForFrequency,
  type Frequency,
} from "@/lib/visuals/registry";
import {
  PREVIEW_MARKER, SAMPLE_SOURCES, SCENARIO_LABEL, SCENE_AFTER_PATCH, SCENE_BEFORE, SCENE_LINKS, SCENE_LINKS_AFTER, type SceneNode,
} from "./previewSampleData";
import "@/components/visuals/visuals.css";

type Phase = "before" | "after";

function diff(before: SceneNode[], after: SceneNode[]): Array<{ id: string; text: string }> {
  const out: Array<{ id: string; text: string }> = [];
  after.forEach((a) => {
    const b = before.find((x) => x.id === a.id)!;
    const parts: string[] = [];
    if (a.visual !== b.visual) parts.push(`shown as ${getElementType(a.visual)?.label} instead of ${getElementType(b.visual)?.label}`);
    if (a.state !== b.state || a.visual !== b.visual) parts.push(`state “${getState(b.visual, b.state).label}” → “${getState(a.visual, a.state).label}”`);
    const added = a.overlays.filter((o) => !b.overlays.includes(o)).map((o) => getOverlay(o)?.label);
    if (added.length) parts.push(`overlay added: ${added.join(", ")}`);
    if (a.evidence !== b.evidence) parts.push(`now labelled “${EVIDENCE_TYPES.find((e) => e.id === a.evidence)?.label ?? "not stated"}”`);
    if (parts.length) out.push({ id: a.id, text: `${a.label}: ${parts.join("; ")}` });
  });
  return out;
}

export default function VisualPreview() {
  const [isStatic, setStatic] = useState(false);
  const [dark, setDark] = useState(false);
  const [phase, setPhase] = useState<Phase>("before");
  const [sel, setSel] = useState<string | null>("machine");
  const [galleryPick, setGalleryPick] = useState<{ type: string; state: string } | null>(null);
  const [cat, setCat] = useState<string>("all");

  const after = useMemo(() => SCENE_BEFORE.map((n) => ({ ...n, ...(SCENE_AFTER_PATCH[n.id] ?? {}) })), []);
  const nodes = phase === "before" ? SCENE_BEFORE : after;
  const links = SCENE_LINKS.map((l) => (phase === "after" ? { ...l, ...(SCENE_LINKS_AFTER[l.id] ?? {}) } : l));
  const changes = diff(SCENE_BEFORE, after);
  const changedMap = phase === "after" ? Object.fromEntries(changes.map((c) => [c.id, "see “What changed”"])) : {};
  const selNode = nodes.find((n) => n.id === sel);

  const surface = dark ? "#0B0F17" : "#FCFBF8";
  const cardBg = dark ? "rgba(17,21,31,0.92)" : "#FFFFFF";
  const line = dark ? "rgba(195,207,212,0.18)" : "#E9E2D4";
  const section: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12, padding: "18px 20px", borderRadius: 18, background: cardBg, border: `1px solid ${line}` };
  const h2: React.CSSProperties = { margin: 0, font: "700 19px/1.25 var(--font-display, var(--font-body))" };
  const p: React.CSSProperties = { margin: 0, font: "400 13.5px/1.55 var(--font-body)" };
  const sample: VisualItem = { id: "s", label: "Sample element", visual: "facility", state: "operating", overlays: [] };

  return (
    <div className={`tw-world ozv${dark ? " ozv-dark" : ""}`} data-ozv-static={isStatic} style={{ minHeight: "100dvh", background: surface, color: "var(--ozv-ink)", fontFamily: "var(--font-body)" }} data-testid="visual-preview">
      <div role="banner" style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "10px 18px", background: "#3B1C00", color: "#FFE3C2", borderBottom: "3px solid #FF7A1A" }}>
        <b style={{ font: "700 15px/1.2 var(--font-body)" }}>{PREVIEW_MARKER}</b>
        <span style={{ font: "400 12.5px/1.4 var(--font-body)" }}>Development only · synthetic placeholders · never loaded into a lead case, the demo or any export</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="ozv-btn" style={{ color: "#FFE3C2" }} aria-pressed={isStatic} onClick={() => setStatic((v) => !v)}>Static view (no motion)</button>
          <button className="ozv-btn" style={{ color: "#FFE3C2" }} aria-pressed={dark} onClick={() => setDark((v) => !v)}>Dark surface</button>
        </span>
      </div>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 18px 60px", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, font: "700 30px/1.15 var(--font-display, var(--font-body))" }}>Ozy visual vocabulary</h1>
          <p style={{ ...p, maxWidth: 820 }}>Base element → state → overlays → connections → evidence. Every state pairs colour with text and a pattern (solid / dashed / dotted / hatched outline, fill level, counted marks or a corner badge). Unknown is always grey, dashed and marked “?”. Reduced-motion settings and “Static view” stop all decorative motion.</p>
        </header>

        {/* 1 · grammar */}
        <section style={section} aria-labelledby="g-h">
          <h2 id="g-h" style={h2}>1 · The grammar, one layer at a time</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            <div><p style={{ ...p, fontWeight: 600 }}>Base element</p><VisualNode item={{ ...sample, state: "unknown" }} compact /></div>
            <div><p style={{ ...p, fontWeight: 600 }}>+ State</p><VisualNode item={{ ...sample, state: "under-construction" }} compact /></div>
            <div><p style={{ ...p, fontWeight: 600 }}>+ Overlay</p><VisualNode item={{ ...sample, state: "under-construction", overlays: ["possible-risk"] }} compact /></div>
            <div><p style={{ ...p, fontWeight: 600 }}>+ Evidence & confidence</p><VisualNode item={{ ...sample, state: "under-construction", overlays: ["possible-risk"], evidence: "assumption", confidence: "low" }} /></div>
          </div>
        </section>

        {/* 2 · unknown / observed / assumed / illustrative */}
        <section style={section} aria-labelledby="ev-h">
          <h2 id="ev-h" style={h2}>2 · Unknown, observed, stakeholder view, assumption, illustrative</h2>
          <p style={p}>The same element and state with each evidence label. Confidence is a separate channel (segments + text) and never shares a channel with severity.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <VisualNode item={{ id: "u", label: "Stock level", visual: "stock", state: "unknown", overlays: [] }} />
            <VisualNode item={{ id: "o", label: "Stock level", visual: "stock", state: "low", overlays: [], evidence: "observed", confidence: "high" }} />
            <VisualNode item={{ id: "s", label: "Stock level", visual: "stock", state: "low", overlays: [], evidence: "stakeholder", holder: "Warehouse team" }} />
            <VisualNode item={{ id: "a", label: "Stock level", visual: "stock", state: "sufficient", overlays: [], evidence: "assumption", confidence: "low" }} />
            <VisualNode item={{ id: "i", label: "Stock level", visual: "stock", state: "full", overlays: [], evidence: "illustrative" }} />
          </div>
          <div className="ozv-row" aria-label="Confidence levels">{CONFIDENCE_LEVELS.map((c) => <ConfidenceMeter key={c.id} level={c.id} />)}</div>
          <div className="ozv-row" aria-label="Evidence labels">{EVIDENCE_TYPES.map((e) => <EvidenceTag key={e.id} type={e.id} />)}<EvidenceTag type="" /></div>
        </section>

        {/* 3 · overlays */}
        <section style={section} aria-labelledby="ov-h">
          <h2 id="ov-h" style={h2}>3 · Overlays</h2>
          <p style={p}>A possible risk (triangle) is not an active problem (flame, labelled as a metaphor). Literal fire has its own label and element. There is deliberately no “omitted for privacy” badge — omissions are explained in “Limitations of this baseline”.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <VisualNode item={{ id: "r1", label: "Machine 2", visual: "machine", state: "delayed", overlays: ["possible-risk"] }} compact />
            <VisualNode item={{ id: "r2", label: "Machine 2", visual: "machine", state: "unavailable", overlays: ["active-problem"] }} compact />
            <VisualNode item={{ id: "r3", label: "Forest plot", visual: "literal-fire", state: "exposure", overlays: [] }} compact />
            <VisualNode item={{ id: "r4", label: "Forest plot", visual: "literal-fire", state: "observed", overlays: ["literal-fire"] }} compact />
          </div>
          <div className="ozv-row">{OVERLAYS.map((o) => <OverlayChip key={o.id} id={o.id} />)}</div>
        </section>

        {/* 4 · connections */}
        <section style={section} aria-labelledby="c-h">
          <h2 id="c-h" style={h2}>4 · Connections</h2>
          <p style={p}>Thickness shows interaction frequency only when it is known; unknown frequency stays a neutral line. A connection states a relationship — it never proves causality.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
            {(["unknown", "low", "medium", "high"] as Frequency[]).map((f) => (<span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px/1.3 var(--font-body)" }}><ConnectionGlyph type="relationship" state="active" frequency={f} width={90} />{f === "unknown" ? "frequency not known" : f} ({strokeForFrequency(f)}px)</span>))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            {CONNECTION_TYPES.map((ct) => (
              <div key={ct.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 10, borderRadius: 12, border: `1px solid ${line}` }}>
                <b style={{ font: "600 13px/1.3 var(--font-body)" }}>{ct.label}</b>
                {ct.states.map((s) => (<span key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}><ConnectionGlyph type={ct.id} state={s.id} frequency="unknown" width={100} /><StateLabel state={s} /></span>))}
                <span className="ozv-rule">{ct.rule}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 5 · before / after with inspectable sources */}
        <section style={section} aria-labelledby="ba-h">
          <h2 id="ba-h" style={h2}>5 · Before / after, with an inspectable source panel</h2>
          <div role="group" aria-label="Scenario" className="ozv-row">
            <button className="ozv-btn" aria-pressed={phase === "before"} onClick={() => setPhase("before")}>Before · baseline</button>
            <button className="ozv-btn" aria-pressed={phase === "after"} onClick={() => setPhase("after")}>After · illustrative scenario</button>
          </div>
          {phase === "after" && <div role="status" style={{ padding: "8px 12px", borderRadius: 12, border: "1.5px dashed var(--ozv-scenario)", color: "var(--ozv-scenario)", font: "600 13px/1.4 var(--font-body)" }}>{SCENARIO_LABEL} · illustrative, not a prediction</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))", gap: 14, alignItems: "start" }}>
            <svg viewBox="0 0 600 340" style={{ width: "100%", height: "auto", borderRadius: 14, background: dark ? "#0E1A21" : "#F4F1EA" }} role="group" aria-label="Sample map — use Tab to move between elements, Enter to inspect">
              {links.map((l) => {
                const a = nodes.find((n) => n.id === l.from)!, b = nodes.find((n) => n.id === l.to)!;
                const ct = getConnectionType(l.type), st = ct.states.find((s) => s.id === l.state) ?? ct.states[0];
                const x1 = a.x + 30, y1 = a.y + 26, x2 = b.x + 30, y2 = b.y + 26;
                return (
                  <g key={l.id} className={`ozv-tone-${st.t.tone ?? "neutral"}`}>
                    <path d={ct.pattern === "zigzag" ? `M${x1} ${y1}L${(x1 + x2) / 2 - 8} ${(y1 + y2) / 2 - 8}L${(x1 + x2) / 2 + 8} ${(y1 + y2) / 2 + 8}L${x2} ${y2}` : `M${x1} ${y1}L${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth={strokeForFrequency(l.frequency)} strokeDasharray={st.t.outline === "dashed" ? "7 5" : st.t.outline === "dotted" ? "2 5" : undefined} className={ct.pattern === "flow" && st.t.motion === "flow" ? "ozv-dash" : undefined} opacity={0.8} />
                    {st.t.badge && <Badge id={st.t.badge} x={(x1 + x2) / 2} y={(y1 + y2) / 2} title={st.label} />}
                  </g>
                );
              })}
              {nodes.map((n) => {
                const st = getState(n.visual, n.state), changed = phase === "after" && !!SCENE_AFTER_PATCH[n.id];
                const ov = n.overlays.map((o) => getOverlay(o)!).filter(Boolean);
                return (
                  <g key={n.id} transform={`translate(${n.x} ${n.y})`} role="button" tabIndex={0} aria-pressed={sel === n.id} aria-label={`${n.label}: ${st.label}${changed ? ", changed in scenario" : ""}`}
                    onClick={() => setSel(n.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(n.id); } }} style={{ cursor: "pointer", outline: "none" }}>
                    {changed && <circle cx={30} cy={26} r={34} fill="none" stroke="var(--ozv-scenario)" strokeWidth={2} strokeDasharray="4 4" className="ozv-pulse" />}
                    {sel === n.id && <circle cx={30} cy={26} r={30} fill="none" stroke="var(--ozv-focus)" strokeWidth={2.5} />}
                    <g className={`ozv-tone-${st.t.tone ?? "neutral"}`}><Glyph glyph={getElementType(n.visual)?.glyph ?? "document"} t={st.t} size={56} overlays={ov.map((o) => ({ badge: o.badge, title: o.label }))} /></g>
                    <text x={30} y={70} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="currentColor">{n.label}</text>
                    <text x={30} y={84} textAnchor="middle" fontSize={10.5} className={`ozv-tone-${st.t.tone ?? "neutral"}`} fill="currentColor">{st.label}</text>
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selNode ? <InspectPanel item={selNode} sources={SAMPLE_SOURCES} onClose={() => setSel(null)} /> : <p style={p}>Select an element to inspect its state, evidence and sources.</p>}
              <div className="ozv-panel" aria-live="polite">
                <b style={{ font: "600 14px/1.3 var(--font-body)" }}>What changed</b>
                {phase === "before" ? <span style={p}>Nothing — this is the baseline. Switch to “After” to play the illustrative scenario.</span> : (
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, font: "400 13px/1.45 var(--font-body)" }}>
                    {changes.map((c) => <li key={c.id}>{c.text}</li>)}
                    {Object.entries(SCENE_LINKS_AFTER).map(([id, ch]) => { const l = SCENE_LINKS.find((x) => x.id === id)!; return <li key={id}>{l.fromLabel} → {l.toLabel}: connection “{getConnectionType(l.type).states.find((s) => s.id === l.state)?.label}” → “{getConnectionType(l.type).states.find((s) => s.id === ch.state)?.label}”</li>; })}
                    <li>Everything else is unchanged and stays neutral — unchanged items do not turn green.</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
          <details>
            <summary style={{ cursor: "pointer", font: "600 13px/1.3 var(--font-body)" }}>List alternative (for dense maps, keyboard and screen readers)</summary>
            <div style={{ marginTop: 10 }}><ElementList items={nodes} connections={links} selectedId={sel} onSelect={setSel} changed={changedMap} /></div>
          </details>
        </section>

        {/* 6 · state gallery */}
        <section style={section} aria-labelledby="sg-h">
          <h2 id="sg-h" style={h2}>6 · Every element and its states ({ELEMENT_TYPES.length} elements)</h2>
          <div role="group" aria-label="Category" className="ozv-row">
            <button className="ozv-btn" aria-pressed={cat === "all"} onClick={() => setCat("all")}>All</button>
            {CATEGORIES.map((c) => <button key={c.id} className="ozv-btn" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>)}
          </div>
          {galleryPick && (() => { const et = getElementType(galleryPick.type)!, st = getState(galleryPick.type, galleryPick.state); return (
            <div className="ozv-panel" aria-live="polite">
              <b>{et.label} · {st.label}</b>
              <span style={p}>Base cue: {et.cue}. Visual change: {st.cue ?? "see the glyph"}.{et.rule ? ` Rule: ${et.rule}` : ""}</span>
            </div>); })()}
          {CATEGORIES.filter((c) => cat === "all" || c.id === cat).map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h3 style={{ margin: "6px 0 0", font: "700 15px/1.3 var(--font-body)" }}>{c.label}</h3>
              <span style={{ ...p, fontSize: 12.5, opacity: 0.8 }}>{c.blurb}</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 8 }}>
                {ELEMENT_TYPES.filter((e) => e.category === c.id).map((et) => (
                  <div key={et.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 12, border: `1px solid ${line}` }}>
                    <b style={{ font: "600 13px/1.3 var(--font-body)" }}>{et.label}</b>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {et.states.map((s) => (
                        <button key={s.id} className="ozv-chipbtn" onClick={() => setGalleryPick({ type: et.id, state: s.id })} aria-label={`${et.label}: ${s.label}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 70, padding: 4, borderRadius: 10, background: "transparent", color: "inherit" }}>
                          <span className={`ozv-tone-${s.t.tone ?? "neutral"}`}><Glyph glyph={et.glyph} t={s.t} size={38} /></span>
                          <span style={{ font: "500 10px/1.2 var(--font-body)", textAlign: "center" }}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
