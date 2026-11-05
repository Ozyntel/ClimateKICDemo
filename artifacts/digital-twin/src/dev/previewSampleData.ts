/**
 * SYNTHETIC SAMPLE DATA — VISUAL PREVIEW ONLY.
 *
 * Neutral, made-up placeholders used solely by /dev/visual-preview to show
 * how the visual vocabulary looks. Not a use case, not a lead, not a
 * forecast. This module must never be imported outside src/dev/ (enforced
 * by src/lib/lead/isolation.test.ts) and is only reachable in development
 * builds (App.tsx gates the route on import.meta.env.DEV).
 */
import type { ConnectionItem } from "@/components/visuals/VisualConnection";
import type { SourceRef } from "@/components/visuals/InspectPanel";
import type { VisualItem } from "@/components/visuals/VisualNode";

export const PREVIEW_MARKER = "Visual preview — illustrative data";

export const SAMPLE_SOURCES: SourceRef[] = [
  { id: "SAMPLE-1", title: "Sample operations note", date: "2026-01-15", scope: "Synthetic placeholder — one site, one month", docType: "Placeholder note", owner: "Sample role" },
  { id: "SAMPLE-2", title: "Sample team survey", date: "2026-02-01", scope: "Synthetic placeholder — 12 of 40 people responded", docType: "Placeholder survey", owner: "Sample role" },
];

export interface SceneNode extends VisualItem { x: number; y: number }

/** Baseline ("before") scene. Positions are on a 600 × 340 canvas. */
export const SCENE_BEFORE: SceneNode[] = [
  { id: "org", label: "Sample organisation", visual: "organisation", state: "operating", overlays: [], evidence: "observed", sourceIds: ["SAMPLE-1"], x: 270, y: 150, note: "Placeholder organisation for the preview." },
  { id: "site", label: "Site 1", visual: "facility", state: "operating", overlays: [], evidence: "observed", sourceIds: ["SAMPLE-1"], x: 70, y: 40 },
  { id: "supplier", label: "Supplier A", visual: "supplier", state: "available", overlays: [], evidence: "observed", sourceIds: ["SAMPLE-1"], x: 70, y: 250 },
  { id: "machine", label: "Machine 2", visual: "machine", state: "awaiting-installation", overlays: [], evidence: "assumption", confidence: "low", confidenceWhy: "Placeholder: no delivery date in any source.", x: 470, y: 40 },
  { id: "team", label: "Team A", visual: "team", state: "active", overlays: ["workload"], evidence: "stakeholder", holder: "Team A (sample survey)", sourceIds: ["SAMPLE-2"], x: 470, y: 250 },
  { id: "cash", label: "Cash", visual: "cash", state: "unknown", overlays: ["missing-evidence"], evidence: "", x: 270, y: 10 },
  { id: "risk", label: "Possible delay", visual: "risk", state: "identified", overlays: [], evidence: "assumption", confidence: "medium", confidenceWhy: "Placeholder assumption.", x: 270, y: 280 },
];

/**
 * "After" — an illustrative scenario: the supplier is disrupted. Only the
 * fields that change are listed; everything else stays as in the baseline.
 */
export const SCENARIO_LABEL = "Illustrative scenario: Supplier A is disrupted for a month";
export const SCENE_AFTER_PATCH: Record<string, Partial<SceneNode>> = {
  supplier: { state: "disrupted", evidence: "illustrative" },
  site: { state: "unavailable", evidence: "illustrative" },
  risk: { visual: "active-problem", label: "Delay (scenario)", state: "hypothetical", evidence: "illustrative" },
  team: { overlays: ["workload", "delay"], evidence: "illustrative" },
};

export const SCENE_LINKS: Array<ConnectionItem & { from: string; to: string }> = [
  { id: "l1", from: "supplier", to: "site", fromLabel: "Supplier A", toLabel: "Site 1", type: "flow", state: "flowing", label: "Deliveries", frequency: "high", evidence: "observed" },
  { id: "l2", from: "site", to: "org", fromLabel: "Site 1", toLabel: "Sample organisation", type: "dependency", state: "active", label: "Output depends on Site 1", frequency: "unknown", evidence: "observed" },
  { id: "l3", from: "machine", to: "org", fromLabel: "Machine 2", toLabel: "Sample organisation", type: "dependency", state: "uncertain", label: "Capacity depends on installation", frequency: "unknown", evidence: "assumption" },
  { id: "l4", from: "team", to: "org", fromLabel: "Team A", toLabel: "Sample organisation", type: "tension", state: "mild", label: "Different timelines (reported)", frequency: "medium", evidence: "stakeholder" },
  { id: "l5", from: "team", to: "site", fromLabel: "Team A", toLabel: "Site 1", type: "handover", state: "clear", label: "Shift hand-over", frequency: "low", evidence: "observed" },
];

export const SCENE_LINKS_AFTER: Record<string, Partial<ConnectionItem>> = {
  l1: { state: "blocked", evidence: "illustrative" },
  l5: { state: "delayed", evidence: "illustrative" },
};
