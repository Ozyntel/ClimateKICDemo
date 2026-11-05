/**
 * Onboarding — intake for the active lead case (light daylight page).
 *
 * Shows the lead's intake answers across six sections, read-only for
 * visitors (the Ozyntel team edits them in /prepare). Sections the team
 * marked as not relevant are omitted; empty answers read "Not provided yet"
 * — never invented example answers. Rendered at /questionnaire.
 *
 * When the case has a case notice it is shown first; when it has a planning
 * ledger, the baseline (available / committed / headroom per constraint and
 * capacity ceilings) is derived from it and shown before the answers.
 */
import { useLocation } from "wouter";
import { DemoHeader, DemoNotPrepared, EmptyLine } from "@/components/DemoChrome";
import { LimitationsSection } from "@/components/visuals/LimitationsSection";
import { PlanningBaseline } from "@/components/planning/PlanningViews";
import { orgName } from "@/lib/lead/derive";
import { orgTypeRule } from "@/lib/lead/orgTypes";
import { useActiveLead } from "@/lib/lead/useActiveLead";
import type { IntakeSectionId, LeadCase } from "@/lib/lead/types";
import "@/components/visuals/visuals.css";

type Field =
  | { kind: "text"; q: string; value: string }
  | { kind: "list"; q: string; items: string[] }
  | { kind: "choice"; q: string; options: Array<{ label: string; on: boolean }>; answered: boolean }
  | { kind: "people"; q: string; people: Array<{ name: string; team: string; role: string }> };

const LVL: Array<[string, string]> = [["Low", "Low"], ["Medium", "Medium"], ["High", "High"]];
/** Elements listed under "The people": stakeholders, groups of people and roles (never scored). */
const PEOPLE_VISUALS = new Set(["external-stakeholder", "community", "customer", "supplier", "staffing", "role"]);

function chipStyle(on: boolean): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", height: 30, padding: "0 13px", borderRadius: 999, font: "500 13px/1 var(--font-body)", whiteSpace: "nowrap", flexShrink: 0, border: on ? "1px solid #221E2E" : "1px solid #E9E2D4", background: on ? "#221E2E" : "#FFFFFF", color: on ? "#FFFFFF" : "#A39BAE" };
}

