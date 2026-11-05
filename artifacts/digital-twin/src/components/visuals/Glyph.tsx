/**
 * Glyph — SVG base visuals for every element in the visual registry.
 *
 * One glyph per base element (48×48 viewBox). A glyph never encodes a state
 * by itself: the `Treatment` passed in decides the stroke pattern (solid /
 * dashed / dotted), body fill (solid / none / muted / hatched), gauge level,
 * repeated-mark count and corner badge. That is what lets the same building
 * read as "operating", "proposed" or "unknown" without bespoke artwork.
 *
 * Colour comes from `currentColor` (set by the tone class on the wrapper) and
 * is always paired with text by the components that use this glyph.
 */
import { useId, type ReactNode, type SVGProps } from "react";
import type { BadgeId, GlyphId, Treatment } from "@/lib/visuals/registry";

interface G {
  /** Body props: fill + stroke per treatment. */
  B: SVGProps<SVGPathElement>;
  /** Line props: stroke only. */
  L: SVGProps<SVGPathElement>;
  /** Solid fill used for gauge levels / counted marks. */
  F: SVGProps<SVGPathElement>;
  lvl: number;
  n: number;
  flow: string | undefined;
  hatch: string;
}

const DASH: Record<string, string | undefined> = { solid: undefined, dashed: "5 4", dotted: "1.2 3.6" };

const fig = (x: number, y: number, s: number, B: G["B"]) => (
  <g key={`f${x}-${y}`}>
    <circle cx={x} cy={y} r={3.6 * s} {...(B as SVGProps<SVGCircleElement>)} />
    <path d={`M${x - 6.5 * s} ${y + 16 * s}c0-6.5 ${2.8 * s}-10 ${6.5 * s}-10s${6.5 * s} 3.5 ${6.5 * s} 10z`} {...B} />
  </g>
);

const range = (n: number) => Array.from({ length: Math.max(0, Math.round(n)) }, (_, i) => i);

