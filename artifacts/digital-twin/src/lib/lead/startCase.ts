/**
 * Optional start case for a dedicated deployment (e.g. a Climate KIC demo site).
 *
 * When the build sets VITE_START_CASE to a demo preset id (see
 * presets/index.ts), a browser that has no case shown in the demo gets that
 * preset as its case — visitors open the link and land straight in it, with
 * no /prepare step. Without the variable nothing happens and the preset code
 * is never loaded (the import below is dynamic). demo.ozyntel.ai leaves it
 * unset, so each lead still sees only the case the team prepared.
 *
 * The copy is created once per browser and marked by its internal label.
 * When a later deploy changes the preset, that copy is replaced (its demo
 * progress goes with it). A case the team chose in /prepare is never replaced.
 *
 * Called only from main.tsx, before the app renders.
 */
import { deleteCase, getActiveCaseId, getCase, listCases, saveCase, setActiveCaseId } from "./store";

const LABEL = "Start case";

/** Short, stable fingerprint of the preset content, so a changed preset is noticed. */
function fingerprint(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function applyStartCase(presetId: string | undefined): Promise<void> {
  const id = (presetId ?? "").trim();
  if (!id) return;
  try {
    const { DEMO_PRESETS, createCaseFromPreset } = await import("./presets");
    const preset = DEMO_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const prefix = `${LABEL} · ${id} · `, label = prefix + fingerprint(JSON.stringify(preset.data));
    const isStart = (internalLabel: string | undefined) => (internalLabel ?? "").startsWith(prefix);

    const active = getCase(getActiveCaseId());
    if (active && !isStart(active.internalLabel)) return; // the team's choice in /prepare wins
    const copies = listCases().filter((c) => isStart(c.internalLabel));
    const current = copies.find((c) => c.internalLabel === label);
    copies.filter((c) => c !== current).forEach((c) => deleteCase(c.id)); // outdated copies of the preset
    if (current) { if (getActiveCaseId() !== current.id) setActiveCaseId(current.id); return; }

    const c = createCaseFromPreset(id);
    saveCase({ ...c, internalLabel: label }, { touch: false });
    setActiveCaseId(c.id);
  } catch {
    // Storage unavailable or blocked: the demo still works through /prepare.
  }
}
