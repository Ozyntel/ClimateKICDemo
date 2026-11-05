/**
 * Vercel / Next.js App Router endpoint for the "Stay in touch" email capture.
 *
 *   POST /api/submit-crm
 *
 * Body shape — accepts BOTH the new convert flow (`payload.email`) and the
 * legacy flow (`payload.form.email`) for backwards compat.
 *
 * Response: always 200 with `{ ok: true }` unless the body is malformed.
 *
 * Email sending (Resend) is fully optional:
 *   - If `RESEND_API_KEY` or `EMAIL_FROM` are missing, the handler skips
 *     sending and returns ok. Local dev needs no setup.
 *   - If the `resend` package isn't installed (dynamic import fails), same
 *     graceful skip.
 *   - When both env vars are present AND the package is installed (i.e. a
 *     normal Vercel deploy with `pnpm install` run), it sends a short
 *     thank-you with next-steps to `payload.email`, naming the organisation
 *     the demo was prepared for when it is known, and a notification with
 *     the organisation, email and intent to EMAIL_TO_INTERNAL (default
 *     hello@ozyntel.com) so the request reaches the team.
 *
 * The Vite SPA never builds this file — it only runs when the app is
 * deployed to Vercel as Next.js. The Express mirror in
 * `artifacts/api-server/src/routes/submitCrm.ts` handles local dev.
 */

const FROM_DEFAULT = "hello@ozyntel.com";
const INTERNAL_DEFAULT = "hello@ozyntel.com";

interface SubmitCrmPayload {
  email?: string;
  intent?: string;
  selectedPathwayId?: string | null;
  selectedPathwayName?: string | null;
  /** Organisation the demo was prepared for (the active lead case), if named. */
  organisationName?: string | null;
  leadContext?: Record<string, unknown>;
  conversion?: string;
  // Legacy shape kept for backwards compat with older Brief.tsx callers.
  form?: { email?: string };
  // Older shape also accepted `answers` etc. — we deliberately do not log them.
  [k: string]: unknown;
}

function extractRecipient(payload: SubmitCrmPayload): string | undefined {
  const direct = typeof payload.email === "string" ? payload.email.trim() : "";
  if (direct) return direct;
  const legacy = typeof payload.form?.email === "string" ? payload.form.email.trim() : "";
  return legacy || undefined;
}

/**
 * Human-readable label for the "I am reaching out as" intent selected on the
 * Finish page (Brief.tsx INTENT_OPTIONS). Falls back to a neutral phrase for
 * unknown/missing values so the sentence always reads cleanly.
 */
function intentLabel(intent: unknown): string {
  switch (intent) {
    case "customer":
      return "a customer";
    case "design_partner":
      return "a design partner";
    case "investor":
      return "an investor";
    case "other":
      return "other";
    default:
      return "a prospective contact";
  }
}

/** Single-line, control-character-free text (safe for an email subject). */
function oneLine(v: unknown, n: number): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return truncate(v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim(), n);
}

/** Organisation the demo was prepared for — top-level field, else leadContext. */
function organisationOf(payload: SubmitCrmPayload): string {
  return oneLine(payload.organisationName, 80) || oneLine(payload.leadContext?.organisationName, 80);
}

function internalSubject(payload: SubmitCrmPayload): string {
  const org = organisationOf(payload);
  return org ? `New contact request — ${org}` : "New contact request — organisation not named";
}

