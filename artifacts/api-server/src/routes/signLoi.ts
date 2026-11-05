/**
 * Local-dev Express mirror of `artifacts/digital-twin/src/app/api/sign-loi/route.ts`.
 *
 *   POST /api/sign-loi
 *
 * Generates the signed-LOI PDF (via dynamic `import("pdf-lib")`), emails it
 * to signer + Ozyntel via Resend, and returns the PDF as base64 so the
 * client can offer a download regardless of email outcome.
 *
 * Both `pdf-lib` and `resend` are loaded dynamically so this file builds
 * before `pnpm install` has fetched them. If either is missing at runtime
 * we degrade gracefully:
 *   - pdf-lib missing → 500 with pdf_generation_unavailable
 *   - resend missing  → 200 with emailSent=false + reason
 *
 * Vite's `/api/*` proxy forwards here during local dev. On Vercel the
 * Next.js route file takes over.
 */
import { Router, type IRouter, type Request, type Response } from "express";

const FROM_DEFAULT = "hello@ozyntel.com";
const INTERNAL_DEFAULT = "hello@ozyntel.com";

// ─── LOI text — local-dev fallback only ─────────────────────────────────────
// The canonical, token-rendered LOI lives in
//   `artifacts/digital-twin/src/lib/loiText.ts`
// The React modal renders it on the client and ships the resolved string as
// `payload.loiBodyRendered`. The Vercel route also uses the canonical
// renderer. This file is only hit in local Vite dev, and almost always
// receives a pre-rendered body from the client — so we no longer keep a
// fully-fledged inline template here. The fallback below is a minimal,
// already-resolved (no [bracket] placeholders) safety net used only if a
// stale client posts without `loiBodyRendered`.
const LOI_TITLE = "Letter of Intent";
const LOI_SUBTITLE =
  "Indicative terms — non-binding except where expressly stated";
const LOI_FALLBACK_BODY = `1. Parties
This Letter of Intent (the "LOI") is entered into on the date of signature (the "Effective Date") between the signing organisation ("Company A") and Ozyntel B.V., a company incorporated in The Netherlands ("Company B"). Company A and Company B are each a "Party" and together the "Parties".

2. Purpose and background
The Parties wish to explore a potential collaboration relating to a transformation baseline and pathway exploration using Ozyntel's digital-twin demo (the "Proposed Transaction"). This LOI sets out certain key terms the Parties currently intend to progress on, subject to further diligence, internal approvals, and the negotiation and execution of definitive agreements.

(Full LOI text was not posted from the client. Please re-open the signing modal — the canonical LOI is rendered there and sent through with the signing payload.)`;

const LOI_FALLBACK_PARAGRAPHS = LOI_FALLBACK_BODY
  .split(/\n\s*\n/)
  .map((p) => p.trim())
  .filter((p) => p.length > 0);

interface SignLoiPayload {
  signer?: {
    name?: string;
    organisation?: string;
    title?: string | null;
    email?: string;
    jurisdiction?: string | null;
    address?: string | null;
  };
  consent?: boolean;
  signatureDataUrl?: string;
  selectedPathwayId?: string | null;
  selectedPathwayName?: string | null;
  signedAt?: string;
  loiBodyRendered?: string;
  context?: {
    /** Organisation the demo was prepared for (the active lead case). */
    organisationName?: string | null;
    caseId?: string | null;
    sector?: string | null;
    // Older clients only — no longer sent by the lead-case demo.
    demoPresetId?: string | null;
    companySize?: string | null;
  };
}

