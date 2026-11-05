/**
 * /disclaimer — first step of the demo before the questionnaire.
 *
 * Routing & gating:
 *   - `/` redirects here when the acceptance flag is not yet set.
 *   - `/questionnaire` redirects here on the same condition.
 *   - Clicking "Continue" sets the flag in localStorage and routes the user
 *     to `/questionnaire` so the existing flow resumes unchanged.
 *
 * Acceptance flag:
 *   key:   "dto_ui_disclaimer_accepted_v1"
 *   store: localStorage (persists across reloads in the same browser).
 *
 * Visual treatment: ink-deep canvas + Newsreader serif + Manrope body +
 * JetBrains Mono eyebrows, matching the rest of the redesigned app.
 * Copy updated for the lead-tailored demo (no example organisations);
 * the exit / continue behaviour is unchanged.
 */
import { useLocation } from "wouter";
import { useCallback } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";

export const DISCLAIMER_ACCEPTED_KEY = "dto_ui_disclaimer_accepted_v1";

export function hasAcceptedDisclaimer(): boolean {
  try {
    return localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) === "1";
  } catch {
    // Treat localStorage errors (private mode, etc.) as "not accepted yet".
    // Users will see the disclaimer every visit in that case — acceptable.
    return false;
  }
}

export function markDisclaimerAccepted(): void {
  try {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "1");
  } catch {
    /* ignore */
  }
}

function OrbitMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="8" />
      <circle cx="32" cy="7" r="8" fill="#FF5440" />
    </svg>
  );
}

export default function Disclaimer() {
  const [, navigate] = useLocation();

  const handleContinue = useCallback(() => {
    markDisclaimerAccepted();
    navigate("/questionnaire");
  }, [navigate]);

  const handleExit = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = "https://www.ozyntel.ai";
    }
  }, []);

  return (
    <div className="dc-page dc-ozy">
      <header className="dc-topbar">
        <span className="dc-brand">
          <span className="dc-brand-mark" aria-hidden><OrbitMark /></span>
          <span className="dc-brand-wm">zy</span>
        </span>
        <span className="dc-eyebrow">Before you begin</span>
      </header>

      <main className="dc-main">
        <div className="dc-card" data-testid="disclaimer-page">
          <div className="dc-head">
            <span className="dc-eyebrow dc-eyebrow-coral">Prototype demo</span>
            <h1 className="dc-h1">
              Before you <em>begin</em>
            </h1>
          </div>

          <div className="dc-body">
            <p className="dc-lede">
              This is a prototype demo. It is not the full Ozyntel product. It is
              designed to give you a clear overview of how we work and what an
              organisational digital twin experience can look like. You will see a
              structured intake, a systems map, bottlenecks and hotspots, and
              pathways to action.
            </p>

            <section className="dc-section">
              <h2 className="dc-h3">How this demo was prepared</h2>
              <p>
                The Ozyntel team prepared this walkthrough for this conversation,
                from the information listed in the demo. Each item shows whether it
                was observed in a source, is a stakeholder view, an assumption or an
                illustrative scenario, and where it came from when a source was
                provided. Scenario results are illustrative, not validated
                predictions.
              </p>
            </section>

            <section className="dc-section">
              <h2 className="dc-h3">Sharing more information</h2>
              <p>
                If you share more information with us, please keep it high level
                and anonymised, and avoid confidential or personal data.
              </p>
            </section>

            <section className="dc-section">
              <h2 className="dc-h3">Want the fully functional version?</h2>
              <p>
                If you would like a tailored, production ready version with deeper
                modelling, evidence handling, and a working collaboration workflow,
                contact the team at{" "}
                <a href="mailto:hello@ozyntel.com" className="dc-link">
                  hello@ozyntel.com
                </a>
                .
              </p>
            </section>

            <p className="dc-foot-note">
              By continuing, you acknowledge this is a demo prototype intended for
              exploration and feedback.
            </p>
          </div>

          <div className="dc-foot">
            <button
              type="button"
              onClick={handleExit}
              data-testid="disclaimer-exit"
              className="dc-exit"
            >
              <ExternalLink className="h-3 w-3" />
              Exit demo
            </button>
            <button
              type="button"
              onClick={handleContinue}
              data-testid="disclaimer-continue"
              className="dc-continue"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
