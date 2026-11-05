/**
 * DataManagement (Data management · Sources) — dark page at /upload.
 *
 * Shows the active lead's current facts (with unit, date, source and
 * evidence type; updated values show their source and the baseline as
 * history), the source documents the team prepared for this lead, the
 * prepared reading of an "uploaded" source, and the information still
 * missing.
 *
 * Uploads are SIMULATED: "Upload" applies a reading that the team prepared
 * in advance (no file is read or analysed). Re-uploading changes nothing.
 * When two applied sources disagree on a number, both values are shown as a
 * conflict to be resolved by a person — never silently picked.
 *
 * For a case with a planning ledger, the baseline is shown here too, and an
 * uploaded source's planning figures are cross-checked against it (match or
 * conflict — never added). Each finding a source adds to the map is listed
 * with its heading or row and the map element it touches.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DemoHeader, DemoNotPrepared, EmptyLine } from "@/components/DemoChrome";
import { LimitationsSection } from "@/components/visuals/LimitationsSection";
import { EvidenceTag, OverlayChip } from "@/components/visuals/parts";
import { PlanningBaseline } from "@/components/planning/PlanningViews";
import { nameOf, numbersWithUpdates, orgName } from "@/lib/lead/derive";
import { hasPlanning, ledgerCheckResults } from "@/lib/lead/planning";
import { applySource } from "@/lib/lead/store";
import { useActiveLead } from "@/lib/lead/useActiveLead";
import "@/components/visuals/visuals.css";

const STATUS_LABEL = { missing: "Not in the model yet", requested: "Requested", supplied: "Supplied" } as const;

export default function DataManagementPage() {
  const [, navigate] = useLocation();
  const { lead, progress } = useActiveLead();
  const [selId, setSelId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (uploadTimer.current) clearTimeout(uploadTimer.current); }, []);

  if (!lead) return (<div className="tw-world" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#0B0F17", color: "#F6F3EC" }}><DemoHeader current="/upload" dark label="Data management" /><DemoNotPrepared dark /></div>);

  const docs = lead.sources.filter((s) => s.title.trim());
  const planning = hasPlanning(lead);
  const sel = docs.find((d) => d.id === selId);
  const numbers = numbersWithUpdates(lead, progress).filter((n) => n.fact.label.trim());
  const missing = lead.missingInfo.filter((m) => m.title.trim());
  const applied = progress.appliedSources;

  const upload = (id: string) => {
    if (applied.includes(id)) { setSelId(id); setNote("Already in the model — nothing added twice."); return; }
    setUploading(null);
    requestAnimationFrame(() => setUploading(id));
    if (uploadTimer.current) clearTimeout(uploadTimer.current);
    uploadTimer.current = setTimeout(() => {
      applySource(lead.id, id);
      setUploading(null); setSelId(id);
      setNote(`Applied ${id}. Facts and key signals in the model now show this source.`);
    }, 750);
  };

  const updatesText = (d: typeof docs[number]) => d.updates.map((u) => {
    const n = lead.numbers.find((x) => x.id === u.numberId);
    return `${n?.label || "Unlinked number"}: ${u.value}${n?.unit ? " " + n.unit : ""}${n?.value ? ` (was ${n.value})` : ""}`;
  });
  /** Map names for ids a source touches (elements, connections, or elements it adds). */
  const targetName = (id: string) => {
    const r = [...lead.relationships, ...lead.sources.flatMap((d) => d.adds.relationships)].find((x) => x.id === id);
    if (r) return `${nameOf(lead, r.from)} → ${nameOf(lead, r.to)} (connection)`;
    const added = lead.sources.flatMap((d) => d.adds.elements).find((e) => e.id === id);
    return added ? added.label : nameOf(lead, id);
  };
  const affectedOf = (d: typeof docs[number]) => Array.from(new Set([
    ...d.mapChanges.map((c) => targetName(c.target)),
    ...d.adds.elements.map((e) => `${e.label} (added)`),
    ...d.adds.relationships.map((r) => `${r.label || targetName(r.id)} (proposed connection)`),
    ...d.reading.affected,
  ]));
  const reading = sel ? [
    { title: "What the team read", items: sel.reading.extracted, dot: "#9C6BFF" },
    { title: "What changes in the model", items: [...sel.reading.changes, ...updatesText(sel)], dot: "#1A51FF" },
    { title: "Map elements it touches", items: affectedOf(sel), dot: "#FF7A1A" },
    { title: "Still uncertain", items: sel.reading.uncertainties, dot: "#FF5440" },
  ] : [];
  const checks = sel && planning ? ledgerCheckResults(lead, sel) : [];
  const download = (d: typeof docs[number]) => {
    try {
      const blob = new Blob([d.fullText], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = d.fileName || `${d.id}.md`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const card: React.CSSProperties = { background: "rgba(17,21,31,0.92)", border: "1px solid rgba(195,207,212,0.14)", borderRadius: 18, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 };

  return (
    <div className="tw-world ozv ozv-dark" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", color: "#F6F3EC", background: "radial-gradient(1200px 640px at 50% -8%, #1B1734 0%, #0B0F17 55%, #06080C 100%)" }}>
      <DemoHeader current="/upload" dark label={orgName(lead)} />
      <main style={{ flex: 1, width: "100%", maxWidth: 1120, margin: "0 auto", padding: "28px 24px 56px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 760 }}>
          <h1 style={{ margin: 0, font: "700 34px/1.1 var(--font-display)", letterSpacing: "-0.02em" }}>Data management</h1>
          <p style={{ margin: 0, font: "400 15px/1.55 var(--font-body)", color: "#C3CFD4", textWrap: "pretty" }}>What the model knows about {orgName(lead)}, and where it came from. Add the prepared source documents in any order: for each one you see what was read, what changed, who it touches and what is still uncertain.</p>
          <span style={{ alignSelf: "flex-start", padding: "6px 10px", borderRadius: 999, background: "rgba(242,194,48,0.14)", color: "#F5CF5B", font: "500 12px/1.3 var(--font-body)" }} data-testid="simulated-upload-note">Simulated upload · readings were prepared in advance by the Ozyntel team; no automatic extraction runs</span>
        </div>

        <section style={card} aria-labelledby="facts-h">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 id="facts-h" style={{ margin: 0, font: "600 16px/1.3 var(--font-display)" }}>The organisation</h2>
            <span style={{ font: "500 12px/1 var(--font-body)", color: "#7F95A0" }}>Current facts · updates show their source</span>
          </div>
          {lead.organisation.overview.trim() ? <p style={{ margin: 0, font: "400 13.5px/1.55 var(--font-body)", color: "#C3CFD4", maxWidth: 820 }}>{lead.organisation.overview}</p> : <EmptyLine dark>No overview added yet.</EmptyLine>}
          {planning && <PlanningBaseline lead={lead} dark />}
          {numbers.length === 0 ? (planning ? null : <EmptyLine dark>No important numbers added yet.</EmptyLine>) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
              {numbers.map((n) => (
                <div key={n.fact.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: n.conflict ? "1.5px dashed #F5CF5B" : "1px solid transparent" }}>
                  {n.conflict ? (
                    <>
                      <span style={{ font: "700 13px/1.3 var(--font-body)", color: "#F5CF5B" }}>Sources disagree</span>
                      {n.conflict.map((c, i) => <span key={i} style={{ font: "600 13px/1.3 var(--font-body)" }}>{c.value}{n.unit ? " " + n.unit : ""} <span style={{ color: "#C4B5FD", fontWeight: 500 }}>· {c.sourceId}{c.asOf ? " · " + c.asOf : ""}</span></span>)}
                      <span style={{ font: "400 11px/1.35 var(--font-body)", color: "#9FB3BC" }}>Check which applies — the model does not choose.</span>
                    </>
                  ) : (
                    <span style={{ font: "700 16px/1.15 var(--font-display)", color: n.value.trim() ? "#F6F3EC" : "#8E97A3" }}>{n.value.trim() ? `${n.value}${n.unit ? " " + n.unit : ""}` : "Unknown"}</span>
                  )}
                  <span style={{ font: "400 11.5px/1.3 var(--font-body)", color: "#9FB3BC" }}>{n.fact.label}{n.asOf ? ` · ${n.asOf}` : ""}</span>
                  {n.updatedBy.length > 0 && !n.conflict && <span style={{ font: "500 11px/1.3 var(--font-body)", color: "#C4B5FD" }}>Updated · {n.updatedBy.join(", ")}{n.was ? ` · was ${n.was}` : ""}</span>}
                  <span className="ozv-row"><EvidenceTag type={n.evidence} />{n.fact.sourceIds.length > 0 && <span style={{ font: "500 10px/1 var(--font-mono)", color: "#C4B5FD" }}>{n.fact.sourceIds.join(" · ")}</span>}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="sources-h" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 18, border: "1.5px dashed rgba(196,181,253,0.35)", background: "rgba(155,123,255,0.04)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 4px 8px" }}>
            <h2 id="sources-h" style={{ margin: 0, font: "600 14px/1.3 var(--font-body)" }}>Source documents prepared for this demo</h2>
            <span style={{ font: "400 12.5px/1.35 var(--font-body)", color: "#9FB3BC" }}>Choose “Upload” to add a source to the model. Files dropped on this page are not read.</span>
          </div>
          {docs.length === 0 && <EmptyLine dark>No source documents have been prepared for this case yet.</EmptyLine>}
          {docs.map((d) => {
            const on = applied.includes(d.id), cur = d.id === selId, up = uploading === d.id;
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 14, background: cur ? "rgba(155,123,255,0.12)" : "rgba(17,21,31,0.85)", border: "1px solid " + (cur ? "rgba(196,181,253,0.45)" : "rgba(195,207,212,0.12)"), flexWrap: "wrap" }}>
                <span aria-hidden style={{ flexShrink: 0, position: "relative", width: 36, height: 44 }}>
                  <svg width="36" height="44" viewBox="0 0 36 44"><path d="M4 2h20l10 10v28a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="rgba(255,255,255,0.06)" stroke="rgba(195,207,212,0.35)" strokeWidth="1.5" /><path d="M24 2v10h10" fill="none" stroke="rgba(195,207,212,0.35)" strokeWidth="1.5" /></svg>
                  <span style={{ position: "absolute", left: 4, bottom: 6, padding: "2px 4px", borderRadius: 4, background: "#9B7BFF", color: "#0E1A21", font: "700 8.5px/1 var(--font-body)" }}>{d.id}</span>
                </span>
                <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 4 }}>
                  <b style={{ font: "600 14px/1.3 var(--font-body)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{d.title}{d.synthetic && <span data-testid="synthetic-badge" style={{ padding: "2px 7px", borderRadius: 6, border: "1.5px solid #F5CF5B", color: "#F5CF5B", font: "800 10px/1.3 var(--font-body)", letterSpacing: "0.08em" }}>SYNTHETIC</span>}</b>
                  <span style={{ font: "400 12px/1.3 var(--font-body)", color: "#7F95A0", overflowWrap: "anywhere" }}>{[d.fileName, d.docType, d.date ? `Dated ${d.date}` : "Date not given"].filter(Boolean).join(" · ")}</span>
                  <span style={{ font: "400 12px/1.35 var(--font-body)", color: "#9FB3BC" }}>Scope: {d.scope || "not described"}</span>
                  {d.excerpt && <span style={{ font: "400 12.5px/1.45 var(--font-body)", color: "#9FB3BC" }}>{d.excerpt}</span>}
                  <span style={{ display: "block", height: 4, borderRadius: 4, background: "rgba(195,207,212,0.12)", overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: on || up ? "100%" : "0%", background: "linear-gradient(90deg, #9B7BFF, #D9F23A)", transition: up ? "width 700ms ease-out" : "none" }} /></span>
                </div>
                <div style={{ flexShrink: 0, marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span role="status" style={{ whiteSpace: "nowrap", font: "600 12px/1 var(--font-body)", color: on || up ? "#D9F23A" : "#7F95A0" }}>{up ? "Applying…" : on ? "✓ In the model" : "Not yet in the model"}</span>
                  <button onClick={() => upload(d.id)} style={{ whiteSpace: "nowrap", height: 32, padding: "0 14px", borderRadius: 999, cursor: "pointer", font: "600 12.5px/1 var(--font-body)", border: on ? "1.5px solid rgba(195,207,212,0.22)" : "none", background: on ? "transparent" : "#1A51FF", color: on ? "#F6F3EC" : "#FFFFFF" }}>{on ? "View reading" : "Upload"}</button>
                  {d.fullText.trim() && <button onClick={() => download(d)} title={`Download ${d.fileName || d.id + ".md"} (the source text, as a file)`} style={{ whiteSpace: "nowrap", height: 26, padding: "0 10px", borderRadius: 999, cursor: "pointer", font: "600 11px/1 var(--font-body)", border: "1px solid rgba(195,207,212,0.18)", background: "transparent", color: "#9FB3BC" }}>Download .md</button>}
                </div>
              </div>
            );
          })}
        </section>

        {sel && (
          <section aria-live="polite" style={{ ...card, gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "6px 10px", borderRadius: 999, background: "rgba(155,123,255,0.18)", color: "#C4B5FD", font: "500 11px/1 var(--font-mono)", letterSpacing: "0.06em" }}>{sel.id}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <b style={{ font: "600 18px/1.3 var(--font-display)" }}>{sel.title}</b>
                <span style={{ font: "400 12.5px/1.4 var(--font-body)", color: "#9FB3BC" }}>{[sel.synthetic ? "SYNTHETIC" : "", sel.docType, sel.date ? "Dated " + sel.date : "Date not given", sel.owner ? "Owner: " + sel.owner : ""].filter(Boolean).join(" · ")}</span>
                <span style={{ font: "400 12.5px/1.4 var(--font-body)", color: "#9FB3BC" }}>Scope: {sel.scope || "not described"}</span>
                <span style={{ font: "500 12.5px/1.4 var(--font-body)", color: "#C4B5FD" }}>{note}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px 24px" }}>
              {reading.map((rd, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ font: "600 13px/1.3 var(--font-body)" }}>{rd.title}</span>
                  {rd.items.length === 0 && <EmptyLine dark>Nothing recorded.</EmptyLine>}
                  {rd.items.map((it, ii) => (<span key={ii} style={{ display: "flex", gap: 8, alignItems: "flex-start", font: "400 13px/1.5 var(--font-body)", color: "#C3CFD4" }}><i style={{ flexShrink: 0, width: 7, height: 7, marginTop: 7, borderRadius: "50%", background: rd.dot }} /><span style={{ flex: 1, minWidth: 0 }}>{it}</span></span>))}
                </div>
              ))}
            </div>
            {sel.mapChanges.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="source-findings">
                <span style={{ font: "600 13px/1.3 var(--font-body)" }}>Findings, linked to the map</span>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", font: "400 12.5px/1.45 var(--font-body)", color: "#C3CFD4" }}>
                    <thead><tr>{["Where in " + sel.id, "Map element", "What it says", "Marked as"].map((h) => <th key={h} scope="col" style={{ textAlign: "left", padding: "6px 8px", font: "600 11.5px/1.3 var(--font-body)", color: "#7F95A0" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {sel.mapChanges.map((c, i) => (
                        <tr key={i} style={{ borderTop: "1px solid rgba(195,207,212,0.12)" }}>
                          <td style={{ padding: "7px 8px", verticalAlign: "top", whiteSpace: "nowrap", font: "500 11.5px/1.4 var(--font-mono)", color: "#C4B5FD" }}>{sel.id} · {c.ref || "—"}</td>
                          <td style={{ padding: "7px 8px", verticalAlign: "top", color: "#F6F3EC", fontWeight: 600 }}>{targetName(c.target)}</td>
                          <td style={{ padding: "7px 8px", verticalAlign: "top" }}>{c.text || c.label}</td>
                          <td style={{ padding: "7px 8px", verticalAlign: "top" }}><span className="ozv-row"><EvidenceTag type={c.evidence} />{c.overlays.map((o) => <OverlayChip key={o} id={o} />)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {planning && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-testid="ledger-checks">
                <span style={{ font: "600 13px/1.3 var(--font-body)" }}>Checked against the planning baseline</span>
                {checks.length === 0 ? (
                  <EmptyLine dark>This document states no planning figures, so nothing in the planning baseline is checked or changed.</EmptyLine>
                ) : (
                  <>
                    <span style={{ font: "400 12.5px/1.45 var(--font-body)", color: "#9FB3BC" }}>{checks.every((c) => c.match) ? `All ${checks.length} figures match the planning baseline. It describes the same snapshot, so nothing is added twice.` : "Some figures differ from the planning baseline. Both are shown — the model does not choose; a person should check which applies."}</span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
                      {checks.map((c, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: c.match ? "1px solid transparent" : "1.5px dashed #F5CF5B", font: "400 12px/1.4 var(--font-body)", color: "#C3CFD4" }}>
                          <b style={{ color: c.match ? "#F6F3EC" : "#F5CF5B", fontWeight: 600 }}>{c.match ? "✓ Matches" : "Sources disagree"} · {c.about}</b>
                          <span>{c.sourceId} says {c.stated}{c.match ? "" : ` · planning baseline: ${c.current}`}</span>
                          <span style={{ font: "500 11px/1.3 var(--font-mono)", color: "#C4B5FD" }}>{c.sourceId} · {c.ref}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {applied.includes(sel.id) && <button onClick={() => navigate("/twin?stage=evidence")} style={{ alignSelf: "flex-start", height: 34, padding: "0 16px", borderRadius: 999, border: "1.5px solid rgba(196,181,253,0.5)", background: "rgba(155,123,255,0.12)", color: "#D9CCFF", cursor: "pointer", font: "600 12.5px/1 var(--font-body)" }}>See the evidence on the map →</button>}
            {sel.fullText.trim() && (
              <details style={{ borderTop: "1px solid rgba(195,207,212,0.14)", paddingTop: 12 }}>
                <summary style={{ cursor: "pointer", font: "600 13px/1.3 var(--font-body)" }}>Read the source document</summary>
                <div style={{ marginTop: 10, maxHeight: 360, overflow: "auto", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", font: "400 12.5px/1.6 var(--font-mono)", color: "#C3CFD4", whiteSpace: "pre-wrap" }}>{sel.fullText}</div>
              </details>
            )}
            <p style={{ margin: 0, font: "400 12px/1.5 var(--font-body)", color: "#7F95A0" }}>This is the team's prepared reading of {sel.id}, kept separate from the document itself.</p>
          </section>
        )}

        <section aria-labelledby="missing-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 id="missing-h" style={{ margin: 0, font: "600 18px/1.3 var(--font-display)" }}>Information still missing</h2>
            <span style={{ font: "400 13.5px/1.5 var(--font-body)", color: "#9FB3BC" }}>What the model does not have for {orgName(lead)}, and what each item would sharpen. Adding a document does not automatically close a gap.</span>
          </div>
          {missing.length === 0 ? <EmptyLine dark>No missing-information items recorded yet.</EmptyLine> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {missing.map((m) => (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", borderRadius: 16, background: "rgba(17,21,31,0.6)", border: "1.5px dashed rgba(195,207,212,0.22)" }}>
                  <span style={{ alignSelf: "flex-start", whiteSpace: "nowrap", padding: "4px 8px", borderRadius: 999, background: "rgba(255,122,26,0.14)", color: "#FFB37A", font: "600 11px/1 var(--font-body)" }}>{STATUS_LABEL[m.status]}</span>
                  <b style={{ font: "600 14px/1.35 var(--font-body)" }}>{m.title}</b>
                  {m.why && <span style={{ font: "400 12.5px/1.45 var(--font-body)", color: "#9FB3BC" }}>{m.why}</span>}
                  {m.sharpens && <span style={{ marginTop: "auto", font: "500 12px/1.4 var(--font-body)", color: "#C4B5FD" }}>Sharpens · {m.sharpens}</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        <LimitationsSection lead={lead} dark />

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/twin")} style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1.5px solid rgba(195,207,212,0.14)", background: "transparent", cursor: "pointer", color: "#F6F3EC", font: "600 14px/1 var(--font-body)" }}>← Back to the organisational model</button>
          <button onClick={() => navigate("/pathways")} style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "none", background: "#1A51FF", cursor: "pointer", color: "#FFFFFF", font: "600 14px/1 var(--font-body)" }}>On to pathways forwards →</button>
        </div>
      </main>
    </div>
  );
}
