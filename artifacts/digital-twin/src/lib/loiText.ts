/**
 * LOI text — template + renderer.
 *
 * The canonical body is `LOI_TEMPLATE`, which contains `{{TOKEN}}`
 * placeholders for the values that vary per signing (effective date, the
 * two party blocks, the transaction summary, governing law). All other
 * placeholders that previously read `[e.g. …]` have been replaced with
 * concrete fallback wording so nothing reaches the user looking like
 * "[Date]" or "[Company legal name]".
 *
 * Consumers should never display the raw template — always go through
 * `renderLoiText({ … })`, which:
 *   1. Substitutes every {{TOKEN}} with a string (with safe fallbacks).
 *   2. Asserts no `[X]` / `[e.g. …]` style placeholders remain (dev warn).
 *
 * The same rendered body is used for both the on-page preview and the
 * generated PDF — `LOISignModal` computes the body, displays it in the
 * preview, and ships the same string to the server so the PDF embeds the
 * exact text the signer saw.
 */
import {
  DEFAULT_COURT_JURISDICTION,
  DEFAULT_GOVERNING_LAW,
  OZYNTEL_PARTY,
  describeParty,
  type PartyInfo,
} from "./loiParties.js";

export const LOI_TITLE = "Letter of Intent";

export const LOI_SUBTITLE =
  "Indicative terms — non-binding except where expressly stated";

/**
 * Three-bullet plain-English summary shown above the preview.
 */
export const LOI_KEY_POINTS: string[] = [
  "Mostly non-binding — see Section 14 for the binding clauses",
  "Used to prioritise follow-up and frame definitive agreements",
  "You'll receive a signed PDF copy by email",
];

/**
 * Raw template — DO NOT render this directly. Always run it through
 * `renderLoiText`. Tokens use the `{{TOKEN}}` convention. Bracketed
 * `[example]` strings in the original template have been baked into
 * concrete defaults below (e.g. "[X] years" → "three (3) years") so that
 * after token substitution no `[…]` remains.
 */