/** Notification to Ozyntel so a "Stay in touch" request actually reaches the team. */
function internalHtml(payload: SubmitCrmPayload, recipient: string): string {
  const org = organisationOf(payload);
  const rows: Array<[string, string]> = [
    ["Organisation", org || "— (not set in the demo)"],
    ["Email", oneLine(recipient, 200)],
    ["Contacting us as", intentLabel(payload.intent)],
    ["Sector", oneLine(payload.leadContext?.sector, 120) || "—"],
    ["Pathway chosen in the demo", oneLine(payload.selectedPathwayName, 160) || "—"],
  ];
  return `<!doctype html><html><body style="font-family:-apple-system,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:18px;margin:0 0 12px;">New contact request${org ? ` — ${escapeHtml(org)}` : ""}</h1>
    <ul style="line-height:1.55;padding-left:18px;">
      ${rows.map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`).join("\n      ")}
    </ul>
    <p style="color:#64748b;font-size:13px;">Sent from the demo's "Stay in touch" form. Reply to this email to answer the contact directly.</p>
  </body></html>`;
}

function buildHtml(payload: SubmitCrmPayload): string {
  const contactType = escapeHtml(intentLabel(payload.intent));
  const org = organisationOf(payload);
  const onBehalf = org ? ` on behalf of <strong style="color:#E89A82;">${escapeHtml(org)}</strong>` : "";

  // Automated confirmation for the "Stay in touch" capture. Plain, warm,
  // copy supplied by Ozyntel. Footer carries the Ozy. wordmark (rendered as
  // styled HTML text — SVG/external images are unreliable across email
  // clients, whereas a webfont-with-serif-fallback wordmark renders anywhere).
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#15191A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#15191A;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1B2021;border:1px solid rgba(236,236,230,0.08);border-radius:14px;">
        <tr><td style="padding:32px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#ECECE6;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hi,</p>
          <p style="margin:0 0 16px;">Thanks for reaching out — this is an automated confirmation that we received your message and noted that you&#39;re contacting us as: <strong style="color:#E89A82;">${contactType}</strong>${onBehalf}.</p>
          <p style="margin:0 0 16px;">A member of our team will get back to you soon. If you&#39;d like to help us route this quickly, reply with 1–2 lines on what you&#39;re looking for and any relevant links or context.</p>
          <p style="margin:0 0 4px;">Best,</p>
          <p style="margin:0 0 24px;">The Ozyntel team</p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid rgba(236,236,230,0.08);">
          <div style="font-family:Newsreader,'Source Serif Pro',Georgia,'Times New Roman',serif;font-weight:700;font-size:30px;letter-spacing:-0.02em;color:#ECECE6;line-height:1;">Oz<em style="font-style:italic;">y</em><span style="color:#E89A82;">.</span></div>
          <a href="https://ozyntel.com" style="display:inline-block;margin-top:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:rgba(236,236,230,0.55);text-decoration:none;">ozyntel.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Resolves the Resend client at runtime. Returns null if either the package
 * is not installed or the env vars are absent — both treated as "skip send"
 * (the brief explicitly requires no-op in local dev with no provider setup).
 */
/**
 * Resend's Node SDK returns `{ data, error }` and only rejects on network
 * errors — a 4xx response from Resend's API (validation error, sandbox
 * restriction, unverified domain, etc.) resolves the promise with an
 * `error` field set. If we don't inspect it we silently log "email=sent"
 * for sends that were quietly dropped by Resend.
 */
interface ResendSendResult {
  data?: { id?: string } | null;
  error?: { name?: string; message?: string } | null;
}
interface ResendSendArgs {
  from: string;
  to: string;
  subject: string;
  html: string;
  /** Reply-To header — used to point replies at hello@ozyntel.com when the
   *  verified Resend domain (ozyntel.ai) has no real inbox behind it. */
  replyTo?: string;
}
async function getResendClient(apiKey: string): Promise<{ send: (args: ResendSendArgs) => Promise<ResendSendResult> } | null> {
  try {
    const moduleName: string = "resend";
    const mod = (await import(/* @vite-ignore */ moduleName)) as {
      Resend?: new (key: string) => {
        emails: { send: (args: ResendSendArgs) => Promise<ResendSendResult> };
      };
    };
    if (!mod?.Resend) return null;
    const client = new mod.Resend(apiKey);
    return {
      send: (args) => client.emails.send(args),
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  let payload: SubmitCrmPayload = {};
  try {
    payload = (await req.json()) as SubmitCrmPayload;
  } catch {
    console.warn("[submit-crm] error=invalid_body");
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const recipient = extractRecipient(payload);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? FROM_DEFAULT;

  // The LOI flow also posts here to record the lead, but it sends its own
  // signed-copy email via /api/sign-loi. Skip the "Stay in touch" auto-reply
  // for LOI submissions so signers don't get a duplicate/contradictory email.
  if (payload.conversion === "loi_signed" || payload.intent === "loi_signed") {
    console.log("[submit-crm] email=skipped reason=loi_handled_separately");
    return Response.json({ ok: true, emailSent: false, reason: "loi_handled_separately" });
  }

  // Decide whether to attempt send. Any missing piece → graceful skip.
  if (!recipient) {
    console.log("[submit-crm] email=skipped reason=no_recipient");
    return Response.json({ ok: true, emailSent: false, reason: "no_recipient" });
  }
  if (!apiKey) {
    console.log("[submit-crm] email=skipped reason=missing_api_key");
    return Response.json({ ok: true, emailSent: false, reason: "missing_api_key" });
  }
  if (!process.env.EMAIL_FROM) {
    console.log("[submit-crm] email=skipped reason=missing_from_addr");
    return Response.json({ ok: true, emailSent: false, reason: "missing_from_addr" });
  }

  const client = await getResendClient(apiKey);
  if (!client) {
    console.log("[submit-crm] email=skipped reason=resend_unavailable");
    return Response.json({ ok: true, emailSent: false, reason: "resend_unavailable" });
  }

  // Reply-To support — recipients hitting Reply land in the real inbox at
  // hello@ozyntel.com even though the actual sender (Resend signs with
  // ozyntel.ai) has no mailbox behind it. Defaults to the Ozyntel inbox.
  const replyTo = process.env.EMAIL_REPLY_TO ?? "hello@ozyntel.com";
  const toInternal = process.env.EMAIL_TO_INTERNAL ?? INTERNAL_DEFAULT;

  // Internal notification (organisation, email, intent) runs alongside the
  // visitor's confirmation; its outcome is logged but never blocks the reply.
  const internalSend = client
    .send({ from, to: toInternal, subject: internalSubject(payload), html: internalHtml(payload, recipient), replyTo: recipient })
    .then((r) => {
      if (r?.error) console.warn(`[submit-crm] internal=failed reason=${r.error.name ?? "unknown"}:${truncate(r.error.message ?? "", 200)}`);
      else console.log(`[submit-crm] internal=sent id=${r?.data?.id ?? "?"}`);
      return !r?.error;
    })
    .catch((err: unknown) => {
      console.warn(`[submit-crm] internal=failed reason=${truncate(err instanceof Error ? err.message : "unknown", 200)}`);
      return false;
    });

  try {
    const [result, internalSent] = await Promise.all([
      client.send({
        from,
        to: recipient,
        subject: "We received your message — Ozyntel",
        html: buildHtml(payload),
        replyTo,
      }),
      internalSend,
    ]);
    // Resend's SDK doesn't reject on 4xx — it resolves with an `error`
    // field. Inspect it so silently-dropped sends don't log as "sent".
    if (result?.error) {
      const reason =
        `${result.error.name ?? "unknown"}:${truncate(result.error.message ?? "", 200)}`;
      console.warn(`[submit-crm] email=failed reason=${reason}`);
      return Response.json({ ok: true, emailSent: false, internalSent, reason: "send_failed", detail: reason });
    }
    console.log(`[submit-crm] email=sent id=${result?.data?.id ?? "?"}`);
    return Response.json({ ok: true, emailSent: true, internalSent, id: result?.data?.id });
  } catch (err) {
    // Log status/code only, never the user payload or the API key.
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn(`[submit-crm] email=failed reason=${truncate(msg, 200)}`);
    // Let the internal notification finish before the function returns.
    const internalSent = await internalSend;
    // Still return ok: true — the demo's UX guarantee is "form submission succeeds".
    return Response.json({ ok: true, emailSent: false, internalSent, reason: "send_failed", detail: msg });
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
