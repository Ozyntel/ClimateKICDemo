/**
 * Twin — the organisational model of the active lead case.
 *
 * Three views of ONE composed map state (src/lib/lead/mapState.ts):
 *   Map      the isometric world (worldMapEngine via TwinWorldMap) with the
 *            chrome floating on it — level switch, Key risks, small inspect
 *            boxes and the bottom menus.
 *   Systems  a labelled systems view (SystemsMap) filling the screen, with
 *            zoom and pan: solid = existing, dashed = proposed / uncertain,
 *            dotted = scenario; risks in red.
 *   List     the same content as keyboard-accessible cards.
 *
 * What the map shows is driven only by the two bottom menus, which work on
 * their own or together: "Run a quick scenario or change" (small decisions
 * on the spot; typed text is matched to the scenarios the team prepared —
 * free text is not analysed) and "Pathways forward" (bigger strategies and
 * structural change). A quick change applies to the current plan, or to the
 * pathway being previewed. With neither, the map shows the case plus any
 * documents added on Data management. Clicking anything opens a small box
 * with "Read more".
 *
 * Content rules: everything comes from the lead case; scenario effects are
 * illustrative; selecting a pathway is not an approval; roles are never
 * scored or given invented feelings.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { TwinWorldMap, type TwinWorldMapHandle } from "@/components/TwinWorldMap";
import { DemoHeader, DemoNotPrepared } from "@/components/DemoChrome";
import { ElementList } from "@/components/visuals/ElementList";
import { MapDetail } from "@/components/visuals/MapDetail";
import { SystemsMap, type MapSelection, type SystemsMapHandle } from "@/components/visuals/SystemsMap";
import type { ConnectionItem } from "@/components/visuals/VisualConnection";
import type { VisualItem } from "@/components/visuals/VisualNode";
import { activePathways, keySignals, matchScenarios, openRisksAt12, orgName, outcomeFor } from "@/lib/lead/derive";
import { toWorldCase } from "@/lib/lead/engineCase";
import { buildMapState, engineEffects, type MapStage } from "@/lib/lead/mapState";
import { orgTypeRule } from "@/lib/lead/orgTypes";
import { formatAmount, hasPlanning, pathwayLedger } from "@/lib/lead/planning";
import { useActiveLead } from "@/lib/lead/useActiveLead";
import { orgItem, sourceRefs, teamItems } from "@/lib/lead/visualItems";
import { getElementType, getState } from "@/lib/visuals/registry";
import type { ImpactRoute } from "@/lib/lead/types";
import type { WorldLevel, WorldMapItem } from "@/lib/worldMapEngine";
import "@/components/visuals/visuals.css";

type View = "map" | "systems" | "list";
type Peek = { sel: NonNullable<MapSelection> | null; role?: string; x: number; y: number; where: "map" | "systems" };

const LEVEL_DEFS: Array<[WorldLevel, string]> = [["macro", "Macro"], ["meso", "Meso"], ["micro", "Micro"]];
const LEVEL_SUB: Record<WorldLevel, string> = {
  macro: "The wider world · places, actors, environment",
  meso: "How the organisation works inside",
  micro: "One team · its roles",
};

function legendFor(level: WorldLevel, portfolio: boolean): Array<[string, string, number?]> {
  if (level === "micro") return [["#F6F3EC", "A role · not a real person", 1], ["#93C5FD", "Decision / sign-off"]];
  if (level === "meso") return [["#FF7A5C", "Tension between teams"], ["#93C5FD", "Decisions"], ["#F1E4C8", "Hand-offs"], ["#C4B5FD", "Information"], ["#FDE68A", "Trust"]];
  if (portfolio) return [["#9B7BFF", "Shares a live twin", 1], ["#8FA3AD", "Own data only"], ["#F2C14E", "Due diligence"], ["#D9F23A", "On track (as stated)", 1], ["#FDBA8C", "Needs support (as stated)", 1], ["#FF5A3C", "Intervene now (as stated)", 1]];
  return [["#9B7BFF", "Your organisation", 1], ["#C3CFD4", "Places", 1], ["#FF5A3C", "Risk"], ["#C4B5FD", "Connection"]];
}

const prefersReduced = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const query = (k: string) => { try { return new URLSearchParams(window.location.search).get(k); } catch { return null; } };
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trim() + "…" : s);

export default function TwinPage() {
  const [, navigate] = useLocation();
  const { lead, progress } = useActiveLead();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sysRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const mapApi = useRef<TwinWorldMapHandle>(null);
  const sysApi = useRef<SystemsMapHandle>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pathways = useMemo(() => (lead ? activePathways(lead) : []), [lead]);
  const chosen = pathways.findIndex((p) => p.id === progress.pathwayPick);
  const previewParam = query("preview");

  const [view, setView] = useState<View>(() => (lead?.presentation.defaultView === "systems" ? "systems" : "map"));
  const [level, setLevel] = useState<WorldLevel>("macro");
  const [floorId, setFloorId] = useState<string | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [drawer, setDrawer] = useState<MapSelection>(null);
  const [listSel, setListSel] = useState<MapSelection>(null);
  const [opt, setOpt] = useState(() => { const i = pathways.findIndex((p) => p.id === previewParam); return i >= 0 ? i : chosen; });
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioText, setScenarioText] = useState("");
  const [scenarioNote, setScenarioNote] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const [route, setRoute] = useState<ImpactRoute | null>(null);
  const [vw, setVw] = useState(1400);
  const [vh, setVh] = useState(900);
  const [hudOpen, setHudOpen] = useState(true);
  const [hudTab, setHudTab] = useState<"sim" | "opts">("sim");
  const [risksOpen, setRisksOpen] = useState<boolean | null>(null);
  const [legendH, setLegendH] = useState(52);
  const [fullscreen, setFullscreen] = useState(false);

  const scenarios = useMemo(() => (lead ? lead.scenarios.filter((s) => s.question.trim()) : []), [lead]);
  const planning = !!lead && hasPlanning(lead);
  const shownId = opt >= 0 ? pathways[opt]?.id ?? null : null;
  const stage: MapStage = scenarioId ? "future" : shownId ? "pathway" : "evidence";
  const scenarioIds = useMemo(() => (scenarioId ? [scenarioId] : []), [scenarioId]);
  const state = useMemo(() => (lead ? buildMapState(lead, progress, { stage, pathwayId: shownId, scenarioIds }) : null), [lead, progress, stage, shownId, scenarioIds]);

  // The world only changes when the set of drawn elements / connections changes (baseline + added documents).
  const worldEls = state ? state.nodes.filter((n) => n.el && (n.origin === "baseline" || n.origin === "source")).map((n) => n.el!) : [];
  const worldRels = state ? state.edges.filter((e) => e.origin === "baseline" || e.origin === "source").map((e) => e.rel) : [];
  const worldKey = JSON.stringify([worldEls.map((e) => e.id), worldRels.map((r) => r.id)]);
  const world = useMemo(() => (lead ? toWorldCase({ ...lead, elements: worldEls, relationships: worldRels }) : null), [lead, worldKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasTeams = !!world && world.floors.length > 0;

  useLayoutEffect(() => {
    const measure = () => { setVw(document.documentElement.clientWidth || window.innerWidth); setVh(window.innerHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  useEffect(() => () => { if (playTimer.current) clearTimeout(playTimer.current); }, []);
  useEffect(() => {
    const f = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  // the systems legend floats over the top of the canvas; the fitted model sits below it
  useLayoutEffect(() => {
    const el = legendRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setLegendH(el.offsetHeight + 20));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);
  useEffect(() => { setLevel("macro"); setFloorId(null); setPeek(null); }, [world]);
  // A newly selected pathway (e.g. on the Pathways page) is shown on the map.
  useEffect(() => { if (chosen >= 0 && !previewParam) setOpt(chosen); }, [chosen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Paint the composed state onto the isometric map. Elements that are not drawn there show on the place they sit near;
  // a group that is not drawn itself (e.g. "partners A–D") shows on each of its drawn members.
  useEffect(() => {
    if (!state || !world || view !== "map" || running) return;
    const drawn = new Set(["org", ...world.places.map((p) => String(p.id)), ...world.far.map((p) => String(p.id)), ...world.global.map((p) => String(p.id)), ...world.floors.map((f) => f.id)]);
    const near = new Map(state.nodes.map((n) => [n.id, n.el?.near ?? ""]));
    const members = new Map<string, string[]>();
    state.nodes.forEach((n) => { const g = n.el?.group; if (g && drawn.has(n.id)) members.set(g, [...(members.get(g) ?? []), n.id]); });
    const at = (id: string): string[] => (drawn.has(id) ? [id] : drawn.has(near.get(id) ?? "") ? [near.get(id)!] : members.get(id) ?? []);
    const id = setTimeout(() => {
      const fx = engineEffects(state), map: Record<string, [string, string]> = {}, hot: Array<{ near: string; label: string }> = [];
      for (const [k, v] of Object.entries(fx.map)) for (const t of at(k)) { if (!map[t] || (v[1] === "harm" && map[t][1] !== "harm")) map[t] = v; }
      for (const h of fx.hot) {
        const t = at(h.near)[0], same = hot.find((x) => x.near === t);
        if (!t || (t !== "org" && map[t]?.[0] === h.label)) continue;
        if (!same) hot.push({ near: t, label: h.label });
        else if (!same.label.includes(" · ") && same.label !== h.label) same.label += " · " + h.label; // two risks on one place, e.g. cash and hours
      }
      mapApi.current?.setEffects(map, hot);
    }, 90);
    return () => clearTimeout(id);
  }, [state, view, running, world]);

  const ripple = useCallback(() => {
    if (playTimer.current) clearTimeout(playTimer.current);
    setRippleKey((k) => k + 1);
    if (prefersReduced()) return;
    setRunning(true);
    mapApi.current?.setEffects({}, []);
    mapApi.current?.ripple();
    playTimer.current = setTimeout(() => setRunning(false), 1300);
  }, []);

  // pathways and quick changes are independent: either can be on its own, or both together
  const playOption = (i: number) => {
    setPeek(null);
    if (opt === i) { setOpt(-1); return; }
    setOpt(i); ripple();
  };
  const runScenario = (id: string) => {
    if (!scenarios.some((x) => x.id === id)) return;
    setScenarioId(id); setScenarioText(""); setScenarioNote(null); setPeek(null); ripple();
  };
  const submitScenario = (e: React.FormEvent) => {
    e.preventDefault();
    const best = matchScenarios(lead!, scenarioText)[0];
    if (best) runScenario(best.scenario.id);
    else setScenarioNote(scenarioText.trim() ? "Not one of the prepared scenarios — this demo only plays prepared ones. Try one below." : "Type a change, or pick one below.");
  };
  const clearScenario = () => { setScenarioId(null); setScenarioNote(null); };

  const onEngineSelect = useCallback((it: WorldMapItem | null, pt: { x: number; y: number } | null) => {
    if (!it || !pt) { setPeek(null); return; }
    if (it.kind === "zoom") { mapApi.current?.setLevel("meso"); return; }
    if (it.kind === "person") { setPeek({ sel: null, role: it.label, x: pt.x, y: pt.y, where: "map" }); return; }
    const raw = it.kind === "org" ? "org" : it.kind === "wp" ? String(it.id).replace(/^w-/, "") : it.kind === "force" ? lead?.elements.find((e) => e.label === it.id)?.id ?? "" : String(it.id);
    if (!state?.nodes.some((n) => n.id === raw)) { setPeek({ sel: null, role: it.label, x: pt.x, y: pt.y, where: "map" }); return; }
    setPeek({ sel: { kind: "node", id: raw }, x: pt.x, y: pt.y, where: "map" });
  }, [lead, state]);
  const onLevelCb = useCallback((lvl: WorldLevel, fid?: string | null) => { setLevel(lvl); setFloorId(fid ?? null); setPeek(null); setRisksOpen(null); }, []);
  const fsOk = typeof document !== "undefined" && !!document.fullscreenEnabled;
  const toggleFullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen?.(); else void rootRef.current?.requestFullscreen?.().catch(() => undefined); };

  const wide = vw >= 1100, phone = vw < 640, short = vh < 640;
  const HUD_H = phone ? 210 : short ? 166 : Math.min(192, Math.round(vh * 0.23));
  const inset = !hudOpen ? 44 : HUD_H + 28;
  useEffect(() => { mapApi.current?.setInset(inset); }, [inset]);
  const risksShown = risksOpen == null ? level === "macro" && !phone : risksOpen;

  const srcs = useMemo(() => (lead ? sourceRefs(lead) : []), [lead]);
  const listItems = useMemo((): { items: VisualItem[]; conns: ConnectionItem[]; changed: Record<string, string> } => {
    if (!lead || !state) return { items: [], conns: [], changed: {} };
    const name = (id: string) => state.nodes.find((n) => n.id === id)?.label ?? id;
    const els = state.nodes.filter((n) => n.el).map((n) => ({ id: n.id, label: n.label, visual: n.el!.visual, state: n.el!.state, overlays: n.overlays, evidence: n.el!.evidence, confidence: n.el!.confidence, confidenceWhy: n.el!.confidenceWhy, holder: n.el!.holder, note: [n.origin === "pathway" ? "Proposed — not approved." : n.origin === "scenario" ? "Scenario assumption." : "", n.display].filter(Boolean).join(" "), measure: n.el!.measure, sourceIds: n.sourceIds }));
    const conns = state.edges.map((e) => ({ id: e.rel.id, fromLabel: name(e.rel.from), toLabel: name(e.rel.to), type: e.rel.type, state: e.origin === "pathway" || e.origin === "scenario" ? (e.rel.state === "active" ? "uncertain" : e.rel.state) : e.rel.state, label: e.rel.label + (e.origin === "pathway" ? " (proposed)" : e.origin === "scenario" ? " (scenario)" : ""), frequency: e.rel.frequency, evidence: e.rel.evidence }));
    const changed = Object.fromEntries(state.nodes.filter((n) => n.marks.some((m) => m.kind !== "source")).map((n) => [n.id, n.marks.filter((m) => m.kind !== "source").map((m) => m.label)[0]]));
    return { items: [orgItem(lead), ...teamItems(lead), ...els], conns, changed };
  }, [lead, state]);

  if (!lead || !world || !state) return (<div className="tw-world" style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0B0F17", color: "#F6F3EC" }}><DemoHeader current="/twin" dark label="Organisational model" /><DemoNotPrepared dark /></div>);

  const rule = orgTypeRule(lead.presentation.orgType);
  const team = lead.teams.find((t) => t.id === floorId);
  const subtitle = level === "macro" ? orgName(lead) + " and the world around it" : level === "meso" ? orgName(lead) + " · " + rule.insideLabel : team?.name ?? "";
  const showLegend = wide && !short;
  const oe = lead.outcomeEstimate && lead.outcomeEstimate.question.trim() ? lead.outcomeEstimate : null;
  const active = scenarios.find((s) => s.id === scenarioId) ?? null;

  // ─── key risks: what the shown option / scenario puts at risk first, then the case's own signals ──
  const risks = [
    ...state.nodes.flatMap((n) => n.marks.filter((m) => m.kind !== "source" && (m.tone === "risk" || m.tone === "mixed") && !(m.kind === "ledger" && m.label === n.display)).map((m) => ({ id: n.id, text: `${n.label}: ${m.label}`, tag: m.kind === "scenario" ? "Scenario" : m.kind === "pathway" ? "Pathway" : "", red: m.tone === "risk" }))),
    ...keySignals(lead, progress).map((sg) => ({ id: lead.findings.find((f) => f.text === sg.text)?.about ?? "", text: sg.text, tag: sg.src, red: false })),
  ].filter((x, i, a) => a.findIndex((y) => y.text === x.text) === i);

  const FS: Array<[string, string, () => void]> = fsOk ? [[fullscreen ? "⤡" : "⛶", fullscreen ? "Exit full screen" : "Full screen", toggleFullscreen]] : [];
  const CTRLS: Array<[string, string, () => void]> = [["⟲", "Rotate left", () => mapApi.current?.rotate(-1)], ["⟳", "Rotate right", () => mapApi.current?.rotate(1)], ["−", "Zoom out", () => mapApi.current?.zoom(0.85)], ["+", "Zoom in", () => mapApi.current?.zoom(1.18)], ...FS];
  const SYS_CTRLS: Array<[string, string, () => void]> = [["−", "Zoom out", () => sysApi.current?.zoom(1 / 1.3)], ["+", "Zoom in", () => sysApi.current?.zoom(1.3)], ["⤢", "Fit the whole model", () => sysApi.current?.reset()], ...FS];
  const ctlBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", font: "600 15px/1 var(--font-body)", color: "#F6F3EC", background: "rgba(10,13,20,0.82)", border: "1px solid rgba(195,207,212,0.35)" };
  const levelBarStyle: React.CSSProperties = { position: "absolute", zIndex: 3, display: "flex", flexDirection: phone ? "row" : "column", gap: 4, padding: 5, borderRadius: 999, background: "rgba(10,13,20,0.78)", border: "1px solid rgba(195,207,212,0.16)", ...(phone ? { left: 14, top: 50 } : { left: 16, top: "45%", transform: "translateY(-50%)" }) };
  const backStyle: React.CSSProperties = { position: "absolute", cursor: "pointer", font: "600 12.5px/1 var(--font-body)", color: "#F6F3EC", background: "rgba(10,13,20,0.82)", border: "1px solid rgba(195,207,212,0.4)", padding: "10px 14px", borderRadius: 999, whiteSpace: "nowrap", zIndex: 4, ...(phone ? { left: 14, top: 98 } : { right: 18, top: 16 }) };
  const ctlStyle: React.CSSProperties = { position: "absolute", right: phone ? 14 : 18, bottom: inset + 12, display: "flex", alignItems: "center", gap: 6, zIndex: 3 };
  const pillBtn: React.CSSProperties = { position: "absolute", zIndex: 6, height: 26, padding: "0 14px", borderRadius: 999, cursor: "pointer", border: "1px solid rgba(195,207,212,0.2)", background: "rgba(9,12,19,0.92)", color: "#C3CFD4", font: "600 11.5px/1 var(--font-body)", whiteSpace: "nowrap" };

  const viewToggle = (
    <div role="group" aria-label="View" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(195,207,212,0.14)" }}>
      {([["map", "Map"], ["systems", "Systems"], ["list", "List"]] as Array<[View, string]>).map(([k, l]) => (
        <button key={k} aria-pressed={view === k} onClick={() => { setView(k); setPeek(null); }} style={{ border: "none", cursor: "pointer", font: "600 12px/1 var(--font-body)", padding: phone ? "8px 10px" : "8px 13px", borderRadius: 999, background: view === k ? "#F6F3EC" : "transparent", color: view === k ? "#0E1A21" : "#9FB3BC" }}>{l}{k === "list" && !phone ? " view" : ""}</button>
      ))}
    </div>
  );

  // ─── key risks panel ──────────────────────────────────────────────
  const risksPanel = (style: React.CSSProperties) => (
    <div style={{ padding: "11px 13px", borderRadius: 16, background: "rgba(10,13,20,0.84)", border: "1px solid rgba(195,207,212,0.16)", ...style }} className="ozv ozv-dark" data-testid="key-risks">
      <button onClick={() => setRisksOpen(!risksShown)} aria-expanded={risksShown} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", padding: 0, border: "none", background: "transparent", cursor: "pointer", font: "600 13px/1.2 var(--font-display)", color: "#F6F3EC" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5440" }} />Key risks{risks.length ? <span style={{ font: "500 11px/1 var(--font-body)", color: "#9FB3BC" }}>{risks.length}</span> : null}</span>
        <span style={{ font: "500 11px/1 var(--font-body)", color: "#9FB3BC" }}>{risksShown ? "Hide" : "Show"}</span>
      </button>
      {risksShown && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 9, maxHeight: 200, overflowY: "auto" }}>
          {risks.length === 0 && <span style={{ font: "italic 400 12.5px/1.4 var(--font-body)", color: "#8E97A3" }}>None recorded.</span>}
          {risks.slice(0, 7).map((r, i) => (
            <button key={i} type="button" onClick={() => { if (!r.id) return; if (view === "list") setListSel({ kind: "node", id: r.id }); else setDrawer({ kind: "node", id: r.id }); }} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 0, border: "none", background: "transparent", textAlign: "left", cursor: r.id ? "pointer" : "default", font: "400 12.5px/1.4 var(--font-body)", color: r.red ? "#FFB3A1" : "#C3CFD4" }}>
              <i style={{ flexShrink: 0, width: 6, height: 6, marginTop: 6, borderRadius: "50%", background: r.red ? "#FF5A3C" : r.tag === "Pathway" || r.tag === "Scenario" ? "#F5CF5B" : "#8FA3AD" }} />
              <span>{r.text}{r.tag && <span style={{ marginLeft: 6, font: "500 10px/1 var(--font-mono)", color: "#C4B5FD" }}>{r.tag}</span>}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ─── small inspect box + read more ────────────────────────────────
  const peekBox = (host: { w: number; h: number }) => {
    if (!peek) return null;
    const W = 250, left = Math.max(8, Math.min(host.w - W - 8, peek.x - W / 2)), above = peek.y > 170;
    const box: React.CSSProperties = { position: "absolute", left, width: W, zIndex: 7, padding: "10px 12px", borderRadius: 14, background: "rgba(12,16,24,0.74)", border: "1px solid rgba(195,207,212,0.24)", backdropFilter: "blur(6px)", boxShadow: "0 8px 24px rgba(0,0,0,0.35)", color: "#F6F3EC", ...(above ? { top: Math.max(8, peek.y - 150) } : { top: peek.y + 16 }) };
    const x = <button aria-label="Close" onClick={() => setPeek(null)} style={{ border: "none", background: "transparent", color: "#9FB3BC", cursor: "pointer", font: "600 14px/1 var(--font-body)", padding: 0 }}>×</button>;
    if (!peek.sel) return (
      <div style={box} role="dialog" aria-label={peek.role}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ font: "600 13.5px/1.3 var(--font-body)" }}>{peek.role}</b>{x}</div>
        <span style={{ font: "400 12px/1.4 var(--font-body)", color: "#9FB3BC" }}>A role as configured for the demo — not a real person.</span>
      </div>
    );
    let title = "", line = "", risk = "", change = "", zoom: (() => void) | null = null;
    if (peek.sel.kind === "edge") {
      const e = state.edges.find((y) => y.rel.id === peek.sel!.id);
      const nm = (id: string) => state.nodes.find((n) => n.id === id)?.label ?? id;
      if (e) { title = `${nm(e.rel.from)} → ${nm(e.rel.to)}`; line = e.rel.label; change = e.marks.find((m) => m.kind !== "source")?.label ?? ""; }
    } else {
      const n = state.nodes.find((y) => y.id === peek.sel!.id);
      if (n) {
        title = n.label;
        line = n.display || (n.el ? getState(n.el.visual, n.el.state).label + " · " + (getElementType(n.el.visual)?.label ?? "") : n.kind === "team" ? "Team · " + (lead.teams.find((t) => t.id === n.id)?.roles.length ?? 0) + " roles" : "Your organisation");
        risk = n.marks.find((m) => m.tone === "risk")?.label ?? "";
        change = n.marks.find((m) => m.tone !== "risk" && m.kind !== "ledger")?.label ?? "";
        if (peek.where === "map" && n.kind === "org" && hasTeams && level === "macro") zoom = () => { setPeek(null); mapApi.current?.setLevel("meso"); };
        if (peek.where === "map" && n.kind === "team" && level === "meso") zoom = () => { setPeek(null); mapApi.current?.setLevel("micro", n.id); };
      }
    }
    return (
      <div style={box} role="dialog" aria-label={title} data-testid="peek">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ font: "600 13.5px/1.3 var(--font-body)" }}>{title}</b>{x}</div>
        {line && <div style={{ font: "400 12px/1.4 var(--font-body)", color: "#C3CFD4", marginTop: 3 }}>{clip(line, 90)}</div>}
        {risk && <div style={{ font: "600 12px/1.4 var(--font-body)", color: "#FF8A70", marginTop: 4 }}>⚠ {risk}</div>}
        {change && !risk && <div style={{ font: "500 12px/1.4 var(--font-body)", color: "#D9F23A", marginTop: 4 }}>{clip(change, 70)}</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button className="ozv-btn" style={{ height: 26, color: "#F6F3EC" }} onClick={() => { setDrawer(peek.sel); setPeek(null); }}>Read more</button>
          {zoom && <button className="ozv-btn" style={{ height: 26, color: "#F6F3EC" }} onClick={zoom}>Zoom inside →</button>}
        </div>
      </div>
    );
  };

  // ─── bottom menus ─────────────────────────────────────────────────
  const matches = scenarioText.trim() ? matchScenarios(lead, scenarioText).map((m) => m.scenario) : [];
  const chips = (matches.length ? matches : scenarios).slice(0, 4);
  const onTop = shownId ? `Pathway ${opt + 1}` : "the current plan";
  const card: React.CSSProperties = { pointerEvents: "auto", display: "flex", flexDirection: "column", gap: 8, minWidth: 0, minHeight: 0, padding: "12px 14px", borderRadius: 16, backdropFilter: "blur(8px)", overflow: "hidden" };
  const simCard = (
    <form onSubmit={submitScenario} style={{ ...card, background: "rgba(30,24,60,0.86)", border: "1px solid rgba(196,181,253,0.28)" }} data-testid="scenario-menu">
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, font: "600 13.5px/1.2 var(--font-display)", color: "#D9F23A" }}>
        Run a quick scenario or change
        {active && <button type="button" onClick={clearScenario} className="ozv-btn" style={{ height: 24, color: "#F6F3EC" }}>Clear</button>}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <input aria-label="Describe a change" value={scenarioText} onChange={(e) => { setScenarioText(e.target.value); setScenarioNote(null); }} placeholder={scenarios.length ? `Type a change, e.g. “${clip(scenarios[0].question, 44)}”` : "No scenarios were prepared for this case"} disabled={!scenarios.length} style={{ flex: 1, minWidth: 0, height: 36, padding: "0 12px", borderRadius: 10, border: "1.5px solid rgba(195,207,212,0.3)", background: "rgba(255,255,255,0.07)", color: "#F6F3EC", font: "500 13px/1 var(--font-body)" }} />
        <button type="submit" disabled={!scenarios.length || running} style={{ flexShrink: 0, height: 36, padding: "0 16px", border: "none", borderRadius: 999, cursor: "pointer", background: "#D9F23A", color: "#0E1A21", font: "700 12.5px/1 var(--font-body)" }}>{running ? "Playing…" : "Run"}</button>
      </div>
      <div style={{ display: "flex", flexWrap: phone ? "nowrap" : "wrap", gap: 6, overflowX: phone ? "auto" : "hidden", overflowY: "hidden", flexShrink: 0 }}>
        {chips.map((s) => <button key={s.id} type="button" onClick={() => runScenario(s.id)} aria-pressed={scenarioId === s.id} style={{ maxWidth: "100%", padding: "5px 10px", borderRadius: 999, cursor: "pointer", border: "1px solid " + (scenarioId === s.id ? "#D9F23A" : "rgba(196,181,253,0.35)"), background: scenarioId === s.id ? "rgba(217,242,58,0.16)" : "rgba(255,255,255,0.04)", color: scenarioId === s.id ? "#D9F23A" : "#D9CCFF", font: "500 12px/1.3 var(--font-body)", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: phone ? 0 : 1 }}>{s.question}</button>)}
      </div>
      <span role="status" style={{ font: "400 11.5px/1.35 var(--font-body)", color: scenarioNote ? "#F5CF5B" : "#9FB3BC" }}>{scenarioNote ?? (active ? `${active.question} — applied to ${onTop}${state.notApplied.length ? ". " + state.notApplied[0].reason : ""}. Illustrative assumption.` : "Small decisions on the spot — on their own or with a pathway. Illustrative, not a prediction.")}</span>
    </form>
  );
  const optsCard = (
    <div style={{ ...card, background: "rgba(12,16,24,0.86)", border: "1px solid rgba(195,207,212,0.18)" }} data-testid="options-menu">
      <span style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, font: "600 13.5px/1.2 var(--font-display)", whiteSpace: "nowrap" }}>
        Pathways forward
        <button onClick={() => navigate("/pathways")} disabled={pathways.length === 0} style={{ display: "inline-flex", alignItems: "center", padding: "7px 12px", borderRadius: 999, border: "none", background: pathways.length ? "#1A51FF" : "#2A3340", color: "#FFFFFF", font: "600 12px/1 var(--font-body)", cursor: pathways.length ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>Explore pathways →</button>
      </span>
      {pathways.length === 0 ? (
        <span style={{ font: "italic 400 12.5px/1.45 var(--font-body)", color: "#9FB3BC" }}>No pathways have been added for this case yet.</span>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${pathways.length}, minmax(0, 1fr))`, gap: 8 }}>
          {pathways.map((p, i) => {
            const on = opt === i, isChosen = chosen === i, v = outcomeFor(lead, p.id);
            const l = planning ? pathwayLedger(lead, p, active ? [active] : []) : null;
            return (
              <button key={p.id} onClick={() => playOption(i)} aria-pressed={on} title={p.summary || p.idea} style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left", cursor: "pointer", padding: "9px 11px", borderRadius: 12, fontFamily: "var(--font-body)", minHeight: 0, color: "#F6F3EC", background: on ? "rgba(155,123,255,0.22)" : "rgba(255,255,255,0.03)", border: "1.5px solid " + (on ? "#9B7BFF" : isChosen ? "rgba(217,242,58,0.6)" : "rgba(195,207,212,0.14)") }}>
                <span style={{ font: "500 11px/1 var(--font-body)", color: on ? "#D9CCFF" : "#7F95A0" }}>Pathway {i + 1}{isChosen ? " · ✓ selected" : ""}{on ? " · on map" : ""}</span>
                <b style={{ display: "block", font: "600 13px/1.3 var(--font-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</b>
                {l ? (
                  <span style={{ font: "500 11.5px/1.35 var(--font-body)", color: "#C3CFD4" }}>{l.totals.map((t, j) => <span key={t.constraint.id} style={{ color: t.headroom != null && t.headroom <= 0 ? "#FF8A70" : undefined, fontWeight: t.headroom != null && t.headroom <= 0 ? 700 : undefined }}>{j ? " · " : ""}{t.headroom == null ? "cap not known" : t.headroom < 0 ? `${formatAmount(t.constraint, -t.headroom)} over` : `${formatAmount(t.constraint, t.headroom)} left`}</span>)}</span>
                ) : v != null ? (
                  <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}><b style={{ font: "700 17px/1 var(--font-display)" }}>{v}%</b><span style={{ font: "400 10.5px/1.25 var(--font-body)", color: "#9FB3BC" }}>demo assumption</span></span>
                ) : (
                  <span style={{ font: "400 11px/1.3 var(--font-body)", color: "#9FB3BC" }}>{p.risks.length ? `${openRisksAt12(p)} risk${openRisksAt12(p) === 1 ? "" : "s"} still open at month 12` : "Risks not assessed"}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <span style={{ font: "400 11.5px/1.35 var(--font-body)", color: "#9FB3BC", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{oe ? "Demo assumption: " + oe.question : active && planning ? "What's left includes the quick change. Not an approval." : "Bigger strategies · click to preview, again to clear. Not an approval."}</span>
    </div>
  );
  const showSim = !phone || hudTab === "sim", showOpts = !phone || hudTab === "opts";
  const hud = (
    <>
      <button onClick={() => setHudOpen((v) => !v)} style={{ ...pillBtn, right: 14, bottom: !hudOpen ? 12 : HUD_H + 18 }}>{!hudOpen ? (phone ? "▴ Show" : "▴ Show controls") : phone ? "▾ Hide" : "▾ Hide controls"}</button>
      <button onClick={() => navigate("/upload")} style={{ ...pillBtn, left: 14, bottom: !hudOpen ? 12 : HUD_H + 18, border: "1px solid rgba(196,181,253,0.45)", background: "rgba(36,28,72,0.95)", color: "#D9CCFF" }} className="tw-ctx">{phone ? "+ Context" : "+ Add more context"}</button>
      {phone && hudOpen && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: HUD_H + 18, zIndex: 6, display: "flex", gap: 2, padding: 2, borderRadius: 999, background: "rgba(9,12,19,0.92)", border: "1px solid rgba(195,207,212,0.2)" }}>
          {([["sim", "Quick change"], ["opts", "Pathways"]] as Array<["sim" | "opts", string]>).map(([k, l]) => (<button key={k} aria-pressed={hudTab === k} onClick={() => setHudTab(k)} style={{ height: 22, padding: "0 12px", border: "none", borderRadius: 999, cursor: "pointer", font: "600 11.5px/1 var(--font-body)", background: hudTab === k ? "#F6F3EC" : "transparent", color: hudTab === k ? "#0E1A21" : "#C3CFD4" }}>{l}</button>))}
        </div>
      )}
      {hudOpen && (
        <div style={{ position: "absolute", left: 14, right: 14, bottom: 12, height: HUD_H, display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 12, pointerEvents: "none", zIndex: 5 }}>
          {showSim && simCard}
          {showOpts && optsCard}
        </div>
      )}
    </>
  );

  const drawerPanel = drawer && (
    <div className="ozv ozv-dark" style={{ position: "absolute", top: 12, right: 12, bottom: inset + 8, width: "min(380px, calc(100% - 24px))", overflowY: "auto", zIndex: 8, borderRadius: 18, boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }} data-testid="detail-drawer">
      <MapDetail lead={lead} state={state} sel={drawer} sources={srcs} onSelect={(s) => setDrawer(s)} onClose={() => setDrawer(null)} />
    </div>
  );

  const legendStrip = (
    <div ref={legendRef} className="ozv ozv-dark" style={{ position: "absolute", left: phone ? 10 : 14, top: 10, right: wide ? 318 : phone ? 10 : 14, zIndex: 3, display: "flex", flexWrap: phone ? "nowrap" : "wrap", overflowX: phone ? "auto" : undefined, whiteSpace: phone ? "nowrap" : undefined, alignItems: "center", gap: "8px 18px", padding: "9px 14px", borderRadius: 14, background: "rgba(13,17,26,0.84)", border: "1px solid rgba(195,207,212,0.12)", backdropFilter: "blur(6px)", font: "400 12px/1.4 var(--font-body)", color: "#C3CFD4" }}>
      {([["#C3CFD4", undefined, "Existing"], ["#C4B5FD", "7 5", "Proposed / uncertain"], ["#D9F23A", "1.5 5", "Scenario"], ["#FF7A5C", undefined, "Risk"]] as Array<[string, string | undefined, string]>).map(([col, dash, l]) => (
        <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}><svg width="30" height="10" aria-hidden><path d="M2 5H24" stroke={col} strokeWidth={1.8} strokeDasharray={dash} strokeLinecap="round" /><path d="M21 1.5L27 5L21 8.5" stroke={col} strokeWidth={1.6} fill="none" /></svg>{l}</span>
      ))}
      <span style={{ color: "#9FB3BC" }}>? unknown · ⚠ possible risk · ◷ pending</span>
      {lead.impactRoutes.length > 0 && (
        <span style={{ display: "inline-flex", flexWrap: phone ? "nowrap" : "wrap", flexShrink: 0, alignItems: "center", gap: 6, marginLeft: "auto" }} data-testid="impact-routes">
          <span style={{ color: "#9FB3BC" }}>Impact routes:</span>
          {lead.impactRoutes.map((r) => <button key={r.id} className="ozv-btn" style={{ height: 26, color: route?.id === r.id ? "#0E1A21" : "#F6F3EC" }} aria-pressed={route?.id === r.id} onClick={() => setRoute(route?.id === r.id ? null : r)}>{r.title}</button>)}
        </span>
      )}
    </div>
  );
  const routeSteps = route && (
    <div className="ozv ozv-dark" style={{ position: "absolute", left: 14, right: phone ? 14 : 70, bottom: inset + 10, zIndex: 3, maxHeight: 110, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "stretch" }} onClick={(e) => e.stopPropagation()}>
      {route.steps.map((s, i) => (
        <button key={i} type="button" onClick={() => s.nodeId && setDrawer({ kind: "node", id: s.nodeId })} style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: 3, padding: "8px 10px", borderRadius: 12, border: "1px dashed rgba(217,242,58,0.4)", background: "rgba(22,30,8,0.88)", backdropFilter: "blur(6px)", color: "#F6F3EC", textAlign: "left", cursor: s.nodeId ? "pointer" : "default" }}>
          <b style={{ font: "600 12.5px/1.3 var(--font-body)" }}>{i + 1}. {s.label}</b>
          <span style={{ font: "400 11.5px/1.35 var(--font-body)", color: "#C3CFD4" }}>{s.question}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div ref={rootRef} className="tw-world" style={{ height: "100dvh", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", color: "#F6F3EC", background: "radial-gradient(1200px 640px at 50% -8%, #1B1734 0%, #0B0F17 55%, #06080C 100%)", overflow: "hidden" }}>
      <DemoHeader current="/twin" dark label={orgName(lead)} right={viewToggle} />
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", background: view === "map" ? "#0E1A21" : undefined }}>

        {view === "list" && (
          <main className="ozv ozv-dark" style={{ position: "absolute", inset: 0, overflowY: "auto", padding: `20px 20px ${inset + 24}px` }} data-testid="twin-list-view">
            <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
              <h1 style={{ margin: 0, font: "700 26px/1.2 var(--font-display)" }}>{orgName(lead)} · list view</h1>
              <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 1fr) 360px" : "minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
                <ElementList items={listItems.items} connections={listItems.conns} selectedId={listSel?.kind === "node" ? listSel.id : null} onSelect={(id) => setListSel({ kind: "node", id })} changed={listItems.changed} emptyText="No places, teams or elements have been added to this case yet." />
                <div style={{ position: wide ? "sticky" : "static", top: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {listSel ? <MapDetail lead={lead} state={state} sel={listSel} sources={srcs} onSelect={setListSel} onClose={() => setListSel(null)} /> : <p className="ozv-muted-text" style={{ margin: 0 }}>Select an item to inspect it.</p>}
                  {risksPanel({})}
                </div>
              </div>
            </div>
          </main>
        )}

        {view === "systems" && (
          <main className="ozv ozv-dark" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "radial-gradient(1200px 700px at 45% 38%, #13202A 0%, #0B1219 72%)" }} data-testid="twin-systems-view" onClick={() => setPeek(null)}>
            <h1 className="ozv-sr">{orgName(lead)} — systems view</h1>
            <div ref={sysRef} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: inset }}>
              <SystemsMap ref={sysApi} state={state} selected={peek?.where === "systems" ? peek.sel : drawer} onSelect={(s, pt) => setPeek(s && pt ? { sel: s, x: pt.x, y: pt.y, where: "systems" } : null)} rippleKey={rippleKey} reducedMotion={prefersReduced()} route={route} allLabels={false} padTop={legendH} padRight={wide && risksShown ? 310 : 0} />
              {peek?.where === "systems" && <div onClick={(e) => e.stopPropagation()}>{peekBox({ w: sysRef.current?.clientWidth ?? vw, h: sysRef.current?.clientHeight ?? vh })}</div>}
            </div>
            {legendStrip}
            {risksPanel({ position: "absolute", right: phone ? 10 : 14, top: phone ? legendH : 10, width: wide ? 290 : phone ? (risksShown ? "min(260px, calc(100% - 20px))" : "auto") : 240, zIndex: 4 })}
            {routeSteps}
            <div style={{ ...ctlStyle, zIndex: 4 }} onClick={(e) => e.stopPropagation()}>
              {SYS_CTRLS.map(([icon, title, act]) => (<button key={title} className="tw-ctl" onClick={act} title={title} aria-label={title} style={ctlBtn}>{icon}</button>))}
            </div>
          </main>
        )}

        {view === "map" && (
          <div ref={stageRef} style={{ position: "absolute", inset: 0 }}>
            <h1 className="ozv-sr">{orgName(lead)} — organisational model</h1>
            <TwinWorldMap ref={mapApi} caseData={world} onSelect={onEngineSelect} onLevel={onLevelCb} />
            <div style={{ position: "absolute", left: 22, top: 18, display: "flex", flexDirection: "column", gap: 10, maxWidth: "52%", pointerEvents: "none" }}>
              <span style={{ font: (wide ? "600 16px/1.25" : "600 14px/1.25") + " var(--font-display)", textShadow: "0 1px 10px rgba(0,0,0,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "4px 10px", borderRadius: 10, background: "rgba(10,13,20,0.55)", alignSelf: "flex-start", maxWidth: "100%" }}>{subtitle}</span>
              {showLegend && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
                  {legendFor(level, rule.legend === "portfolio").map(([col, label, solid], i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, font: "400 11.5px/1 var(--font-body)", color: "#C3CFD4", whiteSpace: "nowrap" }}><i style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px " + (solid ? "solid" : "dashed") + " " + col, background: solid ? col : col + "33" }} />{label}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={levelBarStyle} role="group" aria-label="Level">
              {LEVEL_DEFS.map(([k, name]) => {
                const disabled = k !== "macro" && !hasTeams;
                return (<button key={k} disabled={disabled} aria-pressed={level === k} onClick={() => mapApi.current?.setLevel(k, k === "micro" ? floorId : undefined)} title={disabled ? "Add teams in /prepare to explore inside the organisation" : LEVEL_SUB[k]} style={{ width: 64, height: 34, border: "none", borderRadius: 999, cursor: disabled ? "not-allowed" : "pointer", font: "600 12px/1 var(--font-body)", background: level === k ? "#F6F3EC" : "transparent", color: level === k ? "#0E1A21" : disabled ? "#56646B" : "#C3CFD4" }}>{name}</button>);
              })}
            </div>
            {risksPanel({ position: "absolute", right: phone ? 14 : 16, top: phone ? 12 : level === "macro" ? 16 : 64, width: wide ? 290 : phone ? (risksShown ? "min(260px, calc(100% - 28px))" : "auto") : 240, zIndex: phone ? 6 : 3 })}
            {level !== "macro" && (<button onClick={() => mapApi.current?.setLevel(level === "micro" ? "meso" : "macro")} className="tw-back" style={backStyle}>{level === "micro" ? "← Back to the organisation" : "← Back to the wider view"}</button>)}
            <div style={ctlStyle}>
              {CTRLS.map(([icon, title, act]) => (<button key={title} className="tw-ctl" onClick={act} title={title} aria-label={title} style={ctlBtn}>{icon}</button>))}
            </div>
            {peek?.where === "map" && peekBox({ w: stageRef.current?.clientWidth ?? vw, h: stageRef.current?.clientHeight ?? vh })}
            {running && (<div role="status" style={{ position: "absolute", left: "50%", top: 18, transform: "translateX(-50%)", font: "600 12px/1 var(--font-body)", color: "#0E1A21", background: "#D9F23A", padding: "10px 16px", borderRadius: 999, boxShadow: "0 0 24px rgba(217,242,58,0.45)" }}>Playing it out…</div>)}
          </div>
        )}

        {drawerPanel}
        {hud}
      </div>
    </div>
  );
}