function isString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/** Single-line, control-character-free text safe for an email subject. */
function oneLine(s: string | null | undefined, n: number): string {
  // eslint-disable-next-line no-control-regex
  return truncate((s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim(), n);
}

/** Organisation named on the LOI: what the signer entered, else the demo's lead organisation. */
function loiOrganisation(payload: SignLoiPayload): string {
  return oneLine(payload.signer?.organisation, 80) || oneLine(payload.context?.organisationName, 80);
}

function decodePngDataUrl(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  try {
    const buf = Buffer.from(m[1], "base64");
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function generatePdf(payload: SignLoiPayload): Promise<Uint8Array | null> {
  interface PdfFont {
    widthOfTextAtSize: (text: string, size: number) => number;
  }
  interface PdfPage {
    drawText: (text: string, opts: Record<string, unknown>) => void;
    drawRectangle: (opts: Record<string, unknown>) => void;
    drawImage: (img: unknown, opts: Record<string, unknown>) => void;
  }
  interface PdfDoc {
    addPage: (size: [number, number]) => PdfPage;
    embedFont: (font: string) => Promise<PdfFont>;
    embedPng: (bytes: Uint8Array) => Promise<{
      scaleToFit: (w: number, h: number) => { width: number; height: number };
    }>;
    save: () => Promise<Uint8Array>;
  }
  interface PdfLibMod {
    PDFDocument: { create: () => Promise<PdfDoc> };
    StandardFonts: { Helvetica: string; HelveticaBold: string };
    rgb: (r: number, g: number, b: number) => unknown;
  }
  let mod: PdfLibMod | null = null;
  try {
    const moduleName: string = "pdf-lib";
    mod = (await import(moduleName)) as PdfLibMod;
  } catch {
    return null;
  }
  if (!mod) return null;
  const { PDFDocument, StandardFonts, rgb } = mod;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const SLATE_900 = rgb(0.06, 0.09, 0.16);
  const SLATE_500 = rgb(0.39, 0.45, 0.55);
  const INDIGO = rgb(0.29, 0.34, 0.86);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const LEFT = 56;
  const RIGHT = 56;
  const TOP = 800;
  const BOTTOM = 70;
  const USABLE_W = PAGE_W - LEFT - RIGHT;

  const state = { page: pdf.addPage([PAGE_W, PAGE_H]) as PdfPage, y: TOP };

  function ensureSpace(needed: number) {
    if (state.y - needed < BOTTOM) {
      state.page = pdf.addPage([PAGE_W, PAGE_H]);
      state.y = TOP;
    }
  }

  // Pre-existing `\n` in the source text are honoured as forced line breaks.
  // Bullet lines (those starting with "• ") get a small left indent and a
  // hanging indent on wrapped continuation lines. Keep in sync with the
  // Vercel/Next.js route's drawWrapped.
  function drawWrapped(
    text: string,
    opts: { font: PdfFont; size: number; color: unknown; lineHeight?: number },
  ) {
    const { font: f, size, color, lineHeight = size + 3 } = opts;
    const hardLines = text.split("\n");
    for (const hardLine of hardLines) {
      const trimmed = hardLine.trimEnd();
      if (trimmed.length === 0) {
        ensureSpace(lineHeight);
        state.y -= lineHeight;
        continue;
      }
      const isBullet = /^•\s/.test(trimmed);
      const indent = isBullet ? 12 : 0;
      const hangIndent = isBullet ? 12 : 0;
      const maxWidth = USABLE_W - indent;
      const words = trimmed.split(/\s+/).filter(Boolean);
      let line = "";
      let firstLineOfHard = true;
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        const w = f.widthOfTextAtSize(candidate, size);
        if (w <= maxWidth - (firstLineOfHard ? 0 : hangIndent)) {
          line = candidate;
        } else {
          if (line) {
            ensureSpace(lineHeight);
            state.page.drawText(line, {
              x: LEFT + indent + (firstLineOfHard ? 0 : hangIndent),
              y: state.y, size, font: f, color,
            });
            state.y -= lineHeight;
            firstLineOfHard = false;
          }
          line = word;
        }
      }
      if (line) {
        ensureSpace(lineHeight);
        state.page.drawText(line, {
          x: LEFT + indent + (firstLineOfHard ? 0 : hangIndent),
          y: state.y, size, font: f, color,
        });
        state.y -= lineHeight;
      }
    }
  }

  // Header
  state.page.drawText(LOI_TITLE, {
    x: LEFT, y: state.y, size: 22, font: bold, color: SLATE_900,
  });
  state.y -= 26;
  state.page.drawText(LOI_SUBTITLE, {
    x: LEFT, y: state.y, size: 10, font, color: SLATE_500,
  });
  state.y -= 20;

  // LOI body — prefer the client-rendered text shipped in the payload so
  // the PDF and the UI preview are guaranteed identical. Fall back to the
  // local minimal safety net if `loiBodyRendered` is missing.
  const clientBody = payload.loiBodyRendered?.trim();
  const loiParagraphs = clientBody
    ? clientBody.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0)
    : LOI_FALLBACK_PARAGRAPHS;

  for (const para of loiParagraphs) {
    drawWrapped(para, { font, size: 10, color: SLATE_900, lineHeight: 13 });
    state.y -= 6;
  }
  state.y -= 6;

  // Signer block
  ensureSpace(80);
  state.page.drawText("Signer", { x: LEFT, y: state.y, size: 11, font: bold, color: SLATE_900 });
  state.y -= 16;
  const rows: Array<[string, string]> = [
    ["Name", payload.signer?.name ?? "—"],
    ["Organisation", payload.signer?.organisation ?? "—"],
    ["Role / title", payload.signer?.title || "—"],
    ["Email", payload.signer?.email ?? "—"],
    ["Signed at (UTC)", payload.signedAt ?? new Date().toISOString()],
  ];
  for (const [k, v] of rows) {
    ensureSpace(14);
    state.page.drawText(k, { x: LEFT, y: state.y, size: 10, font, color: SLATE_500 });
    state.page.drawText(truncate(v, 70), { x: LEFT + 110, y: state.y, size: 10, font, color: SLATE_900 });
    state.y -= 14;
  }
  state.y -= 8;

  // Pathway
  if (payload.selectedPathwayName) {
    ensureSpace(40);
    state.page.drawText("Pathway under discussion", {
      x: LEFT, y: state.y, size: 11, font: bold, color: SLATE_900,
    });
    state.y -= 16;
    state.page.drawText(truncate(payload.selectedPathwayName, 80), {
      x: LEFT, y: state.y, size: 10, font, color: INDIGO,
    });
    if (payload.selectedPathwayId) {
      state.y -= 13;
      state.page.drawText(`id: ${payload.selectedPathwayId}`, {
        x: LEFT, y: state.y, size: 9, font, color: SLATE_500,
      });
    }
    state.y -= 14;
  }

  // Context (optional)
  const ctx = payload.context;
  if (ctx && (ctx.organisationName || ctx.sector || ctx.companySize || ctx.demoPresetId)) {
    ensureSpace(60);
    state.page.drawText("Context", { x: LEFT, y: state.y, size: 11, font: bold, color: SLATE_900 });
    state.y -= 16;
    const ctxRows: Array<[string, string | null | undefined]> = [
      ["Demo prepared for", ctx.organisationName],
      ["Sector", ctx.sector],
      ["Company size", ctx.companySize],
      ["Demo preset", ctx.demoPresetId],
    ];
    for (const [k, v] of ctxRows) {
      if (!v) continue;
      ensureSpace(14);
      state.page.drawText(k, { x: LEFT, y: state.y, size: 10, font, color: SLATE_500 });
      state.page.drawText(truncate(String(v), 70), {
        x: LEFT + 110, y: state.y, size: 10, font, color: SLATE_900,
      });
      state.y -= 14;
    }
    state.y -= 6;
  }

  // Signature block
  ensureSpace(120);
  state.page.drawText("Signature", { x: LEFT, y: state.y, size: 11, font: bold, color: SLATE_900 });
  state.y -= 12;
  state.page.drawRectangle({
    x: LEFT, y: state.y - 70, width: 320, height: 1, color: SLATE_500,
  });

  if (payload.signatureDataUrl) {
    const bytes = decodePngDataUrl(payload.signatureDataUrl);
    if (bytes) {
      try {
        const img = await pdf.embedPng(bytes);
        const scaled = img.scaleToFit(300, 64);
        state.page.drawImage(img, {
          x: LEFT, y: state.y - 68, width: scaled.width, height: scaled.height,
        });
      } catch {
        /* fall through */
      }
    }
  }
  state.page.drawText(payload.signer?.name ?? "", {
    x: LEFT, y: state.y - 84, size: 10, font, color: SLATE_500,
  });

  state.page.drawText("Generated by Ozyntel — ozyntel.com", {
    x: LEFT, y: 40, size: 8, font, color: SLATE_500,
  });

  return pdf.save();
}

async function getResendClient(apiKey: string): Promise<
  | { send: (args: { from: string; to: string; subject: string; html: string; attachments?: Array<{ filename: string; content: string }> }) => Promise<unknown> }
  | null
> {
  try {
    const moduleName: string = "resend";
    const mod = (await import(moduleName)) as {
      Resend?: new (key: string) => {
        emails: {
          send: (args: {
            from: string;
            to: string;
            subject: string;
            html: string;
            attachments?: Array<{ filename: string; content: string }>;
          }) => Promise<unknown>;
        };
      };
    };
    if (!mod?.Resend) return null;
    const client = new mod.Resend(apiKey);
    return { send: (args) => client.emails.send(args) };
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function signerHtml(_payload: SignLoiPayload): string {
  // Mirror of route.ts signerHtml — keep in sync. Footer carries the Ozy.
  // wordmark as styled HTML text (email-safe; SVG/external images unreliable).
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#15191A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#15191A;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1B2021;border:1px solid rgba(236,236,230,0.08);border-radius:14px;">
        <tr><td style="padding:32px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#ECECE6;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hi,</p>
          <p style="margin:0 0 16px;">Thank you — this is an automated confirmation that we received your signed Potential Letter of Intent (LoI) via the Ozyntel demo.</p>
          <p style="margin:0 0 16px;">Attached to this email you&#39;ll find a PDF copy of the signed LoI for your records.</p>
          <p style="margin:0 0 8px;font-weight:600;color:#ECECE6;">What happens next</p>
          <p style="margin:0 0 16px;">A member of the Ozyntel team will review and follow up with you shortly. If you have any questions or need to amend details, reply to this email and we&#39;ll help.</p>
          <p style="margin:0 0 4px;">Best regards,</p>
          <p style="margin:0 0 24px;">The Ozyntel team</p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid rgba(236,236,230,0.08);">
          <div style="font-family:Newsreader,'Source Serif Pro',Georgia,'Times New Roman',serif;font-weight:700;font-size:30px;letter-spacing:-0.02em;color:#ECECE6;line-height:1;">Oz<em style="font-style:italic;">y</em><span style="color:#E89A82;">.</span></div>
          <a href="https://ozyntel.com" style="display:inline-block;margin-top:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:rgba(236,236,230,0.55);text-decoration:none;">ozyntel.com</a>
          <p style="margin:14px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:rgba(236,236,230,0.4);">This is an automated message. Please reply to this email if anything looks incorrect, or if you&#39;d like to add context.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function internalHtml(payload: SignLoiPayload): string {
  return `<!doctype html><html><body style="font-family:-apple-system,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:18px;margin:0 0 12px;">New LOI signed${loiOrganisation(payload) ? ` — ${escapeHtml(loiOrganisation(payload))}` : ""}</h1>
    <ul style="line-height:1.55;padding-left:18px;">
      <li><strong>${escapeHtml(payload.signer?.name ?? "—")}</strong> — ${escapeHtml(payload.signer?.organisation ?? "—")}</li>
      <li>${escapeHtml(payload.signer?.email ?? "—")}</li>
      <li>Demo prepared for: ${escapeHtml(oneLine(payload.context?.organisationName, 120) || "— (organisation name not set in the demo)")}</li>
      <li>Pathway: ${escapeHtml(payload.selectedPathwayName ?? "—")}</li>
      <li>Signed at: ${escapeHtml(payload.signedAt ?? "")}</li>
    </ul>
    <p>PDF attached.</p>
  </body></html>`;
}

const router: IRouter = Router();

router.post("/sign-loi", async (req: Request, res: Response) => {
  const payload = (req.body ?? {}) as SignLoiPayload;

  if (
    !payload.signer ||
    !isString(payload.signer.name) ||
    !isString(payload.signer.organisation) ||
    !isString(payload.signer.email) ||
    !isString(payload.signatureDataUrl) ||
    payload.consent !== true
  ) {
    console.warn("[sign-loi] error=missing_required_fields");
    return res.status(400).json({ ok: false, error: "missing_required_fields" });
  }

  const pdfBytes = await generatePdf(payload);
  if (!pdfBytes) {
    console.warn("[sign-loi] error=pdf_lib_unavailable");
    return res.status(500).json({ ok: false, error: "pdf_generation_unavailable" });
  }
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? FROM_DEFAULT;
  const toInternal = process.env.EMAIL_TO_INTERNAL ?? INTERNAL_DEFAULT;

  let emailSent = false;
  let emailReason: string | undefined;

  if (!apiKey) {
    emailReason = "missing_api_key";
    console.log(`[sign-loi] email=skipped reason=${emailReason}`);
  } else if (!process.env.EMAIL_FROM) {
    emailReason = "missing_from_addr";
    console.log(`[sign-loi] email=skipped reason=${emailReason}`);
  } else {
    const client = await getResendClient(apiKey);
    if (!client) {
      emailReason = "resend_unavailable";
      console.log(`[sign-loi] email=skipped reason=${emailReason}`);
    } else {
      try {
        const filename = `LOI-${(payload.signer.organisation ?? "loi").replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
        const attachment = { filename, content: pdfBase64 };
        await Promise.all([
          client.send({
            from,
            to: payload.signer.email!,
            subject: "Copy of your signed Potential Letter of Intent (Ozyntel)",
            html: signerHtml(payload),
            attachments: [attachment],
          }),
          client.send({
            from,
            to: toInternal,
            subject: loiOrganisation(payload) ? `New LOI signed — ${loiOrganisation(payload)}` : "New LOI signed",
            html: internalHtml(payload),
            attachments: [attachment],
          }),
        ]);
        emailSent = true;
        console.log("[sign-loi] email=sent recipients=2");
      } catch (err) {
        emailReason = "send_failed";
        const msg = err instanceof Error ? err.message : "unknown";
        console.warn(`[sign-loi] email=failed reason=${truncate(msg, 80)}`);
      }
    }
  }

  return res.status(200).json({ ok: true, pdf: pdfBase64, emailSent, emailReason });
});

export default router;
