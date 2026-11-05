/**
 * In-app LOI signing modal.
 *
 * Replaces the previous DocuSign external redirect with a contained, free
 * signing experience:
 *   1. Collect name / organisation / title / email + consent.
 *   2. Draw signature on a canvas (see ./SignatureCanvas).
 *   3. POST to /api/sign-loi with signer fields, the signature data URL,
 *      and minimal lead context (organisation name, sector, chosen pathway).
 *   4. The server generates a PDF, emails it to signer + Ozyntel, and
 *      returns `{ ok: true, pdf: <base64>, emailSent: boolean, ... }`.
 *   5. UI shows a "Download PDF" button (always) and a small note about
 *      whether emails were sent.
 *
 * If the server fails entirely the modal still lets the user download a
 * PDF — see the fallback path. CRM record is also POSTed via the existing
 * /api/submit-crm endpoint regardless of email outcome.
 *
 * Visual treatment reuses the `.bm-*` shell/toolbar/× classes from the
 * Brief modal so the two heavy modals share a chassis; LOI-specific styles
 * live under `.loi-*` in `ozyntel-design.css`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Mail,
  MailX,
  X,
} from "lucide-react";
import { SignatureCanvas } from "./SignatureCanvas";
import {
  LOI_KEY_POINTS,
  LOI_PREVIEW_PARAGRAPHS,
  LOI_SUBTITLE,
  LOI_TITLE,
  renderLoiText,
  splitLoiIntoParagraphs,
} from "@/lib/loiText";

interface LOISignModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * v2 flow context. The original Brief page drew the selected pathway from
   * projectStore; the v2 demo tracks it per world-case instead, so callers
   * can pass it in directly. When omitted, we fall back to projectStore so
   * the legacy Brief page keeps working unchanged.
   */
  selectedPathwayName?: string | null;
  transformationGoal?: string | null;
  /**
   * The active lead case only — its id, organisation name and sector. The
   * organisation name pre-fills the form and travels with the LOI and CRM
   * submission so Ozyntel knows which organisation the demo was for.
   */
  leadContext?: { caseId?: string | null; organisationName?: string | null; sector?: string | null };
}

interface SignLoiResponse {
  ok: boolean;
  pdf?: string; // base64
  emailSent?: boolean;
  emailReason?: string;
  error?: string;
}

