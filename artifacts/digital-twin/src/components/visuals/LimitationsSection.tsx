/**
 * The fixed "Limitations of this baseline" section, plus any approved
 * normative-assumption and contestation notices for the case.
 *
 * The fixed lines (BASELINE_LIMITATIONS) are always shown and cannot be
 * removed per case. Privacy- or safety-driven omissions are explained here —
 * never as a badge on a person, claim, source or node.
 */
import { limitationsFor } from "@/lib/lead/derive";
import type { LeadCase } from "@/lib/lead/types";

export function LimitationsSection({ lead, dark }: { lead: LeadCase; dark?: boolean }) {
  const items = limitationsFor(lead);
  const notices = lead.notices.filter((n) => n.text.trim());
  return (
    <section className={`ozv ozv-limits${dark ? " ozv-dark" : ""}`} aria-labelledby="ozv-limits-h" data-testid="limitations-section">
      <h2 id="ozv-limits-h">Limitations of this baseline</h2>
      <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
      {notices.map((n) => (
        <div key={n.id} className="ozv-notice" role="note">
          <b>{n.kind === "normative" ? "Normative assumption" : "Active contestation"}</b>
          {n.approvedRef ? <span className="ozv-muted-text"> · {n.approvedRef}</span> : null}
          <div>{n.text}</div>
        </div>
      ))}
    </section>
  );
}