const GLYPHS: Record<GlyphId, (g: G) => ReactNode> = {
  building: ({ B, L }) => (<><path d="M8 42V16l16-8 16 8v26z" {...B} /><path d="M15 21h5M28 21h5M15 29h5M28 29h5M20 42v-7h8v7" {...L} /></>),
  ring: ({ L, B, lvl }) => {
    const c = 2 * Math.PI * 18;
    return (<><circle cx="24" cy="24" r="18" {...(L as SVGProps<SVGCircleElement>)} strokeDasharray={lvl < 1 ? `${c * lvl} ${c}` : L.strokeDasharray} strokeWidth={3} transform="rotate(-90 24 24)" />
      <circle cx="17" cy="20" r="4" {...(B as SVGProps<SVGCircleElement>)} /><circle cx="31" cy="20" r="4" {...(B as SVGProps<SVGCircleElement>)} /><circle cx="24" cy="31" r="4" {...(B as SVGProps<SVGCircleElement>)} /></>);
  },
  team: ({ B }) => (<>{fig(13, 16, 0.9, B)}{fig(35, 16, 0.9, B)}{fig(24, 20, 1, B)}</>),
  person: ({ B }) => (<><circle cx="24" cy="14" r="6.5" {...(B as SVGProps<SVGCircleElement>)} /><path d="M11 42c0-10 5.5-16 13-16s13 6 13 16z" {...B} /></>),
  external: ({ B, L }) => (<><path d="M12 4v40" {...L} strokeDasharray="2 3" /><circle cx="31" cy="15" r="5.5" {...(B as SVGProps<SVGCircleElement>)} /><path d="M20 42c0-9 4.5-14 11-14s11 5 11 14z" {...B} /><path d="M4 24h5" {...L} /></>),
  community: ({ B }) => (<>{fig(10, 20, 0.7, B)}{fig(20, 14, 0.85, B)}{fig(30, 18, 0.75, B)}{fig(39, 22, 0.65, B)}</>),
  customer: ({ B, L }) => (<><path d="M8 22h28v20H8z" {...B} /><path d="M6 22l4-10h24l4 10M16 42v-9h8v9" {...L} /><path d="M33 27h10v15l-2.5-1.5L38 42l-2.5-1.5L33 42z" {...B} /><path d="M36 31h4M36 35h4" {...L} /></>),
  supplier: ({ B, L }) => (<><path d="M5 42V21l19-11 19 11v21z" {...B} /><path d="M17 42V30h14v12M17 34h14M17 38h14" {...L} /></>),
  city: ({ B, L }) => (<><path d="M5 42V26h7V16h8v10h5V9h8v14h5v19z" {...B} /><path d="M3 42h42" {...L} /><path d="M9 31h2M15 21h2M15 29h2M28 14h2M28 22h2M28 30h2" {...L} /></>),
  district: ({ B, L, F, n }) => {
    const cells: Array<[number, number]> = [[6, 8], [26, 8], [6, 28], [26, 28]];
    return (<>{cells.map(([x, y], i) => (<path key={i} d={`M${x} ${y + 14}V${y + 6}l8-5 8 5v8z`} {...B} />))}<path d="M4 25h40M24 4v40" {...L} />
      {range(n).slice(0, 4).map((i) => (<circle key={`m${i}`} cx={cells[i][0] + 8} cy={cells[i][1] + 10} r="3" {...(F as SVGProps<SVGCircleElement>)} />))}</>);
  },
  facility: ({ B, L }) => (<><path d="M5 42V24l10-6v6l10-6v6l10-6v24z" {...B} /><path d="M35 18V7h5v35M10 32h4M19 32h4M28 32h4" {...L} /></>),
  home: ({ B, L }) => (<><path d="M8 24L24 10l16 14v18H8z" {...B} /><path d="M20 42v-9h8v9" {...L} /></>),
  "care-home": ({ B, L }) => (<><path d="M7 42V20l17-11 17 11v22z" {...B} /><path d="M24 22v11M18.5 27.5h11" {...L} strokeWidth={3} /></>),
  school: ({ B, L }) => (<><path d="M9 42V22h30v20z" {...B} /><path d="M7 22l17-9 17 9M24 13V4l7 3-7 3M15 28h5M28 28h5M21 42v-7h6v7" {...L} /></>),
  ward: ({ B, L, lvl }) => {
    const filled = Math.round(lvl * 3);
    return (<>{[0, 1, 2].map((i) => { const y = 8 + i * 12; return (<g key={i}><path d={`M8 ${y + 8}h32v4H8z`} {...(i < filled ? B : { ...L, strokeDasharray: "3 3" })} /><path d={`M8 ${y + 4}v8M40 ${y + 6}v6M10 ${y + 8}v-3h7v3`} {...L} /></g>); })}</>);
  },
  vehicle: ({ B, L, flow }) => (<g className={flow}><rect x="6" y="14" width="36" height="20" rx="4" {...(B as SVGProps<SVGRectElement>)} /><path d="M10 19h8v6h-8zM21 19h8v6h-8zM32 19h6v6h-6z" {...L} /><circle cx="14" cy="36" r="3.5" {...(L as SVGProps<SVGCircleElement>)} /><circle cx="34" cy="36" r="3.5" {...(L as SVGProps<SVGCircleElement>)} /></g>),
  road: ({ L, B }) => (<><path d="M12 44L19 4h10l7 40z" {...B} /><path d="M24 8v5M24 19v5M24 30v5M24 40v4" {...L} /></>),
  tree: ({ B, L }) => (<><circle cx="24" cy="18" r="12" {...(B as SVGProps<SVGCircleElement>)} /><path d="M24 30v12M18 42h12" {...L} /></>),
  river: ({ L, F, lvl, flow }) => {
    const top = 40 - lvl * 26;
    return (<><path d="M4 12h40M4 42h40" {...L} /><rect x="4" y={top} width="40" height={42 - top} {...(F as SVGProps<SVGRectElement>)} /><path className={flow} d={`M4 ${top + 2}q5-4 10 0t10 0 10 0 10 0`} {...L} /></>);
  },
  traffic: ({ L, F, n, flow }) => {
    const cars = range(Math.min(n, 8));
    return (<><path d="M2 18h44M2 38h44" {...L} /><path d="M2 28h44" {...L} strokeDasharray="4 4" /><g className={flow}>{cars.map((i) => { const lane = i % 2; const x = 4 + (Math.floor(i / 2) * 11) + lane * 5; return (<rect key={i} x={x} y={lane ? 31 : 21} width="7" height="5" rx="1.5" {...(F as SVGProps<SVGRectElement>)} />); })}</g></>);
  },
  thermometer: ({ L, F, lvl }) => {
    const h = 4 + lvl * 24;
    return (<><rect x="20" y="4" width="8" height="32" rx="4" {...(L as SVGProps<SVGRectElement>)} /><circle cx="24" cy="38" r="6" {...(F as SVGProps<SVGCircleElement>)} /><rect x="22" y={34 - h} width="4" height={h} {...(F as SVGProps<SVGRectElement>)} /><path d="M31 10h4M31 18h4M31 26h4" {...L} /></>);
  },
  flood: ({ B, L, F, lvl, hatch }) => {
    const top = 42 - lvl * 22;
    return (<><path d="M12 30L24 20l12 10v12H12z" {...L} />{lvl > 0 && <rect x="2" y={top} width="44" height={42 - top} {...(B.fill === "none" ? { fill: hatch } : F) as SVGProps<SVGRectElement>} />}<path d="M2 42h44" {...L} /><path d={`M2 ${top}q5-3 11 0t11 0 11 0 11 0`} {...L} strokeDasharray={lvl > 0 ? undefined : "2 3"} /></>);
  },
  rain: ({ B, L, n }) => (<><path d="M12 24a8 8 0 0 1 1-15.8A10 10 0 0 1 32 9a7.5 7.5 0 0 1 4 15z" {...B} />{range(Math.min(n, 9)).map((i) => { const x = 12 + (i % 5) * 6 + (i >= 5 ? 3 : 0); const y = 29 + (i >= 5 ? 7 : 0); return (<path key={i} d={`M${x} ${y}l-2 5`} {...L} />); })}</>),
  drought: ({ B, L, F, lvl }) => {
    const h = lvl * 30;
    return (<><path d="M18 6C11 16 8 22 8 28a10 10 0 0 0 20 0c0-6-3-12-10-22z" {...B} /><rect x="34" y="8" width="8" height="32" rx="2" {...(L as SVGProps<SVGRectElement>)} /><rect x="35.5" y={39 - h} width="5" height={h} {...(F as SVGProps<SVGRectElement>)} /></>);
  },
  canopy: ({ B, L, F, lvl }) => (<><ellipse cx="24" cy="40" rx={5 + lvl * 17} ry={2 + lvl * 3} {...(F as SVGProps<SVGEllipseElement>)} opacity={0.45} /><circle cx="24" cy="17" r="11" {...(B as SVGProps<SVGCircleElement>)} /><path d="M24 28v12" {...L} /></>),
  air: ({ L, F, n }) => (<><path d="M4 16h22a5 5 0 1 0-5-5M4 24h30a5 5 0 1 1-5 5M4 32h14" {...L} /><rect x="34" y="34" width="10" height="10" rx="2" {...L as SVGProps<SVGRectElement>} /><path d="M37 38h4" {...L} />{range(Math.min(n, 9)).map((i) => (<circle key={i} cx={8 + (i * 13) % 30} cy={8 + (i * 7) % 34} r="1.6" {...(F as SVGProps<SVGCircleElement>)} />))}</>),
  energy: ({ B, L }) => (<><path d="M26 4L12 26h10l-4 18 16-24H24z" {...B} /><path d="M38 10v30M38 10h6M38 40h6" {...L} /></>),
  material: ({ L, F, lvl }) => {
    const k = Math.round(lvl * 4);
    return (<>{[0, 1, 2, 3].map((i) => { const y = 38 - i * 8; return (<rect key={i} x={8 + (i % 2) * 2} y={y} width="30" height="6" rx="1.5" {...(i < k ? F : { ...L, strokeDasharray: "3 3" }) as SVGProps<SVGRectElement>} />); })}</>);
  },
  machine: ({ B, L, flow }) => (<><rect x="10" y="8" width="20" height="20" rx="2" {...(B as SVGProps<SVGRectElement>)} /><path d="M14 14h12M14 19h8" {...L} /><path d="M4 34h40" {...L} /><g className={flow}><circle cx="10" cy="38" r="3" {...(L as SVGProps<SVGCircleElement>)} /><circle cx="24" cy="38" r="3" {...(L as SVGProps<SVGCircleElement>)} /><circle cx="38" cy="38" r="3" {...(L as SVGProps<SVGCircleElement>)} /></g></>),
  throughput: ({ L, F, n, flow }) => (<><path d="M2 32h44M2 40h44" {...L} /><g className={flow}>{range(Math.min(n, 6)).map((i) => (<rect key={i} x={4 + i * 7} y="24" width="5" height="6" {...(F as SVGProps<SVGRectElement>)} />))}</g></>),
  stock: ({ L, F, lvl }) => {
    const k = Math.round(lvl * 6);
    return (<><path d="M6 4v40M42 4v40M6 18h36M6 31h36M6 44h36" {...L} />{range(6).map((i) => { const row = Math.floor(i / 3), col = i % 3; return (<rect key={i} x={10 + col * 10} y={row ? 34 : 21} width="8" height="8" {...(i < k ? F : { ...L, strokeDasharray: "2 2" }) as SVGProps<SVGRectElement>} />); })}</>);
  },
  rework: ({ L, F, n }) => (<><path d="M36 14a14 14 0 1 0 3 12" {...L} /><path d="M36 6v8h-8" {...L} />{range(Math.min(n, 4)).map((i) => (<rect key={i} x={18 + (i % 2) * 7} y={18 + Math.floor(i / 2) * 7} width="5" height="5" {...(F as SVGProps<SVGRectElement>)} />))}</>),
  goods: ({ B, L, flow }) => (<g className={flow}><path d="M8 16l16-8 16 8v18l-16 8-16-8z" {...B} /><path d="M8 16l16 8 16-8M24 24v18M16 12l16 8" {...L} /></g>),
  "service-flow": ({ L, F, n, flow }) => {
    const clustered = n >= 6;
    return (<><circle cx="7" cy="24" r="5" {...(L as SVGProps<SVGCircleElement>)} /><circle cx="41" cy="24" r="5" {...(L as SVGProps<SVGCircleElement>)} /><g className={clustered ? undefined : flow}>{range(Math.min(n, 8)).map((i) => (<circle key={i} cx={clustered ? 31 - (i % 3) * 3.4 : 13 + i * (22 / Math.max(1, n - 1))} cy={clustered ? 19 + Math.floor(i / 3) * 4.5 : 24} r="1.9" {...(F as SVGProps<SVGCircleElement>)} />))}</g></>);
  },
  queue: ({ B, F, n }) => (<><rect x="34" y="12" width="10" height="24" rx="2" {...(B as SVGProps<SVGRectElement>)} />{range(Math.min(n, 6)).map((i) => (<circle key={i} cx={29 - i * 5} cy="24" r="2.2" {...(F as SVGProps<SVGCircleElement>)} />))}</>),
  product: ({ B, L }) => (<><path d="M10 14h28v26H10z" {...B} /><path d="M10 14l5-6h18l5 6M17 24h14M17 30h9" {...L} /></>),
  testing: ({ B, L }) => (<><rect x="6" y="6" width="24" height="30" rx="2" {...(B as SVGProps<SVGRectElement>)} /><path d="M11 13h14M11 19h10" {...L} /><circle cx="30" cy="30" r="8" {...(L as SVGProps<SVGCircleElement>)} /><path d="M36 36l7 7" {...L} strokeWidth={3} /></>),
  culture: ({ B, L }) => (<><circle cx="24" cy="24" r="18" {...(B as SVGProps<SVGCircleElement>)} /><path d="M10 20q7-6 14 0t14 0M10 28q7-6 14 0t14 0" {...L} /></>),
  trust: ({ B, L }) => (<>{fig(8, 12, 0.7, B)}{fig(40, 12, 0.7, B)}<path d="M8 32q16-14 32 0M8 32h32M16 32v-6M24 32v-8M32 32v-6" {...L} /></>),
  tension: ({ L, n }) => {
    const k = Math.max(2, Math.min(5, n || 2));
    const w = 24 / k;
    const zz = range(k).map((i) => `l${w / 2} ${i % 2 ? 6 : -6}l${w / 2} ${i % 2 ? -6 : 6}`).join("");
    return (<><path d="M2 24h8M38 24h8M6 20l4 4-4 4M42 20l-4 4 4 4" {...L} /><path d={`M12 24${zz}`} {...L} /></>);
  },
  alignment: ({ L, lvl }) => (<><path d={`M8 34L40 ${34 - 20 - lvl * 6}`} {...L} /><path d={`M8 40L40 ${40 - 20 + lvl * 18}`} {...L} /><path d={`M34 ${12 - lvl * 6}l6 ${2 - lvl}-2 6`} {...L} /></>),
  sentiment: ({ B, L }) => (<><path d="M6 10h36v22H20l-8 8v-8H6z" {...B} /><path d="M14 21h.1M24 21h.1M34 21h.1" {...L} strokeWidth={3.5} strokeLinecap="round" /></>),
  voice: ({ B }) => (<><path d="M14 6h28v18H28l-6 6v-6h-8z" {...B} />{fig(10, 30, 0.55, B)}{fig(20, 33, 0.55, B)}</>),
  "speak-up": ({ B, L }) => (<><path d="M6 8h28v18H18l-7 7v-7H6z" {...L} /><path d="M33 22l9 3v7c0 6-4 9-9 11-5-2-9-5-9-11v-7z" {...B} /></>),
  workload: ({ L, F, lvl }) => {
    const k = Math.max(1, Math.round(lvl * 5));
    return (<>{range(5).map((i) => (<rect key={i} x={10 + (i % 2) * 2} y={38 - i * 7} width="26" height="5" rx="1" {...(i < k ? F : { ...L, strokeDasharray: "2 2" }) as SVGProps<SVGRectElement>} />))}</>);
  },
  staffing: ({ B }) => (<>{[8, 18, 28, 38].map((x) => fig(x, 16, 0.7, B))}</>),
  skills: ({ B, L }) => (<><rect x="6" y="16" width="28" height="24" rx="2" {...(B as SVGProps<SVGRectElement>)} /><path d="M11 24h18M11 30h12" {...L} /><path d="M26 10l12-5 12 5-12 5z" {...L} transform="translate(-6 0)" /></>),
  capacity: ({ L, F, lvl }) => {
    const h = lvl * 30;
    return (<><path d="M10 8v32a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4V8" {...L} /><rect x="12" y={42 - h} width="24" height={h} {...(F as SVGProps<SVGRectElement>)} /><path d="M6 8h36" {...L} /></>);
  },
  decision: ({ B, L }) => (<><path d="M24 4l20 20-20 20L4 24z" {...B} /><path d="M18 24l4 4 8-8" {...L} /></>),
  ownership: ({ B, L }) => (<><path d="M12 44V6" {...L} strokeWidth={2.5} /><path d="M12 6h24l-6 8 6 8H12z" {...B} /></>),
  incentive: ({ L, lvl }) => (<><circle cx="24" cy="24" r="16" {...(L as SVGProps<SVGCircleElement>)} /><circle cx="24" cy="24" r="9" {...(L as SVGProps<SVGCircleElement>)} /><circle cx="24" cy="24" r="2.5" {...(L as SVGProps<SVGCircleElement>)} />
    {lvl < 0.5 ? <path d="M2 18h14M2 30h14M12 14l4 4-4 4M12 26l4 4-4 4" {...L} /> : <path d="M2 24h14M46 24H32M12 20l4 4-4 4M36 20l-4 4 4 4" {...L} />}</>),
  handover: ({ B, L }) => (<><rect x="2" y="14" width="12" height="20" rx="2" {...(B as SVGProps<SVGRectElement>)} /><rect x="34" y="14" width="12" height="20" rx="2" {...(B as SVGProps<SVGRectElement>)} /><path d="M16 20h16M28 16l4 4-4 4M32 28H16M20 24l-4 4 4 4" {...L} /></>),
  dependency: ({ B, L }) => (<><circle cx="9" cy="24" r="6" {...(B as SVGProps<SVGCircleElement>)} /><circle cx="39" cy="24" r="6" {...(B as SVGProps<SVGCircleElement>)} /><path d="M15 24h16M27 19l5 5-5 5" {...L} /></>),
  relationship: ({ B, L }) => (<><circle cx="9" cy="24" r="6" {...(B as SVGProps<SVGCircleElement>)} /><circle cx="39" cy="24" r="6" {...(B as SVGProps<SVGCircleElement>)} /><path d="M15 24h18" {...L} /></>),
  bottleneck: ({ L, F, lvl }) => {
    const gap = 2 + lvl * 10;
    return (<><path d={`M4 8L${24 - gap / 2 - 2} 20v8L4 40M44 8L${24 + gap / 2 + 2} 20v8L44 40`} {...L} /><rect x={24 - gap / 2} y="20" width={gap} height="8" {...(F as SVGProps<SVGRectElement>)} /></>);
  },
  capability: ({ B }) => (<path d="M24 4l6 13 14 1.5-10.5 9.5 3 14L24 35l-12.5 7 3-14L4 18.5 18 17z" {...B} />),
  readiness: ({ B, L, lvl }) => {
    const k = Math.round(lvl * 3);
    return (<><rect x="8" y="4" width="32" height="40" rx="3" {...(B as SVGProps<SVGRectElement>)} />{[0, 1, 2].map((i) => (<g key={i}><rect x="13" y={12 + i * 10} width="6" height="6" {...(L as SVGProps<SVGRectElement>)} /><path d={`M23 ${15 + i * 10}h12`} {...L} />{i < k && <path d={`M14 ${15 + i * 10}l2 2 4-5`} {...L} strokeWidth={2.4} />}</g>))}</>);
  },
  cash: ({ L, F, lvl }) => {
    const k = Math.max(1, Math.round(lvl * 6));
    return (<>{range(6).map((i) => (<ellipse key={i} cx="20" cy={40 - i * 5} rx="12" ry="3.5" {...(i < k ? F : { ...L, strokeDasharray: "2 2" }) as SVGProps<SVGEllipseElement>} />))}<path d="M38 14h7M41.5 10v8" {...L} /><path d="M36 30a6 6 0 1 1 0 4" {...L} /></>);
  },
  budget: ({ L, F, lvl }) => (<><rect x="4" y="18" width="40" height="12" rx="2" {...(L as SVGProps<SVGRectElement>)} /><rect x="4" y="18" width={Math.min(40, lvl * 40) * 0.6} height="12" {...(F as SVGProps<SVGRectElement>)} /><path d={`M${4 + lvl * 24} 18v12`} {...L} />{lvl >= 1 && <rect x="44" y="18" width="4" height="12" {...(F as SVGProps<SVGRectElement>)} />}<path d="M4 36h14M22 36h10" {...L} strokeDasharray="3 2" /></>),
  funding: ({ B, L }) => (<><path d="M8 4h20l8 8v30H8z" {...B} /><path d="M28 4v8h8M13 18h14M13 24h10" {...L} /><circle cx="32" cy="36" r="8" {...(L as SVGProps<SVGCircleElement>)} /><path d="M30 33a3 3 0 1 1 0 6" {...L} /></>),
  cost: ({ L, lvl }) => (<><circle cx="14" cy="24" r="10" {...(L as SVGProps<SVGCircleElement>)} /><path d="M12 20a4 4 0 1 1 0 8M10 23h5" {...L} /><path d="M26 24h18M38 18l6 6-6 6" {...L} strokeWidth={1.5 + lvl * 4} /></>),
  revenue: ({ L }) => (<><circle cx="34" cy="20" r="9" {...(L as SVGProps<SVGCircleElement>)} /><path d="M32 16a4 4 0 1 1 0 8M30 19h5" {...L} /><path d="M2 20h18M14 14l6 6-6 6" {...L} /><rect x="22" y="32" width="18" height="12" rx="2" {...(L as SVGProps<SVGRectElement>)} /><path d="M22 36h18" {...L} /></>),
  demand: ({ B, L, lvl }) => (<><path d="M6 18h28l-4 20H10z" {...B} /><path d="M12 18l6-10M28 18l-6-10" {...L} /><path d={lvl >= 0.75 ? "M36 34l8-14M38 20h6v6" : lvl <= 0.25 ? "M36 20l8 14M38 34h6v-6" : "M36 27h9M41 23l4 4-4 4"} {...L} /></>),
  price: ({ B, L, lvl, n }) => (<><path d="M6 8h16l14 14-14 14L6 22z" {...B} /><circle cx="13" cy="15" r="2.5" {...(L as SVGProps<SVGCircleElement>)} />
    {n > 1 ? <path d="M30 40l3-6 3 8 3-10 3 8 3-4" {...L} /> : <path d={lvl >= 0.75 ? "M32 44l12-12M38 32h6v6" : lvl <= 0.25 ? "M32 32l12 12M38 44h6v-6" : "M32 40h12M40 36l4 4-4 4"} {...L} />}</>),
  goal: ({ L, F, lvl }) => (<><path d="M4 42q14-2 20-12t14-16" {...L} strokeDasharray="3 3" /><path d="M4 42q14-2 20-12t14-16" {...(F as SVGProps<SVGPathElement>)} fill="none" stroke="currentColor" strokeWidth={3} pathLength={1} strokeDasharray={`${lvl} 1`} /><path d="M38 14V2" {...L} /><path d="M38 2h8l-3 4 3 4h-8" {...L} /></>),
  impact: ({ B, L }) => (<><path d="M8 40C8 18 22 8 42 6c-2 20-12 34-34 34z" {...B} /><path d="M8 40l20-20" {...L} /></>),
  risk: ({ B, L, F, n }) => (<><path d="M20 6l17 32H3z" {...B} /><path d="M20 17v10M20 32v.5" {...L} strokeWidth={2.6} strokeLinecap="round" />{range(Math.min(n, 3)).map((i) => (<rect key={i} x={40} y={34 - i * 8} width="6" height="5" {...(F as SVGProps<SVGRectElement>)} />))}</>),
  problem: ({ B }) => (<path d="M24 4c2 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 6-12 0 4 2 6 4 7-1-7 0-13 2-19z" {...B} />),
  fire: ({ B, L }) => (<><path d="M2 42h44" {...L} /><path d="M6 42l4-10 4 10M36 42l3-8 3 8" {...L} /><path d="M24 6c2 7 10 11 10 21a10 10 0 0 1-20 0c0-5 2.5-8 5-10 0 3.5 1.5 5 3.5 6-1-6 0-11 1.5-17z" {...B} /></>),
  "early-warning": ({ B, L }) => (<><path d="M12 34V22a12 12 0 0 1 24 0v12l4 4H8z" {...B} /><path d="M20 42a4 4 0 0 0 8 0M24 6v4" {...L} /></>),
  opportunity: ({ B, L }) => (<><path d="M24 10l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" {...B} /><path d="M38 6v6M35 9h6M10 36v6M7 39h6" {...L} /></>),
  intervention: ({ B }) => (<path d="M30 6a10 10 0 0 0-9.5 13L6 33.5a4 4 0 0 0 5.7 5.7L26 25a10 10 0 0 0 13-9.5l-6 6-6-1-1-6z" {...B} />),
  pathway: ({ L, F }) => (<><path d="M4 40c10 0 10-14 20-14s10-14 20-14" {...L} strokeWidth={3} /><circle cx="4" cy="40" r="3.5" {...(F as SVGProps<SVGCircleElement>)} /><circle cx="24" cy="26" r="3.5" {...(F as SVGProps<SVGCircleElement>)} /><circle cx="44" cy="12" r="3.5" {...(F as SVGProps<SVGCircleElement>)} /></>),
  "trade-off": ({ L, B, lvl }) => {
    const tilt = (lvl - 0.5) * 16;
    return (<><path d="M24 8v34M14 42h20" {...L} /><path d={`M8 ${18 + tilt}L40 ${18 - tilt}`} {...L} /><path d={`M3 ${30 + tilt}a5 5 0 0 0 10 0l-5-12z`} {...B} /><path d={`M35 ${30 - tilt}a5 5 0 0 0 10 0l-5-12z`} {...B} /></>);
  },
  regulation: ({ B, L }) => (<><path d="M10 4h20l8 8v32H10z" {...B} /><path d="M30 4v8h8M16 20h16M16 26h16M16 32h10" {...L} /></>),
  driver: ({ B, L }) => (<><circle cx="24" cy="24" r="18" {...(B as SVGProps<SVGCircleElement>)} /><path d="M6 24h36M24 6c-8 10-8 26 0 36M24 6c8 10 8 26 0 36" {...L} /></>),
  indicator: ({ L, lvl }) => {
    const a = Math.PI * (1 - lvl);
    return (<><path d="M6 34a18 18 0 0 1 36 0" {...L} /><path d="M6 34h36" {...L} /><path d={`M24 34L${24 + Math.cos(a) * 14} ${34 - Math.sin(a) * 14}`} {...L} strokeWidth={3} /><circle cx="24" cy="34" r="2.5" {...(L as SVGProps<SVGCircleElement>)} /></>);
  },
  document: ({ B, L }) => (<><path d="M10 4h20l8 8v32H10z" {...B} /><path d="M30 4v8h8M16 20h16M16 26h16M16 32h12" {...L} /></>),
  "missing-evidence": ({ L }) => (<><path d="M10 4h20l8 8v32H10z" {...L} strokeDasharray="4 3" /><path d="M20 20a4 4 0 1 1 5 4c-1 .5-1 1.5-1 3M24 33v.5" {...L} strokeWidth={2.4} strokeLinecap="round" /></>),
  conflict: ({ B, L }) => (<><path d="M2 6h20v14h-8l-5 5v-5H2z" {...B} /><path d="M26 22h20v14h-7v5l-5-5h-8z" {...B} /><path d="M10 34l8-4M38 12l-8 4" {...L} /></>),
  coverage: ({ L, F, lvl }) => {
    const c = 2 * Math.PI * 16;
    return (<><circle cx="24" cy="24" r="16" {...(L as SVGProps<SVGCircleElement>)} strokeDasharray="2 3" /><circle cx="24" cy="24" r="16" fill="none" stroke={(F.fill as string) || "currentColor"} strokeWidth={6} strokeDasharray={`${c * lvl} ${c}`} transform="rotate(-90 24 24)" opacity={0.75} /></>);
  },
  stale: ({ B, L }) => (<><circle cx="24" cy="24" r="18" {...(B as SVGProps<SVGCircleElement>)} /><path d="M24 12v12l8 5" {...L} /></>),
  ripple: ({ L, flow }) => (<g className={flow}><circle cx="24" cy="24" r="4" {...(L as SVGProps<SVGCircleElement>)} /><path d="M14 14a14 14 0 0 0 0 20M34 14a14 14 0 0 1 0 20M8 8a22 22 0 0 0 0 32M40 8a22 22 0 0 1 0 32" {...L} /></g>),
  milestone: ({ B, L }) => (<><rect x="6" y="10" width="36" height="32" rx="3" {...(B as SVGProps<SVGRectElement>)} /><path d="M6 18h36M16 6v8M32 6v8M14 26h4M22 26h4M30 26h4M14 33h4" {...L} /></>),
  permission: ({ L, B }) => (<><rect x="4" y="6" width="40" height="36" rx="10" {...(L as SVGProps<SVGRectElement>)} strokeDasharray="3 3" /><rect x="16" y="22" width="16" height="13" rx="2" {...(B as SVGProps<SVGRectElement>)} /><path d="M19 22v-4a5 5 0 0 1 10 0v4" {...L} /></>),
};