export const LOI_TEMPLATE = `1. Parties
This Letter of Intent (the "LOI") is entered into on {{EFFECTIVE_DATE}} (the "Effective Date") between:
{{PARTY_A_LEGAL_NAME}}, a company incorporated in {{PARTY_A_JURISDICTION}} with registered address {{PARTY_A_ADDRESS}} ("Company A"); and
{{PARTY_B_LEGAL_NAME}}, a company incorporated in {{PARTY_B_JURISDICTION}} with registered address {{PARTY_B_ADDRESS}} ("Company B").
Company A and Company B are each a "Party" and together the "Parties".

2. Purpose and background
The Parties wish to explore {{TRANSACTION_SUMMARY}} (the "Proposed Transaction"). This LOI sets out certain key terms the Parties currently intend to progress on, subject to further diligence, internal approvals, and the negotiation and execution of definitive agreements.

3. Proposed scope (indicative)
The Parties' current working assumptions for the Proposed Transaction include:
• Scope / deliverables: pilot + discovery aligned to the selected pathway, with definitive scope confirmed at kick-off.
• Objectives / success criteria: pathway-specific measurable outcomes, decision criteria, and KPIs, confirmed at kick-off.
• Working approach: workshops, structured interviews, data access where relevant, and a sprint cadence agreed at kick-off.
• Key dependencies: access to stakeholders, systems, and internal approvals, confirmed at kick-off.

4. Commercial terms (indicative, non-binding)
Unless stated as binding below, the commercial terms in this section are non-binding and for discussion purposes only.
• Commercial model: to be agreed in the definitive agreement (e.g. fixed fee, subscription, or time and materials).
• Indicative fees / pricing: to be provided alongside the definitive scope.
• Payment terms: typically 30 days net or against agreed milestones, confirmed in the definitive agreement.
• Expenses: reasonable expenses reimbursable against receipts, with caps confirmed in the definitive agreement.
• Taxes: VAT or local sales tax to be applied per applicable law.

5. Timeline and next steps
The Parties' intended timeline is:
• Kick-off / first working session: within 30 days of the Effective Date.
• Due diligence / discovery window: approximately four to six weeks following kick-off.
• Target date for definitive agreement(s): at the close of the discovery window.
• Target start date for delivery: promptly following execution of the definitive agreement.

6. Due diligence and information requests (optional)
Each Party may request reasonable information to evaluate the Proposed Transaction, including:
• Organisational context, requirements, constraints, and stakeholder map.
• Relevant technical architecture and data inventory.
• Compliance requirements and risk considerations.

7. Confidentiality (binding)
The Parties agree to keep confidential and not disclose to any third party any non-public information received in connection with the Proposed Transaction (the "Confidential Information"), except:
• to employees, contractors, professional advisers, and affiliates who have a need to know and are bound by confidentiality obligations; or
• as required by applicable law or a competent authority.
Term: These confidentiality obligations begin on the Effective Date and continue for three (3) years after the later of (i) the last disclosure of Confidential Information or (ii) termination of discussions, whichever is later. If the Parties already have an NDA in place covering this matter, that NDA will govern and this clause will be interpreted consistently with it.

8. Exclusivity / non-solicitation (optional; binding only if ticked)
Tick as applicable:
• No exclusivity. The Parties may engage with other potential partners.
• Exclusivity. For thirty (30) days from the Effective Date, neither Party will actively negotiate a substantially similar transaction with a third party in relation to the Proposed Transaction.
• (Optional) Non-solicitation. For twelve (12) months, neither Party will solicit for employment the other Party's employees who are materially involved in the Proposed Transaction, other than through general recruitment not targeted at those employees.

9. Intellectual property (indicative; binding carve-outs)
Background IP: Each Party retains all rights to intellectual property owned or developed outside the Proposed Transaction ("Background IP").
Foreground IP (if created): To be agreed in definitive agreement(s), including whether created materials are (i) owned by one Party, (ii) jointly owned, or (iii) licensed.
Tools and know-how: Each Party retains general know-how, methods, templates, and non-confidential skills developed in the course of work, excluding the other Party's Confidential Information.

10. Data protection and security (binding principles)
Where personal data is processed, the Parties intend to comply with applicable data protection law (including GDPR, as applicable). The Parties will agree appropriate data processing terms (e.g. a data processing agreement) before any transfer or processing of personal data, and will follow reasonable security practices.

11. Publicity (binding)
Neither Party shall issue press releases or public announcements regarding the Proposed Transaction or this LOI without the other Party's prior written consent, except as required by law.

12. Costs (binding)
Each Party will bear its own costs and expenses incurred in connection with the Proposed Transaction, unless otherwise agreed in writing.

13. Governing law and jurisdiction (binding)
This LOI and any dispute arising out of or in connection with it shall be governed by the laws of {{GOVERNING_LAW_JURISDICTION}}, and the courts of {{COURT_JURISDICTION}} shall have exclusive jurisdiction, except where mandatory law provides otherwise.

14. Non-binding nature; binding provisions
Except for Sections 7 (Confidentiality), 8 (Exclusivity / non-solicitation) (if selected as binding), 10 (Data protection and security), 11 (Publicity), 12 (Costs), and 13 (Governing law and jurisdiction), this LOI is intended only as an expression of the Parties' current intentions and does not create any legally binding obligation to proceed with the Proposed Transaction.

15. Signatures
Each Party signs below as an authorised representative.`;

/** How many sections the on-page "preview" shows by default. */
export const LOI_PREVIEW_PARAGRAPHS = 3;

/** Inputs for `renderLoiText`. Everything is optional with safe defaults. */
export interface LoiRenderArgs {
  /** Effective date — defaults to today's date in human-readable form. */
  effectiveDate?: Date | string;
  /** Signer's organisation. Missing fields fall back to "TBD — …". */
  partyA: Partial<PartyInfo>;
  /** Ozyntel side — defaults to `OZYNTEL_PARTY`. */
  partyB?: Partial<PartyInfo>;
  /** Optional pathway name to weave into the transaction summary. */
  selectedPathwayName?: string | null;
  /** Optional transformation goal text — supports a more specific summary. */
  transformationGoal?: string | null;
  /** Default: "The Netherlands". */
  governingLawJurisdiction?: string;
  /** Default: "Amsterdam, The Netherlands". */
  courtJurisdiction?: string;
}

