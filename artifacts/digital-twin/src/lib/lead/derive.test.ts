import { describe, expect, it } from "vitest";
import alphaRaw from "../../../test/fixtures/synthetic-lead-alpha.json";
import betaRaw from "../../../test/fixtures/synthetic-lead-beta-partial.json";
import { BASELINE_LIMITATIONS, createBlankLeadCase, normaliseLeadCase } from "./blank";
import { buildBriefText } from "./brief";
import { activePathways, completeness, isBlankCase, keySignals, limitationsFor, numbersWithUpdates, openRisksAt12, orgName, outcomeFor } from "./derive";
import { toWorldCase } from "./engineCase";
import { validateLeadCase } from "./validate";
import type { LeadProgress } from "./types";

const alpha = normaliseLeadCase(alphaRaw);
const beta = normaliseLeadCase(betaRaw);
const P = (applied: string[] = [], pick: string | null = null): LeadProgress => ({ appliedSources: applied, pathwayPick: pick, timelineMonth: 12, stressTests: [] });

describe("empty, unknown and partial cases render safely", () => {
  it("blank case derives empty views with the fixed limitations", () => {
    const b = createBlankLeadCase();
    expect(isBlankCase(b)).toBe(true);
    expect(orgName(b)).toBe("Organisation (name not set)");
    expect(numbersWithUpdates(b, P())).toEqual([]);
    expect(keySignals(b, P())).toEqual([]);
    expect(activePathways(b)).toEqual([]);
    expect(limitationsFor(b)).toEqual([...BASELINE_LIMITATIONS]);
    expect(completeness(b).every((c) => !c.done)).toBe(true);
    expect(validateLeadCase(b).filter((i) => i.level === "error")).toEqual([]);
  });

  it("blank case maps to a valid, empty world for the map engine", () => {
    const w = toWorldCase(createBlankLeadCase());
    expect(w.org.label).toBe("Organisation (name not set)");
    expect(w.places).toEqual([]);
    expect(w.floors).toEqual([]);
    expect(w.options).toEqual([]);
    expect(w.theme).toBe("city");
  });

  it("partial file is normalised with blank defaults, unknown stays unknown", () => {
    expect(beta.organisation.name).toBe("Test Organisation Beta");
    expect(beta.numbers).toEqual([]);
    expect(beta.teams[1].headcount).toBeNull();
    expect(beta.elements[0].state).toBe("unknown");
    expect(beta.elements[0].confidence).toBe("unknown");
    const w = toWorldCase(beta);
    expect(w.theme).toBe("campus");
    expect(w.floors.map((f) => f.staffKnown)).toEqual([false, false]);
    expect(validateLeadCase(beta).filter((i) => i.level === "error")).toEqual([]);
  });

  it("an unknown number is shown as unknown, not zero", () => {
    const v = numbersWithUpdates(alpha, P()).find((n) => n.fact.id === "n-staff")!;
    expect(v.value).toBe("");
  });
});

describe("simulated uploads", () => {
  it("updates comparable numbers and keeps the baseline as history", () => {
    const v = numbersWithUpdates(alpha, P(["T-01"])).find((n) => n.fact.id === "n-cash")!;
    expect(v.value).toBe("90");
    expect(v.was).toBe("100");
    expect(v.updatedBy).toEqual(["T-01"]);
    expect(keySignals(alpha, P(["T-01"])).map((s) => s.text)).toContain("Alpha signal from T-01");
  });

  it("shows conflicting sources instead of choosing one", () => {
    const v = numbersWithUpdates(alpha, P(["T-01", "T-02"])).find((n) => n.fact.id === "n-cash")!;
    expect(v.conflict?.map((c) => c.value)).toEqual(["90", "95"]);
    expect(v.value).toBe("100"); // baseline kept until a person resolves it
  });

  it("ignores applied ids that are not sources of this case", () => {
    const v = numbersWithUpdates(alpha, P(["FL-01", "S-99"])).find((n) => n.fact.id === "n-cash")!;
    expect(v.value).toBe("100");
    expect(keySignals(alpha, P(["FL-01"])).map((s) => s.src)).not.toContain("FL-01");
  });
});

describe("populated case uses the reusable rules", () => {
  it("maps elements to map layers via the visual registry", () => {
    const w = toWorldCase(alpha);
    expect(w.places.map((p) => p.id)).toEqual(expect.arrayContaining(["el-site", "el-supplier"]));
    expect(w.far.map((p) => p.id)).toContain("el-rule");
    expect(w.global.map((p) => p.id)).toContain("el-heat");
    expect(w.forces).toEqual([{ label: "Alpha Culture", cat: "culture", near: "el-site" }]);
    expect(w.ties).toEqual([["el-supplier", "org", "none", "Supplies parts"]]);
    expect(w.inner.links.some((l) => l[2] === "tension")).toBe(true);
    expect(w.floors.find((f) => f.id === "team-ops")!.staffKnown).toBe(true);
    expect(w.options[0].hot).toEqual([{ near: "el-site", label: "Alpha effect one" }]);
  });

  it("unknown element state is labelled as unknown on the map, not as safe", () => {
    const place = toWorldCase(alpha).far.find((p) => p.id === "el-rule");
    expect(place).toBeTruthy();
    const site = toWorldCase({ ...alpha, elements: alpha.elements.map((e) => (e.id === "el-site" ? { ...e, state: "unknown" } : e)) }).places.find((p) => p.id === "el-site")!;
    expect((site.view as { word: string }).word).toBe("State unknown");
  });

  it("outcome estimates appear only when entered", () => {
    expect(outcomeFor(alpha, "pw-1")).toBe(40);
    expect(outcomeFor(alpha, "pw-2")).toBeNull();
    expect(outcomeFor({ ...alpha, outcomeEstimate: null }, "pw-1")).toBeNull();
  });

  it("risk is a plain count, never a banded level", () => {
    expect(openRisksAt12(alpha.pathways[0])).toBe(1);
    expect(openRisksAt12(alpha.pathways[1])).toBe(0);
  });

  it("populated fixture passes validation without errors", () => {
    expect(validateLeadCase(alpha).filter((i) => i.level === "error")).toEqual([]);
  });
});

describe("exports contain only the active case", () => {
  it("brief text for one case never mentions another", () => {
    const a = buildBriefText(alpha, P(["T-01"], "pw-1"));
    const b = buildBriefText(beta, P());
    expect(a).toContain("Test Organisation Alpha");
    expect(a).toContain("Limitations of this baseline");
    expect(a).toContain("Illustrative demo results");
    expect(b).toContain("Test Organisation Beta");
    for (const s of ["Alpha", "T-01", "pw-1"]) expect(b).not.toContain(s);
  });

  it("blank brief has empty states, no invented content", () => {
    const t = buildBriefText(createBlankLeadCase(), P());
    expect(t).toContain("Decision: not written down yet");
    expect(t).toContain("Selected pathway: none yet");
    expect(t).toContain("- None added yet");
  });
});

describe("validation", () => {
  it("flags broken references, duplicates and missing holders", () => {
    const bad = normaliseLeadCase({
      ...alphaRaw,
      elements: [...alphaRaw.elements, { ...alphaRaw.elements[0] }, { id: "el-x", label: "Mood", visual: "sentiment", state: "concern" }],
      relationships: [{ id: "rz", from: "nope", to: "org", type: "dependency" }],
    });
    const msgs = validateLeadCase(bad).map((i) => i.message).join("\n");
    expect(msgs).toMatch(/Duplicate ids/);
    expect(msgs).toMatch(/needs a holder/);
    expect(msgs).toMatch(/not an element, team or the organisation/);
  });
});