/** Ids of every glyph that has a drawing (used by tests to check registry coverage). */
export const GLYPH_IDS = Object.keys(GLYPHS) as GlyphId[];

/** Corner badge icons (drawn inside a 14px circle at the top-right). */
const BADGE_ICONS: Record<BadgeId, ReactNode> = {
  check: <path d="M-3.2 0l2.2 2.2 4.4-4.6" />,
  clock: <><circle r="3.6" /><path d="M0-2v2l1.8 1.2" /></>,
  pause: <path d="M-1.6-3v6M1.6-3v6" />,
  cross: <path d="M-2.8-2.8l5.6 5.6M2.8-2.8l-5.6 5.6" />,
  question: <path d="M-2.2-1.6a2.3 2.3 0 1 1 3 2.1c-.6.3-.8.7-.8 1.4M0 3.4v.2" />,
  barrier: <path d="M-4-1.5h8v3h-8zM-2.5-1.5l-1.5 3M1-1.5l-1.5 3M4-1.5l-1.5 3M-3 1.5v2.5M3 1.5v2.5" />,
  plus: <path d="M0-3.4v6.8M-3.4 0h6.8" />,
  warning: <path d="M0-3.8l4 7H-4zM0-1v2M0 2.4v.2" />,
  scaffold: <path d="M-3.5 4v-8M3.5 4v-8M-3.5-1.5h7M-3.5 2h7M-3.5-1.5l7 3.5" />,
  magnifier: <><circle cx="-0.8" cy="-0.8" r="2.4" /><path d="M1 1l2.6 2.6" /></>,
  broken: <path d="M-4 0h2.6M1.4 0H4M-1.2-2.6l-.6 1.8M1.2 2.6l.6-1.8" />,
  lock: <><rect x="-2.8" y="-0.6" width="5.6" height="4" rx="0.8" /><path d="M-1.6-0.6v-1.4a1.6 1.6 0 0 1 3.2 0v1.4" /></>,
  dots: <path d="M-2.6 0h.1M0 0h.1M2.6 0h.1" strokeWidth={2.2} strokeLinecap="round" />,
  speech: <path d="M-3.6-3h7.2v4.6h-3.6L-2 3.4v-1.8h-1.6z" />,
  package: <path d="M-3.4-1.6L0-3.4l3.4 1.8v3.6L0 3.8l-3.4-1.8zM-3.4-1.6L0 .2l3.4-1.8M0 .2v3.6" />,
  sun: <><circle r="1.8" /><path d="M0-4v1M0 3v1M-4 0h1M3 0h1M-2.8-2.8l.7.7M2.1 2.1l.7.7M2.8-2.8l-.7.7M-2.1 2.1l-.7.7" /></>,
  retry: <path d="M2.8-1.2A3 3 0 1 0 3 1.4M3-3v2h-2" />,
  calendar: <><rect x="-3.4" y="-2.6" width="6.8" height="6" rx="0.8" /><path d="M-3.4-0.6h6.8M-1.6-3.8v2M1.6-3.8v2" /></>,
  bell: <path d="M-2.6 1.6V-0.4a2.6 2.6 0 0 1 5.2 0v2l.8.8h-6.8zM-0.8 3.2a.9.9 0 0 0 1.6 0" />,
  flame: <path d="M0-4c.5 2 2.8 3 2.8 5.6a2.8 2.8 0 0 1-5.6 0c0-1.4.8-2.2 1.5-2.8 0 1 .4 1.5.9 1.7-.2-1.6 0-3 .4-4.5z" fill="currentColor" />,
  "flame-outline": <path d="M0-4c.5 2 2.8 3 2.8 5.6a2.8 2.8 0 0 1-5.6 0c0-1.4.8-2.2 1.5-2.8 0 1 .4 1.5.9 1.7-.2-1.6 0-3 .4-4.5z" strokeDasharray="1.4 1.2" />,
};

