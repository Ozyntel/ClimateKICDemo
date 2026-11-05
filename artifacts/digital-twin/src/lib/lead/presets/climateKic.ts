/**
 * DEMONSTRATION PRESET — Climate KIC (public context + synthetic planning case).
 *
 * The organisation context draws on public information: Climate KIC is an
 * independent Dutch non-profit foundation working internationally on climate
 * transformation, with a public strategy that emphasises place-based
 * transformation and systems innovation; ClimateLaunchpad is a green business
 * ideas competition powered by Climate KIC, whose distributed delivery
 * inspires this case. Office locations (HQ at Plantage Middenlaan 45,
 * Amsterdam; co-location centres in Brussels, Milan, Warsaw, Valencia and
 * London; info points in Vienna, Copenhagen, Paris and Berlin) are from the
 * public contact page, climate-kic.org/contact (checked November 2026).
 *
 * EVERYTHING ELSE IS SYNTHETIC: the four partners (A–D), cohorts, budget,
 * specialist hours, source documents CK-01–CK-03, stakeholder views, pathways
 * and scenarios are invented for a bounded planning demo. Nothing here
 * describes Climate KIC's confidential operations, approved plans, actual
 * finances, actual partners or actual people, and nothing is a verified
 * ClimateLaunchpad operating plan.
 *
 * Loaded only from /prepare ("Start from a demo case"), which creates a new,
 * editable lead case from this object. The customer-facing pages never import
 * it — they read the case the team set active, like any other lead.
 *
 * Numbers: every resource figure shown in the demo is derived from
 * `planning` (constraints + components) and each pathway's `components`.
 * Do not repeat those figures in free text: they would go stale on edit.
 */

const SYN = "synthetic" as const;

type Rec = Record<string, unknown>;

const el = (id: string, label: string, visual: string, state: string, x: number, y: number, extra: Rec = {}): Rec => ({
  id, label, visual, state, overlays: [], layer: "list", near: "", note: "", holder: "", evidence: SYN, confidence: "unknown", confidenceWhy: "",
  sourceIds: [], measure: { value: "", unit: "", asOf: "" }, portfolio: { tier: "", health: "", status: "" },
  pos: { x, y }, group: "", facts: [], unknowns: [], ledger: "", shape: "", ring: "", ...extra,
});

/** A public office location, drawn as an island on the inner ring (not in the systems view). */
const office = (id: string, city: string, kind: "co-location centre" | "info point", address: string): Rec => ({
  ...el(id, kind === "info point" ? `${city} info point` : `${city} office`, "organisation", "operating", 0, 0, {
    layer: "macro", ring: "inner", shape: `city-${city.toLowerCase()}`, pos: null, evidence: "observed",
    note: `Climate KIC ${kind}, ${address}. Public information (climate-kic.org/contact).`,
    unknowns: ["Its role in this programme is not part of the case"],
  }),
});

/** A connection. state "active" = existing (solid); "uncertain" / "unknown" = proposed or uncertain (dashed). */
const rel = (id: string, from: string, to: string, label: string, extra: Rec = {}): Rec => ({
  id, from, to, type: "dependency", label, state: "active", tone: "neutral", frequency: "unknown", evidence: SYN, sourceIds: [], perspectives: [], note: "", ...extra,
});

const proposedRel = (id: string, from: string, to: string, label: string, note: string): Rec => rel(id, from, to, label, { state: "uncertain", evidence: "assumption", note });

/** An illustrative link between islands of the network map (offices are public; what they do in this programme is not part of the case). */
const eco = (id: string, from: string, to: string, label: string): Rec => rel(id, from, to, label, { type: "relationship", evidence: "illustrative", note: "Illustrative link for the demo — not an account of how this office works." });

/** An illustrative team (roles, not people; headcount not stated) with role-to-role links for the micro level. */
const team = (id: string, name: string, purpose: string, tier: number, roles: string[], links: Array<[string, string, "decision" | "handover", string]>): Rec => ({
  id, name, purpose, headcount: null, roles, tier, views: [], visual: "team", state: "unknown", overlays: [],
  roleLinks: links.map(([from, to, kind, label]) => ({ from, to, kind, label })),
});

// ─── shared option parts (defined once, used by more than one option) ──

const LEARNING_PKG = (x: number, y: number) => el("ck-pkg-learning", "Shared learning & follow-up package", "intervention", "proposed", x, y, {
  evidence: "assumption",
  note: "Common milestone definitions, a short check-in after each cohort and a partner learning session, with room for local measures. Includes founder follow-up.",
  unknowns: ["Reporting burden on partners has not been measured", "Which follow-up founders actually want (no founder feedback in the model)"],
});
const READINESS_PKG = (x: number, y: number) => el("ck-pkg-ready", "Partner-readiness & accessibility package", "intervention", "proposed", x, y, {
  evidence: "assumption",
  note: "Readiness checks with partners before recruitment and an accessible participation option (for example flexible remote coaching and travel or connectivity support).",
  unknowns: ["Which partners need which support", "No inclusion baseline to compare against"],
});
const PACKAGE_RELS = (): Rec[] => [
  proposedRel("ck-p-learn-learning", "ck-pkg-learning", "ck-learning", "Shared milestones + local measures", "Proposed: a small shared evidence core alongside local insight."),
  proposedRel("ck-p-learn-founders", "ck-pkg-learning", "ck-founders", "Follow-up support for founders", "Proposed follow-up; usefulness would be founder-reported, not assumed."),
  proposedRel("ck-p-ready-partners", "ck-pkg-ready", "ck-partners", "Readiness check before recruitment", "Proposed check; it does not by itself make a partner ready."),
  proposedRel("ck-p-ready-access", "ck-pkg-ready", "ck-access", "Accessible participation option", "Proposed support; effect on participation is not known."),
];
const STEP_LEARNING = { id: "step-learning", title: "Shared learning & follow-up package", what: "Agree common milestone definitions, a short check-in and a partner learning session, leaving room for local measures; offer founder follow-up.", showsOn: ["ck-pkg-learning", "ck-learning"], dependsOn: ["Partners accept common definitions", "Founder permission before sharing sensitive venture information"], evidence: ["Partner feedback on reporting burden", "Founder-reported usefulness of follow-up"] };
const STEP_READINESS = { id: "step-readiness", title: "Partner-readiness & accessibility package", what: "Check partner readiness before recruitment and provide an accessible participation option.", showsOn: ["ck-pkg-ready", "ck-readiness", "ck-access"], dependsOn: ["Partners share what they need", "Local accessibility needs are described"], evidence: ["Readiness check results per partner", "Participation data broken down by access needs (none yet)"] };

const proposedCohort = (id: string, label: string, x: number, y: number) => el(id, label, "team", "proposed", x, y, {
  evidence: "assumption",
  note: "A proposed new local cohort. Not approved, staffed or delivering. The hosting partner is not decided.",
  unknowns: ["Hosting partner and its readiness", "Trained mentors for this cohort", "Local delivery costs (venue, language, travel) — not priced"],
});
const cohortRels = (id: string): Rec[] => [
  proposedRel(`${id}-ready`, "ck-readiness", id, "Readiness to confirm before recruitment", "Proposed dependency: recruit only when the hosting partner is ready."),
  proposedRel(`${id}-mentors`, "ck-mentors", id, "Needs trained mentors", "Proposed dependency: trained mentors before recruitment."),
  proposedRel(`${id}-founders`, id, "ck-founders", "More target places (capacity ceiling)", "Planned capacity only — not applications, participation or outcomes."),
];

// ─── source texts (SYNTHETIC) ──────────────────────────────────────────

