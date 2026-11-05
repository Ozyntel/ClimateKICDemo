/**
 * The development-only sample lead is a valid, complete case: no validation
 * errors, every page has something to show, and its uploads demonstrate a
 * conflict rather than silently picking a value.
 */
import { describe, expect, it } from "vitest";
import { SAMPLE_LEAD } from "@/dev/sampleLead";
import { normaliseLeadCase } from "@/lib/lead/blank";
import { validateLeadCase } from "@/lib/lead/validate";
import { activePathways, completeness, numbersWithUpdates, outcomeFor } from "@/lib/lead/derive";
import { toWorldCase } from "@/lib/lead/engineCase";

describe("dev sample lead", () => {
  const lead = normaliseLeadCase(JSON.parse(JSON.stringify(SAMPLE_LEAD)));

  it("has no validation errors or warnings", () => {
    expect(validateLeadCase(lead)).toEqual([]);
  });

  it("fills every section of the checklist and maps to the world engine", () => {
    expect(completeness(lead).filter((c) => !c.done).map((c) => c.label)).toEqual([]);
    expect(activePathways(lead)).toHaveLength(3);
    expect(outcomeFor(lead, "pw-1")).toBe(45);
    const w = toWorldCase(lead);
    expect(w.floors.length).toBe(3);
  });

  it("shows the two supplier sources as a conflict once both are uploaded", () => {
    const n = numbersWithUpdates(lead, { appliedSources: ["S-02", "S-03"], pathwayPick: null, timelineMonth: 0 }).find((x) => x.fact.id === "n-lead")!;
    expect(n.conflict?.map((c) => c.value)).toEqual(["21", "28"]);
  });
});
