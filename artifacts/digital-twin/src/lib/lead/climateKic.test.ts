/**
 * Climate KIC demonstration preset: exact resource arithmetic, order-independent
 * and idempotent evidence, distinct pathway map states, quick changes that work
 * with or without a pathway and never leak into the baseline, and no
 * unsupported claims.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { CLIMATE_KIC_PRESET } from "./presets/climateKic";
import { createCaseFromPreset } from "./presets";
import { normaliseLeadCase } from "./blank";
import { validateLeadCase } from "./validate";
import { activePathways, keySignals, matchScenarios } from "./derive";
import { toWorldCase } from "./engineCase";
import { activeStressTests, baselineLedger, ledgerCheckResults, pathwayLedger, toggleStressTest, type Ledger } from "./planning";
import { buildBriefText } from "./brief";
import { buildMapState, engineEffects, type MapStage } from "./mapState";
import { applySource, createCase, getActiveCaseId, getCase, getProgress, listCases, saveCase, setActiveCaseId } from "./store";
import { applyStartCase } from "./startCase";
import type { LeadCase, LeadProgress } from "./types";

const lead: LeadCase = normaliseLeadCase(JSON.parse(JSON.stringify(CLIMATE_KIC_PRESET)));
const P = (applied: string[] = [], pick: string | null = null, stress: string[] = []): LeadProgress => ({ appliedSources: applied, pathwayPick: pick, timelineMonth: 12, stressTests: stress });
const pw = (id: string) => lead.pathways.find((p) => p.id === id)!;
const t = (l: Ledger | null, id: string) => l!.totals.find((x) => x.constraint.id === id)!;
const m = (l: Ledger | null, id: string) => l!.metrics.find((x) => x.metric.id === id)!.value;
const ONLINE = "ck-st-online", DEMO = "ck-st-demoday", CHECKINS = "ck-st-checkins", S2 = "ck-st-sponsor";
const stress = (...ids: string[]) => activeStressTests(lead, ids);

describe("Climate KIC preset — content", () => {
  it("is a valid case with no validation errors or warnings", () => {
    expect(validateLeadCase(lead)).toEqual([]);
  });

  it("prefills the onboarding fields and the case notice", () => {
    expect(lead.organisation.name).toBe("Climate KIC");
    expect(lead.presentation.orgType).toBe("network");
    expect(lead.decision.question).toMatch(/grow the network quickly, phase growth, or strengthen existing delivery first/);
    expect(lead.decision.rights[0]).toMatch(/proposed, not verified/i);
    expect(lead.caseNotice).toMatch(/synthetic and illustrative/);
    expect(lead.missingInfo.map((x) => x.title)).toEqual(["Actual partner agreements", "Staffing (partners and mentors)", "Funding conditions", "Founder feedback", "Inclusion baselines", "Validated outcomes"]);
  });

  it("has exactly three pathways, four quick changes and three SYNTHETIC sources", () => {
    expect(lead.scenarios.map((x) => x.id)).toEqual([ONLINE, DEMO, CHECKINS, S2]);
    expect(JSON.stringify(CLIMATE_KIC_PRESET)).not.toMatch(/translat/i);
    expect(activePathways(lead).map((p) => p.title)).toEqual(["Expand quickly", "Phased, supported growth", "Strengthen first"]);
    expect(lead.sources.map((s) => [s.id, s.synthetic])).toEqual([["CK-01", true], ["CK-02", true], ["CK-03", true]]);
    for (const p of lead.pathways) expect(p.plan.length).toBeLessThanOrEqual(3);
  });

  it("makes no unsupported forecasts or invented climate quantities", () => {
    const text = JSON.stringify(CLIMATE_KIC_PRESET);
    expect(text).not.toMatch(/\d+\s?%/); // no probabilities or percentages
    expect(text).not.toMatch(/tCO2|tonnes|kg CO|probabilit(y|ies) of|risk score:|likely to succeed|will succeed|guarantee[sd]? (success|impact)/i);
    // Every proposed element is marked proposed, never approved / delivering.
    for (const p of lead.pathways) for (const e of p.adds.elements) expect(["proposed"]).toContain(e.state);
  });
});

describe("Climate KIC — resource arithmetic", () => {
  it("baseline: €240,000 / 300 h committed, €60,000 and 120 h headroom, 4 partners, 6 cohorts, 72 teams", () => {
    const b = baselineLedger(lead);
    expect([t(b, "cash").allocated, t(b, "cash").cap, t(b, "cash").headroom]).toEqual([240000, 300000, 60000]);
    expect([t(b, "hours").allocated, t(b, "hours").cap, t(b, "hours").headroom]).toEqual([300, 420, 120]);
    expect([m(b, "partners"), m(b, "cohorts"), m(b, "teams")]).toEqual([4, 6, 72]);
  });

  it.each([
    ["ck-pw-a", 300000, 0, 400, 20, 8, 96],
    ["ck-pw-b", 295000, 5000, 410, 10, 7, 84],
    ["ck-pw-c", 265000, 35000, 360, 60, 6, 72],
  ])("%s: exact totals, headroom and capacity", (id, cash, cashHead, hours, hoursHead, cohorts, teams) => {
    const l = pathwayLedger(lead, pw(id));
    expect([t(l, "cash").allocated, t(l, "cash").headroom]).toEqual([cash, cashHead]);
    expect([t(l, "hours").allocated, t(l, "hours").headroom]).toEqual([hours, hoursHead]);
    expect([m(l, "cohorts"), m(l, "teams")]).toEqual([cohorts, teams]);
  });

  it("quick change · buyer demo day (+€6,000, +12 h): A €6,000 over, B €1,000 and 2 h over, C €29,000 left", () => {
    const [a, b, c] = ["ck-pw-a", "ck-pw-b", "ck-pw-c"].map((id) => pathwayLedger(lead, pw(id), stress(DEMO)));
    expect([t(a, "cash").allocated, t(a, "cash").headroom, t(a, "hours").headroom]).toEqual([306000, -6000, 8]);
    expect([t(b, "cash").allocated, t(b, "cash").headroom, t(b, "hours").headroom]).toEqual([301000, -1000, -2]);
    expect([t(c, "cash").allocated, t(c, "cash").headroom, t(c, "hours").headroom]).toEqual([271000, 29000, 48]);
    expect(c!.notApplied).toEqual([]);
  });

  it("quick change · monthly check-ins (+24 h, no cash) and · one cohort online (−€4,000)", () => {
    const [a, b, c] = ["ck-pw-a", "ck-pw-b", "ck-pw-c"].map((id) => pathwayLedger(lead, pw(id), stress(CHECKINS)));
    expect([t(a, "hours").headroom, t(b, "hours").headroom, t(c, "hours").headroom]).toEqual([-4, -14, 36]);
    expect([t(a, "cash").allocated, t(b, "cash").allocated, t(c, "cash").allocated]).toEqual([300000, 295000, 265000]);
    const online = pathwayLedger(lead, pw("ck-pw-a"), stress(ONLINE));
    expect([t(online, "cash").allocated, t(online, "cash").headroom, t(online, "hours").allocated]).toEqual([296000, 4000, 400]);
  });

  it("quick change · conditional sponsor: A €30,000 and B €35,000 cash headroom; no hours added; baseline untouched", () => {
    const [a, b] = ["ck-pw-a", "ck-pw-b"].map((id) => pathwayLedger(lead, pw(id), stress(S2)));
    expect([t(a, "cash").headroom, t(b, "cash").headroom]).toEqual([30000, 35000]);
    expect([t(a, "hours").headroom, t(b, "hours").headroom]).toEqual([20, 10]);
    expect(t(a, "cash").cap).toBe(300000);
    expect(t(baselineLedger(lead), "cash").available).toBe(300000);
  });

  it("a quick change is applied once, however often it is passed, and combines without double counting", () => {
    const demo = lead.scenarios.find((x) => x.id === DEMO)!, sponsor = lead.scenarios.find((x) => x.id === S2)!;
    expect(t(pathwayLedger(lead, pw("ck-pw-a"), [demo, demo]), "cash").allocated).toBe(306000);
    const both = pathwayLedger(lead, pw("ck-pw-a"), [demo, sponsor, demo]);
    expect([t(both, "cash").allocated, t(both, "cash").available, t(both, "cash").headroom]).toEqual([306000, 330000, 24000]);
  });
});

describe("Climate KIC — evidence documents", () => {
  const stateFor = (applied: string[], stage: MapStage = "evidence") => buildMapState(lead, P(applied), { stage, pathwayId: null, scenarioIds: [] });
  const fingerprint = (applied: string[]) => {
    const s = stateFor(applied);
    return JSON.stringify(s.nodes.map((n) => [n.id, [...n.overlays].sort(), n.marks.map((x) => `${x.by}|${x.ref}|${x.label}`).sort(), [...n.sourceIds].sort()]).sort())
      + JSON.stringify(s.edges.map((e) => [e.rel.id, e.marks.map((x) => `${x.by}|${x.ref}`).sort()]).sort());
  };

  it("each document works on its own, and any order gives the same map", () => {
    const all = fingerprint(["CK-01", "CK-02", "CK-03"]);
    for (const order of [["CK-03", "CK-01", "CK-02"], ["CK-02", "CK-03", "CK-01"], ["CK-01", "CK-03", "CK-02"]]) expect(fingerprint(order)).toBe(all);
    for (const one of ["CK-01", "CK-02", "CK-03"]) expect(stateFor([one]).sources.map((d) => d.id)).toEqual([one]);
  });

  it("a document added twice changes nothing (idempotent upload)", () => {
    expect(fingerprint(["CK-02", "CK-02"])).toBe(fingerprint(["CK-02"]));
  });

  it("nothing from a document appears before it is added, nor at the baseline stage", () => {
    const base = stateFor([], "baseline");
    expect(base.nodes.flatMap((n) => n.marks).filter((x) => x.kind === "source")).toEqual([]);
    expect(base.edges.some((e) => e.rel.id === "ck-s-escalation")).toBe(false);
    const withAll = stateFor(["CK-01", "CK-02", "CK-03"], "baseline");
    expect(withAll.stage).toBe("baseline");
    expect(withAll.nodes.flatMap((n) => n.marks).filter((x) => x.kind === "source")).toEqual([]);
  });

  it("CK-01 confirms the ledger (same snapshot, nothing added) and shows a conflict when the baseline was edited", () => {
    const checks = ledgerCheckResults(lead, lead.sources[0]);
    expect(checks.length).toBe(13);
    expect(checks.every((c) => c.match)).toBe(true);
    expect(t(baselineLedger(lead), "cash").allocated).toBe(240000); // not doubled by the upload
    const edited = JSON.parse(JSON.stringify(lead)) as LeadCase;
    edited.planning!.components[0].costs[0].amount = 250000;
    const bad = ledgerCheckResults(edited, edited.sources[0]).filter((c) => !c.match);
    expect(bad.map((c) => [c.stated, c.current])).toEqual([["€240,000", "€250,000"]]);
  });

  it("CK-02 alone adds qualitative, pending dependencies and no budget figures", () => {
    expect(lead.sources[1].ledgerChecks).toEqual([]);
    const s = stateFor(["CK-02"]);
    const node = (id: string) => s.nodes.find((n) => n.id === id)!;
    expect(node("ck-mentors").overlays).toContain("pending");
    expect(node("ck-sponsor").overlays).toContain("pending");
    expect(node("ck-mentors").el!.state).toBe("unknown"); // pending is not resolved
    expect(s.ledger!.totals.find((x) => x.constraint.id === "cash")!.cap).toBe(300000); // sponsor not counted
    expect(node("ck-partner-a").marks.map((x) => x.ref)).toEqual(["Partner perspectives · Partner A"]);
  });

  it("synthetic source signals are labelled synthetic, not observed", () => {
    const sig = keySignals(lead, P(["CK-02"])).filter((x) => x.src === "CK-02");
    expect(sig.length).toBe(2);
    expect(sig.every((x) => x.evidence === "synthetic")).toBe(true);
  });
});

describe("Climate KIC — pathways and quick changes on the map", () => {
  const S = (pathwayId: string | null, stage: MapStage, scenarioIds: string[] = [], applied: string[] = []) => buildMapState(lead, P(applied), { stage, pathwayId, scenarioIds });
  const ids = (s: ReturnType<typeof S>) => s.nodes.map((n) => n.id);
  const display = (s: ReturnType<typeof S>, id: string) => s.nodes.find((n) => n.id === id)!.display;

  it("A, B and C produce distinct map states with the right finance and hours displays", () => {
    const a = S("ck-pw-a", "pathway"), b = S("ck-pw-b", "pathway"), c = S("ck-pw-c", "pathway");
    expect(ids(a)).toEqual(expect.arrayContaining(["ck-new-a1", "ck-new-a2"]));
    expect(ids(a)).not.toContain("ck-pkg-learning");
    expect(ids(b)).toEqual(expect.arrayContaining(["ck-new-b1", "ck-pkg-learning", "ck-pkg-ready"]));
    expect(ids(c)).toEqual(expect.arrayContaining(["ck-pkg-learning", "ck-pkg-ready"]));
    expect(ids(c).some((id) => id.startsWith("ck-new-"))).toBe(false);
    expect(display(a, "ck-finance")).toBe("€300,000 of €300,000 · €0 headroom");
    expect(display(a, "ck-hours")).toBe("400 hours of 420 hours · 20 hours headroom");
    expect(display(b, "ck-finance")).toBe("€295,000 of €300,000 · €5,000 headroom");
    expect(display(b, "ck-hours")).toBe("410 hours of 420 hours · 10 hours headroom");
    expect(display(c, "ck-finance")).toBe("€265,000 of €300,000 · €35,000 headroom");
    expect(display(c, "ck-hours")).toBe("360 hours of 420 hours · 60 hours headroom");
    expect(a.nodes.find((n) => n.id === "ck-finance")!.overlays).toContain("possible-risk"); // no cash contingency
    for (const s of [a, b]) for (const n of s.nodes.filter((x) => x.origin === "pathway")) expect(n.marks[0].label).toBe("Proposed");
  });

  it("switching pathways leaves nothing of the previous pathway behind and keeps the evidence", () => {
    const applied = ["CK-02"];
    const a = S("ck-pw-a", "pathway", [], applied), c = S("ck-pw-c", "pathway", [], applied);
    expect(ids(c).filter((id) => id.startsWith("ck-new-"))).toEqual([]);
    expect(c.nodes.flatMap((n) => n.marks).some((x) => x.by === "Expand quickly")).toBe(false);
    expect(c.nodes.find((n) => n.id === "ck-mentors")!.overlays).toContain("pending");
    expect(a.nodes.find((n) => n.id === "ck-mentors")!.overlays).toContain("pending");
  });

  it("a quick change works without a pathway: it is applied to the current plan", () => {
    const s = S(null, "future", [DEMO]);
    expect(s.stage).toBe("future");
    expect(s.pathway).toBeNull();
    expect(ids(s)).toContain("ck-sc-demoday");
    expect(display(s, "ck-finance")).toBe("€246,000 of €300,000 · €54,000 headroom");
    expect(display(s, "ck-hours")).toBe("312 hours of 420 hours · 108 hours headroom");
    expect(s.nodes.find((n) => n.id === "ck-buyers")!.marks.some((x) => x.kind === "scenario")).toBe(true);
    expect(s.edges.find((e) => e.rel.id === "ck-r-founders-buyers")!.highlight).toBe(true);
  });

  it("the same quick change on top of a pathway can tip it over — shown in red, only where it applies", () => {
    const a = S("ck-pw-a", "future", [CHECKINS]);
    expect(display(a, "ck-hours")).toBe("424 hours of 420 hours · 4 hours over");
    expect(display(a, "ck-finance")).toBe("€300,000 of €300,000 · €0 headroom");
    expect(a.nodes.find((n) => n.id === "ck-hours")!.overlays).toContain("possible-risk");
    expect(engineEffects(a).map["ck-hours"][1]).toBe("harm");
    const c = S("ck-pw-c", "future", [CHECKINS]);
    expect(display(c, "ck-hours")).toBe("384 hours of 420 hours · 36 hours headroom");
    expect(c.nodes.find((n) => n.id === "ck-hours")!.marks.some((x) => x.tone === "risk")).toBe(false);
  });

  it("moving a cohort online saves cash but turns local accessibility red", () => {
    const s = S(null, "future", [ONLINE]);
    expect(display(s, "ck-finance")).toBe("€236,000 of €300,000 · €64,000 headroom");
    expect(s.nodes.find((n) => n.id === "ck-access")!.marks.find((x) => x.kind === "scenario")!.tone).toBe("risk");
    expect(engineEffects(s).map["ck-access"][1]).toBe("harm");
  });

  it("the sponsor scenario is an assumption only and resolves neither hours nor readiness", () => {
    const b = S("ck-pw-b", "future", [S2], ["CK-02"]);
    expect(display(b, "ck-finance")).toBe("€295,000 of €330,000 · €35,000 headroom");
    expect(display(b, "ck-hours")).toBe("410 hours of 420 hours · 10 hours headroom");
    expect(b.nodes.find((n) => n.id === "ck-readiness")!.el!.state).toBe("unknown");
    expect(b.nodes.find((n) => n.id === "ck-mentors")!.overlays).toContain("pending");
    const back = S("ck-pw-b", "pathway", [S2]);
    expect(display(back, "ck-finance")).toBe("€295,000 of €300,000 · €5,000 headroom");
  });

  it("returning to the baseline leaves no pathway or scenario effects behind", () => {
    const s = S("ck-pw-a", "baseline", [DEMO, S2], ["CK-01"]);
    expect(s.stage).toBe("baseline");
    expect(s.nodes.flatMap((n) => n.marks)).toEqual([]);
    expect(s.changed).toEqual([]);
    expect(display(s, "ck-finance")).toBe("€240,000 of €300,000 · €60,000 headroom");
    expect(engineEffects(s).map).toEqual({});
  });

  it("unavailable stages fall back and say why", () => {
    const s = S(null, "future", []);
    expect(s.stage).toBe("baseline");
    expect(s.stages.find((x) => x.id === "future")!.why).toMatch(/Run one of the prepared scenarios first/);
    expect(s.stages.find((x) => x.id === "pathway")!.why).toMatch(/Preview or select a pathway first/);
    expect(s.stages.find((x) => x.id === "evidence")!.why).toMatch(/No documents added yet/);
  });
});

describe("Climate KIC — checks, toggles and the brief", () => {
  it("validation flags broken planning and map references", () => {
    const bad = JSON.parse(JSON.stringify(lead)) as LeadCase;
    bad.pathways[0].components.push({ componentId: "nope", count: 1 });
    bad.scenarios[0].adjustments[0].constraintId = "nowhere";
    bad.sources[1].mapChanges[0].target = "ghost";
    const msgs = validateLeadCase(bad).map((i) => `${i.level}: ${i.message}`).join("\n");
    expect(msgs).toMatch(/error: Expand quickly: unknown planning component \(nope\)/);
    expect(msgs).toMatch(/error: .*adjustment on an unknown constraint \(nowhere\)/);
    expect(msgs).toMatch(/Source CK-02: map change .* targets an unknown id \(ghost\)/);
  });

  it("quick changes are not combinable: switching one on switches the other off", () => {
    const one = toggleStressTest(lead, [], DEMO);
    expect(one).toEqual([DEMO]);
    expect(toggleStressTest(lead, one, S2)).toEqual([S2]);
    expect(toggleStressTest(lead, [S2], S2)).toEqual([]);
    expect(toggleStressTest(lead, [], "not-a-quick-change")).toEqual([]);
  });

  it("the brief shows derived resources for the selected pathway and labels selection as under consideration", () => {
    const text = buildBriefText(lead, P(["CK-01"], "ck-pw-b", [DEMO]));
    expect(text).toContain("Selected pathway (under consideration, not approved): Phased, supported growth");
    expect(text).toContain("Flexible planning envelope: €301,000 of €300,000 · €1,000 over");
    expect(text).toContain("Central specialist hours: 422 hours of 420 hours · 2 hours over");
    expect(text).toContain("Quick changes included (illustrative assumptions)");
    expect(text).toContain(lead.caseNotice);
  });
});

describe("Climate KIC — creating the case from the preset", () => {
  beforeEach(() => localStorage.clear());

  it("creates a new, separate case that is not shown in the demo until the team chooses to", () => {
    const a = createCaseFromPreset("climate-kic");
    const b = createCaseFromPreset("climate-kic");
    expect(a.id).not.toBe(b.id);
    expect(listCases()).toHaveLength(2);
    expect(getActiveCaseId()).toBeNull();
    expect(a.organisation.name).toBe("Climate KIC");
    expect(getProgress(a.id)).toEqual({ appliedSources: [], pathwayPick: null, timelineMonth: 12, stressTests: [] });
    expect(applySource(a.id, "CK-01")).toBe(true);
    expect(applySource(a.id, "CK-01")).toBe(false);
    expect(getProgress(a.id).appliedSources).toEqual(["CK-01"]);
  });
});

describe("Climate KIC — opening straight into the case (VITE_START_CASE)", () => {
  beforeEach(() => localStorage.clear());

  it("does nothing without the setting or with an unknown preset", async () => {
    await applyStartCase(undefined);
    await applyStartCase("");
    await applyStartCase("not-a-preset");
    expect(listCases()).toEqual([]);
    expect(getActiveCaseId()).toBeNull();
  });

  it("creates the Climate KIC case once per browser and shows it in the demo", async () => {
    await applyStartCase("climate-kic");
    const id = getActiveCaseId();
    expect(getCase(id)!.organisation.name).toBe("Climate KIC");
    expect(getCase(id)!.scenarios).toHaveLength(4);
    await applyStartCase("climate-kic");
    expect(listCases()).toHaveLength(1);
    expect(getActiveCaseId()).toBe(id);
  });

  it("accepts the preset id as typed in a dashboard (\"Climate KIC\", \"climate_kic\")", async () => {
    await applyStartCase(" Climate KIC ");
    expect(getCase(getActiveCaseId())!.organisation.name).toBe("Climate KIC");
    await applyStartCase("climate_kic");
    expect(listCases()).toHaveLength(1);
  });

  it("never replaces a case the team chose in /prepare", async () => {
    const mine = createCase("Team case");
    setActiveCaseId(mine.id);
    await applyStartCase("climate-kic");
    expect(getActiveCaseId()).toBe(mine.id);
    expect(listCases()).toHaveLength(1);
  });

  it("replaces an outdated copy after the preset changes, starting with fresh demo progress", async () => {
    await applyStartCase("climate-kic");
    const old = getActiveCaseId()!;
    saveCase({ ...getCase(old)!, internalLabel: "Start case · climate-kic · oldversion" });
    applySource(old, "CK-01");
    await applyStartCase("climate-kic");
    const now = getActiveCaseId()!;
    expect(now).not.toBe(old);
    expect(getCase(old)).toBeNull();
    expect(listCases()).toHaveLength(1);
    expect(getProgress(now).appliedSources).toEqual([]);
  });
});

describe("Climate KIC — scenario box and island map", () => {
  it("typed text is matched to a prepared scenario; anything else matches nothing", () => {
    expect(matchScenarios(lead, "move a cohort online")[0].scenario.id).toBe(ONLINE);
    expect(matchScenarios(lead, "what if we host a demo day for buyers")[0].scenario.id).toBe(DEMO);
    expect(matchScenarios(lead, "monthly check-ins with partners")[0].scenario.id).toBe(CHECKINS);
    expect(matchScenarios(lead, "what if the sponsor money arrives")[0].scenario.id).toBe(S2);
    expect(matchScenarios(lead, "hire a new CEO")).toEqual([]);
  });

  it("maps to an islands world: HQ in Amsterdam, offices on the inner ring, programme and partners outside", () => {
    const w = toWorldCase(lead);
    expect(w.theme).toBe("isles");
    expect(w.org.shape).toBe("city-amsterdam");
    const inner = w.places.filter((p) => p.ring === "inner").map((p) => p.label);
    expect(inner).toEqual(["Brussels office", "Milan office", "Warsaw office", "Valencia office", "London office", "Vienna info point", "Copenhagen info point", "Paris info point", "Berlin info point"]);
    expect(w.places.find((p) => p.id === "ck-office-paris")!.shape).toBe("city-paris");
    expect(w.places.filter((p) => p.ring === "outer").map((p) => p.id)).toEqual(expect.arrayContaining(["ck-cohorts", "ck-partner-a", "ck-mentors", "ck-sponsor"]));
  });

  it("the island map shows one ecosystem: partners, offices, the programme and founders link to each other, not only to HQ", () => {
    const w = toWorldCase(lead);
    const placeIds = new Set(w.places.map((p) => String(p.id)));
    const between = w.ties.filter(([a, b]) => placeIds.has(a) && placeIds.has(b));
    expect(between.length).toBeGreaterThanOrEqual(20);
    expect(between.some(([a, b]) => a === "ck-office-brussels" && b === "ck-partner-a")).toBe(true);
    expect(between.some(([a, b]) => a === "ck-partner-a" && b === "ck-cohorts")).toBe(true);
    expect(between.filter(([a, b]) => a.startsWith("ck-office-") && b.startsWith("ck-office-")).length).toBe(5);
    expect(lead.relationships.filter((r) => r.from.startsWith("ck-office-")).every((r) => r.evidence === "illustrative")).toBe(true);
  });

  it("teams become islands at the meso level, with role-to-role links at the micro level (roles, not people)", () => {
    const w = toWorldCase(lead);
    expect(w.floors).toHaveLength(9);
    const central = w.floors.find((f) => f.id === "team-ck-central")!;
    expect(central.staffKnown).toBe(false);
    expect(central.roles.length).toBeGreaterThanOrEqual(6);
    expect(central.ties.length).toBeGreaterThan(0);
    expect(central.ties.every(([a, b]) => a >= 0 && b >= 0 && a !== b)).toBe(true);
  });

  it("offices are on the map and list but not drawn in the systems view (no position)", () => {
    const office = lead.elements.find((e) => e.id === "ck-office-brussels")!;
    expect(office.pos).toBeNull();
    expect(office.layer).toBe("macro");
  });
});