const CK01 = `# CK-01 — Programme portfolio and resource snapshot

SYNTHETIC DEMO DOCUMENT · not a Climate KIC record

Date: 31 October 2026
Scope: four fictional partners (A–D) and six cohorts. Planning extract, not an approved budget.

## Partner baseline

| Partner | Cohorts | Target teams | Cost | Central hours |
|---|---|---|---|---|
| A | 2 | 24 | €80,000 | 100 |
| B | 2 | 24 | €80,000 | 100 |
| C | 1 | 12 | €40,000 | 50 |
| D | 1 | 12 | €40,000 | 50 |
| **Total** | **6** | **72** | **€240,000** | **300** |

## Planning cap

€300,000 and 420 central specialist hours for the cycle.

## Candidate additions

| Addition | Cost | Central hours | Capacity |
|---|---|---|---|
| One new cohort | €30,000 | 50 | up to 12 target teams |
| Shared learning and follow-up package | €15,000 | 40 | — |
| Partner-readiness and accessibility package | €10,000 | 20 | — |

## Notes

- Partner staffing and in-kind contributions are unconfirmed and not priced.
- The cap is not a cash-flow schedule.
- Identical cohort costs are a simplifying demo assumption.
`;

const CK02 = `# CK-02 — Delivery and partner readiness review

SYNTHETIC DEMO DOCUMENT · not a Climate KIC record

Date: 2 November 2026
Scope: fictional partner perspectives; not a network survey.

## Partner perspectives

- **Partner A** could host another cohort if trained mentors are secured before recruitment. Two potential mentors are interested; neither is contracted.
- **Partner B** could host another cohort if a local-language coach and a suitable venue are confirmed. Neither cost is included in CK-01.
- **Partner C** prefers to consolidate and improve founder follow-up before adding delivery. Proposed buyer introductions are not confirmed.
- **Partner D** reports a need for flexible remote coaching and clearer travel or connectivity support. There is no representative participation survey.

## Programme lead proposal

The programme lead proposes common milestone definitions, a short check-in and a partner learning session, with room for local measures. Reporting burden has not been measured.

## Funding

A possible €30,000 sponsor has been discussed but has not made or committed an offer. Do not include it in baseline funding.
`;

const CK03 = `# CK-03 — Learning, governance and impact note

SYNTHETIC DEMO DOCUMENT · a fictional proposal, not Climate KIC policy

Date: 3 November 2026

## Proposed decision rights

- The central lead proposes scope.
- Finance checks funding.
- Local partners shape delivery within agreed minimum standards.
- The learning lead proposes definitions and consent.
- An appropriate human sponsor makes the final decision.

## Proposed practices

- Check partner readiness before recruitment.
- Establish a named mentor-escalation route.
- Provide an accessible participation option.
- Obtain founder permission before sharing sensitive venture information.
- Review learning after each cohort.

## Possible measures

Recruitment, completion, coaching delivered, founder-reported usefulness, follow-up requests, introductions accepted, pilots agreed and evidence of adoption.

Keep programme activity, adoption and actual climate outcomes separate.

## Unknown

Actual agreements, staffing, consent arrangements, inclusion baselines and validated long-term outcomes are unknown.
`;

// ─── the case ──────────────────────────────────────────────────────────

