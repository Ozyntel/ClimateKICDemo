/**
 * Vercel / Next.js App Router endpoint for the in-app LOI signing flow.
 *
 *   POST /api/sign-loi
 *
 * Generates a signed-LOI PDF (with embedded signature image), emails it to
 * both signer + Ozyntel via Resend, and returns the PDF as base64 so the
 * client can offer a "Download PDF" button regardless of email outcome.
 *
 * Response:
 *   200 { ok: true, pdf: "<base64>", emailSent: boolean, emailReason?: string }
 *   400 { ok: false, error: "<code>" }    — only for malformed input
 *
 * Email + PDF deps are loaded dynamically so:
 *   - the file typechecks before `pnpm install` has fetched `resend` /
 *     `pdf-lib`
 *   - if either dep is missing at runtime, the relevant feature silently
 *     no-ops (PDF unavailable → emit a clear error code; Resend unavailable
 *     → still return PDF with `emailSent: false`)
 *
 * Local Vite dev: this file is NEVER bundled by Vite. The mirror in
 * `artifacts/api-server/src/routes/signLoi.ts` handles dev via the
 * `/api/*` proxy.
 */

// Relative import w/ `.js` extension so Vercel's @vercel/node builder
// (nodenext module resolution) can resolve it. The path alias `@/lib/...`
// works inside the Vite SPA tree but is not picked up by the serverless
// function build chain.
import {
  LOI_SUBTITLE,
  LOI_TITLE,
  renderLoiText,
  splitLoiIntoParagraphs,
} from "../../../lib/loiText.js";

const FROM_DEFAULT = "hello@ozyntel.com";
const INTERNAL_DEFAULT = "hello@ozyntel.com";

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
  context?: {
    /** Organisation the demo was prepared for (the active lead case). */
    organisationName?: string | null;
    caseId?: string | null;
    sector?: string | null;
    // Older clients only — no longer sent by the lead-case demo.
    demoPresetId?: string | null;
    companySize?: string | null;
  };
  /**
   * The LOI body the client rendered for the on-page preview. When
   * present, the server embeds it verbatim in the PDF so the preview and
   * the PDF are guaranteed identical. If absent (older clients), the
   * server re-renders from the canonical template using the signer fields.
   */
  loiBodyRendered?: string;
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

/**
 * Decode the data URL produced by the canvas (`data:image/png;base64,...`)
 * into a raw byte buffer. Returns null if it doesn't look like a PNG data
 * URL — the PDF generator will skip the embed in that case.
 */
