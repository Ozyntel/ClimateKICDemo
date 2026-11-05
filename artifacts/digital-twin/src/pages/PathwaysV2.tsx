/**
 * PathwaysV2 (Pathways forwards) — dark page at /pathways.
 *
 * Up to three pathway cards from the active lead case. Each card has a small
 * city mini-map (pathwayMiniMap) playing the pathway out over one shared
 * 12-month timeline (play / speed / scrub): risk spots pulse until closed,
 * benefits glow. A side-by-side comparison table follows. Choosing a
 * pathway is stored in the lead's own progress (never shared across cases).
 *
 * Content rules: results are illustrative. Outcome percentages appear only
 * when the team entered them, labelled "demo assumption". Risk is shown as a
 * plain count of open risk spots, not banded into low / medium / high.
 * Selecting a pathway marks it "under consideration" — never approved.
 *
 * A case with a planning ledger keeps the same cards and table but shows no
 * 12-month timeline (nothing is forecast over time): each card shows the
 * pathway's derived cash / hours / capacity, and its mini-map pulses the
 * conditions the pathway puts at risk.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DemoHeader, DemoNotPrepared, EmptyLine } from "@/components/DemoChrome";
import { buildMapState } from "@/lib/lead/mapState";
import { formatAmount, formatMetric, hasPlanning, pathwayLedger } from "@/lib/lead/planning";
import { activePathways, nameOf, openRisksAt12, orgName, outcomeFor } from "@/lib/lead/derive";
import { toWorldCase } from "@/lib/lead/engineCase";
import { useActiveLead } from "@/lib/lead/useActiveLead";
import type { Pathway, PathwaySpot } from "@/lib/lead/types";
import { createPathwayMiniMap, type PathwayMiniMap } from "@/lib/pathwayMiniMap";

export default function PathwaysV2Page() {
  const [, navigate] = useLocation();
  const { lead, progress, setProgress } = useActiveLead();
  const [t, setTState] = useState(() => progress.timelineMonth);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const refs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const maps = useRef<PathwayMiniMap[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef(false);
  const tRef = useRef(t); tRef.current = t;
  const speedRef = useRef(speed); speedRef.current = speed;

  const world = useMemo(() => (lead ? toWorldCase(lead) : null), [lead]);
  const pws: Pathway[] = useMemo(() => (lead ? activePathways(lead) : []), [lead]);
  const pick = pws.findIndex((p) => p.id === progress.pathwayPick);
  const planning = !!lead && hasPlanning(lead);
  // Planning cases: each mini-map pulses the places the pathway puts at risk (derived from the map state; no timing is invented).
  const mapPws: Pathway[] = useMemo(() => {
    if (!lead || !world || !planning) return pws;
    const drawn = new Set(["org", ...world.places.map((x) => String(x.id))]);
    return pws.map((p) => {
      const st = buildMapState(lead, { ...progress, stressTests: [] }, { stage: "pathway", pathwayId: p.id, scenarioIds: [] });
      const risks: PathwaySpot[] = [];
      for (const n of st.nodes) for (const m of n.marks) {
        if (!(m.kind === "pathway" || m.kind === "ledger") || !(m.tone === "risk" || m.tone === "mixed") || (m.kind === "ledger" && m.label === n.display)) continue;
        const near = drawn.has(n.id) ? n.id : n.el?.near && drawn.has(n.el.near) ? n.el.near : "org";
        if (!risks.some((r) => r.near === near)) risks.push({ label: m.label, near, from: 0, until: null });
      }
      return { ...p, risks: risks.slice(0, 4), wins: [] };
    });
  }, [lead, world, planning, pws, progress]);

  useEffect(() => {
    maps.current.forEach((m) => m.destroy());
    maps.current = [];
    if (!world) return;
    mapPws.forEach((pw, i) => {
      const cv = refs[i].current;
      if (cv) { const m = createPathwayMiniMap(cv, { caseData: world, pathway: pw }); m.setT(planning ? 12 : tRef.current); maps.current.push(m); }
    });
    return () => { maps.current.forEach((m) => m.destroy()); maps.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, mapPws]);

  const setT = useCallback((nt: number) => {
    const v = Math.max(0, Math.min(12, nt));
    maps.current.forEach((m) => m.setT(v));
    setTState(v);
  }, []);
  const stop = useCallback(() => { cancelAnimationFrame(rafRef.current); setPlaying(false); }, []);
  const play = useCallback(() => {
    let t0: number | null = null;
    const start = tRef.current >= 12 ? 0 : tRef.current;
    setPlaying(true);
    const step = (now: number) => {
      if (t0 == null) t0 = now;
      const nt = start + ((now - t0) / 750) * (speedRef.current || 1);
      if (nt >= 12) { setT(12); setPlaying(false); return; }
      setT(nt);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [setT]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (dragRef.current) scrubTo(e.clientX); };
    const onUp = () => { dragRef.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scrubTo = (x: number) => { const el = trackRef.current; if (!el) return; const r = el.getBoundingClientRect(); stop(); setT(((x - r.left) / r.width) * 12); };

  if (!lead || !world) return (<div className="tw-world" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#0B0F17", color: "#F6F3EC" }}><DemoHeader current="/pathways" dark label="Pathways forwards" /><DemoNotPrepared dark /></div>);

  const choose = (id: string) => setProgress((p) => ({ ...p, pathwayPick: id }));
  const ledgers = pws.map((pw) => (planning ? pathwayLedger(lead, pw) : null));
  const headText = (t: NonNullable<(typeof ledgers)[number]>["totals"][number]) => (t.headroom == null ? "headroom unknown" : t.headroom < 0 ? `${formatAmount(t.constraint, -t.headroom)} over` : t.headroom === 0 ? "nothing left" : `${formatAmount(t.constraint, t.headroom)} left`);
  const capText = (i: number) => (ledgers[i]?.metrics.filter((m) => m.metric.elementId).map((m) => `${formatMetric(m.metric, m.value)} ${m.metric.label.toLowerCase()}`).join(" · ") ?? "");
  const active = (x: PathwaySpot) => x.from <= t && (x.until == null || t < x.until);
  const oe = lead.outcomeEstimate && lead.outcomeEstimate.question.trim() ? lead.outcomeEstimate : null;
  const pct = (t / 12) * 100, m = Math.round(t), monthLabel = m === 0 ? "Now" : "Month " + m;
  const cols = Math.max(1, pws.length);

  const dot = (col: string): React.CSSProperties => ({ flexShrink: 0, width: 8, height: 8, marginTop: 6, borderRadius: "50%", background: col });
  const tagStyle = (col: string, bg: string): React.CSSProperties => ({ display: "inline-block", marginLeft: 6, padding: "2px 6px", borderRadius: 999, background: bg, color: col, font: "600 10.5px/1.3 var(--font-body)", whiteSpace: "nowrap" });
  type Item = { text: string; dot?: string; tag?: string; tagCol?: [string, string] };
  const plain = (text: string): Item[] => (text.trim() ? [{ text }] : [{ text: "Not provided", tag: "unknown", tagCol: ["#9FB3BC", "rgba(255,255,255,0.05)"] }]);
  const listOr = (arr: Item[]): Item[] => (arr.length ? arr : [{ text: "None listed" }]);
  const rows: Array<{ label: string; cells: Item[][] }> = planning ? [
    { label: "The idea", cells: pws.map((pw) => plain(pw.summary || pw.idea)) },
    ...lead.planning!.constraints.map((c) => ({ label: c.label, cells: pws.map((_, i) => { const t = ledgers[i]?.totals.find((x) => x.constraint.id === c.id); return t ? [{ text: `${formatAmount(c, t.allocated)} · ${headText(t)}`, dot: (t.headroom ?? 1) <= 0 ? "#FF5A3C" : "#3DD68C" }] : plain(""); }) })),
    { label: "Capacity (ceiling)", cells: pws.map((_, i) => plain(capText(i))) },
    { label: "Trade-off", cells: pws.map((pw) => plain(pw.tradeOff)) },
    { label: "What must be true", cells: pws.map((pw) => listOr([...pw.needs, ...pw.conditions].slice(0, 3).map((n) => ({ text: n, dot: "#9C6BFF" })))) },
    { label: "Proposed actions", cells: pws.map((pw) => listOr(pw.plan.map((x) => ({ text: x.title, dot: "#C4B5FD" })))) },
  ] : [
    { label: "The idea", cells: pws.map((pw) => plain(pw.idea || pw.summary)) },
    { label: "How long", cells: pws.map((pw) => plain(pw.horizon)) },
    { label: "Costs", cells: pws.map((pw) => plain(pw.cost)) },
    { label: "What must be true", cells: pws.map((pw) => listOr([...pw.needs, ...pw.conditions].map((n) => ({ text: n, dot: "#9C6BFF" })))) },
    { label: "Interventions", cells: pws.map((pw) => listOr(pw.interventions.map((n) => ({ text: n, dot: "#C4B5FD" })))) },
    { label: "Benefits", cells: pws.map((pw) => listOr(pw.wins.map((w) => ({ text: w.label + (w.near ? " · " + nameOf(lead, w.near) : ""), dot: "#3DD68C", tag: "from month " + w.from, tagCol: ["#6EE7A8", "rgba(61,214,140,0.16)"] as [string, string] })))) },
    ...(oe ? [{ label: "Demo assumption", cells: pws.map((pw) => { const v = outcomeFor(lead, pw.id); return [{ text: (v != null ? v + "% · " : "Not estimated · ") + oe.question, tag: "demo assumption", tagCol: ["#9FB3BC", "rgba(255,255,255,0.05)"] as [string, string] }]; }) }] : []),
    { label: "Risks", cells: pws.map((pw) => (pw.risks.length ? pw.risks.map((x) => ({ text: x.label + (x.near ? " · " + nameOf(lead, x.near) : ""), dot: x.until == null ? "#FF5A3C" : "#C3CFD4", tag: x.until == null ? "still open at month 12" : "closed by month " + x.until, tagCol: ["#9FB3BC", "rgba(255,255,255,0.05)"] as [string, string] })) : [{ text: "Risks not assessed", tag: "unknown", tagCol: ["#9FB3BC", "rgba(255,255,255,0.05)"] as [string, string] }])) },
    { label: "How you'd know it's working", cells: pws.map((pw) => plain(pw.watch)) },
    { label: "Based on", cells: pws.map((pw) => plain(pw.sourceIds.length ? pw.sourceIds.join(" · ") : "")) },
  ];
  const SPEEDS: Array<[string, string, number]> = [["❚❚", "Pause", 0], ["▶", "Play", 1], ["▶▶", "Faster", 2], ["▶▶▶", "Fastest", 4]];

  return (
    <div className="tw-world" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", color: "#F6F3EC", background: "radial-gradient(1200px 640px at 50% -8%, #1B1734 0%, #0B0F17 55%, #06080C 100%)" }}>
      <DemoHeader current="/pathways" dark label={orgName(lead)} />
      <main style={{ flex: 1, width: "100%", maxWidth: 1320, margin: "0 auto", padding: "28px 24px 56px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: "1 1 560px", maxWidth: 820 }}>
            <button onClick={() => navigate("/twin")} style={{ alignSelf: "flex-start", border: "none", background: "transparent", cursor: "pointer", font: "500 13px/1 var(--font-body)", color: "#9FB3BC" }}>← Back to the organisational model</button>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h1 style={{ margin: 0, font: "700 34px/1.1 var(--font-display)", color: "#F6F3EC", letterSpacing: "-0.01em" }}>Current Decision</h1>
              <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(195,207,212,0.22)", font: "500 16px/1.5 var(--font-body)" }}>
                {lead.decision.question.trim() || <EmptyLine dark>The decision has not been written down yet.</EmptyLine>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ padding: "7px 11px", borderRadius: 999, background: "rgba(242,194,48,0.14)", color: "#F5CF5B", font: "500 12px/1 var(--font-body)", whiteSpace: "nowrap" }}>Illustrative demo results, not validated predictions</span>
            {pick >= 0 && <button onClick={() => navigate("/twin")} style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "none", font: "700 14px/1 var(--font-body)", cursor: "pointer", background: "#D9F23A", color: "#0E1A21", whiteSpace: "nowrap" }}>✓ See the selected pathway on the model →</button>}
            {pick >= 0 && <button onClick={() => navigate("/executive-brief")} style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1.5px solid rgba(195,207,212,0.45)", font: "600 14px/1 var(--font-body)", cursor: "pointer", background: "rgba(255,255,255,0.04)", color: "#F6F3EC", whiteSpace: "nowrap" }}>Executive brief →</button>}
            <button onClick={() => navigate("/brief")} style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "none", font: "600 14px/1 var(--font-body)", cursor: "pointer", background: "#1A51FF", color: "#FFFFFF", whiteSpace: "nowrap" }}>Wrap up the demo →</button>
          </div>
        </div>

        {pws.length === 0 ? (
          <section style={{ padding: 24, borderRadius: 18, background: "rgba(17,21,31,0.92)", border: "1px dashed rgba(195,207,212,0.3)" }}>
            <EmptyLine dark>No pathways have been added for this case yet.</EmptyLine>
          </section>
        ) : (
          <>
            {!planning && <section aria-label="Timeline" style={{ position: "sticky", top: 12, zIndex: 2, display: "flex", alignItems: "center", gap: 18, padding: "10px 14px 10px 10px", borderRadius: 999, background: "rgba(14,18,28,0.88)", border: "1px solid rgba(195,207,212,0.16)", boxShadow: "0 12px 32px rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}>
              <div style={{ flexShrink: 0, display: "flex", gap: 3, padding: 3, borderRadius: 999, background: "rgba(255,255,255,0.05)" }}>
                {SPEEDS.map(([icon, title, v]) => { const on = v === 0 ? !playing : playing && speed === v; return (<button key={title} onClick={() => { if (v === 0) { stop(); return; } setSpeed(v); if (!playing) play(); }} title={title} aria-label={title} aria-pressed={on} style={{ height: 32, minWidth: 40, padding: "0 10px", border: "none", borderRadius: 999, cursor: "pointer", font: "700 11px/1 var(--font-body)", background: on ? "#D9F23A" : "transparent", color: on ? "#0E1A21" : "#C3CFD4" }}>{icon}</button>); })}
              </div>
              <span aria-live="polite" style={{ flexShrink: 0, minWidth: 92, font: "700 17px/1 var(--font-display)", color: "#D9F23A", whiteSpace: "nowrap" }}>{monthLabel}</span>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                <div ref={trackRef} role="slider" tabIndex={0} aria-label="Month" aria-valuemin={0} aria-valuemax={12} aria-valuenow={m} onKeyDown={(e) => { if (e.key === "ArrowRight") { stop(); setT(t + 1); } if (e.key === "ArrowLeft") { stop(); setT(t - 1); } }} onPointerDown={(e) => { dragRef.current = true; scrubTo(e.clientX); }} style={{ position: "relative", height: 20, cursor: "pointer", touchAction: "none" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: 7, height: 6, background: "rgba(195,207,212,0.12)", borderRadius: 6 }} />
                  <div style={{ position: "absolute", left: 0, top: 7, height: 6, width: pct + "%", background: "#D9F23A", borderRadius: 6 }} />
                  <div style={{ position: "absolute", top: 1, left: "calc(" + pct + "% - 9px)", width: 18, height: 18, borderRadius: "50%", background: "#D9F23A", border: "3px solid #0E1A21" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", font: "500 11px/1 var(--font-body)", color: "#7F95A0" }}>{["Now", "3 mo", "6 mo", "9 mo", "12 mo"].map((tk) => (<span key={tk}>{tk}</span>))}</div>
              </div>
            </section>}

            <section style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${cols === 1 ? 420 : 300}px, 1fr))`, gap: 16 }}>
              {pws.map((pw, i) => {
                const sel = pick === i, nr = pw.risks.filter(active).length, nw = pw.wins.filter(active).length, v = outcomeFor(lead, pw.id);
                return (
                  <article key={pw.id} aria-label={`Pathway ${i + 1}: ${pw.title}`} style={{ display: "flex", flexDirection: "column", background: "linear-gradient(180deg, rgba(20,24,35,0.95) 0%, rgba(12,15,22,0.95) 100%)", borderRadius: 20, border: "1.5px solid " + (sel ? "#D9F23A" : "rgba(195,207,212,0.16)"), overflow: "hidden" }}>
                    <div style={{ position: "relative", height: 330, overflow: "hidden", background: "#0E1A21", borderBottom: "1px solid rgba(195,207,212,0.12)" }}>
                      <canvas ref={refs[i]} style={{ display: "block" }} aria-hidden />
                      <div style={{ position: "absolute", left: 0, right: 0, top: 0, display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px 26px", background: "linear-gradient(180deg, rgba(8,11,17,0.92) 0%, rgba(8,11,17,0.55) 60%, rgba(8,11,17,0) 100%)", pointerEvents: "none" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ font: "500 12px/1 var(--font-body)", color: "#9FB3BC" }}>Pathway 0{i + 1}</span>
                          {v != null && <span style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(10,13,20,0.7)", border: "1px solid rgba(195,207,212,0.2)", whiteSpace: "nowrap" }}><b style={{ font: "700 15px/1 var(--font-display)" }}>{v}%</b><span style={{ font: "400 11px/1 var(--font-body)", color: "#9FB3BC" }}> demo assumption</span></span>}
                        </div>
                        <b style={{ display: "block", font: "600 18px/1.25 var(--font-display)", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>{pw.title}</b>
                      </div>
                    </div>
                    {planning && ledgers[i] ? (
                    <div role="status" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "14px 16px 0" }}>
                      {ledgers[i]!.totals.map((tt) => { const bad = (tt.headroom ?? 1) <= 0; return (<span key={tt.constraint.id} style={{ display: "inline-flex", alignItems: "baseline", gap: 5, padding: "5px 9px", borderRadius: 10, background: bad ? "rgba(255,90,60,0.14)" : "rgba(255,255,255,0.05)", border: "1px solid " + (bad ? "rgba(255,90,60,0.5)" : "transparent"), font: "500 12px/1.3 var(--font-body)", color: bad ? "#FFB3A1" : "#C3CFD4" }}><b style={{ font: "700 13.5px/1 var(--font-display)", color: bad ? "#FF8A70" : "#F6F3EC" }}>{formatAmount(tt.constraint, tt.allocated)}</b>{headText(tt)}</span>); })}
                      {capText(i) && <span style={{ padding: "5px 9px", borderRadius: 10, background: "rgba(255,255,255,0.05)", font: "500 12px/1.3 var(--font-body)", color: "#C3CFD4" }}>{capText(i)}</span>}
                    </div>
                    ) : (
                    <div role="status" style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", padding: "14px 16px 0", font: "500 12px/1.3 var(--font-body)", color: "#C3CFD4" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5A3C" }} />{nr} risk{nr === 1 ? "" : "s"} active now</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#3DD68C" }} />{nw} benefit{nw === 1 ? "" : "s"} showing</span>
                      <span style={{ color: "#9FB3BC" }}>{pw.risks.length ? `${openRisksAt12(pw)} still open at month 12` : "Risks not assessed"}</span>
                    </div>
                    )}
                    <p style={{ margin: 0, padding: "8px 16px 0", font: "400 13px/1.5 var(--font-body)", color: "#9FB3BC" }}>{pw.summary || pw.idea}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px 16px", marginTop: "auto" }}>
                      {planning ? <button onClick={() => navigate(`/twin?preview=${encodeURIComponent(pw.id)}`)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, font: "600 12px/1.3 var(--font-body)", color: "#C4B5FD" }}>Preview on the map →</button> : <span style={{ font: "500 12px/1.3 var(--font-body)", color: "#7F95A0" }}>{pw.horizon}</span>}
                      <button onClick={() => choose(pw.id)} aria-pressed={sel} style={{ whiteSpace: "nowrap", height: 36, padding: "0 16px", borderRadius: 999, cursor: "pointer", font: "700 12.5px/1 var(--font-body)", border: sel ? "none" : "1.5px solid rgba(217,242,58,0.5)", background: sel ? "#D9F23A" : "transparent", color: sel ? "#0E1A21" : "#D9F23A" }}>{sel ? "✓ Selected · under consideration" : "Select this path"}</button>
                    </div>
                  </article>
                );
              })}
            </section>

            <section style={{ background: "rgba(17,21,31,0.92)", border: "1px solid rgba(195,207,212,0.14)", borderRadius: 16, overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <caption style={{ textAlign: "left", padding: "14px 16px", font: "600 13.5px/1.25 var(--font-display)" }}>Side by side</caption>
                <thead><tr><th scope="col" style={{ width: 150 }} />{pws.map((pw, i) => (<th key={pw.id} scope="col" style={{ textAlign: "left", padding: "14px 16px", borderLeft: "1px solid rgba(195,207,212,0.14)", background: pick === i ? "rgba(217,242,58,0.07)" : "transparent" }}><span style={{ display: "block", font: "500 11px/1 var(--font-body)", color: "#7F95A0" }}>Pathway 0{i + 1}</span><b style={{ font: "600 13.5px/1.3 var(--font-body)" }}>{pw.title}</b></th>))}</tr></thead>
                <tbody>
                  {rows.map((rw, ri) => (
                    <tr key={ri} style={{ borderTop: "1px solid rgba(195,207,212,0.14)" }}>
                      <th scope="row" style={{ textAlign: "left", verticalAlign: "top", padding: "14px 16px", font: "600 13px/1.35 var(--font-body)" }}>{rw.label}</th>
                      {rw.cells.map((cell, ci) => (
                        <td key={ci} style={{ verticalAlign: "top", padding: "14px 16px", borderLeft: "1px solid rgba(195,207,212,0.14)", background: pick === ci ? "rgba(217,242,58,0.04)" : "transparent" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {cell.map((it, ii) => (<span key={ii} style={{ display: "flex", gap: 8, alignItems: "flex-start", font: "400 13px/1.45 var(--font-body)", color: "#C3CFD4" }}>{it.dot && <i style={dot(it.dot)} />}<span style={{ flex: 1, minWidth: 0 }}>{it.text}{it.tag && <span style={tagStyle(it.tagCol![0], it.tagCol![1])}>{it.tag}</span>}</span></span>))}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {oe && <p style={{ margin: 0, padding: "10px 16px 14px", font: "400 12px/1.5 var(--font-body)", color: "#9FB3BC" }}>Demo assumption basis: {oe.basis || "not stated"}. This is not a validated probability.</p>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