export const CLIMATE_KIC_PRESET = {
  schema: "ozy-lead-case",
  version: 1,
  id: "lead-preset-climate-kic",
  internalLabel: "Climate KIC — demonstration case (public context, synthetic planning data)",
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
  presentation: { orgType: "network", theme: "portfolio", defaultView: "" },
  caseNotice: "Demonstration case: the organisation context draws on public information. The planning data, partners, scenarios and results are synthetic and illustrative.",
  organisation: {
    name: "Climate KIC",
    overview: "Climate KIC is an independent Dutch non-profit foundation working internationally on climate transformation, headquartered at Plantage Middenlaan 45 in Amsterdam. Its public strategy emphasises place-based transformation and systems innovation, connecting technology, governance, finance, policy and ecosystem actors.",
    sector: "Climate innovation and systems transformation",
    place: "Netherlands-based foundation, working internationally",
    size: "",
    context: "Organisation type: non-profit / climate innovation network. Operating model: central coordination with locally delivered programmes. ClimateLaunchpad — a green business ideas competition powered by Climate KIC — and its distributed delivery inspire this case. This case is a fictional planning subset, not an account of the whole organisation or a verified ClimateLaunchpad operating plan.",
    visual: "organisation",
    state: "operating",
    shape: "city-amsterdam",
  },
  respondent: {
    role: "Central programme lead (fictional role — no real person is represented)",
    accountableFor: "Proposing the programme scope for the annual cycle, within agreed minimum standards.",
    goals: "Support more climate innovators while maintaining local relevance, delivery quality and the conditions for real-world impact.",
  },
  decision: {
    question: "With a fixed planning envelope and limited specialist time, should we grow the network quickly, phase growth, or strengthen existing delivery first—and what conditions must be true for that choice to support both founders and climate impact?",
    challenge: "Key constraints: flexible funding, central specialist time, partner readiness and unpriced local delivery requirements. Cash and specialist hours are separate constraints — an option can fit one and not the other.",
    objectives: [
      "Support more climate innovators",
      "Maintain local relevance and delivery quality",
      "Keep the conditions for real-world impact in view",
    ],
    timeHorizon: "An illustrative future annual cycle, viewed over 12 months",
    inScope: [
      "A fictional planning subset of four local delivery partners, A–D",
      "Six existing cohorts (a cohort is one distinct local batch; one partner can deliver more than one)",
      "One annual planning cycle",
      "The flexible planning envelope and central specialist time",
    ],
    outOfScope: [
      "Climate KIC as a whole organisation",
      "Real partners, staff, finances or approved plans",
      "A verified ClimateLaunchpad operating plan",
      "Calculated climate quantities (CO₂, impact numbers, ROI)",
    ],
    workingWell: [],
    underway: [],
    whereStalls: "",
    rights: [
      "Status: proposed, not verified",
      "The central lead proposes scope",
      "Finance checks funding",
      "Local partners shape delivery within agreed minimum standards",
      "The learning lead proposes definitions and consent",
      "An appropriate human sponsor makes the final decision",
    ],
  },
  intake: {
    constraints: { capacityLimits: true, governanceBottlenecks: false, decisionLatency: false, unclearOwnership: false },
    constraintNotes: "Flexible funding, central specialist time, partner readiness and unpriced local delivery requirements. Cash and hours are separate constraints.",
    externalNotes: "Funding restrictions and timing, availability of mentors, local accessibility, buyer demand and procurement conditions.",
    external: { marketVolatility: "", demandOutlook: "", regulatoryPressure: "", supplyDisruptionRisk: "", environmentalFactor: "" },
    omitSections: [],
  },
  numbers: [],
  elements: [
    el("ck-sponsor", "Funders / possible sponsor", "funding", "unknown", 8, 8, {
      layer: "macro", ring: "outer", shape: "fund",
      note: "External funding relationships — kept separate from the flexible planning envelope. No sponsor offer is part of the baseline.",
      unknowns: ["Funding restrictions and timing", "Whether any additional funding is eligible for this use"],
    }),
    el("ck-finance", "Finance & flexible funding", "budget", "allocated", 8, 34, {
      layer: "list", near: "org", ledger: "cash",
      note: "The flexible planning envelope for the cycle and the finance / funder interface that checks what the scope can fund.",
      unknowns: ["Funding conditions and timing"],
    }),
    el("ck-hours", "Central specialist capacity", "capacity", "spare", 8, 62, {
      layer: "list", near: "org", ledger: "hours",
      note: "Central specialist time for onboarding, coaching escalation and learning. A separate constraint from cash.",
      unknowns: ["How specialist time is spread across the year"],
    }),
    el("ck-learning", "Learning & impact", "team", "active", 8, 90, {
      layer: "list", near: "org",
      note: "The learning and impact function: definitions, partner feedback and programme adjustment. Keeps programme activity, adoption and climate outcomes apart.",
      unknowns: ["Founder feedback", "Inclusion baselines", "Validated outcomes"],
    }),
    el("ck-lead", "Central programme lead", "role", "assigned", 27, 8, {
      layer: "list", near: "org",
      note: "A role, not a real person. Proposes the programme scope (a proposed decision right, not verified).",
    }),
    el("ck-decision", "Growth decision · annual cycle", "decision", "open", 27, 34, {
      layer: "list", near: "org",
      note: "Grow quickly, phase growth or strengthen existing delivery first — and which conditions must be true. Open: no option is approved.",
      unknowns: ["Who the final human sponsor is", "Agreed minimum delivery standards"],
    }),
    el("ck-readiness", "Partner readiness", "readiness", "unknown", 27, 56, {
      layer: "list", near: "ck-cohorts",
      note: "Whether a partner can recruit and deliver another cohort well. Not assessed in the baseline.",
      unknowns: ["Partner agreements", "Staffing per partner", "Mentor availability per partner"],
    }),
    el("ck-local", "Local delivery requirements", "cost", "unknown", 27, 90, {
      layer: "list", near: "ck-cohorts",
      note: "Venue, language, travel or connectivity needs of each local delivery. Not priced in the baseline.",
      unknowns: ["What each local delivery needs and what it costs"],
    }),
    el("ck-partners", "Local delivery partners A–D", "external-stakeholder", "engaged", 50, 22, {
      layer: "list",
      note: "Four fictional local delivery partners. One partner can deliver more than one cohort. Open a partner to see how they differ.",
      unknowns: ["Partner agreements", "Partner staffing and in-kind contributions"],
    }),
    el("ck-partner-a", "Partner A", "external-stakeholder", "engaged", 0, 0, { layer: "macro", ring: "outer", shape: "office", group: "ck-partners", pos: null, note: "Fictional local delivery partner.", unknowns: ["Agreement and staffing"] }),
    el("ck-partner-b", "Partner B", "external-stakeholder", "engaged", 0, 0, { layer: "macro", ring: "outer", shape: "office", group: "ck-partners", pos: null, note: "Fictional local delivery partner.", unknowns: ["Agreement and staffing"] }),
    el("ck-partner-c", "Partner C", "external-stakeholder", "engaged", 0, 0, { layer: "macro", ring: "outer", shape: "office", group: "ck-partners", pos: null, note: "Fictional local delivery partner.", unknowns: ["Agreement and staffing"] }),
    el("ck-partner-d", "Partner D", "external-stakeholder", "engaged", 0, 0, { layer: "macro", ring: "outer", shape: "office", group: "ck-partners", pos: null, note: "Fictional local delivery partner.", unknowns: ["Agreement and staffing"] }),
    el("ck-mentors", "Trainers & mentors", "staffing", "unknown", 50, 68, {
      layer: "macro", ring: "outer", shape: "school",
      note: "Trainers and mentors who coach founders in each cohort.",
      unknowns: ["How many trained mentors are available, and where"],
    }),
    el("ck-access", "Local accessibility", "capability", "unknown", 50, 92, {
      layer: "list", near: "ck-founders",
      note: "Conditions that decide who can take part locally: travel, connectivity, language, timing.",
      unknowns: ["Inclusion baseline", "Who cannot currently take part"],
    }),
    el("ck-cohorts", "Programme cohorts", "team", "active", 72, 22, {
      layer: "macro", ring: "outer", shape: "pavilion",
      note: "The six existing cohorts of the fictional planning subset, delivered locally by partners A–D. ClimateLaunchpad's distributed delivery inspires this case.",
    }),
    el("ck-founders", "Founder teams", "external-stakeholder", "unknown", 72, 66, {
      layer: "macro", ring: "outer", shape: "lab",
      note: "Climate innovators taking part in cohorts. Targets are planned places — not applications, participation or completions.",
      unknowns: ["Founder feedback", "Who applies and who completes"],
    }),
    el("ck-buyers", "Challenge owners / buyers", "customer", "prospect", 92, 22, {
      layer: "macro", ring: "outer", shape: "shop",
      note: "Organisations that might scope a pilot with a founder team. Buyer demand and procurement conditions are outside the programme's control.",
      unknowns: ["Buyer demand", "Procurement conditions"],
    }),
    el("ck-adoption", "Possible pilots & adoption", "opportunity", "identified", 92, 52, {
      layer: "macro", ring: "outer", shape: "yard",
      note: "A pilot or adoption is an independent decision by a buyer. Not evidenced in this case.",
      unknowns: ["Pilots agreed", "Evidence of adoption"],
    }),
    el("ck-communities", "Affected communities", "community", "not-heard", 92, 88, {
      layer: "macro", ring: "outer", shape: "homes",
      note: "People affected by the solutions founders develop: relevance, benefits and possible harms.",
      unknowns: ["Who is affected depends on each solution"],
    }),
    el("ck-climate", "Climate & equity outcomes", "impact", "unverified", 72, 92, {
      layer: "macro", ring: "outer", shape: "farm",
      note: "Not quantified in this case. Mitigation, adaptation or circularity benefits — and harms — depend on the solution, its baseline, actual use and distribution.",
      unknowns: ["No climate quantities can be calculated from this case"],
    }),
    office("ck-office-brussels", "Brussels", "co-location centre", "Pl. du Congrès 1, Brussels"),
    office("ck-office-milan", "Milan", "co-location centre", "Bastioni di Porta Nuova 21, Milan"),
    office("ck-office-warsaw", "Warsaw", "co-location centre", "Koszykowa 54, Warsaw"),
    office("ck-office-valencia", "Valencia", "co-location centre", "Calle Quart 80, Valencia"),
    office("ck-office-london", "London", "co-location centre", "1 Triton Square, London"),
    office("ck-office-vienna", "Vienna", "info point", "Lindengasse 56, Vienna"),
    office("ck-office-copenhagen", "Copenhagen", "info point", "BLOXHUB, Bryghuspladsen 8, Copenhagen"),
    office("ck-office-paris", "Paris", "info point", "8 Rue Jean Antoine de Baïf, Paris"),
    office("ck-office-berlin", "Berlin", "info point", "Hauptstraße 151, Berlin"),
  ],
  teams: [
    team("team-ck-central", "Central programme · Amsterdam", "Coordinates the network and proposes the programme scope", 0,
      ["Central programme lead", "Decision sponsor", "Programme coordinator", "Partner network manager", "Mentor network coordinator", "Communications lead"],
      [["Central programme lead", "Decision sponsor", "decision", "Scope for sign-off"], ["Partner network manager", "Central programme lead", "decision", "Partner readiness input"], ["Mentor network coordinator", "Programme coordinator", "handover", "Mentor availability"], ["Programme coordinator", "Partner network manager", "handover", "Cohort schedule"], ["Communications lead", "Programme coordinator", "handover", "Recruitment timing"]]),
    team("team-ck-finance", "Finance & funders · Amsterdam", "Checks funding and funder conditions", 1,
      ["Finance lead", "Grants & funder manager", "Budget controller"],
      [["Budget controller", "Finance lead", "decision", "Envelope check"], ["Grants & funder manager", "Finance lead", "decision", "Funder conditions"]]),
    team("team-ck-learning", "Learning & impact · Amsterdam", "Proposes definitions, consent and learning reviews", 1,
      ["Learning lead", "Impact analyst", "Data & consent steward"],
      [["Impact analyst", "Learning lead", "handover", "Shared milestones"], ["Data & consent steward", "Learning lead", "decision", "Founder permission"]]),
    team("team-ck-delivery", "Programme delivery", "Runs cohorts with local partners", 1,
      ["Programme manager", "Cohort coordinator", "Trainer lead", "Founder support coach"],
      [["Cohort coordinator", "Programme manager", "decision", "Recruitment go-ahead"], ["Trainer lead", "Cohort coordinator", "handover", "Mentor matching"]]),
    ...["Brussels", "Milan", "Warsaw", "Valencia", "London"].map((city) => team(`team-ck-${city.toLowerCase()}`, `${city} centre team`, "Local partners, funders and programmes", 2,
      ["Centre lead", "Partner liaison", "Programme officer"],
      [["Partner liaison", "Centre lead", "decision", "Local partner needs"], ["Programme officer", "Partner liaison", "handover", "Local delivery"]])),
  ],
  relationships: [
    rel("ck-r-lead-dec", "ck-lead", "ck-decision", "Proposes scope · a human sponsor decides", { type: "decision", state: "unclear", note: "Proposed decision rights, not verified." }),
    rel("ck-r-fin-dec", "ck-finance", "ck-decision", "Funding bounds the programme scope", { note: "Finance checks what the scope can fund." }),
    rel("ck-r-sponsor-fin", "ck-sponsor", "ck-finance", "Possible extra funding — nothing committed", { state: "uncertain", note: "Kept separate from the baseline envelope." }),
    rel("ck-r-dec-ready", "ck-decision", "ck-readiness", "Programme scope → partner readiness", { note: "A larger scope needs more partners to be ready." }),
    rel("ck-r-ready-cohorts", "ck-readiness", "ck-cohorts", "Readiness conditions cohort delivery"),
    rel("ck-r-mentors-ready", "ck-mentors", "ck-readiness", "Readiness depends on available mentors"),
    rel("ck-r-local-ready", "ck-local", "ck-readiness", "…and on local resources", { note: "Venue, language, travel or connectivity." }),
    rel("ck-r-partners-cohorts", "ck-partners", "ck-cohorts", "Deliver cohorts locally"),
    rel("ck-r-mentors-cohorts", "ck-mentors", "ck-cohorts", "Coaching in each cohort"),
    rel("ck-r-cohorts-founders", "ck-cohorts", "ck-founders", "Delivery & coaching → founder experience"),
    rel("ck-r-access-founders", "ck-access", "ck-founders", "Accessibility → who can take part"),
    rel("ck-r-founders-buyers", "ck-founders", "ck-buyers", "If ready: possible buyer introduction", { state: "uncertain", note: "A question to validate, not a guaranteed step." }),
    rel("ck-r-buyers-adoption", "ck-buyers", "ck-adoption", "Possible pilot → potential adoption", { state: "uncertain", note: "Depends on procurement, funding and technical conditions." }),
    rel("ck-r-adoption-climate", "ck-adoption", "ck-climate", "May enable mitigation, adaptation or circularity", { state: "uncertain", note: "Depends on the solution, its baseline, actual use and distribution. Not quantified." }),
    rel("ck-r-communities", "ck-communities", "ck-adoption", "Relevance, benefits and possible harms", { type: "relationship", state: "unknown" }),
    rel("ck-r-hours-partners", "ck-hours", "ck-partners", "Onboarding support"),
    rel("ck-r-hours-mentors", "ck-hours", "ck-mentors", "Coaching escalation"),
    rel("ck-r-hours-learning", "ck-hours", "ck-learning", "Learning and evidence work"),
    rel("ck-r-learning-partners", "ck-learning", "ck-partners", "Partner feedback", { type: "information", state: "regular" }),
    rel("ck-r-learning-dec", "ck-learning", "ck-decision", "Programme adjustment", { type: "information", state: "regular" }),
    // the map network: HQ, offices and the programme (organisation context)
    rel("ck-r-org-cohorts", "org", "ck-cohorts", "Coordinates the programme"),
    rel("ck-r-sponsor-org", "ck-sponsor", "org", "Possible funding — nothing committed", { state: "uncertain" }),
    ...["brussels", "milan", "warsaw", "valencia", "london"].map((c) => rel(`ck-r-org-${c}`, "org", `ck-office-${c}`, "Co-location centre · coordination", { type: "relationship", state: "active", evidence: "observed" })),
    ...["vienna", "copenhagen", "paris", "berlin"].map((c) => rel(`ck-r-org-${c}`, "org", `ck-office-${c}`, "Info point", { type: "relationship", state: "active", evidence: "observed" })),
    // the wider ecosystem: partners, offices, the programme, founders and buyers interact with each other, not only with HQ
    ...["a", "b", "c", "d"].map((x) => rel(`ck-r-partner-${x}-cohorts`, `ck-partner-${x}`, "ck-cohorts", "Delivers cohorts locally")),
    ...[["a", "brussels"], ["b", "milan"], ["c", "warsaw"], ["d", "valencia"]].map(([x, c]) => eco(`ck-r-${c}-partner-${x}`, `ck-office-${c}`, `ck-partner-${x}`, "Local support (illustrative)")),
    ...[["brussels", "milan"], ["milan", "warsaw"], ["warsaw", "valencia"], ["valencia", "london"], ["london", "brussels"]].map(([a, b]) => eco(`ck-r-net-${a}-${b}`, `ck-office-${a}`, `ck-office-${b}`, "Shared programmes across centres (illustrative)")),
    eco("ck-r-london-cohorts", "ck-office-london", "ck-cohorts", "Programme activity (illustrative)"),
    eco("ck-r-vienna-founders", "ck-office-vienna", "ck-founders", "Entry point for founders (illustrative)"),
    eco("ck-r-copenhagen-buyers", "ck-office-copenhagen", "ck-buyers", "Local challenge owners (illustrative)"),
    eco("ck-r-paris-communities", "ck-office-paris", "ck-communities", "Local context (illustrative)"),
    eco("ck-r-berlin-adoption", "ck-office-berlin", "ck-adoption", "Local pilots (illustrative)"),
    // inside the organisation (illustrative teams)
    rel("ck-t-central-finance", "team-ck-central", "team-ck-finance", "Scope needs a funding check", { type: "decision", state: "clear" }),
    rel("ck-t-central-learning", "team-ck-central", "team-ck-learning", "Definitions and consent", { type: "information", state: "regular" }),
    rel("ck-t-central-delivery", "team-ck-central", "team-ck-delivery", "Scope and minimum standards", { type: "decision", state: "clear" }),
    rel("ck-t-learning-delivery", "team-ck-learning", "team-ck-delivery", "Learning reviews", { type: "information", state: "regular" }),
    ...["brussels", "milan", "warsaw", "valencia", "london"].map((c) => rel(`ck-t-${c}`, `team-ck-${c}`, "team-ck-delivery", "Local cohorts", { type: "handover", state: "clear" })),
  ],
  sources: [
    {
      id: "CK-01", title: "Programme portfolio and resource snapshot", fileName: "CK-01-portfolio-resource-snapshot.md", date: "2026-10-31", docType: "Planning extract",
      scope: "Four fictional partners and six cohorts. Planning extract, not an approved budget.", owner: "Central programme (fictional)", synthetic: true,
      excerpt: "Partner baseline A–D, the planning cap and three candidate additions.",
      fullText: CK01,
      reading: {
        extracted: ["Partner baseline for A–D: cohorts, target teams, cost and central hours per partner", "Planning cap for the cycle", "Candidate additions: one new cohort, a shared learning and follow-up package, a partner-readiness and accessibility package"],
        changes: ["Adds the per-partner split to Partners A–D on the map", "Cross-checks the planning baseline and candidate costs — the same snapshot, so nothing is added twice", "Marks partner staffing and in-kind contributions as not priced"],
        affected: [],
        uncertainties: ["Not an approved budget", "The cap is not a cash-flow schedule", "Partner staffing and in-kind contributions are unconfirmed", "Identical cohort costs are a simplifying demo assumption"],
      },
      updates: [],
      signals: ["Partner staffing not priced"],
      mapChanges: [
        { target: "ck-partner-a", ref: "Partner baseline · row A", label: "2 cohorts · 24 teams · €80,000 · 100 h", text: "Partner A: two cohorts, 24 target teams, €80,000 and 100 central hours.", overlays: [], evidence: SYN },
        { target: "ck-partner-b", ref: "Partner baseline · row B", label: "2 cohorts · 24 teams · €80,000 · 100 h", text: "Partner B: two cohorts, 24 target teams, €80,000 and 100 central hours.", overlays: [], evidence: SYN },
        { target: "ck-partner-c", ref: "Partner baseline · row C", label: "1 cohort · 12 teams · €40,000 · 50 h", text: "Partner C: one cohort, 12 target teams, €40,000 and 50 central hours.", overlays: [], evidence: SYN },
        { target: "ck-partner-d", ref: "Partner baseline · row D", label: "1 cohort · 12 teams · €40,000 · 50 h", text: "Partner D: one cohort, 12 target teams, €40,000 and 50 central hours.", overlays: [], evidence: SYN },
        { target: "ck-partners", ref: "Partner baseline · Total", label: "Rows A–D add up to the baseline", text: "The partner rows total six cohorts, 72 target teams, €240,000 and 300 central hours.", overlays: [], evidence: SYN },
        { target: "ck-local", ref: "Notes", label: "Staffing & in-kind not priced", text: "Partner staffing and in-kind contributions are unconfirmed and not priced.", overlays: ["missing-evidence"], evidence: SYN },
        { target: "ck-finance", ref: "Planning cap", label: "A planning cap, not a cash-flow schedule", text: "The cap is not a cash-flow schedule.", overlays: [], evidence: SYN },
        { target: "ck-cohorts", ref: "Notes", label: "Identical cohort costs (simplification)", text: "Identical cohort costs are a simplifying demo assumption.", overlays: [], evidence: "assumption" },
      ],
      ledgerChecks: [
        { target: "baseline", field: "cash", value: 240000, ref: "Partner baseline · Total" },
        { target: "baseline", field: "hours", value: 300, ref: "Partner baseline · Total" },
        { target: "baseline", field: "cohorts", value: 6, ref: "Partner baseline · Total" },
        { target: "baseline", field: "teams", value: 72, ref: "Partner baseline · Total" },
        { target: "cash", field: "cap", value: 300000, ref: "Planning cap" },
        { target: "hours", field: "cap", value: 420, ref: "Planning cap" },
        { target: "new-cohort", field: "cash", value: 30000, ref: "Candidate additions · One new cohort" },
        { target: "new-cohort", field: "hours", value: 50, ref: "Candidate additions · One new cohort" },
        { target: "new-cohort", field: "teams", value: 12, ref: "Candidate additions · One new cohort" },
        { target: "learning", field: "cash", value: 15000, ref: "Candidate additions · Shared learning and follow-up" },
        { target: "learning", field: "hours", value: 40, ref: "Candidate additions · Shared learning and follow-up" },
        { target: "readiness", field: "cash", value: 10000, ref: "Candidate additions · Partner-readiness and accessibility" },
        { target: "readiness", field: "hours", value: 20, ref: "Candidate additions · Partner-readiness and accessibility" },
      ],
      adds: { elements: [], relationships: [] },
    },
    {
      id: "CK-02", title: "Delivery and partner readiness review", fileName: "CK-02-delivery-partner-readiness.md", date: "2026-11-02", docType: "Review notes",
      scope: "Fictional partner perspectives; not a network survey.", owner: "Central programme (fictional)", synthetic: true,
      excerpt: "What each fictional partner says it would need before adding delivery, and a possible sponsor.",
      fullText: CK02,
      reading: {
        extracted: ["Conditions each partner (A–D) names for adding or consolidating delivery", "The programme lead's proposal for common milestones and a learning session", "A possible sponsor that has been discussed but not offered"],
        changes: ["Adds partner perspectives (stakeholder views) to Partners A–D", "Marks mentors, local requirements and the sponsor as pending — nothing is confirmed by this document", "Adds no budget figures: language-coach and venue costs are named but not priced"],
        affected: [],
        uncertainties: ["Not a network survey — four fictional perspectives", "No mentor is contracted", "Language-coach and venue costs are not priced", "No representative participation survey", "Reporting burden not measured", "The sponsor has made no offer"],
      },
      updates: [],
      signals: ["No mentors contracted yet", "Sponsor discussed — no offer"],
      mapChanges: [
        { target: "ck-partner-a", ref: "Partner perspectives · Partner A", label: "Could host if trained mentors are secured", text: "Partner A could host another cohort if trained mentors are secured before recruitment.", overlays: [], evidence: "stakeholder" },
        { target: "ck-mentors", ref: "Partner perspectives · Partner A", label: "2 interested · none contracted", text: "Two potential mentors are interested; neither is contracted.", overlays: ["pending"], evidence: "stakeholder" },
        { target: "ck-partner-b", ref: "Partner perspectives · Partner B", label: "Could host if a language coach & venue are confirmed", text: "Partner B could host another cohort if a local-language coach and a suitable venue are confirmed.", overlays: [], evidence: "stakeholder" },
        { target: "ck-local", ref: "Partner perspectives · Partner B", label: "Language coach & venue: not priced", text: "The costs of a local-language coach and a venue are not included in CK-01.", overlays: ["missing-evidence"], evidence: "stakeholder" },
        { target: "ck-partner-c", ref: "Partner perspectives · Partner C", label: "Prefers to consolidate & improve follow-up first", text: "Partner C prefers to consolidate and improve founder follow-up before adding delivery.", overlays: [], evidence: "stakeholder" },
        { target: "ck-r-founders-buyers", ref: "Partner perspectives · Partner C", label: "Buyer introductions not confirmed", text: "Proposed buyer introductions are not confirmed.", overlays: [], evidence: "stakeholder" },
        { target: "ck-partner-d", ref: "Partner perspectives · Partner D", label: "Needs remote coaching & travel / connectivity support", text: "Partner D reports a need for flexible remote coaching and clearer travel or connectivity support.", overlays: [], evidence: "stakeholder" },
        { target: "ck-access", ref: "Partner perspectives · Partner D", label: "No representative participation survey", text: "There is no representative participation survey.", overlays: ["missing-evidence"], evidence: "stakeholder" },
        { target: "ck-learning", ref: "Programme lead proposal", label: "Common milestones + local measures proposed", text: "The programme lead proposes common milestone definitions, a short check-in and a partner learning session, with room for local measures. Reporting burden has not been measured.", overlays: [], evidence: "stakeholder" },
        { target: "ck-sponsor", ref: "Funding", label: "Discussed · no offer made", text: "A possible €30,000 sponsor has been discussed but has not made or committed an offer. Not included in baseline funding.", overlays: ["pending"], evidence: "stakeholder" },
      ],
      ledgerChecks: [],
      adds: { elements: [], relationships: [] },
    },
    {
      id: "CK-03", title: "Learning, governance and impact note", fileName: "CK-03-learning-governance-impact.md", date: "2026-11-03", docType: "Proposal note",
      scope: "A fictional proposal, not Climate KIC policy.", owner: "Learning & impact (fictional)", synthetic: true,
      excerpt: "Proposed decision rights, practices, possible measures and what is unknown.",
      fullText: CK03,
      reading: {
        extracted: ["Proposed decision rights (central lead, finance, partners, learning lead, human sponsor)", "Proposed practices: readiness before recruitment, mentor escalation, accessible option, founder permission, learning reviews", "Possible measures, kept separate from adoption and climate outcomes"],
        changes: ["Adds the proposed decision rights to the decision connection", "Adds two proposed connections: a mentor-escalation route and founder permission before sharing venture information", "Marks consent arrangements and validated outcomes as unknown"],
        affected: [],
        uncertainties: ["A proposal, not policy", "Actual agreements, staffing and consent arrangements are unknown", "No inclusion baseline", "Long-term outcomes not validated"],
      },
      updates: [],
      signals: ["Decision rights only proposed"],
      mapChanges: [
        { target: "ck-r-lead-dec", ref: "Proposed decision rights", label: "Rights proposed, not verified", text: "The central lead proposes scope; finance checks funding; local partners shape delivery within agreed minimum standards; the learning lead proposes definitions and consent; an appropriate human sponsor makes the final decision.", overlays: [], evidence: "stakeholder" },
        { target: "ck-readiness", ref: "Proposed practices", label: "Check before recruitment (proposed)", text: "Check partner readiness before recruitment.", overlays: [], evidence: "stakeholder" },
        { target: "ck-access", ref: "Proposed practices", label: "Accessible participation option proposed", text: "Provide an accessible participation option.", overlays: [], evidence: "stakeholder" },
        { target: "ck-learning", ref: "Possible measures", label: "Activity, adoption & climate outcomes kept separate", text: "Possible measures: recruitment, completion, coaching delivered, founder-reported usefulness, follow-up requests, introductions accepted, pilots agreed and evidence of adoption. Keep programme activity, adoption and actual climate outcomes separate.", overlays: [], evidence: "stakeholder" },
        { target: "ck-climate", ref: "Unknown", label: "Long-term outcomes not validated", text: "Validated long-term outcomes are unknown.", overlays: ["missing-evidence"], evidence: "stakeholder" },
        { target: "ck-founders", ref: "Unknown", label: "Consent & inclusion baseline unknown", text: "Consent arrangements and inclusion baselines are unknown.", overlays: ["missing-evidence"], evidence: "stakeholder" },
      ],
      ledgerChecks: [],
      adds: {
        elements: [],
        relationships: [
          proposedRel("ck-s-escalation", "ck-mentors", "ck-hours", "Named mentor-escalation route (proposed)", "Proposed in CK-03 · Proposed practices. Not yet established."),
          proposedRel("ck-s-consent", "ck-founders", "ck-learning", "Founder permission before sharing venture information (proposed)", "Proposed in CK-03 · Proposed practices. Consent arrangements are unknown."),
        ],
      },
    },
  ],
  findings: [
    { id: "ck-f1", text: "Cash and specialist hours are separate limits", kind: "signal", evidence: SYN, confidence: "unknown", confidenceWhy: "", sourceIds: [], about: "ck-finance" },
    { id: "ck-f2", text: "Partner readiness not assessed; local costs not priced", kind: "signal", evidence: SYN, confidence: "unknown", confidenceWhy: "", sourceIds: [], about: "ck-readiness" },
    { id: "ck-f3", text: "Targets are planned capacity — not applications, participation, completions or achieved climate impact.", kind: "finding", evidence: SYN, confidence: "unknown", confidenceWhy: "", sourceIds: [], about: "ck-cohorts" },
  ],
  assumptions: [
    { id: "ck-a1", text: "The planning envelope and specialist hours cover one illustrative annual cycle.", basis: "Case boundary (synthetic)", sourceIds: [] },
    { id: "ck-a2", text: "A cohort is one distinct local batch; one partner can deliver more than one cohort.", basis: "Case boundary (synthetic)", sourceIds: [] },
    { id: "ck-a3", text: "The hosting partner of any new cohort is not decided.", basis: "Case boundary (synthetic)", sourceIds: [] },
  ],
  missingInfo: [
    { id: "ck-m1", title: "Actual partner agreements", why: "Whether a partner can host or add delivery depends on what has been agreed.", sharpens: "Partner readiness and the option comparison", status: "missing" },
    { id: "ck-m2", title: "Staffing (partners and mentors)", why: "New cohorts need people; staffing is unconfirmed and not priced.", sharpens: "Options A and B", status: "missing" },
    { id: "ck-m3", title: "Funding conditions", why: "Restrictions and timing decide what the envelope can actually pay for, and when.", sharpens: "Finance & flexible funding", status: "missing" },
    { id: "ck-m4", title: "Founder feedback", why: "Whether coaching and follow-up are useful is a founder-reported question.", sharpens: "Learning & impact, the founder-readiness route", status: "missing" },
    { id: "ck-m5", title: "Inclusion baselines", why: "Without a baseline, accessibility support cannot be compared with anything.", sharpens: "Local accessibility", status: "missing" },
    { id: "ck-m6", title: "Validated outcomes", why: "Adoption and climate outcomes are not evidenced; nothing is quantified.", sharpens: "Climate & equity outcomes", status: "missing" },
  ],
  limitations: [
    "Demonstration case: the organisation context draws on public information. The planning data, partners, scenarios and results are synthetic and illustrative.",
    "This is not an account of Climate KIC's operations, approved plans, finances, partners or people, and not a verified ClimateLaunchpad operating plan.",
    "Ozy is not used as a predictive simulation here: no probabilities, risk scores, impact numbers, ROI or CO₂ figures are calculated. Selecting a pathway does not make it feasible or successful. People remain responsible for decisions.",
    "Targets are capacity ceilings (planned places), not applications, participation, completions or achieved climate impact.",
    "Office locations are public information. The teams and roles inside the organisation are illustrative — not Climate KIC's actual structure — and no real person is represented.",
  ],
  notices: [],
  pathways: [
    {
      id: "ck-pw-a", title: "Expand quickly", summary: "Two new cohorts this cycle.",
      idea: "Use the remaining envelope for the greatest theoretical additional reach this cycle.",
      horizon: "One annual cycle", cost: "",
      needs: ["Hosting partners are ready before recruitment", "Trained mentors are secured for both new cohorts", "Local staffing and resources are confirmed and affordable"],
      conditions: ["No unplanned cost appears — there is no cash contingency", "Specialist time stays within what remains"],
      interventions: [], watch: "Readiness checks passed before recruitment; mentors contracted; local costs priced.", sourceIds: [],
      wins: [], risks: [],
      effects: [
        { target: "ck-cohorts", label: "+2 proposed cohorts (not approved)", tone: "neutral", direction: "", overlay: "" },
        { target: "ck-mentors", label: "Needed for 2 more cohorts · availability unconfirmed", tone: "mixed", direction: "", overlay: "missing-evidence" },
        { target: "ck-local", label: "Local staffing & resources unconfirmed", tone: "mixed", direction: "", overlay: "missing-evidence" },
        { target: "ck-readiness", label: "Readiness to confirm for 2 hosting partners", tone: "mixed", direction: "", overlay: "missing-evidence" },
        { target: "ck-learning", label: "No dedicated learning or readiness package", tone: "neutral", direction: "", overlay: "" },
      ],
      components: [{ componentId: "baseline", count: 1 }, { componentId: "new-cohort", count: 2 }],
      adds: {
        elements: [proposedCohort("ck-new-a1", "Proposed cohort A1", 50, 45), proposedCohort("ck-new-a2", "Proposed cohort A2", 72, 44)],
        relationships: [...cohortRels("ck-new-a1"), ...cohortRels("ck-new-a2")],
      },
      plan: [
        { id: "step-a-cohorts", title: "Recruit two additional cohorts", what: "Add two local cohorts this cycle, hosted by partners still to be decided.", showsOn: ["ck-new-a1", "ck-new-a2"], dependsOn: ["Hosting partners ready before recruitment", "Trained mentors secured", "Local staffing and venues confirmed"], evidence: ["Agreements with the hosting partners", "Priced local delivery requirements"] },
        { id: "step-a-mentors", title: "Secure trained mentors before recruitment", what: "Confirm and contract trained mentors for both new cohorts before recruitment opens.", showsOn: ["ck-mentors"], dependsOn: ["Mentors available where the new cohorts would run"], evidence: ["Mentor commitments"] },
        { id: "step-a-local", title: "Confirm local staffing and delivery requirements", what: "Confirm who delivers locally and what the venue, language and travel needs cost.", showsOn: ["ck-local", "ck-partners"], dependsOn: ["Partners share staffing and in-kind contributions"], evidence: ["Partner staffing plans", "Local cost estimates"] },
      ],
      tradeOff: "Most reach, but no cash contingency and no support packages.",
      evidenceNeeded: ["Signed partner agreements for the hosting partners", "Mentor commitments", "Priced local delivery requirements (venue, language, travel)"],
    },
    {
      id: "ck-pw-b", title: "Phased, supported growth", summary: "One new cohort, plus learning and readiness support.",
      idea: "Add some reach while funding the support that makes delivery and learning more dependable.",
      horizon: "One annual cycle", cost: "",
      needs: ["The hosting partner for the new cohort passes a readiness check before recruitment", "Mentors are secured for the new cohort", "Partners accept common milestone definitions"],
      conditions: ["Headroom is very limited — any unpriced local cost may not fit", "Partner resources remain conditional"],
      interventions: [], watch: "Readiness check before recruitment; founder-reported usefulness of follow-up; reporting burden on partners.", sourceIds: [],
      wins: [], risks: [],
      effects: [
        { target: "ck-cohorts", label: "+1 proposed cohort (not approved)", tone: "neutral", direction: "", overlay: "" },
        { target: "ck-readiness", label: "Unresolved — check before recruitment", tone: "mixed", direction: "", overlay: "missing-evidence" },
        { target: "ck-local", label: "Unpriced local requirements", tone: "mixed", direction: "", overlay: "missing-evidence" },
        { target: "ck-finance", label: "Very limited headroom", tone: "mixed", direction: "", overlay: "" },
      ],
      components: [{ componentId: "baseline", count: 1 }, { componentId: "new-cohort", count: 1 }, { componentId: "learning", count: 1 }, { componentId: "readiness", count: 1 }],
      adds: {
        elements: [proposedCohort("ck-new-b1", "Proposed cohort B1", 50, 45), LEARNING_PKG(27, 74), READINESS_PKG(72, 44)],
        relationships: [...cohortRels("ck-new-b1"), ...PACKAGE_RELS()],
      },
      plan: [
        { id: "step-b-cohort", title: "Add one cohort after a readiness check", what: "Add one local cohort, recruited only once the hosting partner has passed a readiness check.", showsOn: ["ck-new-b1"], dependsOn: ["Hosting partner ready before recruitment", "Mentors secured", "Local costs priced and affordable"], evidence: ["Readiness check result", "Mentor commitments", "Local cost estimate"] },
        STEP_LEARNING,
        STEP_READINESS,
      ],
      tradeOff: "Some reach with support, but very little headroom.",
      evidenceNeeded: ["Readiness check for the hosting partner", "Priced local requirements for the new cohort", "Partner feedback on common milestones"],
    },
    {
      id: "ck-pw-c", title: "Strengthen first", summary: "No new cohort; strengthen learning and readiness first.",
      idea: "Strengthen learning, readiness and accessibility in existing delivery before adding cohorts.",
      horizon: "One annual cycle", cost: "",
      needs: ["Partners take part in readiness checks and the learning session", "Founders give permission before venture information is shared"],
      conditions: ["Expansion is deferred to a later cycle — a trade-off, not a failure"],
      interventions: [], watch: "Founder-reported usefulness of follow-up; partner feedback on readiness checks; participation by access need (once a baseline exists).", sourceIds: [],
      wins: [], risks: [],
      effects: [
        { target: "ck-cohorts", label: "No new cohort this cycle (deferred, a trade-off)", tone: "neutral", direction: "", overlay: "" },
        { target: "ck-readiness", label: "Readiness support proposed", tone: "proposed", direction: "", overlay: "" },
      ],
      components: [{ componentId: "baseline", count: 1 }, { componentId: "learning", count: 1 }, { componentId: "readiness", count: 1 }],
      adds: {
        elements: [LEARNING_PKG(27, 74), READINESS_PKG(72, 44)],
        relationships: PACKAGE_RELS(),
      },
      plan: [
        STEP_LEARNING,
        STEP_READINESS,
        { id: "step-c-review", title: "Revisit expansion for a later cycle", what: "Use this cycle's readiness and learning evidence to decide whether, where and how to add cohorts later.", showsOn: ["ck-decision"], dependsOn: ["Learning reviewed after each cohort"], evidence: ["Learning review after each cohort", "Readiness check results"] },
      ],
      tradeOff: "Most headroom, but expansion waits — a trade-off, not a failure.",
      evidenceNeeded: ["Partner feedback on readiness checks", "Founder-reported usefulness of follow-up", "An inclusion baseline to compare against later"],
    },
  ],
  outcomeEstimate: null,
  scenarios: [
    {
      id: "ck-st-online", kind: "stress-test", combinable: false,
      question: "Move one existing cohort online",
      assumptions: [
        "Invented quick change, not an estimate: one existing cohort runs fully online instead of in a venue.",
        "It saves that cohort's venue and travel — an invented amount, applied once.",
        "No change to central specialist hours, cohorts or target places.",
      ],
      effects: [
        { target: "ck-access", label: "Connectivity may shut some founders out", tone: "risk", direction: "", overlay: "possible-risk" },
        { target: "ck-mentors", label: "Remote coaching — fit not confirmed", tone: "mixed", direction: "", overlay: "missing-evidence" },
        { target: "ck-local", label: "Less venue and travel need for one cohort", tone: "benefit", direction: "", overlay: "" },
      ],
      adjustments: [{ label: "Venue and travel saved for one cohort (assumed)", constraintId: "cash", amount: -4000, target: "total", componentId: "", per: "once", note: "Invented amount, not an estimate." }],
      adds: { elements: [], relationships: [] },
      highlight: ["ck-r-access-founders", "ck-r-mentors-cohorts", "ck-r-local-ready"],
      unchanged: ["Central specialist hours", "Number of cohorts and target places", "Partner agreements"],
      requiresComponent: "",
      keywords: ["online", "remote", "virtual", "digital", "hybrid", "video", "zoom", "no venue", "move a cohort", "move one cohort"],
    },
    {
      id: "ck-st-demoday", kind: "stress-test", combinable: false,
      question: "Host a buyer demo day",
      assumptions: [
        "Invented quick change, not an estimate: one demo day where founder teams meet challenge owners.",
        "It costs an invented amount of cash and central specialist time, once.",
        "Introductions become possible, not guaranteed — buyers decide independently.",
      ],
      effects: [
        { target: "ck-buyers", label: "More introductions possible — not guaranteed", tone: "mixed", direction: "", overlay: "" },
        { target: "ck-founders", label: "Teams must be ready to pitch", tone: "mixed", direction: "", overlay: "missing-evidence" },
      ],
      adjustments: [
        { label: "Demo day (assumed)", constraintId: "cash", amount: 6000, target: "total", componentId: "", per: "once", note: "Invented amount, not an estimate." },
        { label: "Organising the demo day (assumed)", constraintId: "hours", amount: 12, target: "total", componentId: "", per: "once", note: "Invented amount, not an estimate." },
      ],
      adds: {
        elements: [el("ck-sc-demoday", "Buyer demo day", "intervention", "proposed", 92, 37, { layer: "list", near: "ck-buyers", evidence: "illustrative", note: "A one-day event where founder teams pitch to challenge owners. An assumption in this scenario.", unknowns: ["Which buyers would come", "Which founder teams are ready to pitch"] })],
        relationships: [
          rel("ck-sc-r-founders", "ck-founders", "ck-sc-demoday", "Teams pitch (assumed)", { state: "uncertain", evidence: "illustrative" }),
          rel("ck-sc-r-buyers", "ck-sc-demoday", "ck-buyers", "Possible introductions — not guaranteed", { state: "uncertain", evidence: "illustrative" }),
        ],
      },
      highlight: ["ck-r-founders-buyers", "ck-r-fin-dec"],
      unchanged: ["Number of cohorts and target places", "Pilots or adoption — a buyer decides that independently"],
      requiresComponent: "",
      keywords: ["demo day", "demo", "pitch", "showcase", "buyer", "buyers", "investor", "event", "matchmaking", "challenge owner"],
    },
    {
      id: "ck-st-checkins", kind: "stress-test", combinable: false,
      question: "Add monthly check-ins with partners",
      assumptions: [
        "Invented quick change, not an estimate: a short monthly check-in between the central team and each partner.",
        "It uses about two central specialist hours a month (24 hours in the cycle) — an invented amount.",
        "No extra cash.",
      ],
      effects: [
        { target: "ck-learning", label: "More regular partner feedback", tone: "benefit", direction: "", overlay: "" },
        { target: "ck-partners", label: "Reporting burden rises — not measured", tone: "mixed", direction: "", overlay: "missing-evidence" },
      ],
      adjustments: [{ label: "Monthly partner check-ins (assumed)", constraintId: "hours", amount: 24, target: "total", componentId: "", per: "once", note: "Invented amount, not an estimate." }],
      adds: { elements: [], relationships: [] },
      highlight: ["ck-r-learning-partners", "ck-r-hours-partners"],
      unchanged: ["Cash", "Number of cohorts and target places"],
      requiresComponent: "",
      keywords: ["check-in", "check in", "checkin", "meeting", "monthly", "call", "calls", "coordination", "reporting", "sync"],
    },
    {
      id: "ck-st-sponsor", kind: "stress-test", combinable: false,
      question: "The discussed sponsor funding arrives",
      assumptions: [
        "Scenario assumption, not a fact: the discussed sponsor signs, the money is eligible for this exact use and it is received in time.",
        "Kept separate from the baseline envelope.",
      ],
      effects: [
        { target: "ck-sponsor", label: "Assumed signed, eligible and received (scenario)", tone: "neutral", direction: "", overlay: "" },
      ],
      adjustments: [{ label: "Conditional sponsor (assumed signed, eligible, received in time)", constraintId: "cash", amount: 30000, target: "cap", componentId: "", per: "once", note: "Scenario assumption only — never part of the baseline." }],
      adds: { elements: [], relationships: [] },
      highlight: ["ck-r-sponsor-fin", "ck-r-fin-dec"],
      unchanged: ["Central specialist hours — the sponsor adds none", "Mentor contracts", "Partner readiness", "Founder or climate outcomes"],
      requiresComponent: "",
      keywords: ["sponsor", "funding", "funder", "grant", "money", "donor", "extra budget", "more budget", "30,000", "30000"],
    },
  ],
  planning: {
    period: "Illustrative future annual cycle (12 months)",
    note: "Synthetic planning baseline for a fictional subset of four local delivery partners and six existing cohorts.",
    notes: [
      "Cash and specialist hours are separate constraints; they are never added together.",
      "Targets are planned capacity, not applications, participation, completions or achieved climate impact.",
      "Local delivery requirements are not priced in the baseline.",
      "No sponsor funding is included in any baseline total.",
    ],
    constraints: [
      { id: "cash", label: "Flexible planning envelope", unit: "", prefix: "€", cap: 300000, elementId: "ck-finance", note: "Planning cap for the cycle.", evidence: SYN, sourceIds: [] },
      { id: "hours", label: "Central specialist hours", unit: "hours", prefix: "", cap: 420, elementId: "ck-hours", note: "Available central specialist time for the cycle.", evidence: SYN, sourceIds: [] },
    ],
    metrics: [
      { id: "partners", label: "Local delivery partners", unit: "", note: "Fictional partners A–D.", elementId: "" },
      { id: "cohorts", label: "Cohorts", unit: "", note: "A cohort is one distinct local batch.", elementId: "ck-cohorts" },
      { id: "teams", label: "Target founder teams", unit: "", note: "Capacity ceiling — not applications, participation, completions or impact.", elementId: "ck-cohorts" },
    ],
    components: [
      { id: "baseline", label: "Existing commitments (six cohorts, partners A–D)", kind: "baseline", costs: [{ constraintId: "cash", amount: 240000 }, { constraintId: "hours", amount: 300 }], adds: [{ metricId: "partners", amount: 4 }, { metricId: "cohorts", amount: 6 }, { metricId: "teams", amount: 72 }], note: "Committed baseline cost and specialist time.", evidence: SYN, sourceIds: [] },
      { id: "new-cohort", label: "New cohort", kind: "candidate", costs: [{ constraintId: "cash", amount: 30000 }, { constraintId: "hours", amount: 50 }], adds: [{ metricId: "cohorts", amount: 1 }, { metricId: "teams", amount: 12 }], note: "Hosting partner not decided.", evidence: SYN, sourceIds: [] },
      { id: "learning", label: "Shared learning & follow-up package", kind: "candidate", costs: [{ constraintId: "cash", amount: 15000 }, { constraintId: "hours", amount: 40 }], adds: [], note: "", evidence: SYN, sourceIds: [] },
      { id: "readiness", label: "Partner-readiness & accessibility package", kind: "candidate", costs: [{ constraintId: "cash", amount: 10000 }, { constraintId: "hours", amount: 20 }], adds: [], note: "", evidence: SYN, sourceIds: [] },
    ],
  },
  impactRoutes: [
    {
      id: "ck-route-founder", title: "Founder readiness", note: "Each arrow is a question to validate, not a guaranteed result.",
      steps: [
        { label: "Accessible recruitment", nodeId: "ck-access", question: "Can the people the programme is for actually take part?", evidence: "No inclusion baseline or participation survey." },
        { label: "Appropriate coaching", nodeId: "ck-mentors", question: "Are trained mentors available where cohorts run?", evidence: "Mentor availability unconfirmed." },
        { label: "Clearer proposition and evidence", nodeId: "ck-founders", question: "Do founders report that coaching sharpened their proposition and evidence?", evidence: "No founder feedback in the model." },
        { label: "Ready to approach a buyer or investor", nodeId: "ck-buyers", question: "Are founders ready — by their own and the buyer's judgement — to approach a buyer or investor?", evidence: "Not evidenced." },
      ],
    },
    {
      id: "ck-route-adoption", title: "Local adoption", note: "Adoption is an independent decision by the buyer.",
      steps: [
        { label: "Potential introduction", nodeId: "ck-buyers", question: "Is an introduction accepted by a challenge owner?", evidence: "Buyer introductions not confirmed." },
        { label: "Pilot scoping", nodeId: "ck-adoption", question: "Is a pilot scoped with clear terms?", evidence: "No pilots in the model." },
        { label: "Procurement, funding and technical conditions", nodeId: "ck-buyers", question: "Do procurement, funding and technical conditions allow a pilot?", evidence: "Procurement conditions unknown." },
        { label: "Pilot learning", nodeId: "ck-learning", question: "What did the pilot show, and who interprets it?", evidence: "Not evidenced." },
        { label: "Independent adoption decision", nodeId: "ck-adoption", question: "Does the buyer decide, independently, to adopt?", evidence: "Not evidenced." },
      ],
    },
    {
      id: "ck-route-learning", title: "System learning", note: "A small shared evidence core plus local insight.",
      steps: [
        { label: "Shared evidence core + local insights", nodeId: "ck-learning", question: "Which few measures do all partners share, and which stay local?", evidence: "Proposed in CK-02 / CK-03 — not agreed." },
        { label: "Joint interpretation", nodeId: "ck-partners", question: "Do partners and the central team interpret results together?", evidence: "Not in the model." },
        { label: "Adjustments", nodeId: "ck-decision", question: "What changes as a result, and who decides?", evidence: "Decision rights proposed, not verified." },
        { label: "Testing in later cohorts", nodeId: "ck-cohorts", question: "Are adjustments tested in later cohorts?", evidence: "Not evidenced." },
      ],
    },
    {
      id: "ck-route-climate", title: "Climate and equity", note: "No climate quantities can be calculated from this case.",
      steps: [
        { label: "Adoption", nodeId: "ck-adoption", question: "Is a solution actually adopted and used?", evidence: "Not evidenced." },
        { label: "May enable mitigation, adaptation or circularity", nodeId: "ck-climate", question: "Against which baseline, and with what actual use?", evidence: "Not quantified." },
        { label: "Benefits and harms depend on distribution", nodeId: "ck-communities", question: "Who benefits, who bears harms, and were they heard?", evidence: "Affected communities not yet heard." },
      ],
    },
  ],
};
