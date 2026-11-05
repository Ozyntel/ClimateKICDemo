/**
 * WrapUp (Wrap up demo) — the demo's final step, at /brief.
 *
 * The conversion page: register interest (which is done by signing a short
 * letter of intent — said plainly in the fine print under the button), or
 * leave an email so Ozyntel can follow up — rebuilt in the v2 design
 * (light paper page, shared DemoHeader "Move around" menu, same voice and
 * tokens as Onboarding / Finish).
 *
 * The signing experience reuses the existing LOISignModal (signature canvas →
 * /api/sign-loi → PDF + email). The chosen pathway and the organisation name
 * of the active lead case (its own progress, never another case) are passed
 * into the modal and the CRM lead so the follow-up carries context. Nothing is stored until the visitor
 * actively submits.
 *
 * The downloadable executive brief now lives at /executive-brief, reachable
 * from here and from the Pathways page after a pathway is chosen.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { DemoHeader } from "@/components/DemoChrome";
import { activePathways } from "@/lib/lead/derive";
import { useActiveLead } from "@/lib/lead/useActiveLead";
import { LOISignModal } from "@/components/LOISignModal";


type Intent = "customer" | "design_partner" | "investor" | "other";
const INTENT_OPTIONS: Array<{ id: Intent; label: string }> = [
  { id: "customer", label: "Customer" },
  { id: "design_partner", label: "Design partner" },
  { id: "investor", label: "Investor" },
  { id: "other", label: "Other" },
];

export default function WrapUpPage() {
  const [, navigate] = useLocation();
  const { lead, progress } = useActiveLead();
  const [loiOpen, setLoiOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [intent, setIntent] = useState<Intent>("customer");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);


  const chosenName = lead ? activePathways(lead).find((p) => p.id === progress.pathwayPick)?.title ?? null : null;
  // Only the organisation name, sector and chosen pathway travel with a submission —
  // never other case content. An unset name is sent as null, not as a placeholder label.
  const leadCtx = { caseId: lead?.id ?? null, organisationName: lead?.organisation.name.trim() || null, sector: lead?.organisation.sector.trim() || null };

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !consent) return;
    setSubmitting(true);
    const payload = {
      email: email.trim(),
      intent,
      selectedPathwayId: null,
      selectedPathwayName: chosenName,
      organisationName: leadCtx.organisationName,
      leadContext: { organisationName: leadCtx.organisationName, sector: leadCtx.sector, caseId: leadCtx.caseId },
      signedAt: null,
      conversion: "ozyntel_overview_request" as const,
    };
    try {
      const res = await fetch("/api/submit-crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("HTTP " + res.status);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("submit-crm failed (demo offline?)", err);
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }

  const cardBase: React.CSSProperties = { display: "flex", gap: 16, padding: "20px 22px", borderRadius: 20, background: "#FFFFFF", border: "1px solid #E9E2D4" };
  const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 20px", borderRadius: 999, border: "none", cursor: "pointer", background: "#1A51FF", color: "#FFFFFF", font: "600 14px/1 var(--font-body)", whiteSpace: "nowrap" };

  return (
    <div className="tw-world" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", color: "#221E2E", background: "#FCFBF8" }}>
      <DemoHeader current="/brief" label="Wrap up" />

      <main style={{ flex: 1, width: "100%", maxWidth: 720, margin: "0 auto", padding: "32px 24px 56px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ font: "600 12px/1 var(--font-body)", letterSpacing: "0.08em", textTransform: "uppercase", color: "#8E869C" }}>You made it to the end</span>
          <h1 style={{ margin: 0, font: "700 34px/1.1 var(--font-display)", letterSpacing: "-0.02em", color: "#221E2E" }}>Thanks for trying the <em>demo</em></h1>
          <p style={{ margin: 0, font: "400 15px/1.55 var(--font-body)", color: "#453E54", textWrap: "pretty" }}>
            From here you can register your interest, or leave an email so we can follow up.
            Nothing is stored on our side until you actively choose to share it.
          </p>
        </div>

        {/* Back to the organisational model */}
        <div>
          <button onClick={() => navigate("/twin")} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 999, cursor: "pointer", background: "#FFFFFF", border: "1.5px solid #E9E2D4", color: "#221E2E", font: "600 13.5px/1 var(--font-body)", whiteSpace: "nowrap" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            Back to the organisational model
          </button>
        </div>

        {/* Primary: Register interest — signing the LOI is disclosed in the fine print below the button */}
        <section style={{ ...cardBase, borderColor: "#DED3FA", boxShadow: "0 0 0 1px #DED3FA, 0 10px 30px rgba(98,54,232,0.08)" }}>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "#F6F2FF", color: "#6236E8" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <h2 style={{ margin: 0, font: "600 19px/1.3 var(--font-display)", color: "#221E2E" }}>Register your interest</h2>
            <p style={{ margin: 0, font: "400 14px/1.5 var(--font-body)", color: "#453E54", textWrap: "pretty" }}>Let us know you'd like to explore this further and we'll prioritise a follow-up for {leadCtx.organisationName || "your organisation"}.</p>
            <div><button onClick={() => setLoiOpen(true)} aria-describedby="register-interest-fine-print" style={btnPrimary}>Register interest →</button></div>
            <p id="register-interest-fine-print" style={{ margin: 0, font: "400 12px/1.5 var(--font-body)", color: "#8E869C" }}>Interest is registered with a short letter of intent, signed on the next screen. It is non-binding apart from standard clauses such as confidentiality. A copy is emailed to you and to Ozyntel.</p>
          </div>
        </section>

        {/* OR divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#8E869C" }}>
          <span style={{ flex: 1, height: 1, background: "#E9E2D4" }} />
          <span style={{ font: "italic 500 12px/1 var(--font-body)" }}>or</span>
          <span style={{ flex: 1, height: 1, background: "#E9E2D4" }} />
        </div>

        {/* Secondary: Stay in touch */}
        <section style={cardBase}>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "#EAF7F4", color: "#0E8C72" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, font: "600 17px/1.3 var(--font-display)", color: "#221E2E" }}>Stay in touch</h2>
            {done ? (
              <p style={{ margin: 0, font: "500 14px/1.5 var(--font-body)", color: "#0E8C72" }}>✓ Thanks — we'll be in touch shortly. You can close this tab.</p>
            ) : (
              <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <span style={{ font: "500 12px/1 var(--font-body)", color: "#6A6376" }}>I am reaching out as</span>
                  <div role="radiogroup" aria-label="Reason for getting in touch" style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {INTENT_OPTIONS.map((opt) => {
                      const on = intent === opt.id;
                      return (<button key={opt.id} type="button" role="radio" aria-checked={on} onClick={() => setIntent(opt.id)} style={{ height: 34, padding: "0 14px", borderRadius: 999, cursor: "pointer", font: "600 12.5px/1 var(--font-body)", whiteSpace: "nowrap", border: "1.5px solid " + (on ? "#1A51FF" : "#E9E2D4"), background: on ? "#EEF3FF" : "#FFFFFF", color: on ? "#1A51FF" : "#453E54" }}>{opt.label}</button>);
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <label htmlFor="wrapup-email" style={{ font: "500 12px/1 var(--font-body)", color: "#6A6376" }}>Email</label>
                  <input id="wrapup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ height: 42, padding: "0 14px", borderRadius: 12, border: "1.5px solid #E9E2D4", background: "#FFFFFF", color: "#221E2E", font: "500 14px/1 var(--font-body)", outline: "none" }} />
                </div>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", font: "400 13px/1.45 var(--font-body)", color: "#453E54", cursor: "pointer" }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>I agree to be contacted by the Ozyntel team. No marketing list.</span>
                </label>
                <div><button type="submit" disabled={!email.trim() || !consent || submitting} style={{ ...btnPrimary, opacity: !email.trim() || !consent || submitting ? 0.5 : 1, cursor: !email.trim() || !consent || submitting ? "default" : "pointer" }}>{submitting ? "Sending…" : "Get in contact →"}</button></div>
              </form>
            )}
          </div>
        </section>

        {/* Tertiary + disclaimer */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, font: "500 13px/1 var(--font-body)", color: "#6A6376" }}>
          <button onClick={() => navigate("/twin")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6A6376", font: "inherit", textDecoration: "underline" }}>Skip for now</button>
          <span aria-hidden="true">·</span>
          <button onClick={() => { if (typeof window !== "undefined") window.location.href = "https://www.ozyntel.ai"; }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6A6376", font: "inherit", textDecoration: "underline" }}>Exit demo</button>
        </div>
        <p style={{ margin: 0, textAlign: "center", font: "400 12px/1.6 var(--font-body)", color: "#8E869C", textWrap: "pretty" }}>Nothing has been stored on our server during this demo. Please don't include confidential or personal data in anything you submit.</p>
      </main>

      <LOISignModal open={loiOpen} onClose={() => setLoiOpen(false)} selectedPathwayName={chosenName} transformationGoal={lead?.decision.question || null} leadContext={leadCtx} />
    </div>
  );
}
