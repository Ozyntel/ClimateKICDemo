/**
 * React access to the active lead case and its demo progress.
 * Re-reads on same-tab changes (LEAD_CHANGED_EVENT) and cross-tab changes
 * (storage event), so /prepare edits show up in an open demo tab.
 *
 * The lead object keeps its identity while its content is unchanged, so a
 * progress change (an upload, a stress test) does not rebuild the map.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveCase, getProgress, LEAD_CHANGED_EVENT, LEAD_STORAGE_PREFIX, saveProgress } from "./store";
import type { LeadCase, LeadProgress } from "./types";

export function useActiveLead(): { lead: LeadCase | null; progress: LeadProgress; setProgress: (fn: (p: LeadProgress) => LeadProgress) => void } {
  const last = useRef<{ json: string; lead: LeadCase | null }>({ json: "", lead: null });
  const read = () => {
    const fresh = getActiveCase();
    const json = fresh ? JSON.stringify(fresh) : "";
    if (json !== last.current.json) last.current = { json, lead: fresh };
    const lead = last.current.lead;
    return { lead, progress: getProgress(lead?.id) };
  };
  const [state, setState] = useState(read);
  useEffect(() => {
    const on = () => setState(read());
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith(LEAD_STORAGE_PREFIX)) on(); };
    window.addEventListener(LEAD_CHANGED_EVENT, on);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(LEAD_CHANGED_EVENT, on); window.removeEventListener("storage", onStorage); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setProgress = useCallback((fn: (p: LeadProgress) => LeadProgress) => {
    const id = state.lead?.id;
    if (!id) return;
    saveProgress(id, fn(getProgress(id)));
  }, [state.lead?.id]);
  return { ...state, setProgress };
}
