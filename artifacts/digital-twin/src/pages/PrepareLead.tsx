/**
 * /prepare — team-only editor for lead-specific demo cases.
 *
 * Not linked from the customer flow, and behind the team password (see
 * src/components/prepare/PrepareGate.tsx). Everything is stored in this browser
 * (localStorage, one key per case — see src/lib/lead/store.ts). Export a case
 * to a JSON file to keep it or to load it on the presenting machine.
 *
 * Workflow: New blank case → fill sections (all optional) → check warnings →
 * "Show in the demo" → walk the demo → export the JSON file.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ListEditor, RowEditor, smallBtn } from "@/components/prepare/FieldEditor";
import { lockPrepare } from "@/components/prepare/PrepareGate";
import * as SEC from "@/components/prepare/sections";
import { VisualNode } from "@/components/visuals/VisualNode";
import {
  blankAssumption, blankElement, blankFinding, blankMissing, blankNotice, blankNumber, blankPathway, blankPlanning, blankRelationship, blankRoute, blankScenario, blankSource, blankTeam,
  BASELINE_LIMITATIONS, normaliseLeadCase,
} from "@/lib/lead/blank";
import { createCaseFromPreset, DEMO_PRESETS } from "@/lib/lead/presets";
import { completeness, nameOf } from "@/lib/lead/derive";
import {
  createCase, deleteCase, exportCaseJson, exportFileName, getActiveCaseId, getCase, getProgress, importCaseJson, LEAD_CHANGED_EVENT, listCases, resetProgress, saveCase, setActiveCaseId,
  type LeadSummary,
} from "@/lib/lead/store";
import type { LeadCase } from "@/lib/lead/types";
import { validateLeadCase } from "@/lib/lead/validate";
import { getElementType } from "@/lib/visuals/registry";
import "@/components/visuals/visuals.css";

// Development builds only: a button that loads a synthetic example case. The
// import sits behind import.meta.env.DEV, so production builds drop it.
const DevSampleButton = import.meta.env.DEV ? lazy(() => import("@/dev/DevSampleButton")) : null;

const SECTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: "organisation", label: "Organisation & look", hint: "Name, overview, sector and the organisation-type presentation rules." },
  { id: "decision", label: "Decision & intake", hint: "The decision, objectives, horizon, boundaries and intake answers." },
  { id: "numbers", label: "Important numbers", hint: "Each with unit, date or period, source and evidence type. Empty value = unknown." },
  { id: "elements", label: "Places & system elements", hint: "Stakeholders, places, infrastructure, flows, risks … each with a visual, state and overlays." },
  { id: "teams", label: "Teams & roles", hint: "Teams inside the organisation. Roles, not names of people." },
  { id: "relationships", label: "Relationships", hint: "Dependencies, decision rights, hand-offs, trust, tension — with differing perspectives." },
  { id: "sources", label: "Sources & uploads", hint: "Source documents with date and scope, plus the prepared reading shown on simulated upload." },
  { id: "findings", label: "Findings & assumptions", hint: "Key signals, findings with confidence, assumptions and missing information." },
  { id: "limitations", label: "Limitations & notices", hint: "Case-specific limitations and approved normative / contestation notices." },
  { id: "planning", label: "Planning ledger", hint: "Optional. Caps, the baseline and candidate components. Pathway totals, headroom and quick-change results are calculated from these — never typed twice." },
  { id: "pathways", label: "Pathways & scenarios", hint: "Up to three pathways with illustrative effects, plus quick changes (scenarios) and impact routes." },
  { id: "json", label: "Advanced: JSON", hint: "Edit or paste the whole case as JSON." },
];

const page: React.CSSProperties = { minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#FCFBF8", color: "#221E2E", fontFamily: "var(--font-body)" };
const card: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", borderRadius: 16, background: "#FFFFFF", border: "1px solid #E9E2D4" };
const h2: React.CSSProperties = { margin: 0, font: "700 18px/1.3 var(--font-display)" };
const hint: React.CSSProperties = { margin: 0, font: "400 13px/1.5 var(--font-body)", color: "#6A6376" };
const primary: React.CSSProperties = { ...smallBtn, background: "#1A51FF", color: "#FFFFFF", borderColor: "#1A51FF", height: 34 };

export default function PrepareLeadPage() {
  const [, navigate] = useLocation();
  const [cases, setCases] = useState<LeadSummary[]>(() => listCases());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveCaseId());
  const [editId, setEditId] = useState<string | null>(() => getActiveCaseId() ?? listCases()[0]?.id ?? null);
  const [lead, setLead] = useState<LeadCase | null>(() => getCase(editId));
  const [section, setSection] = useState("organisation");
  const [newLabel, setNewLabel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [json, setJson] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => { setCases(listCases()); setActiveId(getActiveCaseId()); };
    window.addEventListener(LEAD_CHANGED_EVENT, on);
    return () => window.removeEventListener(LEAD_CHANGED_EVENT, on);
  }, []);
  useEffect(() => { setLead(getCase(editId)); }, [editId]);
  useEffect(() => { if (section === "json" && lead) setJson(exportCaseJson(lead)); }, [section, lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: LeadCase) => { setLead(saveCase(next)); };
  const issues = useMemo(() => (lead ? validateLeadCase(lead) : []), [lead]);
  const checklist = useMemo(() => (lead ? completeness(lead) : []), [lead]);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const create = () => { const c = createCase(newLabel.trim()); setNewLabel(""); setEditId(c.id); setSection("organisation"); flash("New blank case created."); };
  const fromPreset = (id: string) => {
    const c = createCaseFromPreset(id);
    setEditId(c.id); setSection("organisation");
    flash(`“${c.organisation.name}” demo case created as a new, separate case. Review and edit the prefilled sections, then click “Show in the demo”.`);
  };
  const doExport = () => {
    if (!lead) return;
    const blob = new Blob([exportCaseJson(lead)], { type: "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = exportFileName(lead); document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    flash("Exported " + exportFileName(lead) + ". Store it outside the repository.");
  };
  const doImport = (f: File) => {
    const r = new FileReader();
    r.onload = () => { try { const c = importCaseJson(String(r.result ?? "")); setEditId(c.id); flash("Imported as a new, separate case."); } catch (e) { flash((e as Error).message); } };
    r.readAsText(f);
  };
  const doDelete = () => {
    if (!lead) return;
    const name = lead.internalLabel || lead.organisation.name || "this case";
    if (!window.confirm(`Delete “${name}” from this browser? This cannot be undone. Export it first if you may need it again.`)) return;
    deleteCase(lead.id);
    const rest = listCases(); setEditId(rest[0]?.id ?? null); flash("Case deleted from this browser.");
  };
  const doReset = () => {
    if (!lead || !window.confirm("Reset demo progress for this case? Simulated uploads and the chosen pathway are cleared. Content is kept.")) return;
    resetProgress(lead.id); flash("Demo progress reset. Content unchanged.");
  };
  const applyJson = () => {
    if (!lead) return;
    try { const parsed = JSON.parse(json); const c = normaliseLeadCase({ ...parsed, schema: "ozy-lead-case" }); update({ ...c, id: lead.id, createdAt: lead.createdAt }); flash("JSON applied to this case."); }
    catch { flash("That JSON could not be read — nothing was changed."); }
  };

  const ctx = lead as LeadCase;
  const elementAside = (row: { label: string; visual: string; state: string; overlays: string[] }) => (
    <div className="ozv" style={{ width: 230 }} aria-label="Preview"><VisualNode item={{ id: "pv", label: row.label || "Preview", visual: row.visual, state: row.state, overlays: row.overlays }} compact /><p className="ozv-rule" style={{ margin: "6px 0 0" }}>{getElementType(row.visual)?.rule ?? ""}</p></div>
  );

  return (
    <div className="tw-world" style={page}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid #E9E2D4", flexWrap: "wrap" }}>
        <b style={{ font: "700 20px/1 var(--font-display)" }}>Prepare a lead demo</b>
        <span style={{ padding: "4px 10px", borderRadius: 999, background: "#FFF1E8", color: "#A64B00", font: "600 12px/1.3 var(--font-body)" }}>Team only · password-protected · not linked from the customer flow</span>
        <span style={{ marginLeft: "auto", font: "400 12px/1.4 var(--font-body)", color: "#6A6376" }}>Saved in this browser only · export to keep a copy</span>
        <button style={smallBtn} onClick={lockPrepare} title="Lock the editor in this tab">Lock</button>
      </header>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(240px, 280px) minmax(0, 1fr)", gap: 18, padding: 18, alignItems: "start" }} className="prep-grid">
        <aside style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 12 }}>
          <div style={card}>
            <b style={{ font: "600 14px/1.3 var(--font-body)" }}>Cases in this browser</b>
            {cases.length === 0 && <span style={hint}>None yet. Start with a blank case or import a lead file.</span>}
            <div role="list" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cases.map((c) => (
                <button role="listitem" key={c.id} onClick={() => setEditId(c.id)} aria-current={c.id === editId} style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left", padding: "8px 10px", borderRadius: 10, cursor: "pointer", border: "1.5px solid " + (c.id === editId ? "#9C6BFF" : "#E9E2D4"), background: c.id === editId ? "#F6F2FF" : "#FFFFFF", color: "#221E2E" }}>
                  <b style={{ font: "600 13px/1.3 var(--font-body)" }}>{c.internalLabel || c.name || "Untitled case"}{c.id === activeId ? " · in the demo" : ""}</b>
                  <span style={{ font: "400 11px/1.3 var(--font-body)", color: "#8E869C" }}>{c.name || "Organisation not set"} · {c.updatedAt.slice(0, 10)}</span>
                </button>
              ))}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, font: "600 12px/1.3 var(--font-body)" }}>Internal label for a new case
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Lead — intro call, Nov" style={{ padding: "7px 9px", borderRadius: 10, border: "1px solid #D9D2C3", font: "400 13px/1.4 var(--font-body)" }} />
            </label>
            <button style={primary} onClick={create}>+ New blank case</button>
            <button style={smallBtn} onClick={() => fileRef.current?.click()}>Import a lead file (.json)</button>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8, borderTop: "1px solid #E9E2D4" }} data-testid="demo-presets">
              <b style={{ font: "600 12.5px/1.3 var(--font-body)" }}>Start from a demo case</b>
              {DEMO_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => fromPreset(p.id)} title={p.hint} style={{ ...smallBtn, height: "auto", padding: "8px 12px", whiteSpace: "normal", textAlign: "left", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                  <span>{p.label}</span>
                  <span style={{ font: "400 11px/1.35 var(--font-body)", color: "#6A6376" }}>{p.hint}</span>
                </button>
              ))}
              <span style={{ font: "400 11px/1.4 var(--font-body)", color: "#8E869C" }}>Creates a new case you can edit. It is not shown in the demo until you choose “Show in the demo”.</span>
            </div>
            {DevSampleButton && (
              <Suspense fallback={null}>
                <DevSampleButton style={{ ...smallBtn, borderStyle: "dashed" }} onLoaded={(id) => { setEditId(id); flash("Synthetic example loaded. Click “Show in the demo” to use it."); }} />
              </Suspense>
            )}
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }} />
          </div>
          {lead && (
            <nav aria-label="Sections" style={{ ...card, gap: 4 }}>
              {SECTIONS.map((s) => (<button key={s.id} onClick={() => setSection(s.id)} aria-current={section === s.id} style={{ textAlign: "left", padding: "7px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: section === s.id ? "#221E2E" : "transparent", color: section === s.id ? "#FFFFFF" : "#221E2E", font: "600 13px/1.3 var(--font-body)" }}>{s.label}</button>))}
            </nav>
          )}
        </aside>

        <main style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {msg && <div role="status" style={{ padding: "10px 14px", borderRadius: 12, background: "#EEF4FF", border: "1px solid #C9D8FF", font: "500 13px/1.4 var(--font-body)" }}>{msg}</div>}
          {!lead ? (
            <div style={card}><h1 style={h2}>No case selected</h1><p style={hint}>Create a new blank case or import a lead file to begin. The customer-facing demo shows “not prepared yet” until a case is set to show in the demo.</p></div>
          ) : (
            <>
              <div style={{ ...card, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, font: "600 12px/1.3 var(--font-body)", flex: "1 1 220px" }}>Internal label (team only)
                  <input value={lead.internalLabel} onChange={(e) => update({ ...lead, internalLabel: e.target.value })} style={{ padding: "7px 9px", borderRadius: 10, border: "1px solid #D9D2C3", font: "400 13.5px/1.4 var(--font-body)" }} />
                </label>
                {lead.id === activeId ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#EAF7D2", color: "#3E5A00", font: "600 12px/1.3 var(--font-body)" }}>✓ Shown in the demo</span> : <button style={primary} onClick={() => { setActiveCaseId(lead.id); flash("This case is now the one the demo shows in this browser."); }}>Show in the demo</button>}
                <button style={smallBtn} onClick={() => navigate("/questionnaire")} disabled={lead.id !== activeId} title={lead.id !== activeId ? "Show this case in the demo first" : ""}>Open the demo →</button>
                <button style={smallBtn} onClick={doExport}>Export JSON</button>
                <button style={smallBtn} onClick={doReset}>Reset demo progress</button>
                <button style={{ ...smallBtn, color: "#C8321B", borderColor: "#F3C7BE" }} onClick={doDelete}>Delete case</button>
                <span style={{ ...hint, width: "100%" }}>Demo progress: {getProgress(lead.id).appliedSources.length} simulated upload(s) applied{getProgress(lead.id).pathwayPick ? " · a pathway is chosen" : ""}{getProgress(lead.id).stressTests.length ? ` · ${getProgress(lead.id).stressTests.length} stress test(s) on` : ""}.</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                <div style={card}>
                  <b style={{ font: "600 14px/1.3 var(--font-body)" }}>What's filled in</b>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                    {checklist.map((c) => (<li key={c.label} style={{ font: "400 13px/1.4 var(--font-body)", color: c.done ? "#3E5A00" : "#6A6376" }}>{c.done ? "✓" : "○"} {c.label}{c.done ? "" : " — optional, skip if not relevant"}</li>))}
                  </ul>
                </div>
                <div style={card}>
                  <b style={{ font: "600 14px/1.3 var(--font-body)" }}>Checks ({issues.length})</b>
                  {issues.length === 0 ? <span style={hint}>No problems found.</span> : (
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                      {issues.map((i, k) => (<li key={k} style={{ font: "400 12.5px/1.4 var(--font-body)", color: i.level === "error" ? "#C8321B" : "#6A4A00" }}><button onClick={() => setSection(i.section === "organisation" || i.section === "decision" ? i.section : i.section === "scenarios" ? "pathways" : i.section)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", textAlign: "left" }}>{i.level === "error" ? "Error: " : ""}{i.message}</button></li>))}
                    </ul>
                  )}
                </div>
              </div>

              <section style={card} aria-labelledby="sec-h">
                <h1 id="sec-h" style={h2}>{SECTIONS.find((s) => s.id === section)?.label}</h1>
                <p style={hint}>{SECTIONS.find((s) => s.id === section)?.hint} Everything starts empty or unknown — add only what you can source, or label it as an assumption.</p>

                {section === "organisation" && (<>
                  <RowEditor fields={SEC.PRESENTATION_FIELDS} row={lead.presentation} ctx={ctx} onChange={(v) => update({ ...lead, presentation: v })} />
                  <RowEditor fields={SEC.CASE_NOTICE_FIELDS} row={{ caseNotice: lead.caseNotice }} ctx={ctx} onChange={(v) => update({ ...lead, caseNotice: v.caseNotice })} />
                  <RowEditor fields={SEC.ORGANISATION_FIELDS} row={lead.organisation} ctx={ctx} onChange={(v) => update({ ...lead, organisation: v })} />
                  <h3 style={{ margin: "8px 0 0", font: "600 14px/1.3 var(--font-body)" }}>Main contact (intake “About you”)</h3>
                  <RowEditor fields={SEC.RESPONDENT_FIELDS} row={lead.respondent} ctx={ctx} onChange={(v) => update({ ...lead, respondent: v })} />
                </>)}
                {section === "decision" && (<>
                  <RowEditor fields={SEC.DECISION_FIELDS} row={lead.decision} ctx={ctx} onChange={(v) => update({ ...lead, decision: v })} />
                  <h3 style={{ margin: "8px 0 0", font: "600 14px/1.3 var(--font-body)" }}>Intake answers</h3>
                  <RowEditor fields={SEC.INTAKE_FIELDS} row={lead.intake} ctx={ctx} onChange={(v) => update({ ...lead, intake: v })} />
                </>)}
                {section === "numbers" && <ListEditor fields={SEC.NUMBER_FIELDS} rows={lead.numbers} blank={blankNumber} ctx={ctx} itemLabel={(n) => n.label ? `${n.label}: ${n.value || "unknown"} ${n.unit}` : ""} onChange={(rows) => update({ ...lead, numbers: rows })} addLabel="Add a number" emptyText="No numbers yet." />}
                {section === "elements" && <ListEditor fields={SEC.ELEMENT_FIELDS} rows={lead.elements} blank={blankElement} ctx={ctx} itemLabel={(e) => e.label ? `${e.label} · ${getElementType(e.visual)?.label ?? e.visual}` : ""} onChange={(rows) => update({ ...lead, elements: rows })} addLabel="Add an element" aside={elementAside} emptyText="No elements yet. The map will show only the organisation." />}
                {section === "teams" && <ListEditor fields={SEC.TEAM_FIELDS} rows={lead.teams} blank={blankTeam} ctx={ctx} itemLabel={(t) => t.name} onChange={(rows) => update({ ...lead, teams: rows })} addLabel="Add a team" emptyText="No teams yet. The inside (meso / micro) levels stay disabled until you add one." />}
                {section === "relationships" && <ListEditor fields={SEC.RELATIONSHIP_FIELDS} rows={lead.relationships} blank={blankRelationship} ctx={ctx} itemLabel={(r) => r.from && r.to ? `${nameOf(lead, r.from)} → ${nameOf(lead, r.to)}${r.label ? " · " + r.label : ""}` : ""} onChange={(rows) => update({ ...lead, relationships: rows })} addLabel="Add a relationship" emptyText="No relationships yet." />}
                {section === "sources" && <ListEditor fields={SEC.SOURCE_FIELDS} rows={lead.sources} blank={() => blankSource(lead.sources.length + 1)} ctx={ctx} itemLabel={(s) => s.title ? `${s.id} · ${s.title}` : ""} onChange={(rows) => update({ ...lead, sources: rows })} addLabel="Add a source" emptyText="No sources yet. Data management will show an empty state." />}
                {section === "findings" && (<>
                  <ListEditor fields={SEC.FINDING_FIELDS} rows={lead.findings} blank={blankFinding} ctx={ctx} itemLabel={(f) => f.text} onChange={(rows) => update({ ...lead, findings: rows })} addLabel="Add a finding" emptyText="No findings yet." />
                  <h3 style={{ margin: "8px 0 0", font: "600 14px/1.3 var(--font-body)" }}>Assumptions</h3>
                  <ListEditor fields={SEC.ASSUMPTION_FIELDS} rows={lead.assumptions} blank={blankAssumption} ctx={ctx} itemLabel={(a) => a.text} onChange={(rows) => update({ ...lead, assumptions: rows })} addLabel="Add an assumption" />
                  <h3 style={{ margin: "8px 0 0", font: "600 14px/1.3 var(--font-body)" }}>Missing information</h3>
                  <ListEditor fields={SEC.MISSING_FIELDS} rows={lead.missingInfo} blank={blankMissing} ctx={ctx} itemLabel={(m) => m.title} onChange={(rows) => update({ ...lead, missingInfo: rows })} addLabel="Add a missing item" />
                </>)}
                {section === "limitations" && (<>
                  <div style={{ padding: "10px 12px", borderRadius: 12, background: "#F4F1EA" }}>
                    <b style={{ font: "600 13px/1.3 var(--font-body)" }}>Fixed lines (always shown, cannot be removed)</b>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, font: "400 12.5px/1.5 var(--font-body)", color: "#453E54" }}>{BASELINE_LIMITATIONS.map((l) => <li key={l}>{l}</li>)}</ul>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5, font: "600 12.5px/1.3 var(--font-body)" }}>Case-specific limitations (one per line). Explain privacy- or safety-driven omissions here — never as a badge on a person, claim, source or node.
                    <textarea rows={4} value={lead.limitations.join("\n")} onChange={(e) => update({ ...lead, limitations: e.target.value.split("\n") })} onBlur={(e) => update({ ...lead, limitations: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #D9D2C3", font: "400 13.5px/1.4 var(--font-body)" }} />
                  </label>
                  <h3 style={{ margin: "8px 0 0", font: "600 14px/1.3 var(--font-body)" }}>Normative-assumption and contestation notices</h3>
                  <ListEditor fields={SEC.NOTICE_FIELDS} rows={lead.notices} blank={blankNotice} ctx={ctx} itemLabel={(n) => n.text ? `${n.kind}: ${n.text}` : ""} onChange={(rows) => update({ ...lead, notices: rows })} addLabel="Add a notice" emptyText="No notices. Add only approved wording." />
                </>)}
                {section === "planning" && (lead.planning ? (<>
                  <RowEditor fields={SEC.PLANNING_FIELDS} row={lead.planning} ctx={ctx} onChange={(v) => update({ ...lead, planning: v })} />
                  <button style={{ ...smallBtn, alignSelf: "flex-start", color: "#C8321B", borderColor: "#F3C7BE" }} onClick={() => { if (window.confirm("Remove the planning ledger? Pathway totals and quick-change arithmetic will no longer be shown.")) update({ ...lead, planning: null }); }}>Remove planning ledger</button>
                </>) : <button style={{ ...smallBtn, alignSelf: "flex-start" }} onClick={() => update({ ...lead, planning: blankPlanning() })}>+ Add a planning ledger</button>)}
                {section === "pathways" && (<>
                  <ListEditor fields={SEC.PATHWAY_FIELDS} rows={lead.pathways} blank={blankPathway} ctx={ctx} itemLabel={(p) => p.title} onChange={(rows) => update({ ...lead, pathways: rows })} addLabel="Add a pathway" emptyText="No pathways yet." />
                  <h3 style={{ margin: "8px 0 0", font: "600 14px/1.3 var(--font-body)" }}>Optional outcome estimate (shown as a demo assumption, never a prediction)</h3>
                  {lead.outcomeEstimate ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <RowEditor fields={[{ key: "question", label: "Shared outcome question", kind: "text", wide: true }, { key: "basis", label: "Basis (required)", kind: "textarea" }]} row={lead.outcomeEstimate} ctx={ctx} onChange={(v) => update({ ...lead, outcomeEstimate: { ...lead.outcomeEstimate!, ...v } })} />
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {lead.pathways.filter((p) => p.title).slice(0, 3).map((p) => (
                          <label key={p.id} style={{ display: "flex", flexDirection: "column", gap: 4, font: "600 12px/1.3 var(--font-body)" }}>{p.title} (%)
                            <input type="number" min={0} max={100} value={lead.outcomeEstimate!.values[p.id] ?? ""} onChange={(e) => update({ ...lead, outcomeEstimate: { ...lead.outcomeEstimate!, values: { ...lead.outcomeEstimate!.values, [p.id]: e.target.value === "" ? null : Number(e.target.value) } } })} style={{ width: 120, padding: "7px 9px", borderRadius: 10, border: "1px solid #D9D2C3" }} />
                          </label>
                        ))}
                      </div>
                      <button style={{ ...smallBtn, alignSelf: "flex-start" }} onClick={() => update({ ...lead, outcomeEstimate: null })}>Remove outcome estimate</button>
                    </div>
                  ) : <button style={{ ...smallBtn, alignSelf: "flex-start" }} onClick={() => update({ ...lead, outcomeEstimate: { question: "", basis: "", values: {} } })}>+ Add an outcome estimate</button>}
                  <h3 style={{ margin: "8px 0 0", font: "600 14px/1.3 var(--font-body)" }}>Prepared what-if scenarios</h3>
                  <ListEditor fields={SEC.SCENARIO_FIELDS} rows={lead.scenarios} blank={blankScenario} ctx={ctx} itemLabel={(s) => `${s.kind === "stress-test" ? "Quick change · " : ""}${s.question}`} onChange={(rows) => update({ ...lead, scenarios: rows })} addLabel="Add a scenario" emptyText="No scenarios yet. The what-if card will say none are prepared." />
                  <h3 style={{ margin: "8px 0 0", font: "600 14px/1.3 var(--font-body)" }}>Impact routes (illustrative, separate from the options)</h3>
                  <ListEditor fields={SEC.ROUTE_FIELDS} rows={lead.impactRoutes} blank={blankRoute} ctx={ctx} itemLabel={(r) => r.title} onChange={(rows) => update({ ...lead, impactRoutes: rows })} addLabel="Add an impact route" emptyText="No impact routes. Each step is a question to validate, never a guaranteed result." />
                </>)}
                {section === "json" && (<>
                  <textarea aria-label="Case JSON" value={json} onChange={(e) => setJson(e.target.value)} rows={24} style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 12, border: "1px solid #D9D2C3", font: "400 12px/1.5 var(--font-mono)" }} />
                  <div style={{ display: "flex", gap: 8 }}><button style={primary} onClick={applyJson}>Apply JSON to this case</button><button style={smallBtn} onClick={() => setJson(exportCaseJson(lead))}>Reload from saved</button></div>
                  <p style={hint}>The id of this case is kept, so pasted JSON can never overwrite another case.</p>
                </>)}
              </section>
            </>
          )}
        </main>
      </div>
      <style>{`@media (max-width: 860px) { .prep-grid { grid-template-columns: minmax(0, 1fr) !important; } .prep-grid aside { position: static !important; } }`}</style>
    </div>
  );
}