export function intakeSections(lead: LeadCase): Array<{ id: IntakeSectionId; title: string; qs: Field[] }> {
  const o = lead.organisation, r = lead.respondent, d = lead.decision, it = lead.intake, ex = it.external;
  const txt = (q: string, value: string): Field => ({ kind: "text", q, value });
  const list = (q: string, items: string[]): Field => ({ kind: "list", q, items: items.filter((x) => x.trim()) });
  const choice = (q: string, opts: Array<[string, string]>, val: string | string[]): Field => ({
    kind: "choice", q, answered: Array.isArray(val) ? val.length > 0 : !!val,
    options: opts.map(([v, label]) => ({ label, on: Array.isArray(val) ? val.includes(v) : v === val })),
  });
  const cons = Object.entries(it.constraints).filter(([, v]) => v).map(([k]) => k);
  const people = [
    ...lead.teams.filter((t) => t.name.trim()).map((t) => ({ name: t.name, team: t.headcount != null ? `${t.headcount} people` : "Team", role: t.purpose })),
    ...lead.elements.filter((e) => e.label.trim() && PEOPLE_VISUALS.has(e.visual)).map((e) => ({ name: e.label, team: e.group ? "Partner" : "External", role: e.note })),
  ];
  const all: Array<{ id: IntakeSectionId; title: string; qs: Field[] }> = [
    { id: "organisation", title: "The organisation", qs: [txt("What's the organisation called?", o.name), txt("What sector is it in?", o.sector), txt("Where does it operate?", o.place), choice("How big is the organisation?", [["1-50", "1–50"], ["51-200", "51–200"], ["201-1000", "201–1,000"], ["1001-5000", "1,001–5,000"], ["5000+", "5,000+"]], o.size), txt("Overview", o.overview), txt("Context", o.context)] },
    { id: "respondent", title: "About you", qs: [txt("And you — what's your role there?", r.role), txt("What are you accountable for?", r.accountableFor), txt("What do you personally want to be different?", r.goals)] },
    { id: "change", title: "The decision", qs: [txt("What's the decision or challenge?", d.question), txt("Why it is hard", d.challenge), list("Objectives", d.objectives), txt("Time horizon", d.timeHorizon), list("In scope", d.inScope), list("Out of scope", d.outOfScope), list("What's already working well?", d.workingWell), list("Anything already in flight?", d.underway), txt("Where does it slow down?", d.whereStalls), list("Who decides or checks what?", d.rights)] },
    { id: "people", title: "The people", qs: [{ kind: "people", q: "Who's involved?", people }] },
    { id: "constraints", title: "What's in the way", qs: [choice("What's holding things back?", [["capacityLimits", "Capacity limits"], ["governanceBottlenecks", "Governance bottlenecks"], ["decisionLatency", "Decision latency"], ["unclearOwnership", "Unclear ownership"]], cons), txt("Anything else worth knowing?", it.constraintNotes), list("Known gaps — information not in the model", lead.missingInfo.map((m) => m.title))] },
    { id: "world", title: "The world around you", qs: [choice("How volatile is the market right now?", LVL, ex.marketVolatility), choice("Which way is demand heading?", [["Down", "Heading down"], ["Stable", "Roughly steady"], ["Up", "Heading up"]], ex.demandOutlook), choice("How much regulatory pressure?", LVL, ex.regulatoryPressure), choice("Supply disruption risk?", LVL, ex.supplyDisruptionRisk), choice("Anything environmental on the horizon?", [["none", "Nothing pressing"], ["flooding", "Flooding"], ["storm", "Storm"], ["drought", "Drought"], ["heatwave", "Heatwave"]], ex.environmentalFactor), txt("External context", it.externalNotes)] },
  ];
  return all.filter((s) => !it.omitSections.includes(s.id));
}

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { lead } = useActiveLead();
  if (!lead) return (<div className="tw-world" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#FCFBF8" }}><DemoHeader current="/questionnaire" label="Onboarding" /><DemoNotPrepared /></div>);

  const sections = intakeSections(lead);
  const rule = orgTypeRule(lead.presentation.orgType);
  const box: React.CSSProperties = { padding: "11px 14px", borderRadius: 12, background: "#F4F1EA", border: "1px solid #E9E2D4", font: "400 14px/1.55 var(--font-body)", color: "#453E54", whiteSpace: "pre-line", textWrap: "pretty" };

  return (
    <div className="tw-world" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", color: "#221E2E", background: "#FCFBF8" }}>
      <DemoHeader current="/questionnaire" label="Onboarding" />
      <main style={{ flex: 1, width: "100%", maxWidth: 880, margin: "0 auto", padding: "32px 24px 64px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ font: "600 12px/1 var(--font-body)", letterSpacing: "0.08em", textTransform: "uppercase", color: "#8E869C" }}>{rule.label}</span>
          <h1 style={{ margin: 0, font: "700 34px/1.1 var(--font-display)", letterSpacing: "-0.02em" }}>Onboarding {lead.organisation.name.trim() || "your organisation"}</h1>
          <p style={{ margin: 0, maxWidth: 640, font: "400 15px/1.55 var(--font-body)", color: "#453E54", textWrap: "pretty" }}>These are the intake answers the model is built from. They were prepared with the Ozyntel team and are read-only in the demo. Review them before you open the model.</p>
        </div>
        <PlanningBaseline lead={lead} />

        {sections.map((sec, si) => (
          <section key={sec.id} aria-labelledby={`sec-${sec.id}`} style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 20, borderTop: "1px solid #E9E2D4" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ font: "500 12px/1 var(--font-mono)", color: "#8E869C" }}>{String(si + 1).padStart(2, "0")}</span>
              <h2 id={`sec-${sec.id}`} style={{ flex: 1, minWidth: 0, margin: 0, font: "700 21px/1.2 var(--font-display)", letterSpacing: "-0.01em" }}>{sec.title}</h2>
            </div>
            {sec.qs.map((q, qi) => (
              <div key={qi} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ font: "600 14px/1.4 var(--font-body)" }}>{q.q}</span>
                {q.kind === "text" && (q.value.trim() ? <div aria-readonly="true" style={box}>{q.value}</div> : <EmptyLine>Not provided yet</EmptyLine>)}
                {q.kind === "list" && (q.items.length ? (
                  <div aria-readonly="true" style={{ ...box, display: "flex", flexDirection: "column", gap: 6 }}>
                    {q.items.map((x, ii) => (<span key={ii} style={{ display: "flex", gap: 10 }}><i style={{ width: 5, height: 5, marginTop: 9, flexShrink: 0, borderRadius: "50%", background: "#9C6BFF" }} />{x}</span>))}
                  </div>
                ) : <EmptyLine>Not provided yet</EmptyLine>)}
                {q.kind === "choice" && (q.answered ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{q.options.map((op, oi) => (<span key={oi} style={chipStyle(op.on)} aria-label={`${op.label}${op.on ? " (selected)" : ""}`}>{op.on ? "✓ " : ""}{op.label}</span>))}</div>
                ) : <EmptyLine>Not answered yet — unknown</EmptyLine>)}
                {q.kind === "people" && (q.people.length ? (
                  <div style={{ display: "flex", flexDirection: "column", borderRadius: 12, border: "1px solid #E9E2D4", background: "#F4F1EA", overflow: "hidden" }}>
                    {q.people.map((pp, pi) => (
                      <div key={pi} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, alignItems: "baseline", padding: "10px 14px", borderTop: pi ? "1px solid #E9E2D4" : "none" }}>
                        <b style={{ font: "600 13.5px/1.35 var(--font-body)" }}>{pp.name}</b>
                        <span style={{ font: "500 12px/1.35 var(--font-body)", color: "#6A6376" }}>{pp.team}</span>
                        <span style={{ font: "400 13px/1.45 var(--font-body)", color: "#453E54" }}>{pp.role}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyLine>No teams or stakeholders added yet</EmptyLine>)}
              </div>
            ))}
          </section>
        ))}

        <div className="ozv"><LimitationsSection lead={lead} /></div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, padding: 20, borderRadius: 16, background: "#FFFFFF", border: "1px solid #E9E2D4", boxShadow: "0 1px 2px rgba(34,30,46,0.06)" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <b style={{ font: "700 17px/1.25 var(--font-display)" }}>Reviewed the answers? Open the organisational model</b>
            <span style={{ font: "400 13.5px/1.45 var(--font-body)", color: "#6A6376" }}>The world map of {orgName(lead)}, built from these answers.</span>
          </div>
          <button onClick={() => navigate("/twin")} style={{ display: "inline-flex", alignItems: "center", height: 42, padding: "0 20px", borderRadius: 999, border: "none", background: "#1A51FF", color: "#FFFFFF", font: "600 14px/1 var(--font-body)", cursor: "pointer", whiteSpace: "nowrap" }}>Open the twin →</button>
        </div>
      </main>
    </div>
  );
}
