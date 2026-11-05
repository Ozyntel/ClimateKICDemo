/**
 * Local-dev Express mirror of `artifacts/digital-twin/src/app/api/submit-crm/route.ts`.
 *
 * Same contract:
 *   POST /api/submit-crm
 *     body  → { email | form.email, intent?, selectedPathwayName?, ... }
 *     reply → always 200 with { ok: true, emailSent: boolean, reason? }
 *
 * Resend send is fully optional and gracefully no-ops when:
 *   - the recipient email is missing
 *   - RESEND_API_KEY or EMAIL_FROM is missing (local dev default)
 *   - the `resend` package isn't installed yet
 *
 * Vite's `/api/*` proxy forwards here during local dev. On Vercel, the
 * Next.js route file takes over.
 */

import { Router, type IRouter, type Request, type Response } from "express";

const FROM_DEFAULT = "hello@ozyntel.com";
const INTERNAL_DEFAULT = "hello@ozyntel.com";

interface SubmitCrmPayload {
  email?: string;
  intent?: string;
  selectedPathwayId?: string | null;
  selectedPathwayName?: string | null;
  organisationName?: string | null;
  leadContext?: Record<string, unknown>;
  conversion?: string;
  form?: { email?: string };
  [k: string]: unknown;
}

function extractRecipient(payload: SubmitCrmPayload): string | undefined {
  const direct = typeof payload.email === "string" ? payload.email.trim() : "";
  if (direct) return direct;
  const legacy = typeof payload.form?.email === "string" ? payload.form.email.trim() : "";
  return legacy || undefined;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Mirror of route.ts intentLabel — keep in sync. */
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

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/** Mirror of route.ts oneLine — keep in sync. */
function oneLine(v: unknown, n: number): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return truncate(v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim(), n);
}

function organisationOf(payload: SubmitCrmPayload): string {
  return oneLine(payload.organisationName, 80) || oneLine(payload.leadContext?.organisationName, 80);
}

function internalSubject(payload: SubmitCrmPayload): string {
  const org = organisationOf(payload);
  return org ? `New contact request — ${org}` : "New contact request — organisation not named";
}

/** Mirror of route.ts internalHtml — keep in sync. */
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

  // Mirror of route.ts buildHtml — keep in sync. Footer carries the Ozy.
  // wordmark as styled HTML text (email-safe; SVG/external images unreliable).
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

async function getResendClient(
  apiKey: string,
): Promise<{ send: (args: { from: string; to: string; subject: string; html: string; replyTo?: string }) => Promise<unknown> } | null> {
  try {
    // Non-literal specifier keeps TypeScript from resolving the module at
    // typecheck time, so this file builds even before `pnpm install` has
    // fetched `resend`. Once it has, Node resolves it at runtime.
    const moduleName: string = "resend";
    const mod = (await import(moduleName)) as {
      Resend?: new (key: string) => {
        emails: { send: (args: { from: string; to: string; subject: string; html: string; replyTo?: string }) => Promise<unknown> };
      };
    };
    if (!mod?.Resend) return null;
    const client = new mod.Resend(apiKey);
    return { send: (args) => client.emails.send(args) };
  } catch {
    return null;
  }
}

const router: IRouter = Router();

router.post("/submit-crm", async (req: Request, res: Response) => {
  const payload = (req.body ?? {}) as SubmitCrmPayload;

  const recipient = extractRecipient(payload);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? FROM_DEFAULT;

  // LOI submissions get their own signed-copy email via /api/sign-loi —
  // skip the "Stay in touch" auto-reply here to avoid a duplicate.
  if (payload.conversion === "loi_signed" || payload.intent === "loi_signed") {
    console.log("[submit-crm] email=skipped reason=loi_handled_separately");
    return res.status(200).json({ ok: true, emailSent: false, reason: "loi_handled_separately" });
  }

  if (!recipient) {
    console.log("[submit-crm] email=skipped reason=no_recipient");
    return res.status(200).json({ ok: true, emailSent: false, reason: "no_recipient" });
  }
  if (!apiKey) {
    console.log("[submit-crm] email=skipped reason=missing_api_key");
    return res.status(200).json({ ok: true, emailSent: false, reason: "missing_api_key" });
  }
  if (!process.env.EMAIL_FROM) {
    console.log("[submit-crm] email=skipped reason=missing_from_addr");
    return res.status(200).json({ ok: true, emailSent: false, reason: "missing_from_addr" });
  }

  const client = await getResendClient(apiKey);
  if (!client) {
    console.log("[submit-crm] email=skipped reason=resend_unavailable");
    return res.status(200).json({ ok: true, emailSent: false, reason: "resend_unavailable" });
  }

  const toInternal = process.env.EMAIL_TO_INTERNAL ?? INTERNAL_DEFAULT;
  void client
    .send({ from, to: toInternal, subject: internalSubject(payload), html: internalHtml(payload, recipient), replyTo: recipient })
    .then(() => console.log("[submit-crm] internal=sent"))
    .catch((err: unknown) => console.warn(`[submit-crm] internal=failed reason=${truncate(err instanceof Error ? err.message : "unknown", 80)}`));

  try {
    await client.send({
      from,
      to: recipient,
      subject: "We received your message — Ozyntel",
      html: buildHtml(payload),
    });
    console.log("[submit-crm] email=sent");
    return res.status(200).json({ ok: true, emailSent: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn(`[submit-crm] email=failed reason=${truncate(msg, 80)}`);
    return res.status(200).json({ ok: true, emailSent: false, reason: "send_failed" });
  }
});

export default router;
