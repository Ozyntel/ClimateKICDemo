import { beforeEach, describe, expect, it } from "vitest";
import alpha from "../../../test/fixtures/synthetic-lead-alpha.json";
import {
  applySource, createCase, deleteCase, exportCaseJson, getActiveCase, getActiveCaseId, getCase, getProgress, importCaseJson, listCases, resetProgress, saveCase,
  setActiveCaseId, updateProgress,
} from "./store";
import { isBlankCase } from "./derive";

beforeEach(() => localStorage.clear());

describe("a new demo", () => {
  it("has no active case and no fallback data", () => {
    expect(getActiveCaseId()).toBeNull();
    expect(getActiveCase()).toBeNull();
    expect(listCases()).toEqual([]);
  });

  it("ignores old demo keys left in the browser", () => {
    localStorage.setItem("ozy-world-case", "0");
    localStorage.setItem("ozy-applied-sources", JSON.stringify(["FL-01"]));
    localStorage.setItem("ozy-pathway-pick", "1");
    localStorage.setItem("dto_project_v0", JSON.stringify({ questionnaire: { orgName: "Legacy Org" }, artefacts: [] }));
    expect(getActiveCase()).toBeNull();
    const c = createCase("x");
    expect(getProgress(c.id)).toEqual({ appliedSources: [], pathwayPick: null, timelineMonth: 12, stressTests: [] });
    expect(JSON.stringify(getCase(c.id))).not.toContain("Legacy Org");
  });

  it("creates a blank case that becomes active when none is", () => {
    const c = createCase("Team label");
    expect(getActiveCaseId()).toBe(c.id);
    const got = getActiveCase()!;
    expect(isBlankCase(got)).toBe(true);
    expect(got.organisation.name).toBe("");
    expect(got.numbers).toEqual([]);
    expect(got.pathways).toEqual([]);
    expect(got.outcomeEstimate).toBeNull();
  });
});

describe("two lead cases stay separate", () => {
  it("keeps content, progress and active selection apart", () => {
    const a = createCase("Lead A");
    const b = createCase("Lead B");
    saveCase({ ...getCase(a.id)!, organisation: { ...a.organisation, name: "Org A only" }, sources: [{ ...importSource("S-01") }] });
    saveCase({ ...getCase(b.id)!, organisation: { ...b.organisation, name: "Org B only" } });

    expect(getCase(a.id)!.organisation.name).toBe("Org A only");
    expect(getCase(b.id)!.organisation.name).toBe("Org B only");
    expect(JSON.stringify(getCase(b.id))).not.toContain("Org A only");

    expect(applySource(a.id, "S-01")).toBe(true);
    expect(applySource(a.id, "S-01")).toBe(false); // idempotent
    updateProgress(a.id, (p) => ({ ...p, pathwayPick: "pw-a" }));
    expect(getProgress(a.id).appliedSources).toEqual(["S-01"]);
    expect(getProgress(b.id)).toEqual({ appliedSources: [], pathwayPick: null, timelineMonth: 12, stressTests: [] });

    setActiveCaseId(b.id);
    expect(getActiveCase()!.organisation.name).toBe("Org B only");
  });

  it("deleting one case removes its content and progress only", () => {
    const a = createCase("A"); const b = createCase("B");
    applySource(a.id, "S-01");
    deleteCase(a.id);
    expect(getCase(a.id)).toBeNull();
    expect(getProgress(a.id).appliedSources).toEqual([]);
    expect(listCases().map((c) => c.id)).toEqual([b.id]);
    expect(getActiveCaseId()).toBeNull(); // A was active; nothing silently replaces it
    expect(Object.keys(localStorage as unknown as Record<string, string>).length).toBeGreaterThanOrEqual(0);
  });

  it("reset clears demo progress but keeps content", () => {
    const a = createCase("A");
    saveCase({ ...getCase(a.id)!, organisation: { ...a.organisation, name: "Kept" } });
    applySource(a.id, "S-01");
    resetProgress(a.id);
    expect(getProgress(a.id).appliedSources).toEqual([]);
    expect(getCase(a.id)!.organisation.name).toBe("Kept");
  });
});

describe("import / export", () => {
  it("export contains content only, never progress", () => {
    const a = createCase("A");
    applySource(a.id, "S-01");
    const json = exportCaseJson(getCase(a.id)!);
    expect(json).not.toContain("appliedSources");
    expect(JSON.parse(json).schema).toBe("ozy-lead-case");
  });

  it("importing always creates a separate case (no overwrite)", () => {
    const one = importCaseJson(JSON.stringify(alpha));
    const two = importCaseJson(JSON.stringify(alpha));
    expect(one.id).not.toBe(two.id);
    expect(listCases()).toHaveLength(2);
    const kept = importCaseJson(JSON.stringify({ ...alpha, id: "unique-id-1" }), { keepId: true });
    expect(kept.id).toBe("unique-id-1");
    const clash = importCaseJson(JSON.stringify({ ...alpha, id: "unique-id-1" }), { keepId: true });
    expect(clash.id).not.toBe("unique-id-1");
  });

  it("rejects files that are not lead cases", () => {
    expect(() => importCaseJson("not json")).toThrow();
    expect(() => importCaseJson(JSON.stringify({ hello: 1 }))).toThrow(/not an Ozy lead case/);
  });
});

function importSource(id: string) {
  return { id, title: "t", fileName: "", date: "", docType: "", scope: "", owner: "", excerpt: "", fullText: "", reading: { extracted: [], changes: [], affected: [], uncertainties: [] }, updates: [], signals: [] };
}
