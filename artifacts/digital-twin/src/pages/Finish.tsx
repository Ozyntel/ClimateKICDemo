/**
 * Finish — the executive brief (light page), at /executive-brief.
 *
 * One page built only from the active lead case: progress, the findings that
 * change the decision (signals, findings, applied-source signals — each with
 * its evidence label), the chosen pathway (or an empty state), assumptions,
 * and the fixed "Limitations of this baseline". The same content can be
 * copied or downloaded as text (buildBriefText).
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DemoHeader, DemoNotPrepared, EmptyLine } from "@/components/DemoChrome";
import { LimitationsSection } from "@/components/visuals/LimitationsSection";
import { ConfidenceMeter, EvidenceTag } from "@/components/visuals/parts";
import { activeStressTests, formatMetric, pathwayLedger, totalSentence } from "@/lib/lead/planning";
import { buildBriefText, briefFindings } from "@/lib/lead/brief";
import { activePathways, appliedSourceDocs, orgName, outcomeFor } from "@/lib/lead/derive";
import { useActiveLead } from "@/lib/lead/useActiveLead";
import "@/components/visuals/visuals.css";

export default function FinishPage() {
  const [, navigate] = useLocation();
  const { lead, progress } = useActiveLead();
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(t); }, [copied]);

  if (!lead) return (<div className="tw-world" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#FCFBF8" }}><DemoHeader current="/executive-brief" label="Executive brief" /><DemoNotPrepared /></div>);

  const pws = activePathways(lead);
  const pw = pws.find((p) => p.id === progress.pathwayPick) ?? null;
  const pickIdx = pw ? pws.indexOf(pw) : -1;
  const applied = appliedSourceDocs(lead, progress);
  const findings = briefFindings(lead, progress);
  const oe = lead.outcomeEstimate && lead.outcomeEstimate.question.trim() ? lead.outcomeEstimate : null;
  const v = pw ? outcomeFor(lead, pw.id) : null;
  const summary = buildBriefText(lead, progress);
  const docsCount = lead.sources.filter((s) => s.title.trim()).length;
  const stress = activeStressTests(lead, progress.stressTests);
  const ledger = pw ? pathwayLedger(lead, pw, stress) : null;

  const steps = [
    { done: true, label: "Organisational model", sub: orgName(lead) + " · explored", path: "/twin" },
    { done: applied.length > 0, label: "Data management", sub: docsCount ? `${applied.length} of ${docsCount} documents in the model` : "No documents prepared", path: "/upload" },
    { done: !!pw, label: "Pathways forwards", sub: pw ? "Path 0" + (pickIdx + 1) + " selected for consideration" : "No path selected yet", path: "/pathways" },
  ];
  const copy = () => { try { navigator.clipboard.writeText(summary); } catch { /* ignore */ } setCopied(true); };
  const download = () => {
    try {
      const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (lead.organisation.name || "organisation").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-executive-brief.txt";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };
  const dot = (col: string): React.CSSProperties => ({ flexShrink: 0, width: 7, height: 7, marginTop: 7, borderRadius: "50%", background: col });
  const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E9E2D4", borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 };

  return (
    <div className="tw-world ozv" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", color: "#221E2E", background: "#FCFBF8" }}>
      <DemoHeader current="/executive-brief" label="Executive brief" />
      <main style={{ flex: 1, width: "100%", maxWidth: 880, margin: "0 auto", padding: "28px 24px 56px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ font: "600 12px/1 var(--font-body)", letterSpacing: "0.08em", textTransform: "uppercase", color: "#8E869C" }}>Executive brief · {orgName(lead)}</span>
          <h1 style={{ margin: 0, font: "700 34px/1.1 var(--font-display)", letterSpacing: "-0.02em" }}>What you'd try first, and why</h1>
          {lead.decision.question.trim() ? <p style={{ margin: 0, font: "400 15px/1.55 var(--font-body)", color: "#453E54" }}>“{lead.decision.question}”</p> : <EmptyLine>The decision has not been written down yet.</EmptyLine>}
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {steps.map((st, i) => (
            <button key={i} onClick={() => navigate(st.path)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, textAlign: "left", cursor: "pointer", background: "#FFFFFF", border: "1.5px solid " + (st.done ? "#C9DA3A" : "#E9E2D4"), color: "#221E2E" }}>
              <span aria-hidden style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", font: "700 15px/1 var(--font-body)", background: st.done ? "linear-gradient(160deg, #EAFF6A, #B6CC1E)" : "#F4F1EA", color: st.done ? "#0E1A21" : "#8E869C" }}>{st.done ? "✓" : i + 1}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}><b style={{ font: "600 13.5px/1.3 var(--font-body)" }}>{st.label}{st.done ? <span className="ozv-sr"> (done)</span> : null}</b><span style={{ font: "400 12px/1.35 var(--font-body)", color: "#6A6376" }}>{st.sub}</span></span>
            </button>
          ))}
        </section>

        <section style={card} aria-labelledby="findings-h">
          <h2 id="findings-h" style={{ margin: 0, font: "600 13.5px/1.25 var(--font-display)" }}>What changes the decision, taken together</h2>
          {findings.length === 0 && <EmptyLine>No findings or signals added yet.</EmptyLine>}
          {findings.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 26, font: "500 12px/1.6 var(--font-mono)", color: "#FF5440" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ font: "400 14px/1.5 var(--font-body)", color: "#453E54" }}>{f.text}{f.src && <span style={{ marginLeft: 6, font: "500 10px/1 var(--font-mono)", color: "#6236E8" }}>{f.src}</span>}</span>
                <span className="ozv-row"><EvidenceTag type={f.evidence} />{f.confidence !== "unknown" && <ConfidenceMeter level={f.confidence as "low" | "medium" | "high"} />}</span>
              </span>
            </div>
          ))}
        </section>

        {!pw ? (
          <section style={{ ...card, alignItems: "flex-start" }}>
            <b style={{ font: "600 18px/1.3 var(--font-display)" }}>No pathway chosen yet</b>
            <p style={{ margin: 0, font: "400 14px/1.5 var(--font-body)", color: "#6A6376" }}>{pws.length ? "Pick one of the pathways and the brief is written around it." : "No pathway options have been added for this case yet."}</p>
            {pws.length > 0 && <button onClick={() => navigate("/pathways")} style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "none", background: "#1A51FF", cursor: "pointer", color: "#FFFFFF", font: "600 14px/1 var(--font-body)" }}>Go to pathways forwards →</button>}
          </section>
        ) : (
          <section style={{ ...card, gap: 14, borderRadius: 20, border: "1.5px solid #E9E2D4" }} aria-labelledby="pw-h">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span style={{ font: "500 12px/1 var(--font-body)", color: "#8E869C" }}>Selected pathway · 0{pickIdx + 1} · under consideration, not approved</span>
              {oe && v != null && <span><b style={{ font: "700 16px/1 var(--font-display)" }}>{v}%</b><span style={{ font: "400 12px/1.3 var(--font-body)", color: "#6A6376" }}> demo assumption · {oe.question}</span></span>}
            </div>
            <h2 id="pw-h" style={{ margin: 0, font: "600 22px/1.25 var(--font-display)" }}>{pw.title}</h2>
            {(pw.idea || pw.summary) && <p style={{ margin: 0, font: "400 14.5px/1.55 var(--font-body)", color: "#453E54" }}>{pw.idea || pw.summary}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {[["How long", pw.horizon], ...(ledger ? [...ledger.totals.map((t) => [t.constraint.label, totalSentence(t)]), ...ledger.metrics.filter((m) => m.metric.elementId).map((m) => [m.metric.label + " (capacity ceiling)", "up to " + formatMetric(m.metric, m.value)])] : [["Costs", pw.cost]])].map(([k, val]) => (<div key={k} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 12, background: "#F4F1EA" }}><span style={{ font: "400 11.5px/1.3 var(--font-body)", color: "#6A6376" }}>{k}</span><b style={{ font: "600 13.5px/1.35 var(--font-body)" }}>{val || "Not provided"}</b></div>))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px 24px" }}>
              {(ledger ? [
                { title: "What must be true", items: [...pw.needs, ...pw.conditions], dot: "#9C6BFF" },
                { title: "Proposed actions (not done)", items: pw.plan.map((x) => x.title), dot: "#C4B5FD" },
                { title: "Trade-off", items: pw.tradeOff ? [pw.tradeOff] : [], dot: "#F5A623" },
                { title: "Evidence that would be needed", items: pw.evidenceNeeded, dot: "#FF5A3C" },
              ] : [
                { title: "What must be true", items: [...pw.needs, ...pw.conditions], dot: "#9C6BFF" },
                { title: "Interventions", items: pw.interventions, dot: "#C4B5FD" },
                { title: "Benefits", items: pw.wins.map((w) => w.label + " · from month " + w.from), dot: "#3DD68C" },
                { title: "Risks", items: pw.risks.map((x) => x.label + (x.until == null ? " · still open at month 12" : " · closed by month " + x.until)), dot: "#FF5A3C" },
              ]).map((ls) => (
                <div key={ls.title} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ font: "600 13px/1.3 var(--font-body)" }}>{ls.title}</span>
                  {ls.items.length === 0 && <EmptyLine>None listed</EmptyLine>}
                  {ls.items.map((it, ii) => (<span key={ii} style={{ display: "flex", gap: 8, alignItems: "flex-start", font: "400 13px/1.5 var(--font-body)", color: "#453E54" }}><i style={dot(ls.dot)} /><span style={{ flex: 1, minWidth: 0 }}>{it}</span></span>))}
                </div>
              ))}
            </div>
            {pw.watch && <p style={{ margin: 0, font: "400 13px/1.5 var(--font-body)", color: "#453E54" }}><b>How you'd know it's working · </b>{pw.watch}</p>}
            {ledger && stress.length > 0 && <p style={{ margin: 0, font: "400 13px/1.5 var(--font-body)", color: "#5F6F00" }}><b>Quick changes included (illustrative assumptions) · </b>{stress.map((x) => x.question).join("; ")}.{ledger.notApplied.length ? " " + ledger.notApplied.map((n) => `${n.scenarioTitle}: ${n.reason}`).join(" ") : ""}</p>}
            <p style={{ margin: 0, font: "400 12px/1.5 var(--font-body)", color: "#8E869C" }}>Based on {pw.sourceIds.length ? pw.sourceIds.join(", ") : "no linked sources"}. Documents in the model: {applied.length ? applied.map((d) => d.id).join(", ") : "none yet"}. Illustrative demo results, not validated predictions.</p>
          </section>
        )}

        {lead.assumptions.some((a) => a.text.trim()) && (
          <section style={card} aria-labelledby="assump-h">
            <h2 id="assump-h" style={{ margin: 0, font: "600 13.5px/1.25 var(--font-display)" }}>Assumptions in this baseline</h2>
            {lead.assumptions.filter((a) => a.text.trim()).map((a) => (<div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}><span className="ozv-row"><EvidenceTag type="assumption" /><span style={{ font: "400 14px/1.5 var(--font-body)", color: "#453E54" }}>{a.text}</span></span>{a.basis && <span style={{ font: "400 12px/1.4 var(--font-body)", color: "#8E869C" }}>Basis: {a.basis}</span>}</div>))}
          </section>
        )}

        <LimitationsSection lead={lead} />

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/pathways")} style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1.5px solid #E9E2D4", background: "transparent", cursor: "pointer", color: "#221E2E", font: "600 14px/1 var(--font-body)" }}>← {pw ? "Change path" : "Pathways"}</button>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={copy} style={{ height: 40, padding: "0 18px", border: "1.5px solid #E9E2D4", borderRadius: 999, cursor: "pointer", background: "transparent", color: "#221E2E", font: "600 14px/1 var(--font-body)" }}>{copied ? "✓ Copied" : "Copy the brief"}</button>
            <button onClick={download} data-testid="download-brief" style={{ height: 40, padding: "0 18px", border: "none", borderRadius: 999, cursor: "pointer", background: "#1A51FF", color: "#FFFFFF", font: "600 14px/1 var(--font-body)" }}>Download brief</button>
          </div>
        </div>
      </main>
    </div>
  );
}
