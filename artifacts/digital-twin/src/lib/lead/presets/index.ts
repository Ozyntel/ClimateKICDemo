/**
 * Demo presets offered in /prepare under "Start from a demo case".
 *
 * A preset is ordinary lead-case JSON. Choosing one creates a NEW, separate,
 * editable case (a fresh id, like an import) — it never overwrites a case,
 * and it is not shown in the demo until the team clicks "Show in the demo".
 * Only /prepare imports this module; customer-facing pages read the active
 * case from storage like any other lead.
 */
import { importCaseJson } from "../store";
import type { LeadCase } from "../types";
import { CLIMATE_KIC_PRESET } from "./climateKic";

export interface DemoPreset { id: string; label: string; hint: string; data: unknown }

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "climate-kic",
    label: "Climate KIC — growth decision (demonstration case)",
    hint: "Public organisation context with a synthetic planning case: four fictional partners, six cohorts, three options, three SYNTHETIC source documents and two stress tests.",
    data: CLIMATE_KIC_PRESET,
  },
];

/** Create a new, separate case from a preset. Returns the stored case. */
export function createCaseFromPreset(presetId: string): LeadCase {
  const p = DEMO_PRESETS.find((x) => x.id === presetId);
  if (!p) throw new Error(`Unknown demo preset: ${presetId}`);
  return importCaseJson(JSON.stringify(p.data));
}