function decodePngDataUrl(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  try {
    const bin = atob(m[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Generate the signed LOI as a PDF. Uses `pdf-lib` via dynamic import to
 * stay tolerant to install order.
 *
 * Returns Uint8Array of PDF bytes, or null if `pdf-lib` is unavailable.
 */
/**
 * Replace smart-typography characters with WinAnsi-safe ASCII equivalents.
 *
 * `pdf-lib` ships only the StandardFonts (Helvetica, Times, Courier) which
 * use WinAnsi encoding — basic Latin only. The LOI body (and the dynamic
 * pathway / signer copy) contains curly quotes, em-dashes, ellipses and
 * bullets that the font can't render, and `drawText` throws with the
 * cryptic "The string did not match the expected pattern" error when it
 * fails the encoding regex. Sanitising upfront fixes it without needing
 * to ship a custom Unicode TTF.
 */
function sanitizeForWinAnsi(s: string): string {
  return s
    // Curly single quotes / apostrophes → straight apostrophe
    .replace(/[‘’‚‛′]/g, "'")
    // Curly double quotes → straight double quote
    .replace(/[“”„‟″]/g, '"')
    // Em-dash → double hyphen
    .replace(/—/g, "--")
    // En-dash, minus, figure dash → hyphen
    .replace(/[–−‒]/g, "-")
    // Ellipsis → three dots
    .replace(/…/g, "...")
    // Bullet → asterisk
    .replace(/[•·]/g, "*")
    // Non-breaking space → regular space
    .replace(/ /g, " ")
    // Strip any remaining non-WinAnsi characters as a safety net so a
    // future copy edit with unexpected typography doesn't crash the PDF.
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, "?");
}

async function generatePdf(payload: SignLoiPayload): Promise<Uint8Array | null> {
  // Structural type — avoids a static `import("pdf-lib")` reference so this
  // file typechecks even before `pnpm install` has fetched the package.
  // Includes the font width measurement used for word-wrapping.
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
    mod = (await import(/* @vite-ignore */ moduleName)) as PdfLibMod;
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

  // Page geometry. A4 portrait with generous side margins so wrapped LOI
  // text reads comfortably and lines up with the signer/pathway metadata.
  const PAGE_W = 595;
  const PAGE_H = 842;
  const LEFT = 56;
  const RIGHT = 56;
  const TOP = 800;
  const BOTTOM = 70;
  const USABLE_W = PAGE_W - LEFT - RIGHT;

  /**
   * Wrap a PdfPage so every drawText call goes through sanitizeForWinAnsi.
   * Saves having to repeat the sanitiser at every call site (and saves
   * future copy edits with new smart-typography from breaking the PDF).
   */
  function wrapPageDraw(p: PdfPage): PdfPage {
    const orig = p.drawText.bind(p);
    p.drawText = (text: string, opts: Record<string, unknown>) =>
      orig(sanitizeForWinAnsi(text), opts);
    return p;
  }

  // Same wrap for `widthOfTextAtSize` — drawWrapped uses it to measure each
  // candidate line before drawing; if it sees a smart quote it throws the
  // same encoding error.
  function wrapFontWidth(f: PdfFont): PdfFont {
    const orig = f.widthOfTextAtSize.bind(f);
    f.widthOfTextAtSize = (text: string, size: number) =>
      orig(sanitizeForWinAnsi(text), size);
    return f;
  }
  wrapFontWidth(font);
  wrapFontWidth(bold);

  // Page cursor — kept in `state` so wrap/break helpers can mutate it.
  const state = { page: wrapPageDraw(pdf.addPage([PAGE_W, PAGE_H]) as PdfPage), y: TOP };

  /** Drop to a new page when there's not enough vertical room for `needed` pt. */
  function ensureSpace(needed: number) {
    if (state.y - needed < BOTTOM) {
      state.page = wrapPageDraw(pdf.addPage([PAGE_W, PAGE_H]) as PdfPage);
      state.y = TOP;
    }
  }

  /**
   * Word-wrap `text` to fit within USABLE_W at the given font size, emitting
   * one line at a time. Pre-existing `\n` in `text` are treated as forced
   * line breaks (used by the LOI template to keep bullets and numbered
   * headings on their own lines). Breaks paragraphs across pages cleanly.
   *
   * Bullet lines (those starting with "• ") render with a small left indent
   * and a hanging indent on wrapped continuation lines so the wrapped text
   * lines up under the first word of the bullet rather than under the dot.
   */
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

  // ── Header ───────────────────────────────────────────────────────────────
  state.page.drawText(LOI_TITLE, {
    x: LEFT, y: state.y, size: 22, font: bold, color: SLATE_900,
  });
  state.y -= 26;
  state.page.drawText(LOI_SUBTITLE, {
    x: LEFT, y: state.y, size: 10, font, color: SLATE_500,
  });
  state.y -= 20;

  // ── LOI body ────────────────────────────────────────────────────────────
  // Use the body the client rendered for the preview when available (so
  // the PDF and the preview are guaranteed identical). Fall back to a
  // server-side render using the signer fields for older clients.
  const loiBody = (payload.loiBodyRendered && payload.loiBodyRendered.trim().length > 0)
    ? payload.loiBodyRendered
    : renderLoiText({
        partyA: {
          legalName: payload.signer?.organisation ?? "",
          jurisdiction: payload.signer?.jurisdiction ?? undefined,
          registeredAddress: payload.signer?.address ?? undefined,
        },
        selectedPathwayName: payload.selectedPathwayName ?? null,
        effectiveDate: payload.signedAt,
      });
  const loiParagraphs = splitLoiIntoParagraphs(loiBody);

  for (const para of loiParagraphs) {
    drawWrapped(para, { font, size: 10, color: SLATE_900, lineHeight: 13 });
    state.y -= 6; // inter-paragraph gap
  }
  state.y -= 6;

  // ── Signer block ─────────────────────────────────────────────────────────
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

  // ── Pathway ──────────────────────────────────────────────────────────────
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

  // ── Context (optional) ──────────────────────────────────────────────────
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

  // ── Signature block — needs ~110pt of vertical room. ───────────────────
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
        /* fall through to name-only signature */
      }
    }
  }
  state.page.drawText(payload.signer?.name ?? "", {
    x: LEFT, y: state.y - 84, size: 10, font, color: SLATE_500,
  });

  // ── Footer on the last page ─────────────────────────────────────────────
  state.page.drawText("Generated by Ozyntel — ozyntel.com", {
    x: LEFT, y: 40, size: 8, font, color: SLATE_500,
  });

  return pdf.save();
}

interface ResendSendResult {
  data?: { id?: string } | null;
  error?: { name?: string; message?: string } | null;
}
interface SignLoiResendArgs {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
  /** Reply-To header — points replies to the real Ozyntel inbox even when
   *  the verified sending domain (ozyntel.ai) has no mailbox behind it. */
  replyTo?: string;
}
async function getResendClient(apiKey: string): Promise<
  | { send: (args: SignLoiResendArgs) => Promise<ResendSendResult> }
  | null
