/** Executive brief content + plain-text export, built only from one lead case. */
import { getEvidenceType, type EvidenceType } from "@/lib/visuals/registry";
import { activePathways, appliedSourceDocs, keySignals, limitationsFor, orgName, outcomeFor } from "./derive";
import { activeStressTests, formatMetric, pathwayLedger, totalSentence } from "./planning";
import type { LeadCase, LeadProgress } from "./types";

export interface BriefFinding { text: string; src: string; evidence: EvidenceType | ""; confidence: string }

export function briefFindings(lead: LeadCase, progress: LeadProgress): BriefFinding[] {
  const sig = keySignals(lead, progress);
  const more = lead.findings.filter((f) => f.kind === "finding" && f.text.trim()).map((f) => ({ text: f.text, src: f.sourceIds.join(", "), evidence: f.evidence, confidence: f.confidence }));
  return [...sig, ...more];
}

const ev = (id: string) => getEvidenceType(id)?.label ?? "source type not stated";

export function buildBriefText(lead: LeadCase, progress: LeadProgress): string {
  const pws = activePathways(lead);
  const pw = pws.find((p) => p.id === progress.pathwayPick) ?? null;
  const oe = lead.outcomeEstimate && lead.outcomeEstimate.question.trim() ? lead.outcomeEstimate : null;
  const applied = appliedSourceDocs(lead, progress);
  const lines: string[] = [
    `${orgName(lead)} — executive brief`,
    ...(lead.caseNotice.trim() ? [lead.caseNotice.trim()] : []),
    `Decision: ${lead.decision.question.trim() || "not written down yet"}`,
    "",
    "Findings:",
    ...(briefFindings(lead, progress).map((f) => `- ${f.text} [${ev(f.evidence)}${f.src ? "; " + f.src : ""}]`)),
  ];
  if (briefFindings(lead, progress).length === 0) lines.push("- None added yet");
  lines.push("");
  if (pw) {
    const v = outcomeFor(lead, pw.id);
    lines.push(`Selected pathway (under consideration, not approved): ${pw.title}`);
    if (oe && v != null) lines.push(`Demo assumption (not a prediction): ${v}% — ${oe.question}. Basis: ${oe.basis || "not stated"}`);
    if (pw.idea || pw.summary) lines.push(pw.idea || pw.summary);
    const stress = activeStressTests(lead, progress.stressTests);
    const ledger = pathwayLedger(lead, pw, stress);
    const sec = (t: string, items: string[]) => { lines.push(`${t}:`); (items.length ? items : ["None listed"]).forEach((x) => lines.push(`- ${x}`)); };
    if (ledger) {
      lines.push(`How long: ${pw.horizon || "not provided"}`);
      ledger.totals.forEach((t) => lines.push(`${t.constraint.label}: ${totalSentence(t)}`));
      ledger.metrics.filter((m) => m.metric.elementId).forEach((m) => lines.push(`${m.metric.label} (capacity ceiling, not attendance or impact): up to ${formatMetric(m.metric, m.value)}`));
      if (stress.length) lines.push(`Quick changes included (illustrative assumptions): ${stress.map((x) => x.question).join("; ")}`);
      ledger.notApplied.forEach((n) => lines.push(`${n.scenarioTitle}: ${n.reason}`));
      sec("What must be true", [...pw.needs, ...pw.conditions]);
      sec("Proposed actions (not done)", pw.plan.map((x) => x.title));
      if (pw.tradeOff) lines.push(`Trade-off: ${pw.tradeOff}`);
      sec("Evidence that would be needed", pw.evidenceNeeded);
    } else {
      lines.push(`How long: ${pw.horizon || "not provided"}`, `Costs: ${pw.cost || "not provided"}`);
      sec("What must be true", [...pw.needs, ...pw.conditions]);
      sec("Interventions", pw.interventions);
      sec("Benefits", pw.wins.map((w) => `${w.label} (from month ${w.from})`));
      sec("Risks", pw.risks.map((r) => `${r.label}${r.until == null ? " (still open at month 12)" : ` (closed by month ${r.until})`}`));
    }
    if (pw.watch) lines.push(`How you'd know it's working: ${pw.watch}`);
    lines.push(`Based on: ${pw.sourceIds.join(", ") || "no linked sources"}`);
  } else {
    lines.push("Selected pathway: none yet");
  }
  lines.push("", `Documents in the model: ${applied.length ? applied.map((d) => `${d.id} ${d.title}`).join("; ") : "none yet"}`);
  const assumptions = lead.assumptions.filter((a) => a.text.trim());
  if (assumptions.length) { lines.push("", "Assumptions:"); assumptions.forEach((a) => lines.push(`- ${a.text}${a.basis ? ` (basis: ${a.basis})` : ""}`)); }
  lines.push("", "Limitations of this baseline:", ...limitationsFor(lead).map((l) => `- ${l}`));
  lead.notices.filter((n) => n.text.trim()).forEach((n) => lines.push(`${n.kind === "normative" ? "Normative assumption" : "Active contestation"}: ${n.text}`));
  lines.push("", "Illustrative demo results, not validated predictions.");
  return lines.join("\n");
}