export function LOISignModal({ open, onClose, selectedPathwayName, transformationGoal, leadContext }: LOISignModalProps) {
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  // Optional — when not provided we fall through to "TBD — provided on
  // definitive agreement" inside the rendered LOI text.
  const [signerJurisdiction, setSignerJurisdiction] = useState("");
  const [signerAddress, setSignerAddress] = useState("");
  const [consent, setConsent] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SignLoiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loiExpanded, setLoiExpanded] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);

  /**
   * Friendly HTML5 validity messages.
   *
   * Safari's default popup for a failed `type=email` validation is the
   * cryptic "The string did not match the expected pattern" — which lands
   * on signers as a confusing error. We override the browser's message
   * with a plain-English one keyed off the actual ValidityState reason
   * (empty / typo / etc.). `onInput` clears the override so the field
   * goes back to a normal valid state once the user types something
   * acceptable.
   */
  function setEmailValidity(e: React.InvalidEvent<HTMLInputElement>) {
    const t = e.currentTarget;
    if (t.validity.valueMissing) {
      t.setCustomValidity("Please enter your email address.");
    } else if (t.validity.typeMismatch) {
      t.setCustomValidity(
        "That doesn't look like a valid email — please check for a typo (e.g. you@example.com).",
      );
    } else {
      t.setCustomValidity("");
    }
  }
  function setRequiredValidity(label: string) {
    return (e: React.InvalidEvent<HTMLInputElement>) => {
      const t = e.currentTarget;
      if (t.validity.valueMissing) {
        t.setCustomValidity(`Please enter your ${label}.`);
      } else {
        t.setCustomValidity("");
      }
    };
  }
  /** Generic onInput handler — clears any custom validity once the user types. */
  function clearValidity(e: React.FormEvent<HTMLInputElement>) {
    e.currentTarget.setCustomValidity("");
  }

  // Focus the first field when opening, dismiss on Escape.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      modalRef.current?.querySelector<HTMLInputElement>("input[name='signer-name']")?.focus();
    }, 50);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, submitting]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset transient state whenever the modal is freshly opened, and pre-fill
  // the organisation from the lead case (still editable, e.g. legal name).
  useEffect(() => {
    if (open) {
      setResult(null);
      setErrorMsg(null);
      const leadOrg = leadContext?.organisationName?.trim();
      if (leadOrg) setOrganisation((cur) => cur.trim() ? cur : leadOrg);
    }
  }, [open, leadContext?.organisationName]);

  // Compute the rendered LOI body once per relevant change. The preview
  // shows this directly, and the same string is shipped to the server for
  // the PDF — so what the signer reads is exactly what gets emailed.
  const renderedLoiBody = useMemo(() => {
    // Only the props passed in by the active lead case feed the LOI text.
    return renderLoiText({
      partyA: {
        legalName: organisation,
        jurisdiction: signerJurisdiction,
        registeredAddress: signerAddress,
      },
      selectedPathwayName: selectedPathwayName ?? null,
      transformationGoal: transformationGoal ?? null,
    });
  }, [organisation, signerJurisdiction, signerAddress, selectedPathwayName, transformationGoal]);

  const loiParagraphs = useMemo(
    () => splitLoiIntoParagraphs(renderedLoiBody),
    [renderedLoiBody],
  );

  if (!open) return null;

  const canSubmit =
    name.trim().length > 0 &&
    organisation.trim().length > 0 &&
    email.trim().length > 0 &&
    consent &&
    !!signature &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    setResult(null);

    const effectivePathwayName = selectedPathwayName ?? null;
    const signedAt = new Date().toISOString();

    const payload = {
      signer: {
        name: name.trim(),
        organisation: organisation.trim(),
        title: title.trim() || null,
        email: email.trim(),
        jurisdiction: signerJurisdiction.trim() || null,
        address: signerAddress.trim() || null,
      },
      consent,
      signatureDataUrl: signature,
      selectedPathwayId: null,
      selectedPathwayName: effectivePathwayName,
      signedAt,
      context: {
        // Organisation the demo was prepared for (lead case) — the signer
        // may still type a different legal name above.
        organisationName: leadContext?.organisationName?.trim() || null,
        sector: leadContext?.sector ?? null,
        caseId: leadContext?.caseId ?? null,
      },
      // The rendered LOI body the signer just read in the preview. Server
      // embeds this verbatim in the PDF so the two are guaranteed identical.
      loiBodyRendered: renderedLoiBody,
    };

    // Fire CRM record in parallel — we want the lead recorded even if the
    // email layer is down. Failures are intentionally swallowed.
    void fetch("/api/submit-crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: payload.signer.email,
        intent: "loi_signed",
        selectedPathwayId: payload.selectedPathwayId,
        selectedPathwayName: payload.selectedPathwayName,
        leadContext: { ...payload.context, loiSigned: true, signedAt },
        signedAt,
        conversion: "loi_signed",
      }),
    }).catch(() => {
      /* offline demo — silently ignore */
    });

    // Hard 35 s client timeout — sits just above the function's 30 s
    // maxDuration so a truly unresponsive backend can't leave the
    // submit button spinning indefinitely. AbortController is the only
    // way to time-bound a fetch — there's no built-in `timeout` arg.
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), 35_000);
    try {
      const res = await fetch("/api/sign-loi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      // Use res.text() then JSON.parse so a non-JSON 5xx body (e.g. a
      // Vercel function-failed HTML page) surfaces a useful error rather
      // than "Unexpected token < in JSON at position 0".
      const raw = await res.text();
      let body: SignLoiResponse;
      try {
        body = raw ? (JSON.parse(raw) as SignLoiResponse) : { ok: false };
      } catch {
        throw new Error(`Server returned an unexpected response (HTTP ${res.status}). Please try again.`);
      }
      if (!res.ok || !body.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setResult(body);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("sign-loi failed", err);
      const msg =
        err instanceof DOMException && err.name === "AbortError"
          ? "The signing service took too long to respond. Please try again or download the PDF below if it appears."
          : err instanceof Error
            ? err.message
            : "Could not reach the signing service. Please try again.";
      setErrorMsg(msg);
    } finally {
      window.clearTimeout(tid);
      setSubmitting(false);
    }
  }

  function handleDownload() {
    if (!result?.pdf) return;
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${result.pdf}`;
    const safeOrg = (organisation || "loi").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
    link.download = `loi-${safeOrg}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const success = !!result?.ok;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loi-modal-title"
      className="bm-overlay mod-ozy"
      data-testid="loi-modal"
      onMouseDown={(e) => {
        // Backdrop click → close (only when clicking the backdrop itself).
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bm-shell loi-shell"
        style={{ maxWidth: 720 }}
      >
        <header className="bm-toolbar">
          <div className="loi-toolbar-l">
            <span className="loi-eyebrow">Letter of Intent</span>
            <h2 id="loi-modal-title" className="loi-title">
              Sign the non-binding LOI
            </h2>
          </div>
        </header>

        <button
          type="button"
          onClick={() => !submitting && onClose()}
          disabled={submitting}
          data-testid="loi-modal-close"
          className="bm-x"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bm-body loi-body">
          {success ? (
            <div className="loi-success" data-testid="loi-success">
              <div className="loi-success-head">
                <CheckCircle2 className="h-5 w-5 loi-success-icon" />
                <div>
                  <p className="loi-success-title">LOI signed</p>
                  <p className="loi-success-sub">
                    A copy is available below.{" "}
                    {result?.emailSent ? (
                      <span className="loi-success-mailed">
                        <Mail className="inline h-3 w-3" />{" "}
                        We've also emailed it to you and to Ozyntel.
                      </span>
                    ) : (
                      <span className="loi-success-mailoff">
                        <MailX className="inline h-3 w-3" />{" "}
                        Email delivery is currently disabled in this environment —
                        please download your copy below.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="loi-success-actions">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!result?.pdf}
                  data-testid="loi-download-btn"
                  className="bm-btn bm-btn-primary"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="bm-btn bm-btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="loi-form" data-testid="loi-form">
              {/* Key points — plain-English summary so the signer can scan
                  before deciding whether to expand the full LOI body. */}
              <section className="loi-keypoints" data-testid="loi-key-points">
                <p className="loi-section-lbl loi-section-lbl-copper">
                  Key points
                </p>
                <ul className="loi-keypoints-list">
                  {LOI_KEY_POINTS.map((point) => (
                    <li key={point}>
                      <span aria-hidden="true" className="loi-keypoint-bullet">
                        •
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* LOI preview — collapsed by default, max-h fixed band with
                  internal scroll. "View full LOI" expands to the complete body. */}
              <section
                className="loi-preview"
                data-testid="loi-preview"
                aria-label="Letter of Intent preview"
              >
                <header className="loi-preview-head">
                  <div>
                    <p className="loi-preview-title">{LOI_TITLE} (preview)</p>
                    <p className="loi-preview-sub">
                      {LOI_SUBTITLE} · Non-binding except any stated clauses.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoiExpanded((v) => !v)}
                    aria-expanded={loiExpanded}
                    aria-controls="loi-preview-body"
                    data-testid="loi-preview-toggle"
                    className="loi-preview-toggle"
                  >
                    {loiExpanded ? (
                      <>
                        Hide full LOI
                        <ChevronUp className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        View full LOI
                        <ChevronDown className="h-3 w-3" />
                      </>
                    )}
                  </button>
                </header>
                <div
                  id="loi-preview-body"
                  className={`loi-preview-body ${
                    loiExpanded ? "loi-preview-body-open" : ""
                  }`}
                >
                  <p className="sr-only">Letter of Intent text:</p>
                  {(loiExpanded
                    ? loiParagraphs
                    : loiParagraphs.slice(0, LOI_PREVIEW_PARAGRAPHS)
                  ).map((para, i) => (
                    <p key={i} className="loi-preview-p">
                      {para}
                    </p>
                  ))}
                  {!loiExpanded &&
                    loiParagraphs.length > LOI_PREVIEW_PARAGRAPHS && (
                      <p className="loi-preview-more">
                        … {loiParagraphs.length - LOI_PREVIEW_PARAGRAPHS} more
                        section
                        {loiParagraphs.length - LOI_PREVIEW_PARAGRAPHS === 1
                          ? ""
                          : "s"}
                        {". "}
                        Click <span className="loi-preview-more-cta">View full LOI</span>{" "}
                        to read all of it.
                      </p>
                    )}
                </div>
              </section>

              <div className="loi-fields">
                <Field label="Full name" required>
                  <input
                    type="text"
                    required
                    name="signer-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onInvalid={setRequiredValidity("full name")}
                    onInput={clearValidity}
                    placeholder="Alex Müller"
                    data-testid="loi-name"
                    className="loi-input"
                  />
                </Field>

                <Field label="Organisation" required>
                  <input
                    type="text"
                    required
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    onInvalid={setRequiredValidity("organisation")}
                    onInput={clearValidity}
                    placeholder="Organisation name"
                    data-testid="loi-org"
                    className="loi-input"
                  />
                </Field>

                <Field label="Role / title">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Head of Sustainability"
                    data-testid="loi-title"
                    className="loi-input"
                  />
                </Field>

                <Field label="Email" required>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onInvalid={setEmailValidity}
                    onInput={clearValidity}
                    placeholder="alex@example.com"
                    data-testid="loi-email"
                    className="loi-input"
                  />
                </Field>

                <Field label="Org jurisdiction (optional)">
                  <input
                    type="text"
                    value={signerJurisdiction}
                    onChange={(e) => setSignerJurisdiction(e.target.value)}
                    placeholder="e.g. Germany"
                    data-testid="loi-jurisdiction"
                    className="loi-input"
                  />
                </Field>

                <Field label="Org registered address (optional)">
                  <input
                    type="text"
                    value={signerAddress}
                    onChange={(e) => setSignerAddress(e.target.value)}
                    placeholder="Street, City, Country"
                    data-testid="loi-address"
                    className="loi-input"
                  />
                </Field>
              </div>

              <div>
                <label className="loi-section-lbl">
                  Signature <span className="loi-req">*</span>
                </label>
                <SignatureCanvas onChange={setSignature} testId="loi-signature" />
              </div>

              <label className="loi-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  data-testid="loi-consent"
                />
                <span>
                  I confirm I'm authorised to sign on behalf of my organisation
                  and agree to receive a copy of this signed LOI by email.
                </span>
              </label>

              {errorMsg && <p className="loi-err">{errorMsg}</p>}

              <div className="loi-actions">
                <button
                  type="button"
                  onClick={() => !submitting && onClose()}
                  disabled={submitting}
                  className="loi-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  data-testid="loi-submit"
                  className="bm-btn bm-btn-primary"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Sign &amp; receive copy
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="loi-field">
      <span className="loi-section-lbl">
        {label} {required && <span className="loi-req">*</span>}
      </span>
      {children}
    </label>
  );
}