> {
  try {
    const moduleName: string = "resend";
    const mod = (await import(/* @vite-ignore */ moduleName)) as {
      Resend?: new (key: string) => {
        emails: {
          send: (args: SignLoiResendArgs) => Promise<ResendSendResult>;
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

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to avoid blowing the call stack on large inputs.
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function signerHtml(_payload: SignLoiPayload): string {
  // Automated confirmation sent to the signer with the signed-LOI PDF
  // attached. Copy supplied by Ozyntel. Footer carries the Ozy. wordmark as
  // styled HTML text (email-safe; SVG/external images unreliable across
  // clients).
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
    <h1 style="font-size:18px;margin:0 0 12px;">New LOI signed${loiOrganisation(payload) ? ` — ${escape(loiOrganisation(payload))}` : ""}</h1>
    <ul style="line-height:1.55;padding-left:18px;">
      <li><strong>${escape(payload.signer?.name ?? "—")}</strong> — ${escape(payload.signer?.organisation ?? "—")}</li>
      <li>${escape(payload.signer?.email ?? "—")}</li>
      <li>Demo prepared for: ${escape(oneLine(payload.context?.organisationName, 120) || "— (organisation name not set in the demo)")}</li>
      <li>Pathway: ${escape(payload.selectedPathwayName ?? "—")}</li>
      <li>Signed at: ${escape(payload.signedAt ?? "")}</li>
    </ul>
    <p>PDF attached.</p>
  </body></html>`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request): Promise<Response> {
  let payload: SignLoiPayload = {};
  try {
    payload = (await req.json()) as SignLoiPayload;
  } catch {
    console.warn("[sign-loi] error=invalid_body");
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  // Minimal validation.
  if (
    !payload.signer ||
    !isString(payload.signer.name) ||
    !isString(payload.signer.organisation) ||
    !isString(payload.signer.email) ||
    !isString(payload.signatureDataUrl) ||
    payload.consent !== true
  ) {
    console.warn("[sign-loi] error=missing_required_fields");
    return Response.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  // Generate PDF — wrap in try/catch so any exception from pdf-lib (e.g.
  // a future copy edit slipping in a glyph we forgot to sanitise) becomes
  // a clear error code on the wire instead of a raw exception message
  // bleeding into the .loi-err panel on the client.
  let pdfBytes: Uint8Array | null;
  try {
    pdfBytes = await generatePdf(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn(`[sign-loi] error=pdf_generation_failed reason=${truncate(msg, 120)}`);
    return Response.json(
      { ok: false, error: "pdf_generation_failed" },
      { status: 500 },
    );
  }
  if (!pdfBytes) {
    console.warn("[sign-loi] error=pdf_lib_unavailable");
    return Response.json(
      { ok: false, error: "pdf_generation_unavailable" },
      { status: 500 },
    );
  }
  const pdfBase64 = bytesToBase64(pdfBytes);

  // Email path — graceful no-op when env vars or `resend` are missing.
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
        // Reply-To — recipients hitting Reply land in the real Ozyntel
        // inbox even though Resend signs the outbound mail as the
        // verified ozyntel.ai domain (which has no mailbox behind it).
        const replyTo = process.env.EMAIL_REPLY_TO ?? "hello@ozyntel.com";
        // Hard timeout on the Resend send so a hung network call can't
        // exhaust the function budget and leave the client spinning. 6 s
        // is well inside the 30 s function maxDuration (vercel.json) and
        // enough wall-clock for Resend's typical p99 latency.
        const sendTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("resend_timeout_6s")), 6000),
        );
        const results = (await Promise.race([
          Promise.all([
            client.send({
              from,
              to: payload.signer.email!,
              subject: "Copy of your signed Potential Letter of Intent (Ozyntel)",
              html: signerHtml(payload),
              attachments: [attachment],
              replyTo,
            }),
            client.send({
              from,
              to: toInternal,
              subject: loiOrganisation(payload) ? `New LOI signed — ${loiOrganisation(payload)}` : "New LOI signed",
              html: internalHtml(payload),
              attachments: [attachment],
              replyTo,
            }),
          ]),
          sendTimeout,
        ])) as ResendSendResult[];
        // Resend's SDK doesn't reject on 4xx — inspect each result's
        // `error` field so silently-dropped sends don't log as "sent".
        const failed = results.find((r) => r?.error);
        if (failed) {
          throw new Error(
            `${failed.error?.name ?? "resend_error"}:${failed.error?.message ?? "unknown"}`,
          );
        }
        emailSent = true;
        const ids = results.map((r) => r?.data?.id ?? "?").join(",");
        console.log(`[sign-loi] email=sent recipients=2 ids=${ids}`);
      } catch (err) {
        emailReason = "send_failed";
        const msg = err instanceof Error ? err.message : "unknown";
        console.warn(`[sign-loi] email=failed reason=${truncate(msg, 200)}`);
      }
    }
  }

  return Response.json({
    ok: true,
    pdf: pdfBase64,
    emailSent,
    emailReason,
  });
}