export function Badge({ id, x = 39, y = 9, title }: { id: BadgeId; x?: number; y?: number; title?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} className="ozv-badge">
      {title && <title>{title}</title>}
      <circle r="7.5" className="ozv-badge-bg" />
      <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{BADGE_ICONS[id]}</g>
    </g>
  );
}

export interface GlyphProps {
  glyph: GlyphId;
  t: Treatment;
  size?: number;
  /** Extra overlay badges (beyond the state badge), drawn bottom-right then bottom-left. */
  overlays?: Array<{ badge: BadgeId; title: string }>;
  title?: string;
  className?: string;
}

export function Glyph({ glyph, t, size = 48, overlays = [], title, className }: GlyphProps) {
  const uid = useId().replace(/:/g, "");
  const hatchId = `ozv-h-${uid}`;
  const dash = DASH[t.outline ?? "solid"];
  const fillMode = t.fill ?? "solid";
  const bodyFill = fillMode === "solid" ? "currentColor" : fillMode === "hatched" ? `url(#${hatchId})` : fillMode === "muted" ? "currentColor" : "none";
  const bodyFillOpacity = fillMode === "solid" ? 0.2 : fillMode === "muted" ? 0.06 : 1;
  const common = { stroke: "currentColor", strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, strokeDasharray: dash };
  const g: G = {
    B: { ...common, fill: bodyFill, fillOpacity: bodyFillOpacity },
    L: { ...common, fill: "none" },
    F: { fill: fillMode === "hatched" ? `url(#${hatchId})` : "currentColor", fillOpacity: fillMode === "muted" ? 0.25 : 0.6, stroke: "none" },
    lvl: t.level ?? 0.5,
    n: t.count ?? 3,
    flow: t.motion === "flow" ? "ozv-flow" : undefined,
    hatch: `url(#${hatchId})`,
  };
  const draw = GLYPHS[glyph] ?? GLYPHS.document;
  return (
    <svg viewBox="-2 -2 52 52" width={size} height={size} className={["ozv-glyph", fillMode === "muted" ? "ozv-muted" : "", className ?? ""].join(" ")} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="currentColor" fillOpacity={0.08} />
          <path d="M0 0v5" stroke="currentColor" strokeWidth={1.6} strokeOpacity={0.6} />
        </pattern>
      </defs>
      {draw(g)}
      {t.badge && <Badge id={t.badge} />}
      {overlays.slice(0, 2).map((o, i) => (<Badge key={i} id={o.badge} x={i === 0 ? 39 : 9} y={39} title={o.title} />))}
    </svg>
  );
}
