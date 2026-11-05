import { describe, expect, it } from "vitest";
import { GLYPH_IDS } from "@/components/visuals/Glyph";
import { CATEGORIES, CONNECTION_TYPES, ELEMENT_TYPES, EVIDENCE_TYPES, OVERLAYS, getState, strokeForFrequency } from "./registry";

describe("visual registry", () => {
  it("covers all five categories from the spec", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(["people-places", "flows-environment", "dynamics", "money-goals-risk", "evidence-time"]);
    for (const c of CATEGORIES) expect(ELEMENT_TYPES.filter((e) => e.category === c.id).length).toBeGreaterThan(5);
  });

  it("has unique ids and a drawn glyph for every element", () => {
    const ids = ELEMENT_TYPES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ELEMENT_TYPES) expect(GLYPH_IDS).toContain(e.glyph);
  });

  it("gives every element an unknown state that is never positive/green", () => {
    for (const e of ELEMENT_TYPES) {
      expect(e.states[0].id).toBe("unknown");
      expect(e.states[0].t.tone).toBe("unknown");
      expect(e.states[0].t.badge).toBe("question");
      expect(e.states.length).toBeGreaterThan(1);
    }
    expect(getState("facility", undefined).id).toBe("unknown");
    expect(getState("facility", "not-a-state").id).toBe("unknown");
    expect(getState("not-a-type", "operating").id).toBe("unknown");
  });

  it("contains no universal numeric thresholds in state labels", () => {
    for (const e of ELEMENT_TYPES) for (const s of e.states) expect(s.label).not.toMatch(/\d/);
  });

  it("separates possible risk, active problem and literal fire", () => {
    const risk = OVERLAYS.find((o) => o.id === "possible-risk")!;
    const prob = OVERLAYS.find((o) => o.id === "active-problem")!;
    const fire = OVERLAYS.find((o) => o.id === "literal-fire")!;
    expect(risk.badge).toBe("warning");
    expect(prob.badge).toBe("flame");
    expect(prob.meaning).toMatch(/not a literal fire/i);
    expect(fire.label).toMatch(/literal/i);
    expect(new Set([risk.label, prob.label, fire.label]).size).toBe(3);
  });

  it("has no privacy- or safety-omission overlay", () => {
    for (const o of OVERLAYS) expect(`${o.id} ${o.label} ${o.meaning}`).not.toMatch(/omit|redact|withheld|privacy/i);
  });

  it("only thickens connections when frequency is known", () => {
    expect(strokeForFrequency("unknown")).toBe(strokeForFrequency("low"));
    expect(strokeForFrequency("high")).toBeGreaterThan(strokeForFrequency("medium"));
    for (const c of CONNECTION_TYPES) expect(c.states[0].id).toBe("unknown");
  });

  it("keeps the evidence types visually distinct (synthetic baseline is not 'observed')", () => {
    expect(EVIDENCE_TYPES.map((e) => e.id)).toEqual(["observed", "synthetic", "stakeholder", "assumption", "illustrative"]);
    expect(new Set(EVIDENCE_TYPES.map((e) => e.pattern)).size).toBe(5);
  });

  it("marks attributed dynamics as needing a holder", () => {
    for (const id of ["culture", "trust", "tension", "sentiment", "voice", "speaking-up"]) expect(ELEMENT_TYPES.find((e) => e.id === id)!.attributed).toBe(true);
  });
});
