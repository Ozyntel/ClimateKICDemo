/**
 * Shared chrome for the demo flow: the Ozy wordmark "Move around" menu and
 * the header bar (dark for the twin / data / pathways pages, light for
 * onboarding / brief / wrap-up). Replaces the per-page case switchers — the
 * demo shows exactly one lead case, chosen by the team in /prepare.
 */
import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";

export const DEMO_NAV: Array<[string, string, string]> = [
  ["Onboarding", "The organisation and the intake questions", "/questionnaire"],
  ["Organisational model", "The world map · macro, meso, micro", "/twin"],
  ["Data management", "Source documents in the model", "/upload"],
  ["Pathways forwards", "The options, played out", "/pathways"],
  ["Wrap up demo", "Sign an LOI or get in touch", "/brief"],
];

export function DemoHeader({ current, dark, label, right }: { current: string; dark?: boolean; label?: string; right?: ReactNode }) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const ink = dark ? "#F6F3EC" : "#221E2E";
  const sub = dark ? "#9FB3BC" : "#6A6376";
  return (
    <header style={{ height: 64, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderBottom: dark ? "1px solid rgba(195,207,212,0.14)" : "1px solid #E9E2D4" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button onClick={() => setOpen((v) => !v)} aria-label="Open menu" aria-expanded={open} aria-haspopup="menu" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", padding: "6px 8px 6px 0", font: "700 24px/1 var(--font-display)", letterSpacing: "-0.02em", color: ink }}>
          <span style={{ display: "inline-flex", alignItems: "center" }}><svg width="24" height="24" viewBox="0 0 64 64" style={{ marginRight: 3 }} aria-hidden><circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="8" /><circle cx="32" cy="7" r="8" fill="#FF5440" /></svg>zy</span>
          <span style={{ font: "600 11px/1 var(--font-body)", color: sub }}>▾</span>
        </button>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
            <div role="menu" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} style={{ position: "absolute", top: 46, left: 0, zIndex: 31, minWidth: 230, display: "flex", flexDirection: "column", gap: 2, padding: 8, borderRadius: 14, background: dark ? "rgba(17,21,31,0.96)" : "#FFFFFF", border: dark ? "1px solid rgba(195,207,212,0.14)" : "1px solid #E9E2D4", boxShadow: dark ? "0 16px 40px rgba(0,0,0,0.55)" : "0 12px 32px rgba(34,30,46,0.16)" }}>
              <span style={{ padding: "6px 10px 4px", font: "italic 500 12px/1 var(--font-body)", color: sub }}>Move around</span>
              {DEMO_NAV.map(([l, s, path]) => (
                <button key={path} role="menuitem" autoFocus={path === current} onClick={() => { setOpen(false); navigate(path); }} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "9px 10px", borderRadius: 10, border: "none", textAlign: "left", cursor: "pointer", background: path === current ? (dark ? "rgba(155,123,255,0.16)" : "#F6F2FF") : "transparent" }}>
                  <b style={{ font: "600 13.5px/1.2 var(--font-body)", color: ink }}>{l}</b>
                  <span style={{ font: "400 11.5px/1.3 var(--font-body)", color: sub }}>{s}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {label && <span style={{ font: "italic 500 13px/1 var(--font-body)", color: sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{label}</span>}
      {right && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>{right}</div>}
    </header>
  );
}

/** Shown when no lead case is active in this browser. */
export function DemoNotPrepared({ dark }: { dark?: boolean }) {
  const ink = dark ? "#F6F3EC" : "#221E2E";
  const sub = dark ? "#C3CFD4" : "#453E54";
  return (
    <main data-testid="demo-not-prepared" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 10, padding: 24, borderRadius: 18, background: dark ? "rgba(17,21,31,0.92)" : "#FFFFFF", border: dark ? "1px solid rgba(195,207,212,0.14)" : "1px solid #E9E2D4" }}>
        <h1 style={{ margin: 0, font: "700 24px/1.2 var(--font-display)", color: ink }}>This demo has not been prepared yet</h1>
        <p style={{ margin: 0, font: "400 14px/1.55 var(--font-body)", color: sub }}>There is no organisation loaded in this browser, so there is nothing to show. Nothing has been filled in with example data.</p>
        <p style={{ margin: 0, font: "400 13px/1.5 var(--font-body)", color: sub }}>Ozyntel team: open <a href={import.meta.env.BASE_URL.replace(/\/$/, "") + "/prepare"} style={{ color: dark ? "#D9F23A" : "#1A51FF" }}>/prepare</a> to create a blank case or import a lead file.</p>
      </div>
    </main>
  );
}

/** Small italic empty-state line used inside sections. */
export function EmptyLine({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <span style={{ font: "italic 400 13px/1.5 var(--font-body)", color: dark ? "#8E97A3" : "#8E869C" }}>{children}</span>;
}
