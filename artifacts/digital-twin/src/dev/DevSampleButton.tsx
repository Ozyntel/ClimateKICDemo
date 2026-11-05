/**
 * Development builds only: loads the synthetic sample lead into /prepare so
 * the demo can be clicked through without preparing a real lead. Imported by
 * PrepareLead behind `import.meta.env.DEV`, so production builds drop it.
 */
import { importCaseJson } from "@/lib/lead/store";
import { SAMPLE_LEAD } from "./sampleLead";

export default function DevSampleButton({ onLoaded, style }: { onLoaded: (id: string) => void; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      style={style}
      title="Development builds only — adds a synthetic example case to this browser"
      onClick={() => onLoaded(importCaseJson(JSON.stringify(SAMPLE_LEAD)).id)}
    >
      Load synthetic example (dev only)
    </button>
  );
}
