/**
 * TwinWorldMap — mounts the isometric world-map canvas engine.
 *
 * Thin React wrapper around createWorldMap (src/lib/worldMapEngine.ts, a
 * verbatim port of the design-handoff prototype). It owns the <canvas>,
 * mounts the engine once, pushes case changes in, and forwards the engine's
 * callbacks:
 *   onSelect(item, point)  — point is {x, y} in map pixels, or null on an
 *                            empty-space click.
 *   onLevel(level, floorId)
 *
 * The host page (Twin.tsx) drives the engine imperatively through the ref
 * handle (setLevel / rotate / zoom / setEffects / ripple / select) and
 * renders all chrome (panels, popup, legend) around this canvas.
 *
 * The engine self-manages canvas sizing (it polls its parent's size each
 * frame), so this component only renders the canvas inside a positioned
 * container provided by the parent.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  createWorldMap,
  type WorldLevel,
  type WorldMapController,
  type WorldMapItem,
} from "@/lib/worldMapEngine";
import type { WorldCase } from "@/lib/lead/engineCase";

export interface TwinWorldMapHandle {
  setCase: (c: WorldCase) => void;
  setLevel: (level: WorldLevel, floorId?: string | null) => void;
  getLevel: () => WorldLevel;
  getFloor: () => string | null;
  rotate: (dir: number) => void;
  zoom: (f: number) => void;
  relabel: (names: Record<string, string>) => void;
  setInset: (px: number) => void;
  setEffects: (map: Record<string, [string, string]> | null, hot?: unknown[]) => void;
  ripple: () => void;
  select: (id: string | null) => void;
}

interface TwinWorldMapProps {
  caseData: WorldCase;
  onSelect: (item: WorldMapItem | null, point: { x: number; y: number } | null) => void;
  onLevel: (level: WorldLevel, floorId?: string | null) => void;
}

export const TwinWorldMap = forwardRef<TwinWorldMapHandle, TwinWorldMapProps>(
  function TwinWorldMap({ caseData, onSelect, onLevel }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mapRef = useRef<WorldMapController | null>(null);

    // Keep the latest callbacks reachable from the stable engine closures.
    const cbRef = useRef({ onSelect, onLevel });
    cbRef.current = { onSelect, onLevel };

    // Mount the engine once.
    useEffect(() => {
      if (!canvasRef.current) return;
      const map = createWorldMap(canvasRef.current, {
        onSelect: (it, pt) => cbRef.current.onSelect(it, pt),
        onLevel: (lvl, fid) => cbRef.current.onLevel(lvl, fid),
      });
      mapRef.current = map;
      map.setCase(caseData);
      return () => {
        map.destroy();
        mapRef.current = null;
      };
      // Mount-once: case changes are handled by the effect below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Push case changes into the running engine (resets it to macro).
    useEffect(() => {
      mapRef.current?.setCase(caseData);
    }, [caseData]);

    useImperativeHandle(
      ref,
      (): TwinWorldMapHandle => ({
        setCase: (cc) => mapRef.current?.setCase(cc),
        setLevel: (l, f) => mapRef.current?.setLevel(l, f),
        getLevel: () => mapRef.current?.getLevel() ?? "macro",
        getFloor: () => mapRef.current?.getFloor() ?? null,
        rotate: (d) => mapRef.current?.rotate(d),
        zoom: (f) => mapRef.current?.zoom(f),
        relabel: (names) => mapRef.current?.relabel(names),
        setInset: (px) => mapRef.current?.setInset(px),
        setEffects: (m, h) => mapRef.current?.setEffects(m, h),
        ripple: () => mapRef.current?.ripple(),
        select: (id) => mapRef.current?.select(id),
      }),
      [],
    );

    return (
      <canvas ref={canvasRef} role="img" aria-label="Isometric map of the organisation and the world around it. Switch to List view for a keyboard- and screen-reader-friendly list of the same content." style={{ position: "absolute", inset: 0, display: "block" }} />
    );
  },
);