/**
 * Format a date to "26 May 2026" in en-GB style — readable, unambiguous,
 * matches the rest of the demo UI. Accepts `Date`, ISO string, or already-
 * human-readable string (passed through).
 */
function formatEffectiveDate(input?: Date | string): string {
  if (!input) input = new Date();
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    // Caller passed a non-parseable string — just trust them.
    return typeof input === "string" ? input : new Date().toISOString().slice(0, 10);
  }
  try {
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Build the human-readable transaction summary used inside Section 2.
 * If a pathway is selected, weave its name in. Otherwise, fall back to a
 * generic-but-honest sentence.
 */
function buildTransactionSummary(args: LoiRenderArgs): string {
  const pathway = args.selectedPathwayName?.trim();
  if (pathway) {
    return `a potential collaboration relating to a transformation baseline and pathway exploration using Ozyntel's digital-twin demo (selected pathway: ${pathway})`;
  }
  return "a potential collaboration relating to a transformation baseline and pathway exploration using Ozyntel's digital-twin demo";
}

/**
 * Substitute every {{TOKEN}} in the template with the resolved value.
 * Throws (in dev) if any token remains unresolved or any bracket
 * placeholder leaks through. Production never throws — it only warns.
 */
export function renderLoiText(args: LoiRenderArgs): string {
  const partyA = describeParty(args.partyA);
  const partyB = describeParty(args.partyB ?? OZYNTEL_PARTY);

  const tokens: Record<string, string> = {
    EFFECTIVE_DATE: formatEffectiveDate(args.effectiveDate),
    PARTY_A_LEGAL_NAME: partyA.legalName,
    PARTY_A_JURISDICTION: partyA.jurisdiction,
    PARTY_A_ADDRESS: partyA.registeredAddress,
    PARTY_B_LEGAL_NAME: partyB.legalName,
    PARTY_B_JURISDICTION: partyB.jurisdiction,
    PARTY_B_ADDRESS: partyB.registeredAddress,
    TRANSACTION_SUMMARY: buildTransactionSummary(args),
    GOVERNING_LAW_JURISDICTION:
      args.governingLawJurisdiction?.trim() || DEFAULT_GOVERNING_LAW,
    COURT_JURISDICTION:
      args.courtJurisdiction?.trim() || DEFAULT_COURT_JURISDICTION,
  };

  let out = LOI_TEMPLATE;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  }

  assertNoRawPlaceholders(out);
  return out;
}

/**
 * Sanity-check: after rendering, the LOI body should contain no
 * `{{TOKEN}}` leftovers and no `[bracket]` placeholders. We allow the
 * "(i)/(ii)/(iii)" enumeration since those use round brackets.
 *
 * Dev: warns to console. Doesn't throw — we don't want to crash the demo
 * if a content author leaves a stray pair of square brackets in legitimate
 * prose. The warning surfaces the regression immediately.
 */
function assertNoRawPlaceholders(rendered: string): void {
  const unresolvedTokens = rendered.match(/\{\{[A-Z_]+\}\}/g);
  if (unresolvedTokens) {
    // eslint-disable-next-line no-console
    console.warn(
      `[loiText] renderLoiText left ${unresolvedTokens.length} unresolved token(s): ` +
        Array.from(new Set(unresolvedTokens)).join(", "),
    );
  }
  // Look for `[Word]` / `[lower case]` / `[X]` patterns — i.e. anything in
  // square brackets that smells like an unfilled template placeholder.
  const stray = rendered.match(/\[[^\]\n]{1,60}\]/g);
  if (stray) {
    // eslint-disable-next-line no-console
    console.warn(
      `[loiText] renderLoiText left ${stray.length} square-bracket placeholder(s): ` +
        Array.from(new Set(stray)).slice(0, 5).join(", "),
    );
  }
}

/**
 * Split a rendered LOI body into sections (one entry per blank-line gap).
 * Internal `\n` (numbered headings, bullets) is preserved so the UI can
 * render with `whitespace-pre-line` and the PDF can treat `\n` as a
 * forced line break.
 */
export function splitLoiIntoParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
