// @ts-nocheck
/**
 * worldMapEngine.ts — VERBATIM port of the v2 design-handoff canvas engine.
 *
 * Concatenated, in load order, from design_handoff_twin_world_map-2/prototype/:
 *   world-iso.js  →  world-interiors.js  →  world-city.js  →  world-map.js
 *
 * Plain canvas IIFEs that attach to window globals (window.OzyIso /
 * window.OzyCity); kept byte-for-byte. The only module wiring added is the
 * typed `export` of createWorldMap and the types below.
 *
 * Local changes for the reusable lead-case demo (search for `cs.theme`,
 * `SLOTS`, `ties = (cs.ties`, `perceptions: []`): the world theme comes from
 * the case data (org-type rule) instead of a hard-coded case id; campus
 * departments are assigned from any teams; macro ties come from `cs.ties`;
 * the inside levels are disabled when no teams are configured; and the micro
 * level shows configured roles only — no invented moods, fears, wishes,
 * perceptions, department heads or policy makers.
 * Network cases (search for `byRing`, `city-`, `M.isles`, `f.ties`): island
 * places can choose an inner / outer ring and keep full detail, faint lines
 * show every configured connection between islands, offices can use
 * city-flavoured buildings, the meso level lays teams out as separate
 * islands, and the micro level draws configured role-to-role links.
 * Input is built by src/lib/lead/engineCase.ts.
 */

export type WorldLevel = "macro" | "meso" | "micro";

export interface WorldMapItem {
  kind: string;
  id: string;
  label: string;
  note?: string;
  status?: string;
  view?: { word: string; cat: string };
  tags?: Array<{ label: string; cat?: string }>;
  action?: { label: string; to?: WorldLevel; floorId?: string } | null;
  [k: string]: unknown;
}

export interface WorldMapOptions {
  onSelect?: (item: WorldMapItem | null, point: { x: number; y: number } | null) => void;
  onLevel?: (level: WorldLevel, floorId?: string | null) => void;
}

export interface WorldMapController {
  setCase: (c: unknown) => void;
  setLevel: (level: WorldLevel, floorId?: string | null) => void;
  getLevel: () => WorldLevel;
  getFloor: () => string | null;
  rotate: (dir: number) => void;
  zoom: (f: number) => void;
  relabel: (names: Record<string, string>) => void;
  setInset: (px: number) => void;
  setEffects: (map: Record<string, [string, string]> | null, hot?: unknown[]) => void;
  ripple: () => void;
  spotlight: (id: string | null) => void;
  select: (id: string | null) => void;
  renderNow: (n?: number) => void;
  destroy: () => void;
}

// ─── prototype/world-iso.js ─────────────────────────────────────────
// Ozy iso kit — isometric drawing primitives for the system maps (canvas port of the ozy_iso grammar).
// 2:1 projection: x = OX + (gx − gy)·0.866·S , y = OY + (gx + gy)·0.5·S − h·S, with a yaw around the world pivot.
(function () {
  const PAL = {
    surface: '#0E1A21', meso: '#15232A', ground: '#1A2B33', groundSide: '#132229', groundSideR: '#0F1C22',
    top: '#2F4753', left: '#1E3039', right: '#172832', water: '#1D4A57', waterHi: '#2A6273',
    road: '#22363F', roadLine: 'rgba(253,230,138,0.28)', lot: '#1E323B',
    tree: ['#4A8580', '#7FA89A', '#A9C97A'], roofs: ['#E89A82', '#93B4AF', '#9DBFD1', '#D5E6A7', '#C9B7BE', '#E2D9C7'],
    field: ['#2F4A3B', '#3B5636', '#4A5A33', '#2E4A47'], window: 'rgba(253,230,138,0.55)', glass: '#5EEAD4',
    pill: 'rgba(19,34,42,0.88)', ink: '#F6F3EC', muted: '#C3CFD4', subtle: '#9FB3BC', line: '#2A3F47', cream: '#F4EFE6',
    cat: { culture: '#C4B5FD', emotion: '#F9A8D4', decision: '#93C5FD', trust: '#FDE68A', direction: '#D9F23A', harm: '#FF7A5C', earth: '#5EEAD4', flow: '#D8CDB8' },
    brand: '#9B7BFF', scale: '#3D8BFF', risk: '#FF5A3C', warn: '#F97316',
    own: '#9B7BFF', ownWall: { top: '#4C3E86', left: '#3B2F6E', right: '#2C2356' }, ownRoofs: ['#9B7BFF', '#B9A3FF', '#8A63F5', '#C4B5FD', '#A68BFF', '#B9A3FF'], ownLot: '#2A2A52',
  };
  const NEUTRAL = { top: PAL.top, left: PAL.left, right: PAL.right };
  let TINT = null; const neu = () => TINT || NEUTRAL; const setTint = (t) => { TINT = t; };
  const tintCol = (col) => { if (!TINT || col === TINT || !/^#/.test(col.top || '') || !/^#/.test(col.left || '')) return col; return { top: mix(col.top, '#9B7BFF', 0.5), left: mix(col.left, '#5B42B8', 0.45), right: mix(col.right, '#3F2E86', 0.45) }; };
  function hexRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return 'rgb(' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t)).join(',') + ')'; }
  function rgba(h, a) { const c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function cam() { return { W: 0, H: 0, S: 22, yaw: 0, fx: 0, fy: 0, fh: 0, ox: 0, oy: 0, cy0: 0.52, c: 1, s: 0, frx: 0, fry: 0 }; }
  function rot(k, gx, gy) { const dx = gx - k.ox, dy = gy - k.oy; return [dx * k.c - dy * k.s, dx * k.s + dy * k.c]; }
  function prep(k) { k.c = Math.cos(k.yaw); k.s = Math.sin(k.yaw); const r = rot(k, k.fx, k.fy); k.frx = r[0]; k.fry = r[1]; }
  function P(k, gx, gy, h) {
    const r = rot(k, gx, gy), x = r[0] - k.frx, y = r[1] - k.fry;
    return { x: k.W / 2 + (x - y) * 0.866 * k.S, y: k.H * k.cy0 + (x + y) * 0.5 * k.S - ((h || 0) - k.fh) * k.S, d: r[0] + r[1] };
  }
  const depth = (k, gx, gy) => { const r = rot(k, gx, gy); return r[0] + r[1]; };
  function side(k, nx, ny) { const rx = nx * k.c - ny * k.s, ry = nx * k.s + ny * k.c; return { vis: rx + ry > 0.001, left: rx - ry < 0 }; }
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); }

  function box(ctx, k, gx, gy, w, d, h0, h1, col, o) {
    col = tintCol(col || neu()); o = o || {};
    const x0 = gx - w / 2, x1 = gx + w / 2, y0 = gy - d / 2, y1 = gy + d / 2;
    const sides = [[x0, y0, x1, y0, 0, -1], [x1, y0, x1, y1, 1, 0], [x1, y1, x0, y1, 0, 1], [x0, y1, x0, y0, -1, 0]];
    for (const [ax, ay, bx, by, nx, ny] of sides) {
      const sh = side(k, nx, ny); if (!sh.vis) continue;
      poly(ctx, [P(k, ax, ay, h0), P(k, bx, by, h0), P(k, bx, by, h1), P(k, ax, ay, h1)]);
      ctx.fillStyle = sh.left ? col.left : col.right; ctx.fill();
      if (o.edge) { ctx.strokeStyle = o.edge; ctx.lineWidth = 1; ctx.stroke(); }
      if (o.windows) {
        const rows = Math.max(1, Math.floor((h1 - h0) / 0.55)), len = Math.hypot(bx - ax, by - ay), cols = Math.max(1, Math.floor(len / 0.45));
        ctx.strokeStyle = o.windows; ctx.lineWidth = Math.max(1, k.S * 0.06); ctx.lineCap = 'round';
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const u0 = (c + 0.3) / cols, u1 = (c + 0.62) / cols, hh = h0 + (r + 0.55) * (h1 - h0) / rows;
          const p = P(k, ax + (bx - ax) * u0, ay + (by - ay) * u0, hh), q = P(k, ax + (bx - ax) * u1, ay + (by - ay) * u1, hh);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
    }
    poly(ctx, [P(k, x0, y0, h1), P(k, x1, y0, h1), P(k, x1, y1, h1), P(k, x0, y1, h1)]);
    ctx.fillStyle = col.top; ctx.fill();
    if (o.topEdge) { ctx.strokeStyle = o.topEdge; ctx.lineWidth = o.topW || 1; ctx.stroke(); }
  }
  function gable(ctx, k, gx, gy, w, d, h0, rh, roof, wall) {
    wall = wall || neu();
    const x0 = gx - w / 2, x1 = gx + w / 2, y0 = gy - d / 2, y1 = gy + d / 2, hr = h0 + rh;
    const slopes = [{ n: [0, -1], pts: [[x0, y0, h0], [x1, y0, h0], [x1, gy, hr], [x0, gy, hr]] }, { n: [0, 1], pts: [[x0, y1, h0], [x1, y1, h0], [x1, gy, hr], [x0, gy, hr]] }];
    slopes.sort((a, b) => (side(k, a.n[0], a.n[1]).vis ? 1 : 0) - (side(k, b.n[0], b.n[1]).vis ? 1 : 0));
    for (const s of slopes) { const sh = side(k, s.n[0], s.n[1]); poly(ctx, s.pts.map((p) => P(k, p[0], p[1], p[2]))); ctx.fillStyle = sh.left ? roof : mix(roof, '#0E1A21', 0.22); ctx.fill(); }
    for (const [xx, nx] of [[x0, -1], [x1, 1]]) {
      const sh = side(k, nx, 0); if (!sh.vis) continue;
      poly(ctx, [P(k, xx, y0, h0), P(k, xx, y1, h0), P(k, xx, gy, hr)]); ctx.fillStyle = sh.left ? wall.left : wall.right; ctx.fill();
    }
  }
  function house(ctx, k, gx, gy, w, d, h, roof, o) {
    o = o || {};
    box(ctx, k, gx, gy, w, d, 0, h, o.wall || neu(), { windows: o.windows === false ? null : PAL.window });
    gable(ctx, k, gx, gy, w + 0.08, d + 0.08, h, Math.min(w, d) * 0.42, roof, o.wall);
  }
  function saw(ctx, k, gx, gy, w, d, h, roof, teeth) {
    box(ctx, k, gx, gy, w, d, 0, h, neu(), { windows: PAL.window });
    teeth = teeth || 3;
    const x0 = gx - w / 2, y0 = gy - d / 2, y1 = gy + d / 2, tw = w / teeth, th = Math.min(0.7, tw * 0.6);
    const order = [...Array(teeth).keys()].sort((a, b) => depth(k, x0 + (a + 0.5) * tw, gy) - depth(k, x0 + (b + 0.5) * tw, gy));
    for (const i of order) {
      const xa = x0 + i * tw, xb = xa + tw;
      const sf = side(k, -1, 0);
      if (sf.vis) { poly(ctx, [P(k, xa, y0, h), P(k, xa, y1, h), P(k, xa, y1, h + th), P(k, xa, y0, h + th)]); ctx.fillStyle = rgba(PAL.glass, 0.55); ctx.fill(); }
      for (const [yy, ny] of [[y0, -1], [y1, 1]]) { const sh = side(k, 0, ny); if (!sh.vis) continue; poly(ctx, [P(k, xa, yy, h), P(k, xb, yy, h), P(k, xa, yy, h + th)]); ctx.fillStyle = sh.left ? neu().left : neu().right; ctx.fill(); }
      poly(ctx, [P(k, xa, y0, h + th), P(k, xa, y1, h + th), P(k, xb, y1, h), P(k, xb, y0, h)]); ctx.fillStyle = roof; ctx.fill();
      if (!sf.vis) { const sb = side(k, 1, 0); if (sb.vis) { poly(ctx, [P(k, xa, y0, h), P(k, xa, y1, h), P(k, xa, y1, h + th), P(k, xa, y0, h + th)]); ctx.globalAlpha *= 1; } }
    }
  }
  function cyl(ctx, k, gx, gy, r, h0, h1, col) {
    col = tintCol(col || neu());
    const b = P(k, gx, gy, h0), t = P(k, gx, gy, h1), rx = r * k.S * 1.2247, ry = r * k.S * 0.7071;
    const g = ctx.createLinearGradient(b.x - rx, 0, b.x + rx, 0); g.addColorStop(0, col.left); g.addColorStop(1, col.right);
    ctx.beginPath(); ctx.moveTo(t.x - rx, t.y); ctx.lineTo(b.x - rx, b.y); ctx.ellipse(b.x, b.y, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(t.x + rx, t.y); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(t.x, t.y, rx, ry, 0, 0, 7); ctx.fillStyle = col.top; ctx.fill();
  }
  function tree(ctx, k, gx, gy, sz, colr, pine, h0) {
    h0 = h0 || 0; const b = P(k, gx, gy, h0), t = P(k, gx, gy, h0 + 0.55 * sz);
    ctx.strokeStyle = '#3A2F28'; ctx.lineWidth = Math.max(1, k.S * 0.06); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    const r = k.S * 0.3 * sz;
    if (pine) { ctx.beginPath(); ctx.moveTo(t.x, t.y - r * 2.4); ctx.lineTo(t.x + r, t.y + r * 0.3); ctx.lineTo(t.x - r, t.y + r * 0.3); ctx.closePath(); ctx.fillStyle = colr; ctx.fill(); return; }
    ctx.beginPath(); ctx.arc(t.x, t.y - r * 0.6, r, 0, 7); ctx.fillStyle = colr; ctx.fill();
    ctx.beginPath(); ctx.arc(t.x - r * 0.3, t.y - r * 0.9, r * 0.45, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  }
  function person(ctx, k, gx, gy, h, colr) {
    const p = P(k, gx, gy, h || 0), s = Math.max(2, k.S * 0.09);
    ctx.fillStyle = colr || PAL.cream;
    ctx.beginPath(); ctx.ellipse(p.x, p.y - s * 1.4, s * 0.8, s * 1.4, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y - s * 3.4, s * 0.75, 0, 7); ctx.fill();
  }
  function groundRect(ctx, k, x0, y0, x1, y1, h, fill) { poly(ctx, [P(k, x0, y0, h), P(k, x1, y0, h), P(k, x1, y1, h), P(k, x0, y1, h)]); ctx.fillStyle = fill; ctx.fill(); }
  function groundEllipse(ctx, k, gx, gy, r, h) { const p = P(k, gx, gy, h || 0); ctx.beginPath(); ctx.ellipse(p.x, p.y, r * k.S * 1.2247, r * k.S * 0.7071, 0, 0, 7); return p; }
  function aura(ctx, x, y, r, colr, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(colr, a == null ? 0.2 : a)); g.addColorStop(1, rgba(colr, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  function ribbon(ctx, a, b, colr, t, lift, alpha) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - (lift == null ? Math.max(30, Math.hypot(b.x - a.x, b.y - a.y) * 0.32) : lift);
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.strokeStyle = rgba(colr, 0.12); ctx.lineWidth = 6; ctx.stroke();
    ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.lineDashOffset = -(t || 0) * 14; ctx.strokeStyle = colr; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function textW(ctx, font, txt, ls) { ctx.font = font; if ('letterSpacing' in ctx) ctx.letterSpacing = ls || '0px'; const w = ctx.measureText(txt).width; return w; }
  // kind: place (solid) · label (dashed italic, intangible) · plan (solid fill) · risk · tag (mono, no pill)
  function pill(ctx, x, y, text, o) {
    o = o || {};
    const kind = o.kind || 'place', colr = o.col || PAL.subtle;
    if (kind === 'tag') {
      ctx.font = 'italic 500 11.5px Figtree, sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      const tx = String(text).replace(/^./, (ch) => ch.toUpperCase());
      ctx.fillStyle = colr; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tx, x, y);
      const w = ctx.measureText(tx).width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic';
      return { x0: x - w / 2, y0: y - 7, x1: x + w / 2, y1: y + 7 };
    }
    const font = kind === 'label' || kind === 'mono' ? 'italic 500 12.5px Figtree, sans-serif' : '600 12.5px Figtree, sans-serif';
    const txt = String(text);
    const w = textW(ctx, font, txt, '0px') + (o.dot ? 32 : 22), h = 24;
    const x0 = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2, y0 = y - h / 2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, w, h, h / 2) : ctx.rect(x0, y0, w, h);
    ctx.fillStyle = kind === 'plan' ? colr : PAL.pill; ctx.fill();
    if (kind === 'label') ctx.setLineDash([3, 3]);
    ctx.strokeStyle = kind === 'place' ? (o.col ? colr : 'rgba(195,207,212,0.55)') : colr; ctx.lineWidth = o.strong ? 2 : 1.2; ctx.stroke(); ctx.setLineDash([]);
    if (o.dot) { ctx.beginPath(); ctx.arc(x0 + 14, y, 4, 0, 7); ctx.fillStyle = o.dot; ctx.fill(); }
    ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = kind === 'plan' ? '#0E1A21' : o.textCol || PAL.ink;
    ctx.fillText(txt, x0 + (o.dot ? 24 : 11), y + 0.5);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic';
    return { x0, y0, x1: x0 + w, y1: y0 + h };
  }
  // ——— Sims-like persona avatars (simulated stand-ins, not real people) ———
  const SKIN = ['#F1C7A5', '#E3AE84', '#C98D66', '#A06A46', '#74503A'], HAIR = ['#2B1D16', '#5A3A22', '#A8743F', '#D9B77C', '#1E1E24', '#8C8C94', '#B5523B'], PANTS = ['#2E3A48', '#3D3550', '#4A4036', '#25303A', '#3B4B44'];
  const SHIRTS = ['#9DBFD1', '#E89A82', '#D5E6A7', '#C9B7BE', '#93B4AF', '#E2D9C7', '#B9A3FF', '#FDE68A'];
  function look(seed) { const r = rng(seed); return { skin: SKIN[Math.floor(r() * 5)], hair: HAIR[Math.floor(r() * 7)], pants: PANTS[Math.floor(r() * 5)], shirt: SHIRTS[Math.floor(r() * 8)], style: Math.floor(r() * 4) }; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else ctx.rect(x, y, w, h); ctx.fill(); }
  // x, y = feet; s = unit in px (avatar is ~6.6·s tall)
  function avatar(ctx, x, y, s, lk, o) {
    o = o || {}; const bob = o.bob || 0, sh = o.shirt || lk.shirt;
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.beginPath(); ctx.ellipse(x, y, s * 1.5, s * 0.55, 0, 0, 7); ctx.fill();
    y -= bob;
    const step = o.walk ? Math.sin(o.walk) * s * 0.35 : 0;
    ctx.fillStyle = lk.pants; rr(ctx, x - s * 0.78 + step * 0.3, y - s * 2.3, s * 0.68, s * 2.3, s * 0.3); rr(ctx, x + s * 0.1 - step * 0.3, y - s * 2.3, s * 0.68, s * 2.3, s * 0.3);
    ctx.fillStyle = mix(lk.pants, '#000000', 0.35); rr(ctx, x - s * 0.85, y - s * 0.35, s * 0.8, s * 0.38, s * 0.18); rr(ctx, x + s * 0.05, y - s * 0.35, s * 0.8, s * 0.38, s * 0.18);
    ctx.fillStyle = sh; rr(ctx, x - s * 1.08, y - s * 4.5, s * 2.16, s * 2.6, s * 0.75);
    ctx.fillStyle = mix(sh, '#0E1A21', 0.18);
    if (o.wave) { rr(ctx, x + s * 0.85, y - s * 6.1, s * 0.52, s * 2.0, s * 0.26); ctx.fillStyle = lk.skin; ctx.beginPath(); ctx.arc(x + s * 1.1, y - s * 6.2, s * 0.32, 0, 7); ctx.fill(); ctx.fillStyle = mix(sh, '#0E1A21', 0.18); }
    else rr(ctx, x + s * 0.92, y - s * 4.25, s * 0.5, s * 2.0, s * 0.25);
    rr(ctx, x - s * 1.42, y - s * 4.25, s * 0.5, s * 2.0, s * 0.25);
    ctx.fillStyle = lk.skin; ctx.beginPath(); ctx.arc(x - s * 1.17, y - s * 2.2, s * 0.3, 0, 7); ctx.fill(); if (!o.wave) { ctx.beginPath(); ctx.arc(x + s * 1.17, y - s * 2.2, s * 0.3, 0, 7); ctx.fill(); }
    ctx.fillStyle = lk.skin; rr(ctx, x - s * 0.3, y - s * 4.9, s * 0.6, s * 0.6, s * 0.2);
    const hy = y - s * 5.65, hr = s * 1.08;
    if (lk.style === 1) { ctx.fillStyle = lk.hair; rr(ctx, x - hr * 1.05, hy - hr * 0.4, hr * 2.1, hr * 1.9, hr * 0.6); }
    ctx.fillStyle = lk.skin; ctx.beginPath(); ctx.arc(x, hy, hr, 0, 7); ctx.fill();
    ctx.fillStyle = lk.hair;
    if (lk.style !== 3) { ctx.beginPath(); ctx.arc(x, hy - hr * 0.12, hr * 1.04, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, hy - hr * 0.35, hr * 0.92, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill(); }
    if (lk.style === 2) { ctx.beginPath(); ctx.arc(x, hy - hr * 1.15, hr * 0.42, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#1B1B22'; ctx.beginPath(); ctx.arc(x - hr * 0.36, hy + hr * 0.05, Math.max(0.8, hr * 0.11), 0, 7); ctx.arc(x + hr * 0.36, hy + hr * 0.05, Math.max(0.8, hr * 0.11), 0, 7); ctx.fill();
    if (s >= 3.5) {
      ctx.strokeStyle = '#5A2E24'; ctx.lineWidth = Math.max(1, s * 0.16); ctx.lineCap = 'round'; ctx.beginPath();
      if (o.mood === 'bad') ctx.arc(x, hy + hr * 0.62, hr * 0.28, Math.PI * 1.15, Math.PI * 1.85); else if (o.mood === 'good') ctx.arc(x, hy + hr * 0.3, hr * 0.32, Math.PI * 0.15, Math.PI * 0.85); else { ctx.moveTo(x - hr * 0.22, hy + hr * 0.45); ctx.lineTo(x + hr * 0.22, hy + hr * 0.45); }
      ctx.stroke(); ctx.lineCap = 'butt';
    }
    if (o.stress) { ctx.fillStyle = '#93C5FD'; ctx.beginPath(); ctx.moveTo(x + hr * 1.05, hy - hr * 0.55); ctx.quadraticCurveTo(x + hr * 1.45, hy - hr * 0.05, x + hr * 1.05, hy + hr * 0.12); ctx.quadraticCurveTo(x + hr * 0.75, hy - hr * 0.1, x + hr * 1.05, hy - hr * 0.55); ctx.fill(); }
    return { top: hy - hr, x };
  }
  // ——— furniture ———
  const WOOD = { top: '#B08A62', left: '#7A5C44', right: '#5E4634' }, DARK = { top: '#2A3640', left: '#1E2830', right: '#161E25' }, METAL = { top: '#8696A0', left: '#5E6C75', right: '#47535B' };
  function furniture(ctx, k, kind, gx, gy, h0, r) {
    const b = (x, y, w, d, a, z, c, o) => box(ctx, k, gx + x, gy + y, w, d, h0 + a, h0 + z, c, o);
    switch (kind) {
      case 'desk': b(0, 0, 1.1, 0.6, 0.38, 0.46, WOOD); b(-0.45, 0, 0.08, 0.5, 0, 0.38, WOOD); b(0.45, 0, 0.08, 0.5, 0, 0.38, WOOD); b(0, -0.12, 0.5, 0.06, 0.46, 0.82, DARK, { edge: rgba(PAL.glass, 0.6) }); b(0, 0.55, 0.38, 0.36, 0, 0.3, { top: '#5B4C82', left: '#463A66', right: '#382E52' }); break;
      case 'machine': b(0, 0, 1.3, 0.95, 0, 0.95, METAL); b(0.3, -0.1, 0.4, 0.3, 0.95, 1.15, DARK); { const p = P(k, gx - 0.3, gy + 0.2, h0 + 0.96); ctx.fillStyle = PAL.cat.earth; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, k.S * 0.08), 0, 7); ctx.fill(); } break;
      case 'conveyor': b(0, 0, 2.2, 0.5, 0.2, 0.38, DARK); b(-0.6, 0, 0.36, 0.34, 0.38, 0.7, { top: '#D9B88E', left: '#B08A62', right: '#8E6E4E' }); b(0.4, 0, 0.36, 0.34, 0.38, 0.7, { top: '#D9B88E', left: '#B08A62', right: '#8E6E4E' }); break;
      case 'pallet': b(0, 0, 0.95, 0.95, 0, 0.14, WOOD); b(-0.2, -0.2, 0.42, 0.42, 0.14, 0.56, { top: '#D9B88E', left: '#B08A62', right: '#8E6E4E' }); b(0.22, 0.2, 0.42, 0.42, 0.14, 0.56, { top: '#D9B88E', left: '#B08A62', right: '#8E6E4E' }); b(-0.2, -0.2, 0.42, 0.42, 0.56, 0.98, { top: '#D9B88E', left: '#B08A62', right: '#8E6E4E' }); break;
      case 'shelf': b(0, 0, 0.4, 1.3, 0, 1.35, WOOD); b(0, 0, 0.42, 1.2, 0.45, 0.52, { top: '#E89A82', left: '#C77D68', right: '#A86553' }); b(0, 0, 0.42, 1.2, 0.95, 1.02, { top: '#9DBFD1', left: '#7FA0B2', right: '#678896' }); break;
      case 'plant': cyl(ctx, k, gx, gy, 0.2, h0, h0 + 0.32, { top: '#3A2F28', left: '#C0674E', right: '#94503D' }); tree(ctx, k, gx, gy, 0.7 + r * 0.3, PAL.tree[Math.floor(r * 3)], r > 0.7, h0 + 0.3); break;
      case 'bench': b(0, 0, 1.5, 0.6, 0, 0.55, { top: '#D7E2E3', left: '#9FB0B3', right: '#7F9195' }); b(0.3, 0, 0.5, 0.4, 0.55, 0.9, { top: rgba(PAL.glass, 0.25), left: rgba(PAL.glass, 0.18), right: rgba(PAL.glass, 0.12) }, { edge: rgba(PAL.glass, 0.8) }); break;
      case 'glass': b(0, 0, 1.1, 0.8, 0, 1.0, { top: rgba(PAL.glass, 0.16), left: rgba(PAL.glass, 0.12), right: rgba(PAL.glass, 0.08) }, { edge: rgba(PAL.glass, 0.85), topEdge: rgba(PAL.glass, 0.85) }); break;
      case 'sofa': b(0, 0.05, 1.3, 0.55, 0, 0.28, { top: '#8E7CC3', left: '#6E5DA3', right: '#574985' }); b(0, -0.25, 1.3, 0.16, 0.28, 0.6, { top: '#8E7CC3', left: '#6E5DA3', right: '#574985' }); break;
      case 'coffee': b(0, 0, 0.9, 0.45, 0, 0.62, WOOD); b(0.15, 0, 0.3, 0.26, 0.62, 0.95, DARK); break;
      case 'table': cyl(ctx, k, gx, gy, 0.6, h0 + 0.32, h0 + 0.42, WOOD); cyl(ctx, k, gx, gy, 0.08, h0, h0 + 0.32, WOOD); break;
      case 'screen': b(0, 0, 0.1, 1.3, 0.3, 1.2, { top: '#E9E6DE', left: '#E9E6DE', right: '#CFCBC2' }, { edge: 'rgba(0,0,0,0.25)' }); break;
      case 'bed': b(0, 0, 1.4, 0.8, 0, 0.22, { top: '#5A4632', left: '#46362A', right: '#372A21' }); tree(ctx, k, gx - 0.3, gy, 0.45, PAL.tree[2], false, h0 + 0.22); tree(ctx, k, gx + 0.3, gy, 0.5, PAL.tree[0], false, h0 + 0.22); break;
      case 'shed': house(ctx, k, gx, gy, 1.2, 1, 0.8, PAL.roofs[3]); break;
      case 'cones': cyl(ctx, k, gx - 0.3, gy, 0.16, h0, h0 + 0.4, { top: '#FDE68A', left: '#E9C85A', right: '#C9A73F' }); cyl(ctx, k, gx + 0.3, gy + 0.2, 0.16, h0, h0 + 0.4, { top: '#FDE68A', left: '#E9C85A', right: '#C9A73F' }); break;
      default: b(0, 0, 0.8, 0.8, 0, 0.5, WOOD);
    }
  }
  const __prev = window.OzyIso; window.OzyIso = { PAL, NEUTRAL, neu, setTint, look, avatar, furniture, mix, rgba, hash, rng, cam, prep, P, depth, rot, side, poly, box, gable, house, saw, cyl, tree, person, groundRect, groundEllipse, aura, ribbon, pill }; if (__prev && __prev.__ext) __prev.__ext(window.OzyIso);
})();

// ─── prototype/world-interiors.js ───────────────────────────────────
// Ozy iso kit — interiors & people (loads after world-iso.js and replaces look / avatar / furniture).
// Persona avatars are simulated stand-ins, not real people.
(function () {
  function install(I) {
  const { P, box, cyl, tree, rgba, mix, rng, groundRect, poly } = I;
  const SKIN = ['#F3D2B8', '#E8B992', '#D19A73', '#A8724E', '#7C5238', '#5B3B2A'];
  const HAIR = ['#2A1D17', '#4B3022', '#7A4E2D', '#B8875A', '#D8BE8E', '#1C1C20', '#9A9AA2', '#8E3B25'];
  const TOPS = ['#E9E4DA', '#9DB4C8', '#2F3A4A', '#C9846A', '#7E9B7E', '#D9C6A5', '#5E5470', '#E3C56E', '#B7C4CC', '#F4F1EC'];
  const OUTER = ['#3A3F4A', '#6B5A4A', '#2B3A55', '#8C8F86', '#A65A43', '#4E5E52'];
  const PANTS = ['#2E3642', '#3E4A5C', '#4A4036', '#6B6E72', '#B9A98C', '#1F2329', '#55606E'];
  const SHOES = ['#1E1E22', '#E9E6E0', '#5A3A26', '#2B2B30'];
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function look(seed) {
    const r = rng(seed);
    return { skin: pick(r, SKIN), hair: pick(r, HAIR), hairStyle: Math.floor(r() * 7), top: pick(r, TOPS), outer: r() < 0.45 ? pick(r, OUTER) : null, pants: pick(r, PANTS), skirt: r() < 0.2, shoes: pick(r, SHOES), glasses: r() < 0.24, build: 0.92 + r() * 0.16, style: 0 };
  }
  const shade = (c, t) => mix(c, '#0B0F14', t), light = (c, t) => mix(c, '#FFFFFF', t);
  function grad(ctx, x0, x1, y, c) { const g = ctx.createLinearGradient(x0, y, x1, y); g.addColorStop(0, light(c, 0.12)); g.addColorStop(0.55, c); g.addColorStop(1, shade(c, 0.22)); return g; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); else ctx.rect(x, y, w, h); }
  function limb(ctx, ax, ay, bx, by, w0, w1) {
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.beginPath(); ctx.moveTo(ax + nx * w0 / 2, ay + ny * w0 / 2); ctx.lineTo(bx + nx * w1 / 2, by + ny * w1 / 2);
    ctx.arc(bx, by, w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI); ctx.lineTo(ax - nx * w0 / 2, ay - ny * w0 / 2);
    ctx.arc(ax, ay, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI); ctx.closePath();
  }
  function torsoPath(ctx, x, yS, yW, ws, ww) {
    ctx.beginPath(); ctx.moveTo(x - ws * 0.38, yS - 0.02 * ws);
    ctx.quadraticCurveTo(x - ws * 0.52, yS, x - ws * 0.52, yS + ws * 0.2);
    ctx.lineTo(x - ww / 2, yW); ctx.quadraticCurveTo(x, yW + ws * 0.06, x + ww / 2, yW);
    ctx.lineTo(x + ws * 0.52, yS + ws * 0.2); ctx.quadraticCurveTo(x + ws * 0.52, yS, x + ws * 0.38, yS - 0.02 * ws); ctx.closePath();
  }
  // x, y = feet; s = unit in px (figure is ~7·s tall). o: { bob, walk, mood, stress, wave, vest }
  function avatar(ctx, x, y, s, lk, o) {
    o = o || {}; lk = lk.top ? lk : look(1);
    const b = lk.build, detail = s >= 2.6, fine = s >= 5.5;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, s * 1.15, s * 0.4, 0, 0, 7); ctx.fill();
    y -= o.bob || 0;
    const step = o.walk ? Math.sin(o.walk) * s * 0.28 : 0, hipY = y - s * 3.15, waistY = y - s * 3.25, shY = y - s * 5.2;
    const ws = s * 1.85 * b, ww = s * 1.3 * b;
    // legs + shoes
    const legW = s * 0.5, lx = x - s * 0.27, rx = x + s * 0.27;
    if (lk.skirt) {
      ctx.fillStyle = shade(lk.skin, 0.1); limb(ctx, lx, y - s * 2.1, lx - step, y - s * 0.3, legW * 0.8, legW * 0.62); ctx.fill(); limb(ctx, rx, y - s * 2.1, rx + step, y - s * 0.3, legW * 0.8, legW * 0.62); ctx.fill();
      ctx.fillStyle = grad(ctx, x - s, x + s, 0, lk.pants); ctx.beginPath(); ctx.moveTo(x - ww * 0.52, waistY); ctx.lineTo(x + ww * 0.52, waistY); ctx.lineTo(x + s * 0.92, y - s * 1.75); ctx.quadraticCurveTo(x, y - s * 1.6, x - s * 0.92, y - s * 1.75); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = shade(lk.pants, 0.12); limb(ctx, lx, hipY, lx - step, y - s * 0.3, legW * 1.05, legW * 0.78); ctx.fill();
      ctx.fillStyle = lk.pants; limb(ctx, rx, hipY, rx + step, y - s * 0.3, legW * 1.05, legW * 0.78); ctx.fill();
      ctx.fillStyle = grad(ctx, x - ww / 2, x + ww / 2, 0, lk.pants); rr(ctx, x - ww * 0.5, waistY, ww, s * 0.55, s * 0.2); ctx.fill();
    }
    ctx.fillStyle = lk.shoes; rr(ctx, lx - step - s * 0.32, y - s * 0.42, s * 0.62, s * 0.36, s * 0.16); ctx.fill(); rr(ctx, rx + step - s * 0.3, y - s * 0.42, s * 0.62, s * 0.36, s * 0.16); ctx.fill();
    // arms (behind torso edges)
    const sleeve = lk.outer || lk.top, armW = s * 0.44, swing = o.walk ? -step * 0.6 : 0;
    ctx.fillStyle = shade(sleeve, 0.14); limb(ctx, x - ws * 0.44, shY + s * 0.3, x - ws * 0.56 + swing, y - s * 3.0, armW, armW * 0.8); ctx.fill();
    if (!o.wave) { ctx.fillStyle = shade(sleeve, 0.2); limb(ctx, x + ws * 0.44, shY + s * 0.3, x + ws * 0.56 - swing, y - s * 3.0, armW, armW * 0.8); ctx.fill(); }
    ctx.fillStyle = lk.skin; ctx.beginPath(); ctx.arc(x - ws * 0.56 + swing, y - s * 2.85, s * 0.2, 0, 7); ctx.fill(); if (!o.wave) { ctx.beginPath(); ctx.arc(x + ws * 0.56 - swing, y - s * 2.85, s * 0.2, 0, 7); ctx.fill(); }
    // torso
    ctx.fillStyle = grad(ctx, x - ws / 2, x + ws / 2, 0, lk.outer || lk.top); torsoPath(ctx, x, shY, waistY + s * 0.08, ws, ww); ctx.fill();
    if (lk.outer && detail) {
      ctx.fillStyle = grad(ctx, x - s * 0.3, x + s * 0.3, 0, lk.top); ctx.beginPath(); ctx.moveTo(x - s * 0.26, shY - s * 0.02); ctx.lineTo(x + s * 0.26, shY - s * 0.02); ctx.lineTo(x + s * 0.12, waistY + s * 0.05); ctx.lineTo(x - s * 0.12, waistY + s * 0.05); ctx.closePath(); ctx.fill();
      if (fine) { ctx.strokeStyle = shade(lk.outer, 0.35); ctx.lineWidth = Math.max(0.8, s * 0.05); ctx.beginPath(); ctx.moveTo(x - s * 0.27, shY); ctx.lineTo(x - s * 0.1, shY + s * 0.9); ctx.moveTo(x + s * 0.27, shY); ctx.lineTo(x + s * 0.1, shY + s * 0.9); ctx.stroke(); }
    } else if (fine) { ctx.strokeStyle = shade(lk.top, 0.25); ctx.lineWidth = Math.max(0.8, s * 0.05); ctx.beginPath(); ctx.arc(x, shY - s * 0.05, s * 0.28, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    if (o.vest) { ctx.fillStyle = '#F29A2E'; torsoPath(ctx, x, shY + s * 0.12, waistY, ws * 0.9, ww * 0.95); ctx.fill(); ctx.fillStyle = 'rgba(240,240,230,0.85)'; ctx.fillRect(x - ww * 0.47, y - s * 3.95, ww * 0.94, Math.max(1, s * 0.16)); ctx.fillStyle = lk.top; ctx.fillRect(x - s * 0.1, shY + s * 0.1, s * 0.2, s * 1.9); }
    if (o.wave) { ctx.fillStyle = shade(sleeve, 0.1); limb(ctx, x + ws * 0.44, shY + s * 0.25, x + ws * 0.72, shY - s * 1.3, armW, armW * 0.8); ctx.fill(); ctx.fillStyle = lk.skin; ctx.beginPath(); ctx.arc(x + ws * 0.74, shY - s * 1.45, s * 0.22, 0, 7); ctx.fill(); }
    // neck + head
    const hy = y - s * 6.05, hrx = s * 0.6, hry = s * 0.72;
    ctx.fillStyle = shade(lk.skin, 0.12); rr(ctx, x - s * 0.19, hy + hry * 0.6, s * 0.38, s * 0.6, s * 0.1); ctx.fill();
    const H = lk.hair, st = lk.hairStyle;
    if (st === 1 || st === 4) { ctx.fillStyle = shade(H, 0.08); rr(ctx, x - hrx * 1.18, hy - hry * 0.75, hrx * 2.36, hry * (st === 1 ? 2.35 : 1.6), hrx * 0.7); ctx.fill(); }
    ctx.fillStyle = lk.skin; ctx.beginPath(); ctx.ellipse(x - hrx * 0.98, hy + hry * 0.08, hrx * 0.16, hry * 0.2, 0, 0, 7); ctx.ellipse(x + hrx * 0.98, hy + hry * 0.08, hrx * 0.16, hry * 0.2, 0, 0, 7); ctx.fill();
    const hg = ctx.createRadialGradient(x - hrx * 0.35, hy - hry * 0.35, hrx * 0.2, x, hy, hry * 1.1); hg.addColorStop(0, light(lk.skin, 0.1)); hg.addColorStop(1, shade(lk.skin, 0.12));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(x, hy, hrx, hry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = H;
    if (st === 5) { ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(x, hy - hry * 0.25, hrx * 1.0, hry * 0.78, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.globalAlpha = 1; if (detail) { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(x, hy + hry * 0.42, hrx * 0.82, hry * 0.48, 0, 0.05 * Math.PI, 0.95 * Math.PI); ctx.fill(); ctx.globalAlpha = 1; } }
    else if (st === 3) { for (const [dx, dy, rr2] of [[-0.62, -0.25, 0.42], [-0.3, -0.72, 0.46], [0.18, -0.78, 0.46], [0.6, -0.4, 0.44], [0.75, 0.1, 0.32], [-0.78, 0.12, 0.32]]) { ctx.beginPath(); ctx.arc(x + dx * hrx, hy + dy * hry, rr2 * hrx * 1.15, 0, 7); ctx.fill(); } }
    else {
      ctx.beginPath(); ctx.ellipse(x, hy - hry * 0.12, hrx * 1.06, hry * 0.98, 0, Math.PI * 1.0, Math.PI * 2.0);
      if (st === 6) ctx.quadraticCurveTo(x + hrx * 0.2, hy - hry * 1.55, x - hrx * 0.9, hy - hry * 0.5);
      else ctx.quadraticCurveTo(x + hrx * 0.1, hy - hry * 0.55, x - hrx * 1.06, hy - hry * 0.12);
      ctx.fill();
      if (st === 2) { ctx.beginPath(); ctx.arc(x + hrx * 0.1, hy - hry * 1.12, hrx * 0.42, 0, 7); ctx.fill(); }
      if (st === 4 || st === 1) { rr(ctx, x - hrx * 1.08, hy - hry * 0.3, hrx * 0.32, hry * (st === 1 ? 1.7 : 1.05), hrx * 0.15); ctx.fill(); rr(ctx, x + hrx * 0.76, hy - hry * 0.3, hrx * 0.32, hry * (st === 1 ? 1.7 : 1.05), hrx * 0.15); ctx.fill(); }
    }
    if (detail) {
      const ey = hy + hry * 0.08, ex = hrx * 0.38, er = Math.max(0.7, s * 0.075);
      if (fine) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(x - ex, ey, er * 1.7, er * 1.2, 0, 0, 7); ctx.ellipse(x + ex, ey, er * 1.7, er * 1.2, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#2A211C'; ctx.beginPath(); ctx.arc(x - ex, ey, er, 0, 7); ctx.arc(x + ex, ey, er, 0, 7); ctx.fill();
      if (fine) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x - ex + er * 0.35, ey - er * 0.35, er * 0.32, 0, 7); ctx.arc(x + ex + er * 0.35, ey - er * 0.35, er * 0.32, 0, 7); ctx.fill(); }
      const mood = o.mood || 'neutral', by = ey - hry * 0.26, bw = hrx * 0.3, tilt = mood === 'bad' ? hry * 0.1 : mood === 'good' ? -hry * 0.04 : 0;
      ctx.strokeStyle = shade(H, 0.15); ctx.lineWidth = Math.max(0.8, s * 0.07); ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(x - ex - bw, by + (mood === 'bad' ? hry * 0.04 : 0)); ctx.lineTo(x - ex + bw * 0.8, by - tilt); ctx.moveTo(x + ex + bw, by + (mood === 'bad' ? hry * 0.04 : 0)); ctx.lineTo(x + ex - bw * 0.8, by - tilt); ctx.stroke();
      if (fine) { ctx.strokeStyle = shade(lk.skin, 0.22); ctx.lineWidth = Math.max(0.8, s * 0.05); ctx.beginPath(); ctx.moveTo(x + hrx * 0.02, ey + hry * 0.12); ctx.quadraticCurveTo(x + hrx * 0.12, ey + hry * 0.32, x - hrx * 0.04, ey + hry * 0.34); ctx.stroke(); }
      const my = hy + hry * 0.55; ctx.strokeStyle = '#7A3B30'; ctx.lineWidth = Math.max(0.8, s * 0.075); ctx.beginPath();
      if (mood === 'bad') { ctx.moveTo(x - hrx * 0.22, my + hry * 0.04); ctx.quadraticCurveTo(x, my - hry * 0.08, x + hrx * 0.22, my + hry * 0.04); }
      else if (mood === 'good') { ctx.moveTo(x - hrx * 0.26, my - hry * 0.04); ctx.quadraticCurveTo(x, my + hry * 0.16, x + hrx * 0.26, my - hry * 0.04); }
      else { ctx.moveTo(x - hrx * 0.18, my); ctx.quadraticCurveTo(x, my + hry * 0.03, x + hrx * 0.18, my); }
      ctx.stroke(); ctx.lineCap = 'butt';
      if (mood === 'good' && fine) { ctx.fillStyle = 'rgba(232,120,110,0.22)'; ctx.beginPath(); ctx.arc(x - hrx * 0.55, my - hry * 0.12, hrx * 0.16, 0, 7); ctx.arc(x + hrx * 0.55, my - hry * 0.12, hrx * 0.16, 0, 7); ctx.fill(); }
      if (lk.glasses && s >= 3.2) { ctx.strokeStyle = '#2A2A30'; ctx.lineWidth = Math.max(0.8, s * 0.06); rr(ctx, x - ex - er * 2.4, ey - er * 1.9, er * 4.8, er * 3.6, er * 1.2); ctx.stroke(); rr(ctx, x + ex - er * 2.4, ey - er * 1.9, er * 4.8, er * 3.6, er * 1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - ex + er * 2.4, ey - er * 0.4); ctx.lineTo(x + ex - er * 2.4, ey - er * 0.4); ctx.stroke(); }
    }
    if (o.stress) { ctx.fillStyle = '#A7D3F5'; const dx = x + hrx * 1.15, dy = hy - hry * 0.4; ctx.beginPath(); ctx.moveTo(dx, dy - s * 0.35); ctx.quadraticCurveTo(dx + s * 0.22, dy, dx, dy + s * 0.12); ctx.quadraticCurveTo(dx - s * 0.22, dy, dx, dy - s * 0.35); ctx.fill(); }
    return { top: hy - hry * (st === 2 ? 1.5 : st === 3 ? 1.3 : 1.1), x };
  }

  // ——— furniture (a warmer, more lived-in set) ———
  const WOOD = { top: '#C9A57B', left: '#9C7C58', right: '#7E6346' }, DWOOD = { top: '#8A6446', left: '#6A4C35', right: '#553C2A' };
  const WHITE = { top: '#F2EFE9', left: '#D8D3CA', right: '#BDB7AC' }, CHAIR = { top: '#3E434C', left: '#2E323A', right: '#24272E' };
  const DARK = { top: '#2B323B', left: '#1F252C', right: '#181D23' }, METAL = { top: '#A2ABB1', left: '#7D878E', right: '#636C73' };
  const IND = { top: '#7E9488', left: '#5F7368', right: '#4B5C53' }, FAB = { top: '#9AA3AE', left: '#7B8590', right: '#646D77' };
  const CARD = { top: '#D5B183', left: '#B08D62', right: '#8F714D' }, TERRA = { top: '#3A2F28', left: '#B9694F', right: '#94533E' };
  const BOOKS = ['#8C5A48', '#4E6272', '#B89B6A', '#6E7F6C', '#D8D1C4', '#5C5148'];
  function shadow(ctx, k, gx, gy, w, d, h0) { groundRect(ctx, k, gx - w / 2 + 0.06, gy - d / 2 + 0.08, gx + w / 2 + 0.12, gy + d / 2 + 0.14, h0 + 0.005, 'rgba(0,0,0,0.2)'); }
  function decal(ctx, k, kind, gx, gy, h0, r) {
    if (kind === 'table') { groundRect(ctx, k, gx - 1.25, gy - 0.85, gx + 1.25, gy + 0.85, h0 + 0.004, r > 0.5 ? '#8E7F72' : '#6F7C86'); }
    else if (kind === 'sofa') groundRect(ctx, k, gx - 0.9, gy - 0.2, gx + 0.9, gy + 1.1, h0 + 0.004, '#A39079');
  }
  function furniture(ctx, k, kind, gx, gy, h0, r) {
    const b = (x, y, w, d, a, z, c, o) => box(ctx, k, gx + x, gy + y, w, d, h0 + a, h0 + z, c, o);
    const chair = (x, y) => { b(x, y, 0.34, 0.34, 0.18, 0.24, CHAIR); b(x, y + 0.15, 0.34, 0.06, 0.24, 0.52, CHAIR); b(x, y, 0.06, 0.06, 0, 0.18, DARK); };
    switch (kind) {
      case 'desk': shadow(ctx, k, gx, gy, 1.2, 0.65, h0); chair(0, 0.55); b(-0.5, 0, 0.06, 0.55, 0, 0.42, METAL); b(0.5, 0, 0.06, 0.55, 0, 0.42, METAL); b(0, 0, 1.15, 0.62, 0.42, 0.47, r > 0.5 ? WHITE : WOOD);
        b(0, -0.16, 0.06, 0.06, 0.47, 0.58, DARK); b(0, -0.16, 0.52, 0.05, 0.58, 0.86, DARK, { edge: 'rgba(140,190,220,0.55)' }); b(0.38, 0.08, 0.1, 0.1, 0.47, 0.55, r > 0.3 ? { top: '#E9E4DA', left: '#C9C2B6', right: '#AFA79A' } : TERRA); if (r < 0.4) b(-0.36, 0.05, 0.3, 0.2, 0.47, 0.49, WHITE); break;
      case 'table': shadow(ctx, k, gx, gy, 1.8, 0.9, h0); [[-0.55, -0.62], [0, -0.62], [0.55, -0.62]].forEach(([x, y]) => b(x, y, 0.34, 0.34, 0.18, 0.24, CHAIR)); b(0, 0, 0.1, 0.5, 0, 0.42, DWOOD); b(0, 0, 1.8, 0.9, 0.42, 0.48, r > 0.5 ? DWOOD : WOOD); [[-0.55, 0.62], [0, 0.62], [0.55, 0.62]].forEach(([x, y]) => { b(x, y, 0.34, 0.34, 0.18, 0.24, CHAIR); b(x, y + 0.15, 0.34, 0.06, 0.24, 0.5, CHAIR); }); b(-0.3, 0.1, 0.28, 0.2, 0.48, 0.5, WHITE); break;
      case 'machine': shadow(ctx, k, gx, gy, 1.4, 1.0, h0); b(0, 0, 1.35, 0.95, 0, 0.9, IND); b(0, 0, 1.37, 0.97, 0.86, 0.9, { top: '#C9A43A', left: '#B08E30', right: '#937628' }); b(0.32, -0.12, 0.42, 0.34, 0.9, 1.16, DARK, { edge: 'rgba(120,230,180,0.5)' }); cyl(ctx, k, gx - 0.4, gy + 0.2, 0.12, h0 + 0.96, h0 + 1.5, METAL);
        { const p = P(k, gx + 0.32, gy - 0.12, h0 + 1.17); ctx.fillStyle = '#7CF0B0'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.2, k.S * 0.05), 0, 7); ctx.fill(); } break;
      case 'conveyor': shadow(ctx, k, gx, gy, 2.3, 0.6, h0); b(-1, 0, 0.08, 0.5, 0, 0.36, METAL); b(1, 0, 0.08, 0.5, 0, 0.36, METAL); b(0, 0, 2.3, 0.56, 0.36, 0.44, DARK); [-0.65, 0.05, 0.7].forEach((x, i) => b(x, 0, 0.42, 0.36, 0.44, 0.44 + 0.24 + (i % 2) * 0.08, CARD)); break;
      case 'pallet': shadow(ctx, k, gx, gy, 1.0, 1.0, h0); b(0, 0, 1.0, 1.0, 0, 0.12, WOOD); b(-0.22, -0.22, 0.46, 0.46, 0.12, 0.5, CARD); b(0.24, -0.22, 0.46, 0.46, 0.12, 0.5, CARD); b(-0.22, 0.24, 0.46, 0.46, 0.12, 0.5, CARD); b(0.24, 0.24, 0.46, 0.46, 0.12, 0.5, CARD); b(0, 0, 0.92, 0.92, 0.5, 0.86, CARD); break;
      case 'shelf': shadow(ctx, k, gx, gy, 0.45, 1.3, h0); b(0, 0, 0.42, 1.3, 0, 1.4, WOOD); b(0, 0, 0.44, 1.3, 1.4, 1.44, DWOOD); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { if ((i + j + Math.floor(r * 4)) % 4 === 3) continue; const c = BOOKS[(i * 2 + j + Math.floor(r * 6)) % 6]; b(0.04, -0.3 + j * 0.6, 0.34, 0.5, 0.1 + i * 0.44, 0.36 + i * 0.44, { top: c, left: shade(c, 0.12), right: shade(c, 0.28) }); } break;
      case 'locker': shadow(ctx, k, gx, gy, 0.5, 1.4, h0); b(0, 0, 0.48, 1.4, 0, 1.45, { top: '#8FA3B0', left: '#6E828F', right: '#5A6C78' }, { edge: 'rgba(0,0,0,0.25)' }); break;
      case 'plant': cyl(ctx, k, gx, gy, 0.2, h0, h0 + 0.34, TERRA); tree(ctx, k, gx, gy, 0.7 + r * 0.35, ['#4F8A5B', '#6E9E62', '#3F7A55'][Math.floor(r * 3)], false, h0 + 0.32); break;
      case 'bench': shadow(ctx, k, gx, gy, 1.6, 0.65, h0); b(0, 0, 1.55, 0.62, 0, 0.5, WHITE); b(0, 0, 1.58, 0.65, 0.5, 0.55, { top: '#3D4650', left: '#2E353D', right: '#252B31' }); b(-0.45, -0.1, 0.3, 0.26, 0.55, 0.85, DARK, { edge: 'rgba(150,200,230,0.5)' }); cyl(ctx, k, gx + 0.25, gy, 0.08, h0 + 0.55, h0 + 0.75, { top: 'rgba(170,230,220,0.6)', left: 'rgba(170,230,220,0.45)', right: 'rgba(170,230,220,0.35)' }); cyl(ctx, k, gx + 0.5, gy + 0.08, 0.07, h0 + 0.55, h0 + 0.7, { top: 'rgba(250,210,140,0.7)', left: 'rgba(250,210,140,0.5)', right: 'rgba(250,210,140,0.4)' }); break;
      case 'glass': shadow(ctx, k, gx, gy, 1.1, 0.8, h0); b(0, 0, 1.1, 0.8, 0, 0.5, WHITE); b(0, 0, 1.1, 0.8, 0.5, 1.25, { top: 'rgba(200,235,240,0.2)', left: 'rgba(200,235,240,0.16)', right: 'rgba(200,235,240,0.1)' }, { edge: 'rgba(220,240,245,0.7)' }); b(0, 0, 1.12, 0.82, 1.25, 1.4, WHITE); break;
      case 'sofa': shadow(ctx, k, gx, gy, 1.4, 0.7, h0); b(0, 0.05, 1.3, 0.6, 0, 0.26, FAB); b(0, -0.22, 1.3, 0.18, 0.26, 0.6, FAB); b(-0.62, 0.05, 0.14, 0.6, 0.26, 0.42, FAB); b(0.62, 0.05, 0.14, 0.6, 0.26, 0.42, FAB); b(-0.3, -0.05, 0.4, 0.14, 0.26, 0.5, { top: '#D9C6A5', left: '#BFA985', right: '#A68F6C' }); break;
      case 'coffee': shadow(ctx, k, gx, gy, 1.3, 0.55, h0); b(0, 0, 1.3, 0.55, 0, 0.5, WHITE); b(0, 0, 1.32, 0.57, 0.5, 0.54, DARK); b(0.35, -0.05, 0.28, 0.26, 0.54, 0.8, METAL); b(-0.85, 0, 0.45, 0.55, 0, 1.2, { top: '#E4E1DB', left: '#C6C2BA', right: '#ABA69C' }); break;
      case 'screen': shadow(ctx, k, gx, gy, 0.2, 1.3, h0); b(0, 0, 0.06, 0.06, 0, 0.4, METAL); b(0, 0, 0.08, 1.3, 0.4, 1.25, WHITE, { edge: 'rgba(0,0,0,0.2)' }); break;
      case 'bed': shadow(ctx, k, gx, gy, 1.4, 0.8, h0); b(0, 0, 1.4, 0.8, 0, 0.28, DWOOD); b(0, 0, 1.3, 0.7, 0.28, 0.3, { top: '#4A3A2A', left: '#3A2D21', right: '#2E241A' }); tree(ctx, k, gx - 0.35, gy, 0.42, '#6E9E62', false, h0 + 0.3); tree(ctx, k, gx + 0.3, gy - 0.05, 0.5, '#4F8A5B', false, h0 + 0.3); break;
      case 'shed': I.house(ctx, k, gx, gy, 1.2, 1, 0.8, I.PAL.roofs[3], { wall: WHITE }); break;
      case 'cones': [[-0.3, 0], [0.3, 0.2], [0, -0.3]].forEach(([x, y]) => cyl(ctx, k, gx + x, gy + y, 0.14, h0, h0 + 0.4, { top: '#F7F3EA', left: '#F08A3E', right: '#D06E2A' })); break;
      case 'hbed': shadow(ctx, k, gx, gy, 0.8, 1.5, h0); b(0, 0, 0.78, 1.5, 0.12, 0.42, { top: '#E7ECEE', left: '#C4CDD1', right: '#A9B4B9' }); b(0, 0, 0.7, 1.42, 0.42, 0.52, { top: '#FBFCFC', left: '#E6EAEC', right: '#D2D8DB' }); b(0, 0.18, 0.72, 0.95, 0.52, 0.58, { top: '#A9CFE0', left: '#8DB6C9', right: '#78A1B4' }); b(0, -0.55, 0.5, 0.26, 0.52, 0.64, WHITE); b(0, -0.74, 0.78, 0.06, 0.12, 0.78, METAL);
        cyl(ctx, k, gx + 0.5, gy - 0.6, 0.03, h0, h0 + 1.35, METAL); b(0.5, -0.6, 0.16, 0.06, 1.12, 1.32, { top: 'rgba(220,240,250,0.8)', left: 'rgba(200,230,245,0.7)', right: 'rgba(180,215,235,0.6)' }); break;
      case 'optable': shadow(ctx, k, gx, gy, 0.7, 1.6, h0); cyl(ctx, k, gx, gy, 0.16, h0, h0 + 0.62, METAL); b(0, 0, 0.62, 1.6, 0.62, 0.72, { top: '#5FA8A0', left: '#4A8C85', right: '#3D756F' }); cyl(ctx, k, gx + 0.7, gy - 0.5, 0.04, h0, h0 + 1.9, METAL); cyl(ctx, k, gx + 0.3, gy - 0.2, 0.34, h0 + 1.8, h0 + 1.9, { top: '#F4F7F7', left: '#D9E0E2', right: '#BFC9CC' });
        { const p = P(k, gx + 0.3, gy - 0.2, h0 + 1.8); ctx.save(); ctx.globalCompositeOperation = 'screen'; I.aura(ctx, p.x, p.y + k.S * 0.6, k.S * 1.2, '#FFF6D8', 0.35); ctx.restore(); } break;
      case 'monitor': shadow(ctx, k, gx, gy, 0.5, 0.5, h0); cyl(ctx, k, gx, gy, 0.18, h0, h0 + 0.08, DARK); cyl(ctx, k, gx, gy, 0.04, h0 + 0.08, h0 + 1.1, METAL); b(0, 0, 0.1, 0.5, 1.1, 1.45, DARK, { edge: 'rgba(120,240,180,0.65)' });
        { const p = P(k, gx, gy, h0 + 1.28); ctx.strokeStyle = '#7CF0B0'; ctx.lineWidth = Math.max(1, k.S * 0.04); ctx.beginPath(); ctx.moveTo(p.x - k.S * 0.2, p.y); ctx.lineTo(p.x - k.S * 0.05, p.y); ctx.lineTo(p.x, p.y - k.S * 0.1); ctx.lineTo(p.x + k.S * 0.05, p.y + k.S * 0.06); ctx.lineTo(p.x + k.S * 0.2, p.y); ctx.stroke(); } break;
      case 'curtain': b(0, 0, 0.05, 1.5, 0, 1.3, { top: 'rgba(170,210,205,0.55)', left: 'rgba(150,195,190,0.5)', right: 'rgba(130,180,175,0.45)' }); b(0, 0, 0.06, 1.55, 1.3, 1.34, METAL); break;
      default: b(0, 0, 0.8, 0.8, 0, 0.5, WOOD);
    }
  }
  // a thin wall along a→b; o.windows draws glazing on the inside face, o.cap = top colour
  const WALLC = { top: '#5B5148', left: '#E6DED2', right: '#CFC5B6' };
  function wall(ctx, k, ax, ay, bx, by, h0, h1, o) {
    o = o || {}; const T = o.t || 0.14, horiz = Math.abs(by - ay) < 1e-6, len = Math.hypot(bx - ax, by - ay), gx = (ax + bx) / 2, gy = (ay + by) / 2;
    const col = o.col || WALLC;
    box(ctx, k, gx, gy, horiz ? len : T, horiz ? T : len, h0, h1, col);
    if (o.base && h1 - h0 > 0.4) box(ctx, k, gx, gy, horiz ? len : T + 0.02, horiz ? T + 0.02 : len, h0, h0 + 0.07, { top: '#8A7A68', left: '#9C8B77', right: '#857562' });
    if (o.windows && h1 - h0 > 1) {
      const n = Math.max(1, Math.floor(len / 1.6)), nx = o.nx || 0, ny = o.ny || 0;
      for (let i = 0; i < n; i++) {
        const u0 = (i + 0.2) / n, u1 = (i + 0.8) / n, off = T / 2 + 0.01, ox = -nx * off, oy = -ny * off;
        const q = (u, h) => P(k, ax + (bx - ax) * u + ox, ay + (by - ay) * u + oy, h);
        poly(ctx, [q(u0, h0 + 0.55), q(u1, h0 + 0.55), q(u1, h1 - 0.25), q(u0, h1 - 0.25)]);
        const a = q(u0, h1 - 0.25), c = q(u1, h0 + 0.55), g = ctx.createLinearGradient(a.x, a.y, c.x, c.y); g.addColorStop(0, '#CFE6EE'); g.addColorStop(1, '#8FB4C4');
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#F4F1EC'; ctx.lineWidth = Math.max(1, k.S * 0.05); ctx.stroke();
        const m0 = q((u0 + u1) / 2, h0 + 0.55), m1 = q((u0 + u1) / 2, h1 - 0.25); ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke();
      }
    }
  }
  const FLOORS = {
    factory: { c: '#9A9E9F', tex: 'grid', step: 1.0 }, works: { c: '#7E8385', tex: 'grid', step: 1.0 }, lab: { c: '#D7DDDB', tex: 'grid', step: 0.5 },
    office: { c: '#8E98A3', tex: 'carpet' }, sales: { c: '#B9906A', tex: 'planks' }, boardroom: { c: '#8A6649', tex: 'planks' },
    studio: { c: '#C8AA84', tex: 'planks' }, ward: { c: '#CFDCD8', tex: 'grid', step: 0.5 }, theatre: { c: '#BCD6D2', tex: 'grid', step: 0.5 }, pharmacy: { c: '#DCE2E0', tex: 'grid', step: 0.5 }, clinic: { c: '#D9CDB8', tex: 'planks' }, garden: { c: '#7A9A5C', tex: 'grass' }, lounge: { c: '#B8A07F', tex: 'planks' },
  };
  function floorTile(ctx, k, x0, y0, x1, y1, h, kind, tint) {
    const F = FLOORS[kind] || FLOORS.office, c = tint ? mix(F.c, tint, 0.35) : F.c;
    groundRect(ctx, k, x0, y0, x1, y1, h, c);
    ctx.save(); poly(ctx, [P(k, x0, y0, h), P(k, x1, y0, h), P(k, x1, y1, h), P(k, x0, y1, h)]); ctx.clip();
    ctx.lineWidth = 1;
    if (F.tex === 'planks') { ctx.strokeStyle = 'rgba(60,36,18,0.16)'; for (let u = x0 + 0.32; u < x1; u += 0.32) { const a = P(k, u, y0, h), b = P(k, u, y1, h); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    else if (F.tex === 'grid') { ctx.strokeStyle = 'rgba(0,0,0,0.1)'; const s = F.step || 1; for (let u = x0 + s; u < x1; u += s) { const a = P(k, u, y0, h), b = P(k, u, y1, h); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } for (let v = y0 + s; v < y1; v += s) { const a = P(k, x0, v, h), b = P(k, x1, v, h); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    else if (F.tex === 'grass') { ctx.fillStyle = 'rgba(40,70,30,0.18)'; const rn = rng(Math.round(x0 * 31 + y0 * 17)); for (let i = 0; i < (x1 - x0) * (y1 - y0) * 3; i++) { const p = P(k, x0 + rn() * (x1 - x0), y0 + rn() * (y1 - y0), h); ctx.fillRect(p.x, p.y, 2, 1); } }
    // soft window light
    const cpt = P(k, x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.35, h), R = Math.max(x1 - x0, y1 - y0) * k.S * 0.9, g = ctx.createRadialGradient(cpt.x, cpt.y, 0, cpt.x, cpt.y, R);
    g.addColorStop(0, 'rgba(255,236,200,0.16)'); g.addColorStop(1, 'rgba(255,236,200,0)'); ctx.fillStyle = g; ctx.fillRect(cpt.x - R, cpt.y - R, R * 2, R * 2);
    ctx.restore();
    return c;
  }
  // persona figure: soft, Sims-like human shape — simple hair and clothing blocks, no face, slightly translucent
  const hx2 = (c) => { if (c[0] === '#') return c; const v = c.match(/\d+/g).map(Number); return '#' + v.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join(''); };
  const HAIRC = ['#2A2230', '#4A3428', '#7A5638', '#C9A574', '#1F1F26', '#8E8A90', '#9A4A34'];
  function figure(ctx, x, y, s, col, o) {
    o = o || {}; const r = rng(o.seed || 7), hair = HAIRC[Math.floor(r() * HAIRC.length)], hs = Math.floor(r() * 5), skirt = r() < 0.25, jacket = r() < 0.35;
    ctx.save(); ctx.globalAlpha *= o.alpha == null ? 0.9 : o.alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.95, s * 0.32, 0, 0, 7); ctx.fill();
    const wk = o.walk, walking = wk != null && wk !== 0, sw = walking ? Math.sin(wk) : 0, idle = o.idle || 0;
    y -= (o.bob || 0) + (walking ? Math.abs(Math.cos(wk)) * s * 0.1 : 0); x += walking ? 0 : Math.sin(idle) * s * 0.04;
    if (o.glow) { ctx.globalCompositeOperation = 'screen'; I.aura(ctx, x, y - s * 3.5, s * 4.5, col, 0.35); ctx.globalCompositeOperation = 'source-over'; }
    col = hx2(col); const top = col, bottom = hx2(o.bottom || mix(col, '#1E2532', 0.6)), skin = hx2(mix(col, '#FBEFE3', 0.7)), outer = jacket ? hx2(mix(col, '#2A2F3A', 0.35)) : top;
    const hipY = y - s * 2.95, shY = y - s * 4.85, sx = s * (o.lead ? 0.62 : 0.56);
    const leg = (side, ang, bend, c, wdt) => { const hx = x + side * s * 0.22, kx = hx + Math.sin(ang) * s * 0.75, ky = hipY + s * 1.45, fx = kx + Math.sin(ang - bend) * s * 0.7, fy = y - s * 0.14;
      ctx.strokeStyle = c; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(hx, hipY); ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke();
      ctx.fillStyle = shade(bottom, 0.35); ctx.beginPath(); ctx.ellipse(fx + s * 0.1, fy + s * 0.04, s * 0.27, s * 0.14, 0, 0, 7); ctx.fill(); };
    const la = sw * 0.4, bL = walking ? Math.max(0, Math.cos(wk)) * 0.5 : 0, bR = walking ? Math.max(0, -Math.cos(wk)) * 0.5 : 0;
    leg(-1, la, bL, skirt ? skin : shade(bottom, 0.1), s * (skirt ? 0.32 : 0.48)); leg(1, -la, bR, skirt ? skin : bottom, s * (skirt ? 0.32 : 0.48));
    // hair behind (long styles)
    const hy = y - s * 5.85 + (walking ? 0 : Math.sin(idle * 0.7) * s * 0.03), hr = s * 0.66;
    if (hs === 1) { ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(x, hy + hr * 0.55, hr * 1.02, hr * 1.25, 0, 0, 7); ctx.fill(); }
    const talk = o.talk ? 1.3 + Math.sin(idle * 3) * 0.25 : 0;
    const arm = (side, ang, fore, c) => { const ax = x + side * sx * 0.92, ay = shY + s * 0.25, ex = ax + side * s * 0.1 + Math.sin(ang) * s * 0.65, ey = ay + s * 1.15, hx = ex + Math.sin(ang + fore) * s * 0.6 * (fore < -1 ? 0.3 : 1), hy2 = ey + (fore < -1 ? -s * 0.75 : s * 1.0);
      ctx.strokeStyle = c; ctx.lineWidth = s * 0.36; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ex, ey, hx, hy2); ctx.stroke(); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy2, s * 0.16, 0, 7); ctx.fill(); };
    arm(-1, -sw * 0.35 + 0.05 + (walking ? 0 : Math.sin(idle) * 0.04), -0.15, shade(outer, 0.15));
    // skirt or hips, then torso
    if (skirt) { ctx.fillStyle = bottom; ctx.beginPath(); ctx.moveTo(x - sx * 0.72, hipY - s * 0.35); ctx.lineTo(x + sx * 0.72, hipY - s * 0.35); ctx.quadraticCurveTo(x + sx * 1.05, hipY + s * 0.6, x + sx * 1.0, hipY + s * 0.85); ctx.quadraticCurveTo(x, hipY + s * 1.0, x - sx * 1.0, hipY + s * 0.85); ctx.quadraticCurveTo(x - sx * 1.05, hipY + s * 0.6, x - sx * 0.72, hipY - s * 0.35); ctx.fill(); }
    else { ctx.fillStyle = bottom; ctx.beginPath(); ctx.ellipse(x, hipY, sx * 0.78, s * 0.42, 0, 0, 7); ctx.fill(); }
    const g = ctx.createLinearGradient(x - sx, shY, x + sx, hipY); g.addColorStop(0, light(outer, 0.18)); g.addColorStop(0.6, outer); g.addColorStop(1, shade(outer, 0.18)); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - sx * 0.55, shY - s * 0.1); ctx.bezierCurveTo(x - sx * 1.12, shY - s * 0.05, x - sx * 1.0, shY + s * 0.9, x - sx * 0.74, hipY - s * 0.1);
    ctx.quadraticCurveTo(x, hipY + s * 0.12, x + sx * 0.74, hipY - s * 0.1); ctx.bezierCurveTo(x + sx * 1.0, shY + s * 0.9, x + sx * 1.12, shY - s * 0.05, x + sx * 0.55, shY - s * 0.1); ctx.closePath(); ctx.fill();
    if (jacket && s > 2.2) { ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(x - s * 0.2, shY - s * 0.08); ctx.lineTo(x + s * 0.2, shY - s * 0.08); ctx.lineTo(x + s * 0.08, hipY - s * 0.2); ctx.lineTo(x - s * 0.08, hipY - s * 0.2); ctx.closePath(); ctx.fill(); }
    arm(1, sw * 0.35 - 0.05, talk ? -talk : -0.15, shade(outer, 0.04));
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(x, shY - s * 0.2, s * 0.16, s * 0.26, 0, 0, 7); ctx.fill();
    const hg = ctx.createRadialGradient(x - hr * 0.3, hy - hr * 0.35, hr * 0.1, x, hy, hr * 1.1); hg.addColorStop(0, light(skin, 0.15)); hg.addColorStop(1, shade(skin, 0.1)); ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(x, hy, hr * 0.88, hr, 0, 0, 7); ctx.fill();
    ctx.fillStyle = hair;
    if (hs === 3) { for (const [dx, dy, rr2] of [[-0.55, -0.35, 0.42], [-0.2, -0.75, 0.45], [0.25, -0.72, 0.45], [0.6, -0.3, 0.4], [0, -0.45, 0.5]]) { ctx.beginPath(); ctx.arc(x + dx * hr, hy + dy * hr, rr2 * hr, 0, 7); ctx.fill(); } }
    else { ctx.beginPath(); ctx.ellipse(x, hy - hr * (hs === 4 ? 0.3 : 0.18), hr * (hs === 4 ? 0.86 : 0.95), hr * (hs === 4 ? 0.72 : 0.9), 0, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
      if (hs === 2) { ctx.beginPath(); ctx.arc(x, hy - hr * 1.05, hr * 0.38, 0, 7); ctx.fill(); }
      if (hs === 1 || hs === 0) { ctx.beginPath(); ctx.ellipse(x - hr * 0.78, hy - hr * 0.05, hr * 0.18, hr * (hs === 1 ? 0.75 : 0.35), 0.1, 0, 7); ctx.ellipse(x + hr * 0.78, hy - hr * 0.05, hr * 0.18, hr * (hs === 1 ? 0.75 : 0.35), -0.1, 0, 7); ctx.fill(); } }
    ctx.restore(); return { top: hy - hr * (hs === 2 ? 1.45 : 1.05), x };
  }
  Object.assign(I, { figure, look, avatar, furniture, decal, wall, floorTile, FLOORS, WALLC, __ext: install });
  }
  (function boot() { if (!window.OzyIso) { setTimeout(boot, 20); return; } install(window.OzyIso); })();
})();

// ─── prototype/world-city.js ────────────────────────────────────────
// Ozy world — MACRO · THE CITY. Lays out a case as an open-world isometric city and draws it.
(function boot() {
  if (!window.OzyIso || !window.OzyIso.floorTile) { setTimeout(boot, 20); return; }
  const I = window.OzyIso, PAL = I.PAL;
  const N = 30, BLK = 6;
  const RIVER = [[30, 15.5], [26.5, 19], [23.5, 23.5], [20.5, 27], [18.8, 30]];
  const segDist = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const u = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - a[0] - u * dx, py - a[1] - u * dy); };
  const riverDist = (x, y) => { let m = 1e9; for (let i = 0; i < RIVER.length - 1; i++) m = Math.min(m, segDist(x, y, RIVER[i], RIVER[i + 1])); return m; };

  function zoneOf(bx, by) {
    if (bx === 0) return 'fields';
    if ((by === 0 && bx <= 3) || (bx === 1 && by === 1)) return 'downtown';
    if (bx >= 3 && by <= 1) return 'industry';
    return 'res';
  }
  // Each segment gets its own world: municipality = a small Amsterdam (canals, landmarks, trams, bikes), scale-up & fund = an
  // innovation ecosystem (towers, forest, few streets), enterprise = the standard city plus forests, hospital = one huge hospital
  // island in the middle with the rest of its world on islands around it.
  const THEME = { municipality: 'amsterdam', scaleup: 'eco', fund: 'isles', enterprise: 'forest', hospital: 'campus' };
  const BRICK = ['#8E4A3A', '#A65E46', '#6E3B32', '#C9B79C', '#5B4038', '#B9794F', '#3F3A3C'];
  function layout(cs) {
    const theme = cs.theme || THEME[cs.id] || 'city';
    const blocks = [];
    for (let by = 0; by < 5; by++) for (let bx = 0; bx < 5; bx++) {
      const cx = 1 + bx * BLK + 2.5, cy = 1 + by * BLK + 2.5, rd = riverDist(cx, cy);
      blocks.push({ bx, by, cx, cy, zone: rd < 3 ? 'water' : rd < 6.6 ? 'river' : zoneOf(bx, by), dist: Math.hypot(cx - 15.5, cy - 15.5), place: null });
    }
    blocks.forEach((b) => {
      b.theme = theme;
      if (theme === 'campus' && b.bx >= 1 && b.bx <= 3 && b.by >= 1 && b.by <= 3) b.zone = 'campus';
      if (theme === 'eco' && b.zone !== 'water' && b.zone !== 'river') b.zone = b.bx <= 1 && b.by <= 2 ? 'forest' : b.bx >= 3 && b.by <= 1 ? 'towers' : b.zone === 'fields' ? 'forest' : b.zone;
      if (theme === 'forest' && (b.zone === 'fields' || (b.bx === 4 && b.by >= 3))) b.zone = 'forest';
    });
    const org = blocks.find((b) => b.bx === 2 && b.by === 2); org.place = { id: 'org', label: cs.org.label, shape: cs.org.shape, note: cs.org.note, isOrg: true };
    // hospital: the campus is the city — each major department gets its own block around the main building
    const depts = [];
    if (theme === 'campus') { const SLOTS = [[1, 1], [2, 1], [3, 2], [2, 3], [3, 3], [1, 2], [3, 1], [1, 3]], SH = (f) => { const s = (f.id + ' ' + f.name).toLowerCase(); return /ward|nurs|bed/.test(s) ? 'h-wards' : /surg|clinic|doctor|medic/.test(s) ? 'h-surgery' : /pharm/.test(s) ? 'h-pharm' : /care|social|discharge/.test(s) ? 'h-care' : /it\b|data|digital|privacy/.test(s) ? 'h-it' : 'h-admin'; }; const DEPT = {}; (cs.floors || []).slice(0, SLOTS.length).forEach((f, i) => { DEPT[f.id] = [SLOTS[i][0], SLOTS[i][1], SH(f)]; });
      (cs.floors || []).forEach((f) => { const d = DEPT[f.id]; if (!d) return; const b = blocks.find((x) => x.bx === d[0] && x.by === d[1]); if (b && !b.place) { b.place = { id: f.id, label: f.name, shape: d[2], note: f.sub, dept: true, own: true, staff: f.staff }; depts.push(b.place); } }); }
    // fund: only the fund on the centre island; every company it backs or screens is its own island around it
    if (theme === 'isles') {
      blocks.forEach((b) => { if (!b.place) b.zone = 'void'; });
      // local change: a network case places islands by ring (offices inside, programmes and partners outside), all in full detail
      const byRing = cs.places.some((p) => p.ring);
      const inner = cs.places.filter((p) => (byRing ? p.ring === 'inner' : p.tier === 'ozy')), outer = cs.places.filter((p) => (byRing ? p.ring !== 'inner' : p.tier !== 'ozy'));
      const ring = (arr, R0, a0) => arr.forEach((p, i) => { const a = a0 + (i / arr.length) * Math.PI * 2; blocks.push({ bx: -9, by: -9, cx: 15.5 + Math.cos(a) * R0, cy: 15.5 + Math.sin(a) * R0, zone: 'isle', isle: byRing ? (p.ring === 'inner' ? 'hub' : 'other') : p.tier || 'other', theme, dist: R0, place: Object.assign({}, p) }); });
      if (byRing) { ring(inner, 11.4, -1.2); ring(outer, 20.6, -1.45); } else { ring(inner, 10.2, 0.35); ring(outer, 18.6, 0.05); }
    }
    if (theme !== 'isles') for (const p of cs.places) {
      let best = null, bs = 1e9;
      for (const b of blocks) {
        if (b.place || b.zone === 'water' || b.zone === 'campus') continue;
        const s = (b.zone === p.zone || (p.zone === 'edge' && (b.bx % 4 === 0 || b.by % 4 === 0)) ? 0 : 60) + (p.zone === 'edge' ? -b.dist : b.dist * 0.6);
        if (s < bs) { bs = s; best = b; }
      }
      if (best) best.place = Object.assign({}, p);
    }
    blocks.forEach((b) => { if (b.place) b.place.block = b; });
    const polar = (deg, rad) => [N / 2 + Math.cos(deg * Math.PI / 180) * rad, N / 2 + Math.sin(deg * Math.PI / 180) * rad];
    const far = (cs.far || []).map((f, i) => { const [gx, gy] = polar([20, 110, 200, 290, 155][i % 5], 25.5); return Object.assign({}, f, { gx, gy }); });
    const glob = (cs.global || []).map((g, i) => { const [gx, gy] = polar([65, 137, 245, 318, 2][i % 5], 30.5); return Object.assign({}, g, { gx, gy }); });
    if (theme === 'amsterdam') { const pick = (pref) => { for (const [bx, by] of pref) { const b = blocks.find((x) => x.bx === bx && x.by === by && !x.place && x.zone !== 'water' && !x.landmark); if (b) return b; } return blocks.find((x) => !x.place && x.zone !== 'water' && !x.landmark); };
      [['station', [[3, 3], [3, 2], [4, 2], [2, 3]]], ['museum', [[1, 3], [1, 2], [0, 3]]], ['church', [[1, 1], [2, 1], [0, 1]]], ['mill', [[0, 4], [0, 0], [4, 0], [1, 4]]], ['market', [[2, 1], [3, 1], [2, 0]]]].forEach(([kind, pref]) => { const b = pick(pref); if (b) b.landmark = kind; }); }
    return { theme, depts, far, global: glob, ties: cs.ties || [], bridge: theme === 'campus' ? null : BRIDGE_AT, bridgeStory: cs.bridge || null, blocks, byId: Object.fromEntries(blocks.filter((b) => b.place).map((b) => [b.place.id, b.place])) };
  }

  // ——— shapes: each returns drawables { gx, gy, draw } and sets place.top (height in cells) ———
  const HW = { top: '#E8EFF1', left: '#C9D6DA', right: '#9FB1B8' };
  function storeys(c, k, gx, gy, w, d, h, roof, band) { for (let f = 0; f < h - 1e-6; f += 0.8) { const z = Math.min(h, f + 0.8), alt = band && Math.round(f / 0.8) % 2; I.box(c, k, gx, gy, w, d, f, z, { top: z >= h - 1e-6 ? roof : HW.top, left: alt ? I.mix(PAL.glass, '#1E2F37', 0.55) : HW.left, right: alt ? I.mix(PAL.glass, '#16242B', 0.62) : HW.right }, { windows: PAL.window }); } }
  function amb(c, k, gx, gy) { I.box(c, k, gx, gy, 0.95, 0.5, 0.06, 0.6, { top: '#F6F3EC', left: '#E6E1D8', right: '#C9C3B8' }); I.box(c, k, gx, gy, 0.97, 0.52, 0.3, 0.38, { top: '#FF5A3C', left: '#E04A30', right: '#C23D27' }); I.box(c, k, gx - 0.2, gy, 0.12, 0.2, 0.6, 0.68, { top: '#93C5FD', left: '#6FA6E8', right: '#5A8FD0' }); }
  function shape(list, name, cx, cy, r, seed, own) {
    const R = own ? PAL.ownRoofs : PAL.roofs, roof = R[seed % R.length];
    const add = (gx, gy, fn) => list.push({ gx, gy, fn });
    switch (name) {
      case 'h-admin': add(cx - 0.3, cy - 0.2, (c, k) => storeys(c, k, cx - 0.3, cy - 0.2, 2.8, 2.2, 3.2, roof, true)); add(cx + 1.4, cy + 1.5, (c, k) => storeys(c, k, cx + 1.4, cy + 1.5, 1.3, 1.1, 1.6, roof)); return 3.2;
      case 'h-surgery': add(cx, cy, (c, k) => { storeys(c, k, cx, cy, 3.8, 3.0, 1.6, '#D5E6A7'); I.box(c, k, cx - 1.3, cy - 1.0, 0.7, 0.6, 1.6, 1.95, I.neu()); I.groundEllipse(c, k, cx + 0.5, cy + 0.3, 0.95, 1.62); c.fillStyle = '#2E3A40'; c.fill(); const p = I.P(k, cx + 0.5, cy + 0.3, 1.63), z = k.S * 0.32; c.strokeStyle = '#F6F3EC'; c.lineWidth = Math.max(1.2, k.S * 0.08); c.beginPath(); c.moveTo(p.x - z, p.y - z * 0.5); c.lineTo(p.x - z, p.y + z * 0.5); c.moveTo(p.x + z, p.y - z * 0.5); c.lineTo(p.x + z, p.y + z * 0.5); c.moveTo(p.x - z, p.y); c.lineTo(p.x + z, p.y); c.stroke(); }); return 1.9;
      case 'h-wards': add(cx + 0.3, cy - 0.5, (c, k) => storeys(c, k, cx + 0.3, cy - 0.5, 4.0, 1.8, 4.0, '#9DBFD1')); add(cx - 1.0, cy + 1.4, (c, k) => storeys(c, k, cx - 1.0, cy + 1.4, 1.8, 1.8, 2.4, '#9DBFD1')); return 4;
      case 'h-care': add(cx - 0.6, cy - 0.4, (c, k) => I.house(c, k, cx - 0.6, cy - 0.4, 2.6, 1.8, 1.4, roof, { wall: HW })); add(cx + 1.4, cy + 1.2, (c, k) => { I.box(c, k, cx + 1.4, cy + 1.2, 1.2, 0.08, 0.3, 0.36, I.neu()); I.box(c, k, cx + 1.4, cy + 1.6, 1.2, 0.08, 0.3, 0.36, I.neu()); }); return 2.2;
      case 'h-pharm': add(cx - 0.4, cy - 0.4, (c, k) => storeys(c, k, cx - 0.4, cy - 0.4, 3.0, 2.2, 1.6, '#C9B7BE')); add(cx + 1.6, cy + 1.4, (c, k) => amb(c, k, cx + 1.6, cy + 1.4)); add(cx + 0.2, cy + 1.6, (c, k) => amb(c, k, cx + 0.2, cy + 1.6)); return 1.6;
      case 'h-it': add(cx, cy, (c, k) => { storeys(c, k, cx, cy, 2.4, 2.4, 2.4, '#2E3A40', true); [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]].forEach(([dx, dy]) => I.box(c, k, cx + dx, cy + dy, 0.5, 0.5, 2.4, 2.75, { top: '#3A4650', left: '#2A333B', right: '#20282F' }, { edge: I.rgba(PAL.glass, 0.6) })); }); return 2.8;
      case 'factory':
        add(cx - 0.3, cy + 0.2, (c, k) => I.saw(c, k, cx - 0.3, cy + 0.2, 3.4, 2.2, 1.1, R[0], 4));
        add(cx + 1.7, cy - 1.3, (c, k) => I.cyl(c, k, cx + 1.7, cy - 1.3, 0.32, 0, 2.6, I.neu()));
        add(cx + 1.6, cy + 1.6, (c, k) => I.box(c, k, cx + 1.6, cy + 1.6, 1, 0.9, 0, 0.6, { top: R[5], left: I.neu().left, right: I.neu().right }));
        return 2.6;
      case 'hq':
        add(cx + 0.4, cy - 0.4, (c, k) => I.box(c, k, cx + 0.4, cy - 0.4, 1.8, 1.8, 0, 5, { top: I.neu().top, left: '#203B45', right: '#18303A' }, { windows: PAL.window, edge: I.rgba(PAL.glass, 0.5) }));
        add(cx - 1, cy + 1.1, (c, k) => I.box(c, k, cx - 1, cy + 1.1, 2.4, 1.4, 0, 1, { top: R[2], left: I.neu().left, right: I.neu().right }, { windows: PAL.window }));
        return 5;
      case 'fund':
        add(cx, cy - 0.3, (c, k) => I.box(c, k, cx, cy - 0.3, 1.6, 1.6, 0, 4.2, { top: '#2D4E55', left: '#1F3C44', right: '#183139' }, { windows: I.rgba(PAL.glass, 0.5), edge: I.rgba(PAL.glass, 0.7) }));
        add(cx - 1.2, cy + 1.2, (c, k) => I.box(c, k, cx - 1.2, cy + 1.2, 1.4, 1.2, 0, 1.4, I.neu(), { windows: PAL.window }));
        return 4.2;
      case 'townhall':
        add(cx, cy + 0.3, (c, k) => { I.box(c, k, cx, cy + 0.3, 3.2, 2.2, 0, 1.3, I.neu(), { windows: PAL.window }); I.gable(c, k, cx, cy + 0.3, 3.3, 2.3, 1.3, 0.9, R[4]); });
        add(cx + 1.2, cy - 1.2, (c, k) => { I.box(c, k, cx + 1.2, cy - 1.2, 0.8, 0.8, 0, 3.2, I.neu(), { windows: PAL.window }); I.gable(c, k, cx + 1.2, cy - 1.2, 0.9, 0.9, 3.2, 0.7, R[0]); });
        return 3.9;
      case 'tower':
        add(cx - 0.5, cy - 0.5, (c, k) => I.box(c, k, cx - 0.5, cy - 0.5, 1.4, 1.4, 0, 4.6, { top: '#2D4E55', left: '#1F3C44', right: '#183139' }, { windows: I.rgba(PAL.glass, 0.45), edge: I.rgba(PAL.glass, 0.6) }));
        add(cx + 1, cy + 0.9, (c, k) => I.box(c, k, cx + 1, cy + 0.9, 1.2, 1.2, 0, 3, I.neu(), { windows: PAL.window }));
        return 4.6;
      case 'office':
        add(cx, cy, (c, k) => I.box(c, k, cx, cy, 2.2, 1.6, 0, 1.9, { top: R[2], left: I.neu().left, right: I.neu().right }, { windows: PAL.window }));
        return 1.9;
      case 'warehouse':
        add(cx - 0.2, cy, (c, k) => I.box(c, k, cx - 0.2, cy, 3.4, 2.2, 0, 1.1, { top: R[2], left: I.neu().left, right: I.neu().right }, { windows: PAL.window }));
        add(cx + 1.7, cy + 1.7, (c, k) => I.box(c, k, cx + 1.7, cy + 1.7, 0.9, 0.6, 0, 0.5, { top: R[0], left: '#7A4C40', right: '#5E3A31' }));
        return 1.1;
      case 'farm':
        add(cx + 1.2, cy - 1.2, (c, k) => I.house(c, k, cx + 1.2, cy - 1.2, 1.3, 1, 0.8, R[0], { windows: false }));
        add(cx + 1.9, cy + 0.2, (c, k) => I.cyl(c, k, cx + 1.9, cy + 0.2, 0.3, 0, 1.4, { top: R[5], left: '#3B4F57', right: '#2C3D44' }));
        return 1.4;
      case 'lab':
        add(cx, cy, (c, k) => I.box(c, k, cx, cy, 2.4, 1.8, 0, 1.3, { top: R[1], left: I.neu().left, right: I.neu().right }, { windows: PAL.window }));
        add(cx + 0.4, cy - 0.2, (c, k) => I.cyl(c, k, cx + 0.4, cy - 0.2, 0.45, 1.3, 1.7, { top: '#BFE7E0', left: R[1], right: '#6E8F8A' }));
        return 1.7;
      case 'civic':
        add(cx, cy, (c, k) => { I.box(c, k, cx, cy, 3, 2, 0, 1.3, { top: I.neu().top, left: '#28404B', right: '#1D323B' }, { windows: PAL.window }); I.gable(c, k, cx, cy, 3.1, 2.1, 1.3, 0.8, R[4]); });
        return 2.1;
      case 'shop':
        [[-1.3, 0, 0], [0, 0, 1], [1.3, 0, 2]].forEach(([dx, dy, i]) => add(cx + dx, cy + dy, (c, k) => I.house(c, k, cx + dx, cy + dy, 1.1, 1.4, 0.8 + i * 0.25, R[(seed + i * 2) % R.length])));
        return 1.6;
      case 'homes':
        [[-1.3, -1.2], [0.4, -1.4], [-1.4, 0.6], [0.3, 0.4], [1.6, 0.9], [-0.4, 1.9]].forEach(([dx, dy], i) => add(cx + dx, cy + dy, (c, k) => I.house(c, k, cx + dx, cy + dy, 0.95, 0.8, 0.6, R[(seed + i) % R.length])));
        return 1.1;
      case 'yard':
        add(cx - 0.8, cy - 0.6, (c, k) => I.cyl(c, k, cx - 0.8, cy - 0.6, 0.6, 0, 1.6, { top: R[5], left: '#3B4F57', right: '#2C3D44' }));
        add(cx + 0.6, cy - 0.8, (c, k) => I.cyl(c, k, cx + 0.6, cy - 0.8, 0.6, 0, 1.6, { top: R[5], left: '#3B4F57', right: '#2C3D44' }));
        add(cx, cy + 1.1, (c, k) => I.box(c, k, cx, cy + 1.1, 2.6, 1.1, 0, 0.8, { top: R[0], left: I.neu().left, right: I.neu().right }));
        return 1.6;
      case 'port':
        add(cx, cy, (c, k) => I.box(c, k, cx, cy, 3.2, 1.2, 0, 0.25, { top: '#3A4F58', left: I.neu().left, right: I.neu().right }));
        [[-0.9, '#E89A82'], [0, '#9DBFD1'], [0.9, '#D5E6A7']].forEach(([dx, col]) => add(cx + dx, cy - 0.1, (c, k) => I.box(c, k, cx + dx, cy - 0.1, 0.7, 0.6, 0.25, 0.75, { top: col, left: I.mix(col, '#0E1A21', 0.35), right: I.mix(col, '#0E1A21', 0.5) })));
        return 0.9;
      case 'school':
        add(cx, cy - 0.4, (c, k) => I.house(c, k, cx, cy - 0.4, 2.6, 1.4, 1, R[3]));
        return 1.6;
      case 'care':
        add(cx, cy, (c, k) => I.house(c, k, cx, cy, 2.4, 1.6, 1.3, R[5]));
        return 2;
      // ——— local change: city-flavoured offices for network cases (stylised, not landmark replicas) ———
      case 'city-amsterdam': {
        add(cx, cy + 1.3, (c, k) => { I.groundRect(c, k, cx - 2.4, cy + 0.9, cx + 2.4, cy + 1.75, 0.03, PAL.water); I.box(c, k, cx + 1.25, cy + 1.32, 0.75, 1.05, 0.03, 0.24, { top: '#3A4A52', left: '#2A363C', right: '#20292E' }); });
        const CO = ['#8E4A3A', '#3F3A3C', '#A65E46', '#5B4038', '#6E3B32'], HH = [2.2, 2.7, 2.0, 2.9, 2.35];
        HH.forEach((h, i) => { const gx = cx - 1.9 + i * 0.95, gy = cy - 0.35, W2 = { top: CO[i], left: I.mix(CO[i], '#0E1A21', 0.18), right: I.mix(CO[i], '#0E1A21', 0.38) }; add(gx, gy, (c, k) => { I.box(c, k, gx, gy, 0.86, 1.3, 0, h, W2, { windows: PAL.window }); I.gable(c, k, gx, gy, 0.88, 1.32, h, 0.75, '#2B2530', W2); }); });
        [-2.05, -0.65, 0.75, 2.1].forEach((dx, i) => add(cx + dx, cy + 2.2, (c, k) => I.tree(c, k, cx + dx, cy + 2.2, 0.9, PAL.tree[i % 3], false)));
        return 3.6;
      }
      case 'city-london':
        add(cx - 0.6, cy - 0.4, (c, k) => storeys(c, k, cx - 0.6, cy - 0.4, 2.0, 1.6, 3.2, '#2E3A40', true));
        add(cx + 1.45, cy - 1.15, (c, k) => { const St = { top: '#C9A86A', left: '#B08E52', right: '#8E7240' }; I.box(c, k, cx + 1.45, cy - 1.15, 0.6, 0.6, 0, 3.5, St, { windows: PAL.window }); I.box(c, k, cx + 1.45, cy - 1.15, 0.68, 0.68, 2.85, 3.3, { top: '#F4EFE6', left: '#F4EFE6', right: '#D9CFB4' }); I.gable(c, k, cx + 1.45, cy - 1.15, 0.64, 0.64, 3.5, 0.75, '#3A3F4A', St); });
        add(cx + 0.7, cy + 1.55, (c, k) => I.box(c, k, cx + 0.7, cy + 1.55, 1.3, 0.45, 0.05, 0.7, { top: '#E04A30', left: '#C23D27', right: '#A3321F' }, { windows: PAL.window }));
        return 4.2;
      case 'city-paris':
        add(cx - 0.5, cy + 0.25, (c, k) => { const Wp = { top: '#E6DCC6', left: '#D8CCB2', right: '#BDAF93' }; I.box(c, k, cx - 0.5, cy + 0.25, 2.6, 1.8, 0, 1.6, Wp, { windows: PAL.window }); I.gable(c, k, cx - 0.5, cy + 0.25, 2.62, 1.82, 1.6, 0.55, '#6F7F93', Wp); });
        add(cx + 1.6, cy - 1.3, (c, k) => { const b0 = I.P(k, cx + 1.6, cy - 1.3, 0), tp = I.P(k, cx + 1.6, cy - 1.3, 4.3), sp = k.S * 0.6; c.strokeStyle = '#B08A62'; c.lineWidth = Math.max(1.1, k.S * 0.08); c.beginPath(); c.moveTo(b0.x - sp, b0.y); c.quadraticCurveTo(b0.x - sp * 0.15, (b0.y + tp.y) / 2, tp.x, tp.y); c.moveTo(b0.x + sp, b0.y); c.quadraticCurveTo(b0.x + sp * 0.15, (b0.y + tp.y) / 2, tp.x, tp.y); [[1.2, 0.62], [2.5, 0.34]].forEach(([h, f]) => { const m = I.P(k, cx + 1.6, cy - 1.3, h); c.moveTo(m.x - sp * f, m.y); c.lineTo(m.x + sp * f, m.y); }); c.stroke(); });
        return 4.3;
      case 'city-berlin':
        add(cx - 0.6, cy + 0.55, (c, k) => I.box(c, k, cx - 0.6, cy + 0.55, 2.2, 1.4, 0, 1.4, { top: R[2], left: I.neu().left, right: I.neu().right }, { windows: PAL.window }));
        add(cx + 1.3, cy - 1.1, (c, k) => { I.cyl(c, k, cx + 1.3, cy - 1.1, 0.22, 0, 3.8, { top: '#C9CFD4', left: '#AEB6BC', right: '#8C959C' }); const p = I.P(k, cx + 1.3, cy - 1.1, 3.9); c.fillStyle = '#8FA3AD'; c.beginPath(); c.arc(p.x, p.y, k.S * 0.42, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(p.x - k.S * 0.12, p.y - k.S * 0.12, k.S * 0.15, 0, 7); c.fill(); const q = I.P(k, cx + 1.3, cy - 1.1, 5.3); c.strokeStyle = '#E04A30'; c.lineWidth = Math.max(1, k.S * 0.06); c.beginPath(); c.moveTo(p.x, p.y - k.S * 0.42); c.lineTo(q.x, q.y); c.stroke(); });
        return 5.3;
      case 'city-brussels':
        add(cx - 0.5, cy + 0.35, (c, k) => { const Wb = { top: '#D9CFB4', left: '#C9BE9F', right: '#AFA383' }; I.box(c, k, cx - 0.5, cy + 0.35, 2.8, 1.6, 0, 1.3, Wb, { windows: PAL.window }); I.gable(c, k, cx - 0.5, cy + 0.35, 2.85, 1.65, 1.3, 0.45, '#5E6F7A', Wb); });
        add(cx + 1.5, cy - 1.2, (c, k) => { I.box(c, k, cx + 1.5, cy - 1.2, 0.7, 0.7, 0, 0.4, { top: '#C9BE9F', left: '#AFA383', right: '#958A6C' }); I.cyl(c, k, cx + 1.5, cy - 1.2, 0.2, 0.4, 3.8, { top: '#E6DCC6', left: '#D8CCB2', right: '#BDAF93' }); I.cyl(c, k, cx + 1.5, cy - 1.2, 0.12, 3.8, 4.3, { top: '#C9A24A', left: '#B08E30', right: '#937628' }); });
        return 4.3;
      case 'city-milan':
        [[-0.7, -0.5, 4.0], [0.8, 0.45, 3.3]].forEach(([dx, dy, h]) => add(cx + dx, cy + dy, (c, k) => { I.box(c, k, cx + dx, cy + dy, 1.1, 1.1, 0, h, { top: '#D7DCD8', left: '#9FA9A6', right: '#7F8987' }, { windows: PAL.window }); for (let z = 0.6; z < h; z += 0.7) for (const [ox, oy] of [[0.55, 0], [0, 0.55]]) { const p = I.P(k, cx + dx + ox, cy + dy + oy, z); c.fillStyle = PAL.tree[Math.floor(z * 3) % 3]; c.beginPath(); c.arc(p.x, p.y, k.S * 0.18, 0, 7); c.fill(); } }));
        add(cx + 1.6, cy - 1.45, (c, k) => I.box(c, k, cx + 1.6, cy - 1.45, 0.85, 0.85, 0, 5.0, { top: '#5E8FA0', left: '#29505E', right: '#1D3D48' }, { windows: I.rgba(PAL.glass, 0.55) }));
        return 5;
      case 'city-warsaw':
        add(cx - 0.4, cy - 0.4, (c, k) => { const Ww = { top: '#D9CFB4', left: '#C2B593', right: '#A39674' }; I.box(c, k, cx - 0.4, cy - 0.4, 2.0, 2.0, 0, 1.0, Ww, { windows: PAL.window }); I.box(c, k, cx - 0.4, cy - 0.4, 1.3, 1.3, 1.0, 2.6, Ww, { windows: PAL.window }); I.box(c, k, cx - 0.4, cy - 0.4, 0.8, 0.8, 2.6, 3.8, Ww, { windows: PAL.window }); I.box(c, k, cx - 0.4, cy - 0.4, 0.45, 0.45, 3.8, 4.4, Ww); const p = I.P(k, cx - 0.4, cy - 0.4, 4.4), q = I.P(k, cx - 0.4, cy - 0.4, 5.4); c.strokeStyle = '#C9A24A'; c.lineWidth = Math.max(1.2, k.S * 0.08); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); });
        add(cx + 1.3, cy + 1.35, (c, k) => { const Bk = { top: '#8E4A3A', left: '#7A3E31', right: '#5E3026' }; I.box(c, k, cx + 1.3, cy + 1.35, 1.8, 1.1, 0, 0.8, Bk, { windows: PAL.window }); I.gable(c, k, cx + 1.3, cy + 1.35, 1.85, 1.15, 0.8, 0.5, '#3F4B55', Bk); });
        return 5.4;
      case 'city-valencia': {
        const palm = (c, k, gx, gy, h) => { const b0 = I.P(k, gx, gy, 0), tp = I.P(k, gx, gy, h); c.strokeStyle = '#8A6A4A'; c.lineWidth = Math.max(1.2, k.S * 0.09); c.beginPath(); c.moveTo(b0.x, b0.y); c.quadraticCurveTo(b0.x + k.S * 0.2, (b0.y + tp.y) / 2, tp.x, tp.y); c.stroke(); c.strokeStyle = '#7FA89A'; c.lineWidth = Math.max(1.4, k.S * 0.12); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.beginPath(); c.moveTo(tp.x, tp.y); c.quadraticCurveTo(tp.x + Math.cos(a) * k.S * 0.5, tp.y - k.S * 0.25, tp.x + Math.cos(a) * k.S * 0.9, tp.y + Math.sin(a) * k.S * 0.35 + k.S * 0.2); c.stroke(); } };
        add(cx - 0.6, cy - 0.3, (c, k) => { const G2 = { top: I.rgba(PAL.glass, 0.3), left: I.rgba(PAL.glass, 0.22), right: I.rgba(PAL.glass, 0.15) }; I.box(c, k, cx - 0.6, cy - 0.3, 2.2, 1.4, 0, 1.0, G2, { edge: I.rgba(PAL.glass, 0.8) }); I.gable(c, k, cx - 0.6, cy - 0.3, 2.25, 1.45, 1.0, 0.6, I.rgba(PAL.glass, 0.35), G2); });
        [[1.45, -1.4, 2.4], [1.85, 0.2, 2.0], [-1.8, 1.5, 2.2]].forEach(([dx, dy, h]) => add(cx + dx, cy + dy, (c, k) => palm(c, k, cx + dx, cy + dy, h)));
        add(cx + 0.6, cy + 1.5, (c, k) => I.house(c, k, cx + 0.6, cy + 1.5, 1.4, 0.9, 0.7, '#C0674E', { wall: { top: '#F2E6D0', left: '#E6D6B8', right: '#CDBB98' } }));
        return 2.4;
      }
      case 'city-vienna':
        add(cx - 0.3, cy, (c, k) => { const Wv = { top: '#EDE3C8', left: '#E0D2AE', right: '#C4B48C' }; I.box(c, k, cx - 0.3, cy, 3.0, 1.8, 0, 1.3, Wv, { windows: PAL.window }); I.cyl(c, k, cx - 0.3, cy, 0.75, 1.3, 1.8, Wv); const p = I.P(k, cx - 0.3, cy, 1.8); c.fillStyle = '#5FA08E'; c.beginPath(); c.ellipse(p.x, p.y, k.S * 0.92, k.S * 0.78, 0, Math.PI, 0); c.fill(); const q = I.P(k, cx - 0.3, cy, 1.8); c.strokeStyle = '#C9A24A'; c.lineWidth = Math.max(1.2, k.S * 0.07); c.beginPath(); c.moveTo(q.x, q.y - k.S * 0.78); c.lineTo(q.x, q.y - k.S * 1.3); c.stroke(); });
        return 2.9;
      case 'city-copenhagen': {
        add(cx, cy + 1.45, (c, k) => I.groundRect(c, k, cx - 2.4, cy + 1.0, cx + 2.4, cy + 1.9, 0.03, PAL.water));
        ['#E8A33D', '#C9564B', '#3E7CB1', '#E6C84B', '#5E9E6E'].forEach((col, i) => { const gx = cx - 1.9 + i * 0.95, gy = cy + 0.3, h = 1.3 + (i % 2) * 0.3, Wc = { top: col, left: I.mix(col, '#0E1A21', 0.15), right: I.mix(col, '#0E1A21', 0.32) }; add(gx, gy, (c, k) => { I.box(c, k, gx, gy, 0.86, 1.0, 0, h, Wc, { windows: PAL.window }); I.gable(c, k, gx, gy, 0.88, 1.02, h, 0.45, '#3F3A3C', Wc); }); });
        add(cx + 0.4, cy - 1.45, (c, k) => I.box(c, k, cx + 0.4, cy - 1.45, 2.4, 1.1, 0, 1.6, { top: I.rgba(PAL.glass, 0.35), left: I.rgba(PAL.glass, 0.25), right: I.rgba(PAL.glass, 0.18) }, { edge: I.rgba(PAL.glass, 0.8), windows: PAL.window }));
        return 1.9;
      }
      case 'pavilion':
        add(cx, cy, (c, k) => { const Wt = { top: '#F4EFE6', left: '#E2D9C7', right: '#C9BFAE' }; I.box(c, k, cx, cy, 2.8, 2.0, 0, 0.9, Wt, { windows: PAL.window }); I.gable(c, k, cx, cy, 3.0, 2.2, 0.9, 0.9, '#D9F23A', Wt); const p = I.P(k, cx + 1.3, cy - 0.9, 0), q = I.P(k, cx + 1.3, cy - 0.9, 2.6); c.strokeStyle = '#C3CFD4'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); c.fillStyle = '#9B7BFF'; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x + k.S * 0.6, q.y + k.S * 0.18); c.lineTo(q.x, q.y + k.S * 0.36); c.closePath(); c.fill(); });
        return 2.6;
      default:
        add(cx, cy, (c, k) => I.house(c, k, cx, cy, 1.4, 1.2, 1, roof));
        return 1.6;
    }
  }
  function filler(list, b, seed) {
    const r = I.rng(seed), cx = b.cx, cy = b.cy, add = (gx, gy, fn) => list.push({ gx, gy, fn });
    const trees = (n, spread) => { for (let i = 0; i < n; i++) { const gx = cx + (r() - 0.5) * spread, gy = cy + (r() - 0.5) * spread, col = PAL.tree[Math.floor(r() * 3)], pine = r() < 0.35, sz = 0.8 + r() * 0.5; add(gx, gy, (c, k) => I.tree(c, k, gx, gy, sz, col, pine)); } };
    if (b.zone === 'campus') return;
    if (b.zone === 'forest') { trees(16, 5); return; }
    if (b.zone === 'towers') { [[-1.2, -1.1, 6.5], [1.1, -0.9, 5], [-0.9, 1.2, 4.2], [1.2, 1.2, 7.2]].forEach(([dx, dy, hh], i) => { if (r() < 0.15) return; const h = hh * (0.8 + r() * 0.4), w = 1.1 + r() * 0.4, gx = cx + dx, gy = cy + dy; add(gx, gy, (c, k) => { I.box(c, k, gx, gy, w, w, 0, h, { top: '#5E8FA0', left: '#29505E', right: '#1D3D48' }, { windows: I.rgba(PAL.glass, 0.55), edge: I.rgba(PAL.glass, 0.35) }); if (i === 3) { const p = I.P(k, gx, gy, h + 0.4); c.fillStyle = PAL.glass; c.beginPath(); c.arc(p.x, p.y, Math.max(1.5, k.S * 0.08), 0, 7); c.fill(); } }); }); return; }
    if (b.theme === 'eco' && (b.zone === 'res' || b.zone === 'downtown' || b.zone === 'industry')) {
      if (r() < 0.5) {
        // solar field: tilted panel rows
        for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) { const x0 = cx - 2 + col * 2.1, y0 = cy - 2 + row * 1.05; add(x0 + 0.9, y0 + 0.4, (c, k) => { const q = [I.P(k, x0, y0, 0.12), I.P(k, x0 + 1.8, y0, 0.12), I.P(k, x0 + 1.8, y0 + 0.7, 0.5), I.P(k, x0, y0 + 0.7, 0.5)]; I.poly(c, q); c.fillStyle = '#1F3F7A'; c.fill(); c.strokeStyle = 'rgba(147,197,253,0.55)'; c.lineWidth = 0.8; c.stroke(); c.beginPath(); for (let u = 1; u < 4; u++) { const a = I.P(k, x0 + u * 0.45, y0, 0.12), b2 = I.P(k, x0 + u * 0.45, y0 + 0.7, 0.5); c.moveTo(a.x, a.y); c.lineTo(b2.x, b2.y); } c.strokeStyle = 'rgba(147,197,253,0.25)'; c.stroke(); }); }
        trees(2, 5);
      } else {
        // wind farm: slow-turning turbines
        [[-1.4, -1.3, 0], [1.3, -0.6, 2.1], [-0.4, 1.5, 4.2]].forEach(([dx, dy, ph]) => { const gx = cx + dx, gy = cy + dy; add(gx, gy, (c, k) => { I.cyl(c, k, gx, gy, 0.09, 0, 3.4, { top: '#E8EFF1', left: '#DCE6E9', right: '#A9BCC3' }); const p = I.P(k, gx, gy, 3.45), a0 = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : performance.now() / 1600) + ph, L = k.S * 1.5; c.strokeStyle = '#F6F3EC'; c.lineWidth = Math.max(1.2, k.S * 0.09); c.lineCap = 'round'; c.beginPath(); for (let j = 0; j < 3; j++) { const a = a0 + j * 2.094; c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L); } c.stroke(); c.lineCap = 'butt'; c.fillStyle = '#F6F3EC'; c.beginPath(); c.arc(p.x, p.y, Math.max(1.5, k.S * 0.1), 0, 7); c.fill(); }); });
        trees(4, 5);
      }
      return;
    }
    if (b.theme === 'amsterdam' && b.zone !== 'fields') {
      // canal-house rows around a green courtyard
      for (const [ex, ey, vx, vy] of [[-2, -2, 1, 0], [2, -2, 0, 1], [2, 2, -1, 0], [-2, 2, 0, -1]]) for (let j = 0; j < 5; j++) {
        if (r() < 0.08) continue; const u = j * 0.82, gx = cx + ex + vx * u + (vx === 0 ? -Math.sign(ex) * 0.1 : 0), gy = cy + ey + vy * u + (vy === 0 ? -Math.sign(ey) * 0.1 : 0), brick = BRICK[Math.floor(r() * BRICK.length)], h = 1.0 + r() * 0.8, roof = I.mix(brick, '#1B1416', 0.45);
        add(gx, gy, (c, k) => I.house(c, k, gx, gy, vx ? 0.78 : 0.95, vy ? 0.78 : 0.95, h, roof, { wall: { top: brick, left: brick, right: I.mix(brick, '#0E1A21', 0.3) } }));
      }
      trees(3, 1.8); return;
    }
    if (b.zone === 'fields') { trees(2, 4.6); return; }
    if (b.zone === 'downtown') {
      [[-1.2, -1.1], [1.1, -1], [-1, 1.2], [1.2, 1.1]].forEach(([dx, dy]) => { if (r() < 0.25) return; const h = 1.4 + r() * 2.6, w = 1.2 + r() * 0.5, gx = cx + dx, gy = cy + dy, roof = PAL.roofs[Math.floor(r() * 6)]; add(gx, gy, (c, k) => I.box(c, k, gx, gy, w, w, 0, h, { top: roof, left: PAL.left, right: PAL.right }, { windows: PAL.window })); });
      return;
    }
    if (b.zone === 'industry') {
      const gx = cx - 0.6, gy = cy - 0.4; add(gx, gy, (c, k) => I.box(c, k, gx, gy, 2.8, 2, 0, 0.9, { top: PAL.roofs[2], left: PAL.left, right: PAL.right }));
      trees(2, 4.4); return;
    }
    const spots = [[-1.4, -1.3], [0.2, -1.5], [1.6, -1.2], [-1.5, 0.3], [1.5, 0.4], [-0.6, 1.6], [1, 1.7]];
    spots.forEach(([dx, dy]) => { if (r() < 0.35) return; const gx = cx + dx, gy = cy + dy, roof = PAL.roofs[Math.floor(r() * 6)], h = 0.5 + r() * 0.4; add(gx, gy, (c, k) => I.house(c, k, gx, gy, 0.9, 0.8, h, roof)); });
    trees(b.zone === 'river' ? 6 : 3, 4.6);
  }
  function fields(ctx, k, b, seed) {
    const r = I.rng(seed);
    [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]].forEach(([dx, dy], i) => {
      if (b.place && dx > 0 && dy < 0) return;
      const x0 = b.cx + dx - 1.1, y0 = b.cy + dy - 1.1, col = PAL.field[(seed + i) % 4];
      I.groundRect(ctx, k, x0, y0, x0 + 2.2, y0 + 2.2, 0.02, col);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      for (let j = 1; j < 5; j++) { const a = I.P(k, x0 + j * 0.44, y0, 0.02), c2 = I.P(k, x0 + j * 0.44, y0 + 2.2, 0.02); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.stroke(); }
      void r;
    });
  }

  // low-detail islands: fund-data-only companies are plain grey massing; due-diligence companies are wireframes
  function wbox(c, k, gx, gy, w, d, h, col) { const x0 = gx - w / 2, x1 = gx + w / 2, y0 = gy - d / 2, y1 = gy + d / 2, q = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath(); for (const hh of [0, h]) q.forEach(([x, y], i) => { const p = I.P(k, x, y, hh); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); if (i === 3) { const p0 = I.P(k, q[0][0], q[0][1], hh); c.lineTo(p0.x, p0.y); } }); q.forEach(([x, y]) => { const a = I.P(k, x, y, 0), b = I.P(k, x, y, h); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }); c.stroke(); }
  const GHOST = { top: '#6A7880', left: '#4E5B62', right: '#414D53' };
  function isleLite(list, b) {
    const p = b.place, cx = b.cx, cy = b.cy;
    if (b.isle === 'dd') { p.top = 1.8; list.push({ gx: cx, gy: cy, fn: (c, k) => { wbox(c, k, cx - 0.4, cy - 0.3, 1.8, 1.4, 1.6, I.rgba('#F2C14E', 0.85)); wbox(c, k, cx + 0.9, cy + 0.8, 1.0, 0.9, 0.9, I.rgba('#F2C14E', 0.6)); for (let j = 0; j < 4; j++) I.box(c, k, cx - 1.2, cy + 1.2, 0.7, 0.5, j * 0.09, j * 0.09 + 0.06, { top: j % 2 ? '#F6F3EC' : '#E6DFCF', left: '#C9C0AC', right: '#ADA48F' }); } }); return; }
    p.top = 1.5; list.push({ gx: cx, gy: cy, fn: (c, k) => { I.box(c, k, cx - 0.3, cy - 0.3, 1.8, 1.4, 0, 1.3, GHOST); I.box(c, k, cx + 1.0, cy + 0.9, 0.9, 0.8, 0, 0.7, GHOST); } });
  }
  const HEALTH = { good: '#D9F23A', mixed: '#FDBA8C', risk: '#FF5A3C' };
  function drawIsles(ctx, k, L, t) {
    const cc = 15.5;
    I.box(ctx, k, cc, cc, 9, 9, -0.8, 0, { top: PAL.ground, left: PAL.groundSide, right: PAL.groundSideR });
    I.groundRect(ctx, k, cc - 2.5, cc - 2.5, cc + 2.5, cc + 2.5, 0.01, PAL.ownLot);
    const isles = L.blocks.filter((b) => b.zone === 'isle'), org = I.P(k, cc, cc, 0.05);
    // data lines: live from companies that share their Ozy twin, thin and static for the rest
    for (const b of isles) {
      const p = I.P(k, b.cx, b.cy, 0.05), T = b.isle; if (T === 'other') continue;
      ctx.save(); ctx.lineWidth = T === 'ozy' ? 1.8 : 1; ctx.setLineDash(T === 'ozy' ? [6, 6] : [1.5, 6]); ctx.lineDashOffset = T === 'ozy' ? t * 14 : 0; ctx.strokeStyle = T === 'ozy' ? I.rgba(PAL.own, 0.7) : T === 'dd' ? I.rgba('#F2C14E', 0.45) : 'rgba(195,207,212,0.3)'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(org.x, org.y); ctx.stroke(); ctx.restore();
    }
    // local change: every configured connection between islands as a faint line, so the network is visible at a glance;
    // lines bow away from the centre so links between neighbouring islands don't all cut across the middle
    (L.ties || []).forEach(([a, bb]) => {
      const A = L.byId[a], B = L.byId[bb]; if (!A || !B || !A.block || !B.block) return;
      const x0 = A.block.cx, y0 = A.block.cy, x1 = B.block.cx, y1 = B.block.cy, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, od = Math.hypot(mx - cc, my - cc) || 1, bow = Math.min(3.2, Math.hypot(x1 - x0, y1 - y0) * 0.2), qx = mx + (mx - cc) / od * bow, qy = my + (my - cc) / od * bow;
      ctx.save(); ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 4; ctx.strokeStyle = 'rgba(205,192,255,0.62)'; ctx.lineWidth = 1.7; ctx.beginPath();
      for (let j = 0; j <= 18; j++) { const u = j / 18, v = 1 - u, q = I.P(k, v * v * x0 + 2 * v * u * qx + u * u * x1, v * v * y0 + 2 * v * u * qy + u * u * y1, 0.04); if (j) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
      ctx.stroke(); ctx.restore();
    });
    for (const b of isles) {
      const T = b.isle, p = b.place, S = T === 'ozy' ? 2.9 : T === 'hub' ? 2.7 : 2.4, cx = b.cx, cy = b.cy;
      I.box(ctx, k, cx, cy, S * 2, S * 2, -0.7, 0, T === 'ozy' || T === 'other' || T === 'hub' ? { top: PAL.ground, left: PAL.groundSide, right: PAL.groundSideR } : { top: '#22343C', left: '#1A2930', right: '#142128' });
      if (T === 'hub') { I.groundEllipse(ctx, k, cx, cy, S + 0.45, 0.03); ctx.strokeStyle = I.rgba(PAL.own, 0.45); ctx.lineWidth = 1.2; ctx.stroke(); }
      I.groundRect(ctx, k, cx - S + 0.4, cy - S + 0.4, cx + S - 0.4, cy + S - 0.4, 0.01, T === 'dd' ? '#2A3A3A' : T === 'fund' ? '#2C3D45' : PAL.lot);
      if (T === 'dd') { I.poly(ctx, [I.P(k, cx - S + 0.2, cy - S + 0.2, 0.02), I.P(k, cx + S - 0.2, cy - S + 0.2, 0.02), I.P(k, cx + S - 0.2, cy + S - 0.2, 0.02), I.P(k, cx - S + 0.2, cy + S - 0.2, 0.02)]); ctx.setLineDash([5, 5]); ctx.strokeStyle = I.rgba('#F2C14E', 0.8); ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]); }
      const hc = HEALTH[p.health];
      if (hc) {
        I.groundEllipse(ctx, k, cx, cy, S + 0.25, 0.03);
        if (T === 'ozy') { ctx.strokeStyle = hc; ctx.lineWidth = 2.6; ctx.stroke(); } else { ctx.setLineDash([3, 5]); ctx.strokeStyle = I.rgba(hc, 0.75); ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]); }
        if (p.health === 'risk') { const pu = (t % 1.8) / 1.8; I.groundEllipse(ctx, k, cx, cy, S + 0.25 + pu * 2.2, 0.03); ctx.strokeStyle = I.rgba(hc, (T === 'ozy' ? 0.8 : 0.45) * (1 - pu)); ctx.lineWidth = 2; ctx.stroke(); }
      }
      if (T === 'ozy') { I.groundEllipse(ctx, k, cx, cy, S + 0.85, 0.03); ctx.strokeStyle = I.rgba(PAL.own, 0.6); ctx.lineWidth = 1.2; ctx.stroke(); const a = t * 0.6 + cx, sp = I.P(k, cx + Math.cos(a) * (S + 0.85), cy + Math.sin(a) * (S + 0.85), 0.05); ctx.fillStyle = PAL.own; ctx.beginPath(); ctx.arc(sp.x, sp.y, 3.2, 0, 7); ctx.fill(); }
    }
  }
  function drawGround(ctx, k, L, t) {
    if (L.theme === 'campus') return drawCampusGround(ctx, k, L, t);
    if (L.theme === 'isles') return drawIsles(ctx, k, L, t);
    I.box(ctx, k, N / 2, N / 2, N, N, -0.8, 0, { top: PAL.ground, left: PAL.groundSide, right: PAL.groundSideR });
    for (const b of L.blocks) {
      if (b.zone === 'water') continue;
      if (b.zone === 'forest') { I.groundRect(ctx, k, b.cx - 2.5, b.cy - 2.5, b.cx + 2.5, b.cy + 2.5, 0.01, '#21402F'); continue; }
      if (b.zone === 'fields') fields(ctx, k, b, b.bx * 7 + b.by * 13);
      else I.groundRect(ctx, k, b.cx - 2.5, b.cy - 2.5, b.cx + 2.5, b.cy + 2.5, 0.01, b.place && b.place.isOrg ? PAL.ownLot : PAL.lot);
    }
    // river
    const pts = [], w = 1.7;
    for (let i = 0; i < RIVER.length; i++) { const a = RIVER[Math.max(0, i - 1)], c = RIVER[Math.min(RIVER.length - 1, i + 1)]; const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy); pts.push([RIVER[i][0] - dy / l * w, RIVER[i][1] + dx / l * w, RIVER[i][0] + dy / l * w, RIVER[i][1] - dx / l * w]); }
    I.poly(ctx, pts.map((p) => I.P(k, p[0], p[1], 0.03)).concat(pts.slice().reverse().map((p) => I.P(k, p[2], p[3], 0.03)))); ctx.fillStyle = PAL.water; ctx.fill();
    ctx.setLineDash([6, 10]); ctx.lineDashOffset = -t * 6; ctx.strokeStyle = I.rgba('#5E9FB0', 0.35); ctx.lineWidth = 1; ctx.beginPath();
    RIVER.forEach((p, i) => { const q = I.P(k, p[0], p[1], 0.04); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); ctx.setLineDash([]);
    // roads: cut where they meet the river; one bridge; over water only fine lines
    const keep = (R) => L.theme !== 'eco' || R.a === 12, canal = (R) => L.theme === 'amsterdam' && !R.v && (R.a === 6 || R.a === 18);
    for (const R of ROADSEGS) for (const sg of R.segs) {
      const a = R.a;
      if (!keep(R)) continue;
      if (canal(R) && !sg.wet) { I.groundRect(ctx, k, sg.u0, a - 0.15, sg.u1, a + 1.15, 0.04, PAL.water); continue; }
      if (!sg.wet) { if (R.v) I.groundRect(ctx, k, a, sg.u0, a + 1, sg.u1, 0.05, PAL.road); else I.groundRect(ctx, k, sg.u0, a, sg.u1, a + 1, 0.05, PAL.road); continue; }
      if (sg === BRIDGE) continue;
      ctx.strokeStyle = 'rgba(195,207,212,0.16)'; ctx.lineWidth = 0.6;
      for (const e of [a, a + 1]) { const p = R.v ? I.P(k, e, sg.u0, 0.05) : I.P(k, sg.u0, e, 0.05), q = R.v ? I.P(k, e, sg.u1, 0.05) : I.P(k, sg.u1, e, 0.05); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    }
    ctx.setLineDash([4, 7]); ctx.strokeStyle = PAL.roadLine; ctx.lineWidth = 1;
    for (const R of ROADSEGS) for (const sg of R.segs) { if (sg.wet || !keep(R) || canal(R)) continue; const a = R.a + 0.5; const p = R.v ? I.P(k, a, sg.u0, 0.06) : I.P(k, sg.u0, a, 0.06), q = R.v ? I.P(k, a, sg.u1, 0.06) : I.P(k, sg.u1, a, 0.06); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    ctx.setLineDash([]);
    if (L.theme === 'amsterdam') drawAmsterdam(ctx, k, L, t);
    if (L.theme === 'eco') { ctx.setLineDash([2, 8]); ctx.lineDashOffset = -t * 10; ctx.strokeStyle = I.rgba(PAL.glass, 0.5); ctx.lineWidth = 1.4; for (const R of ROADSEGS) if (R.a === 12) { const p = R.v ? I.P(k, 12.5, 0, 0.07) : I.P(k, 0, 12.5, 0.07), q = R.v ? I.P(k, 12.5, N, 0.07) : I.P(k, N, 12.5, 0.07); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } ctx.setLineDash([]); ctx.lineDashOffset = 0; }
    const story = L.bridgeStory, broken = story && story.state === 'broken';
    if (story && story.barge) {
      ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 8; ctx.strokeStyle = I.rgba(PAL.warn, 0.75); ctx.lineWidth = 1.6; ctx.beginPath(); RIVER.forEach((p, i) => { const q = I.P(k, p[0], p[1], 0.08); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
      const u = (t * 0.025) % 1, seg = u * (RIVER.length - 1), i0 = Math.floor(seg), f = seg - i0, A = RIVER[i0], B = RIVER[Math.min(RIVER.length - 1, i0 + 1)], bx = A[0] + (B[0] - A[0]) * f, by = A[1] + (B[1] - A[1]) * f;
      I.box(ctx, k, bx, by, 1.3, 1.3, 0, 0.3, { top: '#5C4A3A', left: '#45372B', right: '#362B22' }); I.box(ctx, k, bx - 0.25, by - 0.25, 0.5, 0.5, 0.3, 0.65, { top: '#D9B88E', left: '#B08A62', right: '#8E6E4E' }); I.box(ctx, k, bx + 0.3, by + 0.3, 0.4, 0.4, 0.3, 0.75, { top: '#E2D9C7', left: '#B8AE9C', right: '#968D7D' });
    }
    if (BRIDGE) {
      const a = BRIDGE.a, y0 = BRIDGE.u0 - 0.2, y1 = BRIDGE.u1 + 0.2, ym = (y0 + y1) / 2;
      if (broken) {
        const L1 = (y1 - y0) * 0.36;
        I.box(ctx, k, a + 0.5, y0 + L1 / 2, 1.2, L1, -0.25, 0.3, { top: PAL.road, left: '#2A3E47', right: '#1E2F37' }); I.box(ctx, k, a + 0.5, y1 - L1 / 2, 1.2, L1, -0.25, 0.3, { top: PAL.road, left: '#2A3E47', right: '#1E2F37' });
        for (const yy of [y0 + L1, y1 - L1]) { I.box(ctx, k, a + 0.5, yy, 1.3, 0.14, 0.3, 0.7, { top: '#FF5A3C', left: '#F6F3EC', right: '#C9C3B8' }); }
      } else {
      I.box(ctx, k, a + 0.5, ym, 1.2, y1 - y0, -0.25, 0.3, { top: PAL.road, left: '#2A3E47', right: '#1E2F37' });
      ctx.setLineDash([4, 7]); ctx.strokeStyle = PAL.roadLine; ctx.lineWidth = 1; let p = I.P(k, a + 0.5, y0, 0.31), q = I.P(k, a + 0.5, y1, 0.31); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(216,205,184,0.75)'; ctx.lineWidth = 1.2;
      for (const e of [a - 0.08, a + 1.08]) { p = I.P(k, e, y0, 0.62); q = I.P(k, e, y1, 0.62); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); for (let s = 0; s <= 6; s++) { const yy = y0 + (y1 - y0) * s / 6, b = I.P(k, e, yy, 0.3), u = I.P(k, e, yy, 0.62); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(u.x, u.y); ctx.stroke(); } }
    } }
    // zoomed-in detail: traffic
    if (k.lod > 0.02) {
      ctx.save(); ctx.globalAlpha *= k.lod;
      let n = 0;
      for (const R of ROADSEGS) for (const sg of R.segs.concat(BRIDGE && BRIDGE.r === R && !broken ? [Object.assign({}, BRIDGE, { wet: false, bridge: true })] : [])) {
        const len = sg.u1 - sg.u0; if (sg.wet || len < 3 || !keep(R) || canal(R)) continue;
        for (let j = 0; j < Math.min(3, Math.floor(len / 4)); j++) {
          n++; const dir = (n % 2) ? 1 : -1, u = sg.u0 + 0.4 + (((t * 0.5 * dir + n * 2.37) % (len - 0.8)) + (len - 0.8)) % (len - 0.8), lane = R.a + 0.5 + dir * 0.22, h0 = sg.bridge ? 0.3 : 0.05, col = PAL.roofs[n % PAL.roofs.length];
          const box = { top: col, left: mix2(col, 0.3), right: mix2(col, 0.5) };
          if (R.v) I.box(ctx, k, lane, u, 0.3, 0.55, h0, h0 + 0.24, box); else I.box(ctx, k, u, lane, 0.55, 0.3, h0, h0 + 0.24, box);
        }
      }
      ctx.restore();
    }
  }
  const mix2 = (c, t) => I.mix(c, '#0E1A21', t);
  function drawAmsterdam(ctx, k, L, t) {
    // canal bridges where streets cross, houseboats, tree-lined quays, a tram line and bike lanes
    for (const cy of [6, 18]) for (let a = 0; a <= 24; a += 6) { I.box(ctx, k, a + 0.5, cy + 0.5, 1.1, 1.6, 0.04, 0.22, { top: '#3A4A52', left: '#2A363C', right: '#20292E' }); const p = I.P(k, a + 0.5, cy - 0.3, 0.3), q = I.P(k, a + 0.5, cy + 1.3, 0.3); ctx.strokeStyle = 'rgba(216,205,184,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    const rn = I.rng(77);
    for (const cy of [6, 18]) for (let x = 1.5; x < N - 1; x += 3.1) { if (rn() < 0.4 || x % 6 < 1.3) continue; I.box(ctx, k, x, cy + 0.15 + (rn() < 0.5 ? 0 : 0.7), 1.5, 0.42, 0.04, 0.32, { top: PAL.roofs[Math.floor(rn() * 6)], left: '#3B2F2A', right: '#2C231F' }); }
    ctx.strokeStyle = '#E2C26B'; ctx.lineWidth = 1; ctx.setLineDash([]);
    for (const off of [0.35, 0.65]) { const p = I.P(k, 12 + off, 0, 0.07), q = I.P(k, 12 + off, N, 0.07); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    const u = ((t * 0.9) % (N + 4)) - 2; I.box(ctx, k, 12.5, u, 0.42, 2, 0.08, 0.5, { top: '#F4EFE6', left: '#E2C26B', right: '#B89A45' }, { windows: PAL.window });
    ctx.strokeStyle = 'rgba(183,90,70,0.7)'; ctx.lineWidth = 1.4;
    for (const a of [0, 24]) { const p = I.P(k, a + 0.08, 0, 0.06), q = I.P(k, a + 0.08, N, 0.06); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    if (k.lod > 0.02) { ctx.save(); ctx.globalAlpha *= k.lod; for (let i = 0; i < 26; i++) { const v = i % 2, a = [0, 12, 24][i % 3] + 0.12, s = ((t * (0.25 + (i % 5) * 0.06) + i * 1.9) % N), p = v ? I.P(k, a, s, 0.1) : I.P(k, s, a + 0.0, 0.1); ctx.fillStyle = ['#F6F3EC', '#FDE68A', '#93C5FD'][i % 3]; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, k.S * 0.06), 0, 7); ctx.fill(); } ctx.restore(); }
  }
  function drawLandmark(list, b, add) {
    const cx = b.cx, cy = b.cy, brick = '#8E4A3A', dark = '#2B2530', W = { top: brick, left: '#7A3E31', right: '#5E3026' };
    if (b.landmark === 'station') { add(cx, cy, (c, k) => { I.box(c, k, cx, cy + 0.4, 4.4, 1.5, 0, 1.4, W, { windows: PAL.window }); I.gable(c, k, cx, cy + 0.4, 4.5, 1.6, 1.4, 0.6, dark, W); for (const dx of [-0.8, 0.8]) { I.box(c, k, cx + dx, cy + 0.4, 0.55, 0.55, 1.4, 3.1, W); I.gable(c, k, cx + dx, cy + 0.4, 0.6, 0.6, 3.1, 0.5, '#C9A24A', W); } I.cyl(c, k, cx, cy - 1.1, 1.1, 0, 0.9, { top: I.rgba(PAL.glass, 0.4), left: I.rgba(PAL.glass, 0.25), right: I.rgba(PAL.glass, 0.15) }); }); return true; }
    if (b.landmark === 'museum') { add(cx, cy, (c, k) => { I.box(c, k, cx, cy, 3.8, 2.2, 0, 1.8, W, { windows: PAL.window }); I.gable(c, k, cx, cy, 3.9, 2.3, 1.8, 0.8, '#3F4B55', W); for (const [dx, dy] of [[-1.5, -0.8], [1.5, -0.8], [-0.4, -0.8], [0.4, -0.8]]) { I.box(c, k, cx + dx, cy + dy, 0.5, 0.5, 1.8, 3, W); I.gable(c, k, cx + dx, cy + dy, 0.55, 0.55, 3, 0.55, '#3F4B55', W); } }); for (let i = 0; i < 4; i++) { const gx = cx - 1.8 + i * 1.2, gy = cy + 1.9; add(gx, gy, (c, k) => I.tree(c, k, gx, gy, 0.8, PAL.tree[i % 3], false)); } return true; }
    if (b.landmark === 'church') { add(cx, cy, (c, k) => { I.box(c, k, cx - 0.5, cy, 2.6, 1.1, 0, 1.3, W); I.gable(c, k, cx - 0.5, cy, 2.7, 1.2, 1.3, 0.7, dark, W); I.box(c, k, cx + 1.1, cy, 0.8, 0.8, 0, 3.4, W, { windows: PAL.window }); I.cyl(c, k, cx + 1.1, cy, 0.32, 3.4, 4.1, { top: '#3D6FB6', left: '#2E5694', right: '#244579' }); const p = I.P(k, cx + 1.1, cy, 4.1), q = I.P(k, cx + 1.1, cy, 4.9); c.strokeStyle = '#E2C26B'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); }); return true; }
    if (b.landmark === 'mill') { add(cx, cy, (c, k) => { I.cyl(c, k, cx, cy, 0.7, 0, 2.2, { top: '#6B4A3A', left: '#8A6650', right: '#5E4234' }); const p = I.P(k, cx, cy, 2.3), now = performance.now() / 1000, L2 = k.S * 1.6; c.strokeStyle = '#F4EFE6'; c.lineWidth = Math.max(1.2, k.S * 0.08); for (let i = 0; i < 4; i++) { const a = now * 0.6 + i * Math.PI / 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(a) * L2, p.y + Math.sin(a) * L2 * 0.9); c.stroke(); } }); for (let i = 0; i < 6; i++) { const gx = cx - 2 + (i % 3) * 2, gy = cy + (i < 3 ? -1.8 : 1.8); add(gx, gy, (c, k) => I.tree(c, k, gx, gy, 0.7, PAL.tree[i % 3], i % 2 === 0)); } return true; }
    if (b.landmark === 'market') { add(cx, cy, (c, k) => { for (let i = 0; i < 6; i++) { const gx = cx - 1.6 + (i % 3) * 1.6, gy = cy - 0.8 + Math.floor(i / 3) * 1.6; I.box(c, k, gx, gy, 1.1, 0.9, 0, 0.5, { top: ['#E89A82', '#F4EFE6', '#93B4AF'][i % 3], left: '#5E4A40', right: '#4A3A32' }); } }); return true; }
    return false;
  }
  function drawCampusGround(ctx, k, L, t) {
    const C0 = 6.6, C1 = 24.4, cc = (C0 + C1) / 2;
    I.box(ctx, k, cc, cc, C1 - C0, C1 - C0, -1.1, 0, { top: '#2B3E47', left: '#1E2F37', right: '#16242B' });
    I.groundRect(ctx, k, C0 + 0.6, C0 + 0.6, C1 - 0.6, C1 - 0.6, 0.01, '#33505B');
    for (const b of L.blocks) if (b.zone === 'campus') I.groundRect(ctx, k, b.cx - 2.3, b.cy - 2.3, b.cx + 2.3, b.cy + 2.3, 0.015, b.bx === 1 && b.by === 3 ? '#3F5E45' : '#3D5560');
    ctx.setLineDash([2, 6]); ctx.lineDashOffset = -t * 6; ctx.lineWidth = 1.2;
    for (const b of L.blocks) { if (b.zone === 'campus' || b.zone === 'water') continue; const p = I.P(k, b.cx, b.cy, 0.02), q = I.P(k, cc + (b.cx - cc) * 0.55, cc + (b.cy - cc) * 0.55, 0.02); ctx.strokeStyle = I.rgba('#C4B5FD', 0.35); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    for (const b of L.blocks) {
      if (b.zone === 'campus' || b.zone === 'water') continue;
      I.box(ctx, k, b.cx, b.cy, 4.8, 4.8, -0.7, 0, { top: PAL.ground, left: PAL.groundSide, right: PAL.groundSideR });
      if (b.zone === 'fields' || b.zone === 'forest') fields(ctx, k, b, b.bx * 7 + b.by * 13); else I.groundRect(ctx, k, b.cx - 2.2, b.cy - 2.2, b.cx + 2.2, b.cy + 2.2, 0.01, PAL.lot);
    }
    if (k.lod > 0.02) { ctx.save(); ctx.globalAlpha *= k.lod; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + t * 0.15, p = I.P(k, cc + Math.cos(a) * 8.2, cc + Math.sin(a) * 8.2, 0.06); ctx.fillStyle = i % 3 ? '#F6F3EC' : '#FF5A3C'; ctx.fillRect(p.x - 2, p.y - 1, 4, 2.4); } ctx.restore(); }
  }
  function hospital(list, L) {
    const cc = 15.5, add = (gx, gy, fn) => list.push({ gx, gy, fn: (c, k) => { I.setTint(PAL.ownWall); fn(c, k); I.setTint(null); } }), WALL = { top: '#DCE6E9', left: '#A9BCC3', right: '#8499A1' }, GL = { top: I.rgba(PAL.glass, 0.34), left: I.rgba(PAL.glass, 0.26), right: I.rgba(PAL.glass, 0.18) };
    add(cc, cc - 0.6, (c, k) => {
      I.box(c, k, cc, cc - 0.6, 5.2, 5.2, 0, 0.9, WALL);
      for (let f = 0.9; f < 8.1; f += 0.9) I.box(c, k, cc, cc - 0.6, 4.4, 4.4, f, f + 0.9, { top: '#E8EFF1', left: Math.round(f / 0.9) % 2 ? WALL.left : I.mix(PAL.glass, '#1E2F37', 0.55), right: Math.round(f / 0.9) % 2 ? WALL.right : I.mix(PAL.glass, '#16242B', 0.62) }, { windows: PAL.window });
      I.cyl(c, k, cc, cc - 0.6, 1.5, 8.1, 8.2, { top: '#2E3A40', left: '#24303A', right: '#1C262E' });
      const p = I.P(k, cc, cc - 0.6, 8.2); c.strokeStyle = '#F6F3EC'; c.lineWidth = Math.max(1.4, k.S * 0.1); const s2 = k.S * 0.45; c.beginPath(); c.moveTo(p.x - s2, p.y - s2 * 0.6); c.lineTo(p.x - s2, p.y + s2 * 0.6); c.moveTo(p.x + s2, p.y - s2 * 0.6); c.lineTo(p.x + s2, p.y + s2 * 0.6); c.moveTo(p.x - s2, p.y); c.lineTo(p.x + s2, p.y); c.stroke();
      const q = I.P(k, cc + 2.2, cc - 2.85, 6.6), z = k.S * 0.55; c.fillStyle = '#FF5A3C'; c.fillRect(q.x - z * 0.3, q.y - z, z * 0.6, z * 2); c.fillRect(q.x - z, q.y - z * 0.3, z * 2, z * 0.6);
    });
    // covered skybridges tie the main building to the neighbouring departments
    [[cc, 11.7, 0.7, 1.4], [19.0, cc - 0.6, 1.9, 0.7], [cc - 0.6, 19.0, 0.7, 3.0], [11.8, cc - 0.4, 2.2, 0.7]].forEach(([gx, gy, w, d]) => add(gx, gy, (c, k) => I.box(c, k, gx, gy, w, d, 1.7, 2.3, GL, { edge: I.rgba(PAL.glass, 0.7) })));
    // support blocks: ambulance bay & parking, healing garden
    const park = L.blocks.find((b) => b.bx === 3 && b.by === 1), gard = L.blocks.find((b) => b.bx === 1 && b.by === 3);
    if (park && !park.place) { list.push({ gx: park.cx, gy: park.cy, fn: (c, k) => { I.groundRect(c, k, park.cx - 2, park.cy - 2, park.cx + 2, park.cy + 2, 0.02, '#2E3A40'); c.strokeStyle = 'rgba(246,243,236,0.35)'; c.lineWidth = 1; for (let i = -1.5; i <= 1.6; i += 0.75) { const a = I.P(k, park.cx + i, park.cy - 1.8, 0.03), b2 = I.P(k, park.cx + i, park.cy - 0.6, 0.03), a2 = I.P(k, park.cx + i, park.cy + 0.6, 0.03), b3 = I.P(k, park.cx + i, park.cy + 1.8, 0.03); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b2.x, b2.y); c.moveTo(a2.x, a2.y); c.lineTo(b3.x, b3.y); c.stroke(); } } });
      [[-1.1, -1.2], [0.4, -1.2], [-0.4, 1.2]].forEach(([dx, dy]) => list.push({ gx: park.cx + dx, gy: park.cy + dy, fn: (c, k) => amb(c, k, park.cx + dx, park.cy + dy) })); }
    if (gard && !gard.place) { list.push({ gx: gard.cx, gy: gard.cy, fn: (c, k) => { I.groundEllipse(c, k, gard.cx + 0.6, gard.cy + 0.5, 1.1, 0.03); c.fillStyle = PAL.water; c.fill(); } });
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, gx = gard.cx - 0.2 + Math.cos(a) * 1.8, gy = gard.cy + Math.sin(a) * 1.8; list.push({ gx, gy, fn: (c, k) => I.tree(c, k, gx, gy, 0.8, PAL.tree[i % 3], false) }); } }
  }
  const ROADSEGS = [];
  for (let i = 0; i <= 4; i++) for (const v of [true, false]) {
    const a = i * BLK, segs = []; let cur = null;
    for (let s = 0; s <= N * 10; s++) { const u = s / 10, x = v ? a + 0.5 : u, y = v ? u : a + 0.5, wet = riverDist(x, y) < 2.05; if (!cur || cur.wet !== wet) { if (cur) { cur.u1 = u; segs.push(cur); } cur = { u0: u, wet }; } }
    cur.u1 = N; segs.push(cur); const R = { v, a, segs }; segs.forEach((sg) => { sg.r = R; sg.a = a; sg.v = v; }); ROADSEGS.push(R);
  }
  const BRIDGE = (ROADSEGS.find((R) => R.v && R.a === 24) || { segs: [] }).segs.find((sg) => sg.wet) || null;
  const BRIDGE_AT = BRIDGE ? { gx: BRIDGE.a + 0.5, gy: (BRIDGE.u0 + BRIDGE.u1) / 2 } : null;
  function buildDrawables(L) {
    const list = [];
    for (const b of L.blocks) {
      if (b.zone === 'water' || b.zone === 'void') continue;
      const seed = b.zone === 'isle' ? I.hash(b.place.id) % 97 : b.bx * 31 + b.by * 17 + 3;
      if (b.zone === 'isle' && b.isle !== 'ozy' && b.isle !== 'other' && b.isle !== 'hub') { isleLite(list, b); continue; }
      if (b.place && b.place.isOrg && L.theme === 'campus') { b.place.top = 8.4; continue; }
      if (!b.place && b.landmark && drawLandmark(list, b, (gx, gy, fn) => list.push({ gx, gy, fn }))) continue;
      if (b.place) {
        const own = !!(b.place.isOrg || b.place.own), from = list.length;
        b.place.top = shape(list, b.place.shape, b.cx, b.cy, 2.5, seed, own);
        if (own) for (let j = from; j < list.length; j++) { const f0 = list[j].fn; list[j].fn = (cc, kk) => { I.setTint(PAL.ownWall); f0(cc, kk); I.setTint(null); }; }
        const r = I.rng(seed); for (let i = 0; i < 3; i++) { const gx = b.cx + (r() < 0.5 ? -2 : 2) + (r() - 0.5) * 0.4, gy = b.cy + (r() - 0.5) * 4, col = PAL.tree[i % 3]; list.push({ gx, gy, fn: (c, k) => I.tree(c, k, gx, gy, 0.9, col, false) }); }
      } else filler(list, b, seed);
    }
    if (L.theme === 'campus') hospital(list, L);
    if (L.theme === 'isles') for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.4, gx = 15.5 + Math.cos(a) * 3.4, gy = 15.5 + Math.sin(a) * 3.4; list.push({ gx, gy, fn: (c, k) => I.tree(c, k, gx, gy, 0.85, PAL.tree[i % 3], false) }); }
    (L.far || []).forEach((f, i) => {
      const inner = []; f.top = shape(inner, f.shape, f.gx, f.gy, 2.5, 7 + i * 5) || 1.5;
      const r = I.rng(91 + i); for (let j = 0; j < 4; j++) { const gx = f.gx + (r() - 0.5) * 5.2, gy = f.gy + (r() < 0.5 ? -2.6 : 2.6), col = PAL.tree[j % 3]; inner.push({ gx, gy, fn: (c2, k2) => I.tree(c2, k2, gx, gy, 0.85, col, j % 2 === 0) }); }
      list.push({ gx: f.gx, gy: f.gy, fn: (c2, k2) => {
        I.box(c2, k2, f.gx, f.gy, 7, 7, -0.6, 0, { top: PAL.ground, left: PAL.groundSide, right: PAL.groundSideR });
        I.groundRect(c2, k2, f.gx - 2.8, f.gy - 2.8, f.gx + 2.8, f.gy + 2.8, 0.01, PAL.lot);
        inner.slice().sort((a, b) => I.depth(k2, a.gx, a.gy) - I.depth(k2, b.gx, b.gy)).forEach((d) => d.fn(c2, k2));
      } });
    });
    return list;
  }
  function drawEarth(ctx, k, e, at, t) {
    const p = I.P(k, at.cx, at.cy, (at.top || 1) + 2.6), s = k.S;
    if (e.kind === 'flood') {
      ctx.fillStyle = 'rgba(147,197,253,0.85)';
      [[-0.5, 0, 0.55], [0.15, -0.25, 0.7], [0.75, 0, 0.5]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(p.x + dx * s, p.y + dy * s, r * s, 0, 7); ctx.fill(); });
      ctx.strokeStyle = 'rgba(147,197,253,0.7)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) { const x = p.x + (i - 2) * s * 0.35, y0 = p.y + s * 0.5 + ((t * 30 + i * 9) % 14); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x - 2, y0 + 6); ctx.stroke(); }
      for (let i = 0; i < 3; i++) { const u = ((t * 0.3 + i / 3) % 1); I.groundEllipse(ctx, k, at.cx + 1.6, at.cy + 1.6, 0.4 + u * 1.6, 0.05); ctx.strokeStyle = I.rgba('#93C5FD', 0.6 * (1 - u)); ctx.stroke(); }
    } else if (e.kind === 'heat') {
      ctx.strokeStyle = I.rgba(PAL.cat.harm, 0.8); ctx.lineWidth = 1.6;
      for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let i = 0; i <= 16; i++) { const x = p.x - s * 0.9 + i * s * 0.11, y = p.y + j * s * 0.32 + Math.sin(i * 0.9 + t * 2 + j) * s * 0.08; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    } else if (e.kind === 'drought') {
      ctx.fillStyle = PAL.cat.trust; ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.4, 0, 7); ctx.fill();
      ctx.strokeStyle = PAL.cat.trust; ctx.lineWidth = 1.4; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + t * 0.2; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * s * 0.55, p.y + Math.sin(a) * s * 0.55); ctx.lineTo(p.x + Math.cos(a) * s * 0.8, p.y + Math.sin(a) * s * 0.8); ctx.stroke(); }
    } else {
      ctx.fillStyle = PAL.cat.trust; ctx.beginPath(); const x = p.x, y = p.y - s * 0.4;
      ctx.moveTo(x + s * 0.15, y); ctx.lineTo(x - s * 0.25, y + s * 0.55); ctx.lineTo(x, y + s * 0.55); ctx.lineTo(x - s * 0.15, y + s * 1.05); ctx.lineTo(x + s * 0.3, y + s * 0.4); ctx.lineTo(x + s * 0.05, y + s * 0.4); ctx.closePath(); ctx.fill();
    }
    return { x: p.x, y: p.y - s * 1.1 };
  }
  window.OzyCity = { N, BLK, layout, buildDrawables, drawGround, drawEarth };
})();

// ─── prototype/world-map.js ─────────────────────────────────────────
// Ozy world map — controller. MACRO · the city (open world) → MESO · inside the organisation (floors) → MICRO · one team (invisible processes).
// createWorldMap(canvas, { onSelect(item), onLevel(level, floorId) }) → controller
function createWorldMapImpl(canvas, opts) {
  opts = opts || {};
  const I = window.OzyIso, PAL = I.PAL, C = window.OzyCity;
  let ctx = canvas.getContext('2d'); const host = canvas.parentElement;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  function resize() { W = host.clientWidth; H = host.clientHeight; canvas.width = W * DPR; canvas.height = H * DPR; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const km = I.cam(), ki = I.cam();
  km.ox = km.oy = C.N / 2; km.fx = km.fy = C.N / 2;
  let cs = null, L = null, drawables = [], level = 'macro', floorId = null;
  let sel = null, hover = null, effects = {}, hot = [], spot = null, ripples = [], hits = [], fade = 1;
  let yaw = 0.0, yawT = 0.0, yawI = 0.0, yawIT = 0.0, zoomU = 1, zoomUI = 1, boost = 1, boostT = 1, focusT = [C.N / 2, C.N / 2], pending = null;
  let lastInput = 0, drag = null, dragged = false, yawM = 0, yawMT = 0, tiltM = 0;
  let pX = 0, pY = 0, zoomM = 1;
  let insetB = 0, snap = null, snapKey = '', snapping = false;

  // ——— public ———
  function setCase(c) {
    if (window.__ozyApplyGlobal) window.__ozyApplyGlobal(); if (window.__ozyApplyPersonas) window.__ozyApplyPersonas();
    cs = c; L = C.layout(c); snap = null; drawables = C.buildDrawables(L);
    level = 'macro'; floorId = null; sel = null; hover = null; effects = {}; hot = []; spot = null; ripples = []; fade = 0;
    zoomU = 1; boost = boostT = 1; focusT = [C.N / 2, C.N / 2]; km.fx = km.fy = C.N / 2; pending = null;
  }
  function setLevel(l, fid) {
    if (!cs) return;
    if (l === 'meso' && level === 'macro') { const o = L.byId.org.block; focusT = [o.cx, o.cy]; boostT = 3.4; pending = { to: 'meso', at: performance.now() + 650 }; return; }
    if (l === 'macro' && level !== 'macro') { const o = L.byId.org.block; km.fx = o.cx; km.fy = o.cy; boost = 3.4; boostT = 1; focusT = [C.N / 2, C.N / 2]; level = 'macro'; fade = 0.2; floorId = null; emitLevel(); return; }
    if (l !== 'macro' && !(cs.floors || []).length) return;
    if (l === 'micro') { floorId = fid || floorId || (cs.team && cs.team.floor) || cs.floors[0].id; level = 'micro'; fade = 0; emitLevel(); return; }
    if (l === 'meso') { level = 'meso'; fade = 0; emitLevel(); return; }
    level = l; emitLevel();
  }
  function emitLevel() { if (opts.onLevel) opts.onLevel(level, floorId); }

  // ——— hit regions ———
  function addHit(r, item) { hits.push({ r, item }); }
  function inPoly(px, py, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { if ((pts[i].y > py) !== (pts[j].y > py) && px < (pts[j].x - pts[i].x) * (py - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) c = !c; } return c; }
  function pick(mx, my) {
    for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (h.r.poly ? inPoly(mx, my, h.r.poly) : (mx >= h.r.x0 && mx <= h.r.x1 && my >= h.r.y0 && my <= h.r.y1)) return h.item; }
    return null;
  }
  const same = (a, b) => a && b && a.kind === b.kind && a.id === b.id;

  // ——— label placement ———
  let placed = [];
  function place(x, y, text, o, item, force) {
    if (snapping) return null;
    ctx.font = (o.kind === 'label' ? 'italic 500 12.5px' : '600 12.5px') + ' Figtree, sans-serif';
    const w = ctx.measureText(String(text)).width + (o.dot ? 32 : 22), h = 24;
    const x0 = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2, r = { x0: x0 - 3, y0: y - h / 2 - 2, x1: x0 + w + 3, y1: y + h / 2 + 2 };
    if (!force && placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) return null;
    placed.push(r); const rr = I.pill(ctx, x, y, text, o); if (item) addHit(rr, item); return rr;
  }
  function reserve() { placed.push({ x0: 0, y0: 0, x1: Math.min(W, 420), y1: 56 }, { x0: W - 230, y0: 0, x1: W, y1: 58 }, { x0: W - 350, y0: H - 92 - insetB, x1: W, y1: H - insetB }, { x0: 0, y0: H - insetB, x1: W, y1: H }); }
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);

  // ——— MACRO ———
  const PH = 15.5, PL = [4.5, 25.5]; let planeTag = null;
  function drawMacro(t, now) {
    // local change: a ringed islands world without intangible forces is framed tightly (no empty plane above it)
    const ringed = L.theme === 'isles' && (cs.places || []).some((p) => p.ring), noPlane = ringed && !(cs.forces || []).length;
    const SH = Math.max(120, H - 140 - insetB), CY = (76 + SH / 2) / H, RW = ringed ? 24 : 28;
    const base = Math.min(W * 0.96 / (2 * 1.2247 * RW), SH * 0.94 / (2 * 0.7071 * RW + (noPlane ? 3 : 15)));
    km.S = base * zoomU * boost; km.W = W; km.H = H; km.yaw = yaw; km.cy0 = CY + (noPlane ? 1 : 4.5) * km.S / H; km.lod = Math.max(0, Math.min(1, (zoomU * boost - 1.45) / 0.5)); I.prep(km);
    planeTag = null;
    const planeA = level === 'macro' && !pending && !noPlane ? Math.max(0, Math.min(1, (1.75 - zoomU) / 0.35)) : 0;
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H / 2, Math.max(W, H) * 0.8); g.addColorStop(0, '#16282F'); g.addColorStop(1, PAL.surface);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const org = L.byId.org, pin = (p) => I.P(km, p.block.cx, p.block.cy, (p.top || 1) + 0.2), fpin = (f) => I.P(km, f.gx, f.gy, (f.top || 1.5) + 0.2);
    // earth & climate dome + global systems (soft discs beyond the boundary)
    const c0 = I.P(km, C.N / 2, C.N / 2, 0), domeR = 31 * 1.2247 * km.S;
    ctx.setLineDash([1.5, 7]); ctx.lineCap = 'round'; ctx.strokeStyle = I.rgba(PAL.cat.earth, 0.28); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(c0.x, c0.y, domeR, domeR * 0.78, 0, Math.PI, 0); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
    const gpos = (L.global || []).map((gl) => { const p = I.P(km, gl.gx, gl.gy, 0), eff = effects[gl.id], col = eff ? PAL.cat[eff[1]] : PAL.cat[gl.kind === 'pollution' && gl.link === 'harm' ? 'harm' : gl.kind === 'health' ? 'emotion' : gl.kind === 'justice' ? 'culture' : 'earth']; return { gl, p, col, eff }; });
    for (const q of gpos) {
      const r = 3.6 * km.S, it = { kind: 'global', id: q.gl.id }, on = same(hover, it) || same(sel, it) || spot === q.gl.id, bad = q.eff && q.eff[1] === 'harm';
      ctx.globalCompositeOperation = 'screen'; I.aura(ctx, q.p.x, q.p.y, r * 1.5, q.col, on ? 0.26 : 0.16); ctx.globalCompositeOperation = 'source-over';
      ctx.setLineDash([3, 5]); ctx.strokeStyle = I.rgba(q.col, on ? 0.9 : 0.55); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q.p.x, q.p.y, r * 0.62, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      if (bad) { const pu = (t % 1.6) / 1.6; ctx.strokeStyle = I.rgba(PAL.risk, 0.85 * (1 - pu)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.p.x, q.p.y, r * (0.62 + pu * 0.6), 0, 7); ctx.stroke(); }
      glyph(q.gl.kind, q.p.x, q.p.y, km.S, q.col, t);
      addHit({ x0: q.p.x - r * 0.7, y0: q.p.y - r * 0.7, x1: q.p.x + r * 0.7, y1: q.p.y + r * 0.7 }, it);
    }
    C.drawGround(ctx, km, L, t);
    // own lot: brand purple, so your organisation is the first thing you find
    I.groundEllipse(ctx, km, org.block.cx, org.block.cy, 2.9, 0.06); ctx.strokeStyle = I.rgba(PAL.own, 0.95); ctx.lineWidth = 2.2; ctx.stroke();
    I.groundEllipse(ctx, km, org.block.cx, org.block.cy, 3.3, 0.06); ctx.setLineDash([3, 5]); ctx.strokeStyle = I.rgba(PAL.own, 0.55); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    if (sel && (sel.kind === 'org' || sel.kind === 'zoom')) { const u = Math.min(1, (now - (sel.at || 0)) / 360), gp = I.P(km, org.block.cx, org.block.cy, 0.5); ctx.globalCompositeOperation = 'screen'; I.aura(ctx, gp.x, gp.y, 4.2 * km.S * 1.2247, PAL.own, 0.32 * u); ctx.globalCompositeOperation = 'source-over'; I.groundEllipse(ctx, km, org.block.cx, org.block.cy, 2.9, 0.06); ctx.strokeStyle = I.rgba('#D9CCFF', 0.9 * u); ctx.lineWidth = 3; ctx.stroke(); }
    ripples = ripples.filter((r) => now - r.start < 3200);
    for (const r of ripples) for (let j = 0; j < 3; j++) { const u = (now - r.start) / 3200 - j * 0.12; if (u <= 0) continue; I.groundEllipse(ctx, km, org.block.cx, org.block.cy, 2 + u * 16, 0.07); ctx.setLineDash([3, 6]); ctx.strokeStyle = I.rgba(PAL.cat.direction, 0.75 * (1 - u)); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    for (const b of L.blocks) {
      if (!b.place) continue;
      const it = { kind: b.place.isOrg ? 'org' : 'place', id: b.place.id };
      const corners = [I.P(km, b.cx - 2.5, b.cy - 2.5, 0), I.P(km, b.cx + 2.5, b.cy - 2.5, 0), I.P(km, b.cx + 2.5, b.cy + 2.5, 0), I.P(km, b.cx - 2.5, b.cy + 2.5, 0)];
      addHit({ poly: corners }, it);
      const on = same(hover, it) || same(sel, it) || spot === b.place.id;
      if (on) { I.poly(ctx, corners); ctx.fillStyle = I.rgba(PAL.cream, 0.08); ctx.fill(); ctx.setLineDash([4, 5]); ctx.strokeStyle = I.rgba(PAL.cream, 0.7); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); }
      const eff = effects[b.place.id];
      if (eff && eff[1] === 'harm') { I.poly(ctx, corners); ctx.fillStyle = I.rgba(PAL.risk, 0.16); ctx.fill(); ctx.strokeStyle = I.rgba(PAL.risk, 0.9); ctx.lineWidth = 1.6; ctx.stroke(); const pu = (t % 1.6) / 1.6; I.groundEllipse(ctx, km, b.cx, b.cy, 2.6 + pu * 2, 0.07); ctx.strokeStyle = I.rgba(PAL.risk, 0.8 * (1 - pu)); ctx.lineWidth = 2; ctx.stroke(); }
    }
    for (const f of L.far || []) { const it = { kind: 'far', id: f.id }; addHit({ poly: [I.P(km, f.gx - 3.5, f.gy - 3.5, 0), I.P(km, f.gx + 3.5, f.gy - 3.5, 0), I.P(km, f.gx + 3.5, f.gy + 3.5, 0), I.P(km, f.gx - 3.5, f.gy + 3.5, 0)] }, it); }
    const list = drawables.slice().sort((a, b) => I.depth(km, a.gx, a.gy) - I.depth(km, b.gx, b.gy));
    for (const d of list) d.fn(ctx, km);
    // ribbons: local, far and local → global. Anything going wrong turns risk-red.
    const isBad = (id) => effects[id] && effects[id][1] === 'harm';
    // lines from the organisation only show while it is selected (or for what you point at / what goes wrong)
    const orgOn = !!(sel && (sel.kind === 'org' || sel.kind === 'zoom')), orgHov = !!(hover && (hover.kind === 'org' || hover.kind === 'zoom'));
    // ties: every field shows its own connections when selected; colour = tension (risk) · synergy (good) · mixed
    const fcat = { competitor: 'direction', partner: 'trust', city: 'flow', institution: 'decision', community: 'emotion' };
    const TONE = { risk: PAL.risk, good: '#D9F23A', mixed: '#FDBA8C', none: '#8FA3AD' };
    const posOf = (id) => { if (L.byId[id]) return pin(L.byId[id]); const f = (L.far || []).find((x) => x.id === id); if (f) return fpin(f); const q = gpos.find((x) => x.gl.id === id); return q ? q.p : null; };
    const ties = (cs.ties || (window.OZY_WORLD_TIES || {})[cs.id] || (cs.links || []).map(([a, b, cat]) => [a, b, cat === 'harm' ? 'risk' : 'none', ''])).slice();
    [...(L.far || []).map((f) => f.id), ...gpos.map((q) => q.gl.id)].forEach((id) => { if (!ties.some((x) => (x[0] === 'org' && x[1] === id) || (x[1] === 'org' && x[0] === id))) ties.push(['org', id, 'none', '']); });
    const selId = sel ? (sel.kind === 'org' || sel.kind === 'zoom' ? 'org' : sel.id) : null, hovId = hover ? (hover.kind === 'org' || hover.kind === 'zoom' ? 'org' : hover.id) : null;
    const tieLabels = [];
    ties.forEach(([a, b, tone, label], i) => {
      const A = posOf(a), B = posOf(b); if (!A || !B) return;
      // local change: on a ringed islands map only connections whose both ends are affected light up (a risk at HQ does not redden every office)
      const both = !!(effects[a] && effects[b]), onS = selId && (a === selId || b === selId), onH = hovId && (a === hovId || b === hovId), bad = ringed ? both && (isBad(a) || isBad(b)) : isBad(a) || isBad(b), hl = onS || bad || spot === a || spot === b || (ringed ? both : effects[a] || effects[b]);
      if (!hl && !onH) return;
      const col = bad ? PAL.risk : TONE[tone] || TONE.none;
      I.ribbon(ctx, A, B, col, reduced ? 0 : t + i * 0.6, null, onS ? 1 : hl ? 0.85 : 0.55);
      if (onS && label) { const lift = Math.max(30, Math.hypot(B.x - A.x, B.y - A.y) * 0.32); tieLabels.push({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 - lift / 2, text: (tone === 'risk' ? 'Tension · ' : tone === 'good' ? 'Synergy · ' : tone === 'mixed' ? 'Mixed · ' : '') + label, col }); }
    });
    // hovering intangible layer: shared forces threaded down to where they land
    const forces = (cs.forces || []).map((f, i) => {
      const pl = L.byId[f.near] || org, cx = pl.block.cx, cy = pl.block.cy;
      let gx = PL[0] + 1.5 + (Math.max(PL[0], Math.min(PL[1], cx)) - PL[0] - 1.5) * 0.85, gy = PL[0] + 1.5 + (Math.max(PL[0], Math.min(PL[1], cy)) - PL[0] - 1.5) * 0.85;
      gx += ((i * 37) % 7 - 3) * 0.35; gy += ((i * 53) % 7 - 3) * 0.35;
      return { f, pl, gx, gy };
    });
    placed = []; reserve();
    if (planeA > 0.01) {
      ctx.save(); ctx.globalAlpha = planeA;
      for (const q of forces) { const a = I.P(km, q.pl.block.cx, q.pl.block.cy, (q.pl.top || 1) + 0.3), b = I.P(km, q.gx, q.gy, PH); ctx.setLineDash([1.5, 4]); ctx.strokeStyle = I.rgba(PAL.cat[q.f.cat], 0.75); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = PAL.cat[q.f.cat]; ctx.beginPath(); ctx.arc(a.x, a.y, 2.2, 0, 7); ctx.fill(); }
      const pc = [I.P(km, PL[0], PL[0], PH), I.P(km, PL[1], PL[0], PH), I.P(km, PL[1], PL[1], PH), I.P(km, PL[0], PL[1], PH)];
      ctx.save(); ctx.shadowColor = 'rgba(155,123,255,0.45)'; ctx.shadowBlur = 28; I.poly(ctx, pc); ctx.fillStyle = 'rgba(52,42,104,0.62)'; ctx.fill(); ctx.restore(); I.poly(ctx, pc); ctx.strokeStyle = 'rgba(196,181,253,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(196,181,253,0.14)';
      for (let u = PL[0] + 2.5; u < PL[1]; u += 2.5) { let p = I.P(km, u, PL[0], PH), q = I.P(km, u, PL[1], PH); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); p = I.P(km, PL[0], u, PH); q = I.P(km, PL[1], u, PH); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      for (let i = 0; i < forces.length; i++) for (let j = i + 1; j < forces.length; j++) { if ((i + j) % 3) continue; const p = I.P(km, forces[i].gx, forces[i].gy, PH), q = I.P(km, forces[j].gx, forces[j].gy, PH); ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(196,181,253,0.4)'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]); }
      for (const q of forces) { const p = I.P(km, q.gx, q.gy, PH), col = PAL.cat[q.f.cat]; ctx.globalCompositeOperation = 'screen'; I.aura(ctx, p.x, p.y, 30, col, 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke(); q.p = p; }
      ctx.restore();
      planeTag = { rc: pc.reduce((m2, p) => (p.x > m2.x ? p : m2), pc[0]), lc: pc.reduce((m2, p) => (p.x < m2.x ? p : m2), pc[0]), tc: pc.reduce((m2, p) => (p.y < m2.y ? p : m2), pc[0]) };
    }
    // labels — priority order, nothing overlaps unless it is the thing you are pointing at
    const items = [], Z = zoomU * boost, d1 = Z >= 1.3, d2 = km.lod > 0.3;
    const orgP = pin(org);
    const nFloors = cs.floors.filter((f) => effects[f.id]).length;
    items.push({ pri: 10, fn: () => { stem(orgP, 24, PAL.own); const ro = place(orgP.x, orgP.y - 36, org.label, { kind: 'place', dot: PAL.own, col: PAL.own, strong: true }, { kind: 'org', id: 'org' }, true); if (orgOn || orgHov) { place(ro.x1 + 4, orgP.y - 36, 'Zoom into the company →', { kind: 'place', col: PAL.own, textCol: '#D9CCFF', strong: true, align: 'left' }, { kind: 'zoom', id: 'org' }, true); place(orgP.x, orgP.y - 60, 'Your organisation', { kind: 'tag', col: PAL.own }, null); } if (nFloors) place(orgP.x, orgP.y - 12, 'This change touches ' + nFloors + ' teams', { kind: 'label', col: PAL.cat.direction }, { kind: 'org', id: 'org' });
      // local change: what a change does at the organisation itself (risks show as a hot spot instead)
      else if (effects.org && effects.org[1] !== 'harm' && !orgOn && !orgHov) place(orgP.x, orgP.y - 60, effects.org[0], { kind: 'label', col: PAL.cat[effects.org[1]] }, { kind: 'org', id: 'org' }, true); } });
    for (const p of cs.places.concat(L.depts || [])) {
      const pl = L.byId[p.id]; if (!pl) continue;
      const a = pin(pl), it = { kind: 'place', id: p.id }, on = same(hover, it) || same(sel, it) || spot === p.id, eff = effects[p.id], bad = eff && eff[1] === 'harm';
      if (!on && !eff && !d1 && L.theme !== 'isles') continue;
      items.push({ pri: on ? 9 : bad ? 8 : eff ? 6 : p.tier === 'ozy' ? 4 : 3, fn: () => {
        const r = place(a.x, a.y - 30, p.label, { kind: 'place', dot: bad ? PAL.risk : p.dept ? PAL.own : p.status ? PAL.cat[p.cat] : '#C3CFD4', col: bad ? PAL.risk : null, strong: on || bad }, it, on);
        if (r) stem(a, 18, bad ? PAL.risk : null);
        if (r && p.status && !eff && on) place(a.x, a.y - 56, p.status, { kind: 'place', col: PAL.cat[p.cat], textCol: PAL.cat[p.cat] }, it);
        const v = eff ? { word: eff[0], cat: eff[1] } : on && p.view;
        if (r && v) { if (bad) place(a.x, a.y - 56, '!  ' + v.word, { kind: 'plan', col: PAL.risk }, it, true); else place(a.x, a.y - (p.status && !eff ? 82 : 56), v.word, { kind: 'label', col: PAL.cat[v.cat] }, it, !!eff); }
      } });
    }
    for (const f of L.far || []) {
      const it = { kind: 'far', id: f.id }, on = same(hover, it) || same(sel, it) || spot === f.id, eff = effects[f.id], bad = eff && eff[1] === 'harm', a = fpin(f);
      items.push({ pri: on ? 9 : bad ? 7.5 : eff ? 5.5 : 2, fn: () => { const r = place(a.x, a.y - 30, f.label, { kind: 'place', dot: bad ? PAL.risk : PAL.cat[fcat[f.kind]], col: bad ? PAL.risk : null, strong: on }, it, on); if (r) { stem(a, 18, bad ? PAL.risk : null); if (on) place(a.x, a.y - 52, f.kind, { kind: 'tag', col: PAL.subtle }, null); if (eff) place(a.x, a.y - 74, (bad ? '!  ' : '') + eff[0], { kind: bad ? 'plan' : 'label', col: bad ? PAL.risk : PAL.cat[eff[1]] }, it, true); } } });
    }
    gpos.forEach((q) => { const it = { kind: 'global', id: q.gl.id }, on = same(hover, it) || same(sel, it), bad = q.eff && q.eff[1] === 'harm', y = q.p.y + 3.6 * km.S * 0.62 + 18; items.push({ pri: on ? 9 : bad ? 7 : q.eff ? 5 : 1.5, fn: () => { const r = place(q.p.x, y, q.gl.label, { kind: 'place', dot: bad ? PAL.risk : q.col, col: bad ? PAL.risk : null, strong: on }, it, on); if (r && q.eff) place(q.p.x, y + 26, (bad ? '!  ' : '') + q.eff[0], { kind: bad ? 'plan' : 'label', col: bad ? PAL.risk : PAL.cat[q.eff[1]] }, it, true); else if (r && on) place(q.p.x, y - 3.6 * km.S * 1.3 - 30, 'Global · ' + q.gl.kind, { kind: 'tag', col: q.col }, null); } }); });
    if (planeA > 0.4) forces.forEach((q) => { const it = { kind: 'force', id: q.f.label }; items.push({ pri: same(hover, it) ? 9.5 : 7, fn: () => { if (!q.p) return; addHit({ x0: q.p.x - 12, y0: q.p.y - 12, x1: q.p.x + 12, y1: q.p.y + 12 }, it); if (same(hover, it) || same(sel, it)) place(q.p.x, q.p.y - 20, q.f.label, { kind: 'label', col: PAL.cat[q.f.cat], dot: PAL.cat[q.f.cat] }, it, true); } }); });
    (cs.earth || []).forEach((e) => { const pl = L.byId[e.near] || org; const p = C.drawEarth(ctx, km, e, { cx: pl.block.cx + 1.6, cy: pl.block.cy - 1.6, top: pl.top }, reduced ? 0 : t); placed.push({ x0: p.x - km.S, y0: p.y, x1: p.x + km.S, y1: p.y + km.S * 1.6 }); const eOn = (hover && hover.id === e.near) || (sel && sel.id === e.near) || (e.near === 'org' && (orgOn || orgHov)); if (eOn) items.push({ pri: 2.5, fn: () => { place(p.x, p.y - 6, e.label, { kind: 'label', col: e.kind === 'flood' ? PAL.cat.decision : e.kind === 'heat' ? PAL.risk : PAL.cat.trust }, { kind: 'earth', id: e.label }); } }); });
    const BS = cs.bridge; if (L.bridge && BS) items.push({ pri: BS.state === 'broken' ? 8 : km.lod > 0.2 ? 5 : 2, fn: () => { const p = I.P(km, L.bridge.gx, L.bridge.gy, 0.9), col = BS.state === 'broken' ? PAL.risk : PAL.warn; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 7); ctx.fill(); if (BS.state === 'broken') { const pu = (t % 1.6) / 1.6; ctx.strokeStyle = I.rgba(col, 0.8 * (1 - pu)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + pu * 16, 0, 7); ctx.stroke(); } addHit({ x0: p.x - 12, y0: p.y - 12, x1: p.x + 12, y1: p.y + 12 }, { kind: 'bridge', id: 'bridge' }); if (same(hover, { kind: 'bridge', id: 'bridge' }) || same(sel, { kind: 'bridge', id: 'bridge' })) place(p.x + 12, p.y - 14, '!  ' + BS.label, BS.state === 'broken' ? { kind: 'plan', col, align: 'left' } : { kind: 'place', col, textCol: '#FDBA8C', align: 'left' }, { kind: 'bridge', id: 'bridge' }); } });
    hot.forEach((h) => { const pl = L.byId[h.near] || org; items.push({ pri: 8.5, fn: () => { const p = I.P(km, pl.block.cx - 1.8, pl.block.cy + 1.8, 0.1); ctx.fillStyle = PAL.risk; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 7); ctx.fill(); ctx.setLineDash([3, 3]); ctx.strokeStyle = PAL.risk; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, 7); ctx.stroke(); ctx.setLineDash([]); place(p.x, p.y + 24, '!  ' + h.label, { kind: 'plan', col: PAL.risk }, null, true); } }); });
    tieLabels.forEach((q) => items.push({ pri: 8.8, fn: () => { const o = { kind: 'label', col: q.col, textCol: q.col }; for (const dy of [0, 26, -26, 52, -52]) if (place(q.x, q.y + dy, q.text, o, null)) break; } }));
    items.sort((a, b) => b.pri - a.pri).forEach((x) => x.fn());
    if (planeTag && planeA > 0.3) {
      const txt = 'Intangible layer · culture, law, mind'; ctx.font = 'italic 500 11.5px Figtree, sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; const w = ctx.measureText(txt).width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      const cands = [[planeTag.rc.x + 16, planeTag.rc.y], [planeTag.tc.x - w / 2, planeTag.tc.y - 16], [planeTag.lc.x - 16 - w, planeTag.lc.y]];
      for (const [x, y] of cands) { const r = { x0: x - 4, y0: y - 9, x1: x + w + 4, y1: y + 9 }; if (r.x0 < 0 || r.x1 > W || placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) continue; placed.push(r); ctx.save(); ctx.globalAlpha = planeA; I.pill(ctx, x, y, txt, { kind: 'tag', col: '#C4B5FD', align: 'left' }); ctx.restore(); break; }
    }
  }
  function glyph(kind, x, y, S, col, t) {
    const s = Math.max(6, S * 0.9); ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    if (kind === 'climate') { ctx.beginPath(); ctx.arc(x - s * 0.35, y - s * 0.25, s * 0.38, 0, 7); ctx.fill(); ctx.fillStyle = '#D8E4E8'; [[-0.1, 0.15, 0.42], [0.35, 0.05, 0.5], [0.75, 0.2, 0.36]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); }); }
    else if (kind === 'biodiversity') { [[-0.6, 0.2, 1], [0, -0.1, 1.25], [0.6, 0.25, 0.9]].forEach(([dx, dy, z]) => { const bx = x + dx * s, by = y + dy * s + s * 0.5; ctx.beginPath(); ctx.moveTo(bx, by - s * 1.1 * z); ctx.lineTo(bx + s * 0.38 * z, by); ctx.lineTo(bx - s * 0.38 * z, by); ctx.closePath(); ctx.fill(); }); ctx.beginPath(); ctx.moveTo(x + s * 0.5, y - s * 0.9); ctx.quadraticCurveTo(x + s * 0.7, y - s * 1.1, x + s * 0.9, y - s * 0.9); ctx.moveTo(x + s * 0.9, y - s * 0.9); ctx.quadraticCurveTo(x + s * 1.1, y - s * 1.1, x + s * 1.3, y - s * 0.9); ctx.stroke(); }
    else if (kind === 'pollution') { ctx.fillRect(x - s * 0.5, y - s * 0.1, s * 0.3, s * 0.7); for (let i = 0; i < 3; i++) { const u = ((t * 0.25 + i / 3) % 1); ctx.globalAlpha = 0.85 * (1 - u); ctx.beginPath(); ctx.arc(x - s * 0.35 + u * s * 0.9, y - s * 0.3 - u * s * 0.9, s * (0.22 + u * 0.25), 0, 7); ctx.fill(); } }
    else if (kind === 'health') { ctx.beginPath(); ctx.moveTo(x, y + s * 0.55); ctx.bezierCurveTo(x - s * 0.95, y - s * 0.1, x - s * 0.45, y - s * 0.85, x, y - s * 0.3); ctx.bezierCurveTo(x + s * 0.45, y - s * 0.85, x + s * 0.95, y - s * 0.1, x, y + s * 0.55); ctx.fill(); }
    else if (kind === 'justice') { ctx.beginPath(); ctx.moveTo(x, y - s * 0.7); ctx.lineTo(x, y + s * 0.55); ctx.moveTo(x - s * 0.75, y - s * 0.45); ctx.lineTo(x + s * 0.75, y - s * 0.45); ctx.moveTo(x - s * 0.4, y + s * 0.55); ctx.lineTo(x + s * 0.4, y + s * 0.55); ctx.stroke(); [-0.75, 0.75].forEach((dx) => { ctx.beginPath(); ctx.arc(x + dx * s, y - s * 0.1, s * 0.3, 0, Math.PI); ctx.fill(); }); }
    ctx.restore();
  }
  function stem(a, len, col) { ctx.strokeStyle = col ? I.rgba(col, 0.8) : 'rgba(195,207,212,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y - len); ctx.stroke(); ctx.fillStyle = col || PAL.cream; ctx.beginPath(); ctx.arc(a.x, a.y, 2.5, 0, 7); ctx.fill(); }

  // ——— MESO · how the organisation works inside: layers = hierarchy, walls = culture, threads = relations ———
  const FURN = { factory: ['machine', 'conveyor', 'machine', 'pallet', 'locker', 'machine'], lab: ['bench', 'glass', 'bench', 'shelf', 'plant', 'desk'], office: ['desk', 'desk', 'shelf', 'desk', 'plant', 'desk'], sales: ['desk', 'desk', 'sofa', 'desk', 'plant', 'screen'], boardroom: ['table', 'shelf', 'plant', 'screen'], studio: ['desk', 'table', 'plant', 'desk', 'shelf'], garden: ['bed', 'shed', 'plant', 'bed', 'cones'], works: ['desk', 'cones', 'machine', 'locker', 'desk'], lounge: ['sofa', 'coffee', 'plant', 'table'], ward: ['hbed', 'hbed', 'curtain', 'hbed', 'monitor', 'hbed'], theatre: ['optable', 'monitor', 'bench', 'optable', 'hbed'], pharmacy: ['shelf', 'shelf', 'bench', 'shelf', 'desk', 'shelf'], clinic: ['desk', 'sofa', 'desk', 'plant', 'table'] };
  const SLAB = { top: '#3A3F4C', left: '#2B2F3A', right: '#22252E' };
  const LINK = { decision: ['#93C5FD', [], 2, 1], handoff: ['#F1E4C8', [7, 5], 1.8, 1], info: ['#C4B5FD', [1.5, 4.5], 1.8, 1], trust: ['#FDE68A', [], 1.6, 0], tension: [PAL.risk, [5, 5], 2, 0] };
  function roomKind(f) {
    const s = (f.id + ' ' + f.name).toLowerCase();
    if (L && L.theme === 'campus') { if (/ward|nurs/.test(s)) return 'ward'; if (/clinical|doctor|surg/.test(s)) return 'theatre'; if (/pharm/.test(s)) return 'pharmacy'; if (/discharge|social/.test(s)) return 'clinic'; }
    if (/prod|ops|factory|operat/.test(s)) return 'factory'; if (/test|lab|design|engin/.test(s)) return 'lab'; if (/park|mainten/.test(s)) return 'garden';
    if (/road|transport|water|drain/.test(s)) return 'works'; if (/sales|market/.test(s)) return 'sales'; if (/founder|mayor|partner|committee|\bic\b|lead/.test(s)) return 'boardroom';
    if (/health|social|climate|impact|sust/.test(s)) return 'studio'; return 'office';
  }
  function roomsFor(fl, W0, D0) {
    const arr = fl.map((f) => ({ f, w: Math.sqrt(Math.max(1, f.staff)) })).sort((a, b) => b.w - a.w), sum = arr.reduce((s, x) => s + x.w, 0);
    if (arr.length === 1) return [{ f: arr[0].f, x0: 0, y0: 0, x1: W0, y1: D0 }];
    if (arr.length === 2) { const x = W0 * Math.max(0.4, Math.min(0.6, arr[0].w / sum)); return [{ f: arr[0].f, x0: 0, y0: 0, x1: x, y1: D0 }, { f: arr[1].f, x0: x, y0: 0, x1: W0, y1: D0 }]; }
    const W1 = W0 * Math.min(0.46, Math.max(0.34, arr[0].w / sum)), rest = arr.slice(1), rows = Math.ceil(rest.length / 2), rooms = [{ f: arr[0].f, x0: 0, y0: 0, x1: W1, y1: D0 }];
    rest.forEach((x, i) => { const r = Math.floor(i / 2), c = i % 2, last = i === rest.length - 1 && rest.length % 2 === 1, cw = (W0 - W1) / 2; rooms.push({ f: x.f, x0: W1 + (last ? 0 : c * cw), x1: last ? W0 : W1 + (c + 1) * cw, y0: r * D0 / rows, y1: (r + 1) * D0 / rows }); });
    return rooms;
  }
  function orgModel() {
    if (cs.__org) return cs.__org;
    const o = cs.inner || {}, byId = Object.fromEntries(cs.floors.map((f) => [f.id, f]));
    // local change: on the islands theme every team is its own island (a network of teams, not one building)
    const isles = !!(L && L.theme === 'isles' && cs.floors.length > 1);
    const tl = isles ? cs.floors.map((f) => [f]) : (o.tiers || [cs.floors.map((f) => f.id)]).map((ids) => ids.map((id) => byId[id]).filter(Boolean)).filter((t) => t.length);
    const staff = tl.map((t) => t.reduce((s, f) => s + f.staff, 0)), mx = Math.max(...staff), multi = tl.length > 1;
    const tiers = tl.map((fl, i) => { const w = isles ? 9.5 : multi ? 16.5 : 19, d = isles ? 7 : multi ? 9 : 12.5, G = 0.55; void mx; return { i, floors: fl, staff: staff[i], w, d, name: (o.tierNames || [])[i] || '', rooms: roomsFor(fl, w, d).map((r) => Object.assign(r, { tier: i, x0: r.x0 + G, y0: r.y0 + G, x1: r.x1 - G, y1: r.y1 - G })) }; });
    const links = o.links || (cs.threads || []).map(([a, b, l, c]) => [a, b, c === 'harm' ? 'tension' : 'decision', l, 1]);
    const sur = o.surround || [], natL = sur.filter((x) => /water|field|park/.test(x.kind)).map((x) => x.label), comL = sur.filter((x) => !/water|field|park/.test(x.kind)).map((x) => x.label);
    const GT = tiers[tiers.length - 1] || { d: 12, w: 19, floors: [], rooms: [] }, EX = o.ext || [{ id: 'nature', name: 'Nature', icon: 'leaf', side: 'W', sub: natL.join(' · ') }, { id: 'community', name: 'Community', icon: 'home', side: 'W', sub: comL.join(' · ') }];
    const ext = ['W', 'E'].flatMap((sd) => { const L1 = EX.filter((e) => (e.side || 'W') === sd), h = GT.d / Math.max(1, L1.length); return L1.map((e, i) => ({ f: { id: e.id, name: e.name, staff: 0, cat: 'earth', ext: e.icon || 'org', sub: e.sub || (e.id === 'nature' ? natL.join(' · ') : e.id === 'community' ? comL.join(' · ') : ''), note: e.note }, x0: sd === 'W' ? -5.6 : GT.w + 0.9, x1: sd === 'W' ? -0.9 : GT.w + 5.6, y0: i * h + (i ? 0.3 : 0.55), y1: (i + 1) * h - (i === L1.length - 1 ? 0.55 : 0.3), tier: tiers.length - 1 })); });
    const __old = [{ f: { id: 'nature', name: 'Nature', staff: 0, cat: 'earth', ext: 'leaf', sub: natL.join(' · ') || 'Land, water and air the business touches' }, x0: -5.6, x1: -0.9, y0: 0.55, y1: tiers[tiers.length - 1].d * 0.5 - 0.3, tier: tiers.length - 1 },
      { f: { id: 'community', name: 'Community', staff: 0, cat: 'emotion', ext: 'home', sub: comL.join(' · ') || 'Neighbours and the people around the site' }, x0: -5.6, x1: -0.9, y0: tiers[tiers.length - 1].d * 0.5 + 0.3, y1: tiers[tiers.length - 1].d - 0.55, tier: tiers.length - 1 }];
    return (cs.__org = { tiers, links, walls: o.walls || 'open', ext: isles ? [] : ext, isles });
  }
  function furnish(k, f, kind, rm, h0, items, decals, seed, nPeople, t) {
    const r = I.rng(seed), list = FURN[kind] || FURN.office, w = rm.x1 - rm.x0, d = rm.y1 - rm.y0, m = 1.0, sx = 1.9, sy = 2.0;
    const nx = Math.max(1, Math.floor((w - 2 * m) / sx) + 1), ny = Math.max(1, Math.floor((d - 2 * m) / sy) + 1), slots = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) slots.push([nx === 1 ? rm.x0 + w / 2 : rm.x0 + m + (w - 2 * m) * i / (nx - 1), ny === 1 ? rm.y0 + d / 2 : rm.y0 + m + (d - 2 * m) * j / (ny - 1)]);
    const keep = slots.filter((s, i) => i === 0 || r() < 0.78), off = Math.floor(r() * list.length), vest = kind === 'factory' || kind === 'works' || kind === 'garden';
    keep.forEach(([gx, gy], j) => { const kd = list[(j + off) % list.length], rr = r(); decals.push(() => I.decal(ctx, k, kd, gx, gy, h0, rr)); items.push({ gx, gy, fn: () => I.furniture(ctx, k, kd, gx, gy, h0, rr) }); });
    for (let j = 0; j < nPeople; j++) {
      const lk = I.look(seed * 7 + j * 13), A = keep[j % keep.length], B = keep[(j + 2) % keep.length], walker = j % 3 === 1, ph = r() * 6.28;
      const ax = A[0] + 0.25, ay = A[1] + 0.95, bx = B[0] - 0.3, by = B[1] + 0.95, u = walker && !reduced ? (Math.sin(t * 0.3 + ph) + 1) / 2 : 0;
      const gx = Math.min(rm.x1 - 0.4, ax + (bx - ax) * u), gy = Math.min(rm.y1 - 0.35, ay + (by - ay) * u);
      items.push({ gx, gy, fn: () => { const p = I.P(k, gx, gy, h0); I.avatar(ctx, p.x, p.y, Math.max(1.6, k.S * 0.14), lk, { bob: reduced ? 0 : Math.abs(Math.sin(t * 2 + ph)) * k.S * 0.012, walk: walker && !reduced ? t * 4 + ph : 0, mood: f.cat === 'harm' || f.cat === 'emotion' ? 'bad' : 'neutral', vest }); } });
    }
  }
  const PADS = 3.2;
  // the meso backdrop: the city around the organisation, close up and out of focus
  function makeSnap(t) {
    const off = document.createElement('canvas'); off.width = Math.round(W * DPR); off.height = Math.round(H * DPR);
    const keep = { ctx, sel, hover, boost, zoomU, ripples, hits, placed, spot, fx: km.fx, fy: km.fy };
    try { ctx = off.getContext('2d'); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); sel = null; hover = null; spot = null; ripples = []; hits = []; const o = L.byId.org.block; km.fx = o.cx; km.fy = o.cy; boost = 4.2; zoomU = 1; snapping = true; drawMacro(t, t * 1000); }
    catch (e) { void e; }
    finally { snapping = false; ctx = keep.ctx; sel = keep.sel; hover = keep.hover; boost = keep.boost; zoomU = keep.zoomU; ripples = keep.ripples; hits = keep.hits; placed = keep.placed; spot = keep.spot; km.fx = keep.fx; km.fy = keep.fy; }
    const b = document.createElement('canvas'), bx = b.getContext('2d');
    if ('filter' in bx) { b.width = Math.max(2, Math.round(W / 2)); b.height = Math.max(2, Math.round(H / 2)); bx.filter = 'blur(3.5px)'; bx.drawImage(off, 0, 0, b.width, b.height); }
    else { const a = document.createElement('canvas'); a.width = Math.max(2, Math.round(W / 4)); a.height = Math.max(2, Math.round(H / 4)); a.getContext('2d').drawImage(off, 0, 0, a.width, a.height); b.width = Math.max(2, Math.round(W / 8)); b.height = Math.max(2, Math.round(H / 8)); bx.drawImage(a, 0, 0, b.width, b.height); }
    snap = b; snapKey = cs.id + ':' + W + 'x' + H;
  }
  // fit computed over every turn angle, so the building never jumps or rescales while it rotates
  function mesoFit(M) {
    if (M.__fit) return M.__fit;
    const n = M.tiers.length, multi = n > 1, yaws = [0, 0.39, 0.785, 1.18, 1.571, 1.96, 2.356, 2.75];
    if (M.isles) {
      // the first team in the middle, the others on a ring of islands around it
      const dims = M.tiers.map((T) => { let w = 0, h = 0; yaws.forEach((a) => { const b = mesoBounds(T, a, 0); w = Math.max(w, b.x1 - b.x0); h = Math.max(h, b.y1 - b.y0); }); return { w, h }; });
      const mw = Math.max(...dims.map((d) => d.w)) + 2, mh = Math.max(...dims.map((d) => d.h)) + 2;
      const C0 = M.tiers.map((T, i) => { if (i === 0) return [0, 0]; const a = -Math.PI / 2 + ((i - 1) / Math.max(1, n - 1)) * Math.PI * 2; return [Math.cos(a) * mw * 1.45, Math.sin(a) * mh * 1.6]; });
      let ex0 = 1e9, ex1 = -1e9, ey0 = 1e9, ey1 = -1e9; dims.forEach((d, i) => { ex0 = Math.min(ex0, C0[i][0] - d.w / 2 - 1); ex1 = Math.max(ex1, C0[i][0] + d.w / 2 + 1); ey0 = Math.min(ey0, C0[i][1] - d.h / 2 - 1); ey1 = Math.max(ey1, C0[i][1] + d.h / 2 + 1); });
      return (M.__fit = { C0, ex0, ex1, ey0, ey1, dims });
    }
    const dims = M.tiers.map((T, i) => { let w = 0, h = 0; yaws.forEach((a) => { const b = mesoBounds(T, a, i === n - 1 ? PADS : 0); w = Math.max(w, b.x1 - b.x0); h = Math.max(h, b.y1 - b.y0); }); return { w, h }; });
    let core = 0; yaws.forEach((a) => { const b = mesoBounds(M.tiers[0], a, 0); core = Math.max(core, b.y1 - b.y0); });
    const C0 = M.tiers.map((T, i) => [0, i * (core - 1.6)]);
    let ex0 = 1e9, ex1 = -1e9, ey0 = 1e9, ey1 = -1e9; dims.forEach((d, i) => { ex0 = Math.min(ex0, -d.w / 2 - (multi ? 4 : 0)); ex1 = Math.max(ex1, d.w / 2); ey0 = Math.min(ey0, C0[i][1] - d.h / 2); ey1 = Math.max(ey1, C0[i][1] + d.h / 2); });
    return (M.__fit = { C0, ex0, ex1, ey0, ey1, dims });
  }
  function mesoBounds(T, yawv, pad) {
    const k = I.cam(); k.yaw = yawv; k.ox = k.fx = T.w / 2; k.oy = k.fy = T.d / 2; k.S = 1; k.W = 0; k.H = 1; k.cy0 = 0; k.fh = 0; I.prep(k);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const xl = pad ? -5.9 : 0, xr = pad ? T.w + 5.9 : T.w;
    for (const [x, y] of [[xl, 0], [xr, 0], [xr, T.d], [xl, T.d]]) for (const h of [-0.9, 2.8]) { const p = I.P(k, x, y, h); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    return { x0, x1, y0, y1 };
  }
  function drawMeso(t) {
    ctx.fillStyle = PAL.meso; ctx.fillRect(0, 0, W, H);
    if (!snap || snapKey !== cs.id + ':' + W + 'x' + H) makeSnap(t);
    if (snap) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; const sc = 1.14, ox = Math.sin(yawI) * W * 0.035 + pX * 0.12, oy = pY * 0.12; ctx.drawImage(snap, -W * (sc - 1) / 2 + ox, -H * (sc - 1) / 2 + oy, W * sc, H * sc); ctx.restore();
      ctx.fillStyle = 'rgba(9,13,20,0.34)'; ctx.fillRect(0, 0, W, H); const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.45, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(6,9,14,0)'); vg.addColorStop(1, 'rgba(6,9,14,0.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
    placed = []; reserve();
    const M = orgModel(), n = M.tiers.length, multi = n > 1, B = M.tiers.map((T, i) => mesoBounds(T, yawI, i === n - 1 ? PADS : 0)), F = mesoFit(M), C0 = F.C0;
    const top = 60, SH = Math.max(160, H - 84 - insetB), ex0 = F.ex0, ex1 = F.ex1, ey0 = F.ey0, ey1 = F.ey1;
    const S = Math.max(4, Math.min((W - 60) * 0.94 / (ex1 - ex0), SH * 0.96 / (ey1 - ey0))) * zoomUI; ki.S = S;
    const ecx = (ex0 + ex1) / 2, ecy = (ey0 + ey1) / 2, allRooms = [], cams = [];
    M.tiers.forEach((T, i) => {
      const bb = B[i], sx = W / 2 + (C0[i][0] - ecx) * S + pX, sy = top + SH / 2 + (C0[i][1] - ecy) * S + pY, k = I.cam();
      k.yaw = yawI; k.ox = k.fx = T.w / 2; k.oy = k.fy = T.d / 2; k.S = S; k.H = H; k.fh = 0; k.W = 2 * (sx - (bb.x0 + bb.x1) / 2 * S); k.cy0 = (sy - (bb.y0 + bb.y1) / 2 * S) / H; I.prep(k);
      cams.push({ sx, lw: F.dims[i].w / 2 * S, k, yTop: sy - (bb.y1 - bb.y0) / 2 * S, yBot: sy + (bb.y1 - bb.y0) / 2 * S, x0: sx - (bb.x1 - bb.x0) / 2 * S, x1: sx + (bb.x1 - bb.x0) / 2 * S, cy: sy, T });
    });
    // one building, floors pulled apart: corner posts tie each floor to the one below
    ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(226,234,238,0.32)'; ctx.lineWidth = 1.2;
    if (!M.isles) for (let i = 0; i < cams.length - 1; i++) { const A = cams[i], Bc = cams[i + 1]; [[0, 0], [A.T.w, 0], [A.T.w, A.T.d], [0, A.T.d]].forEach(([x, y]) => { const p = I.P(Bc.k, x, y, 1.5), q = I.P(A.k, x, y, -0.4); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }); }
    ctx.restore();
    const sur = []; (M.isles ? cams.slice().sort((a, b) => a.cy - b.cy) : cams.slice().reverse()).forEach((c) => { if (M.isles) { const T = c.T; I.box(ctx, c.k, T.w / 2, T.d / 2, T.w + 2.6, T.d + 2.6, -1.4, -0.42, { top: PAL.ground, left: PAL.groundSide, right: PAL.groundSideR }); I.groundRect(ctx, c.k, -1.1, -1.1, T.w + 1.1, T.d + 1.1, -0.41, PAL.lot); } drawTier(c, t, M, allRooms, n, sur); });
    // relations across the organisation
    const focus = hover && (hover.kind === 'floor' || hover.kind === 'team' || hover.kind === 'ext') ? hover.id : sel && (sel.kind === 'floor' || sel.kind === 'ext') ? sel.id : null, byF = {}; allRooms.forEach((rm) => (byF[rm.f.id] = rm));
    drawClouds(allRooms.filter((rm) => !rm.f.ext), t, focus);
    const tl = [];
    M.links.forEach(([a, b, kind, label, key], j) => {
      const A = byF[a], Bm = byF[b]; if (!A || !Bm) return;
      const st = LINK[kind] || LINK.info, rel = focus && (a === focus || b === focus), dim = focus && !rel, p0 = A.c, p3 = Bm.c;
      if (!rel && !effects[a] && !effects[b] && kind !== 'tension' && !M.isles) return;
      let p1, p2;
      if (A.tier === Bm.tier) { const lift = 40 + (j % 3) * 14 + Math.hypot(p3.x - p0.x, p3.y - p0.y) * 0.18; p1 = { x: p0.x, y: p0.y - lift }; p2 = { x: p3.x, y: p3.y - lift }; }
      else { const off = (j % 2 ? 1 : -1) * (28 + (j % 3) * 22), my = (p0.y + p3.y) / 2; p1 = { x: p0.x + off, y: my }; p2 = { x: p3.x + off, y: my }; }
      const bz = (u) => { const v = 1 - u; return { x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x, y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y }; };
      const lift = A.tier === Bm.tier ? 34 + (j % 3) * 12 + Math.hypot(p3.x - p0.x, p3.y - p0.y) * 0.16 : 18 + (j % 3) * 10;
      I.ribbon(ctx, p0, p3, st[0], reduced ? 0 : t + j * 0.4, lift, rel ? 0.95 : dim ? 0.25 : M.isles && !effects[a] && !effects[b] ? 0.35 : 0.6);
      { const mx2 = (p0.x + p3.x) / 2, my2 = (p0.y + p3.y) / 2 - lift; p1 = { x: (p0.x + 2 * mx2) / 3, y: (p0.y + 2 * my2) / 3 }; p2 = { x: (p3.x + 2 * mx2) / 3, y: (p3.y + 2 * my2) / 3 }; }
      if (rel || (kind === 'tension' && !focus)) tl.push([bz(0.5), label, kind === 'tension' ? PAL.risk : st[0], rel ? 2 : kind === 'tension' ? 1 : 0, kind]);
    });
    if (multi && !M.isles) cams.forEach((c, i) => {
      const T = c.T, lx = Math.max(200, c.sx - (T.i === n - 1 ? c.lw * 0.62 : c.lw * 0.75) - 10), ly = c.cy - 8;
      ctx.textAlign = 'right'; ctx.font = 'italic 500 12px Figtree, sans-serif';
      ctx.fillStyle = '#C4B5FD'; ctx.fillText('Floor ' + (n - i) + (T.floors.some((x) => x.staffKnown === false) ? '' : ' · ' + T.staff + ' people'), lx, ly);
      if (T.floors.length > 1) { ctx.font = '700 16px "Bricolage Grotesque", sans-serif'; ctx.fillStyle = PAL.ink; ctx.fillText(T.name, lx, ly + 19); }
      placed.push({ x0: lx - 230, y0: ly - 12, x1: lx + 4, y1: ly + 26 });
    });
    allRooms.slice().sort((a, b) => (b.on ? 3 : b.f.ext ? 2 : effects[b.f.id] ? 1 : 0) - (a.on ? 3 : a.f.ext ? 2 : effects[a.f.id] ? 1 : 0) || b.f.staff - a.f.staff).forEach((rm) => roomLabel(rm));
    allRooms.forEach((rm) => { if (rm.f.ext) return; const tg = (rm.f.tags || [])[0]; if (tg && rm.on) place(rm.c.x, rm.c.y - rm.R * 0.2, short(tg.label.replace(/[“”"]/g, ''), 34), { kind: 'label', col: '#D9CCFF' }, null, true); });
    sur.forEach(({ s, p, fe, bad }) => { if (!fe) return; if (bad) { riskGlow(p.x, p.y + 6, 26, t); riskText(p.x, p.y - 8, s.label + ' · ' + fe[0]); } else place(p.x, p.y, s.label + ' · ' + fe[0], { kind: 'label', col: PAL.cat[fe[1]] }, null); });
    tl.sort((a, b) => b[3] - a[3]).forEach(([p, label, col, pr, kind]) => { for (const dy of [0, -24, 24, -48]) { if (kind === 'tension' && pr < 2 ? plainText(p.x, p.y + dy, label, PAL.risk, 'italic 500 12px Figtree, sans-serif') : place(p.x, p.y + dy, label, { kind: 'label', col }, null, pr === 2 && dy === 24)) break; } });
  }
  function riskGlow(x, y, r, t) {
    const u = reduced ? 0.5 : (Math.sin(t * 2.4) + 1) / 2, R = r * (1 + u * 0.25);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; I.aura(ctx, x, y, R * 1.6, PAL.risk, 0.35 + u * 0.2); I.aura(ctx, x, y, R * 0.6, '#FFB199', 0.55); ctx.restore();
    ctx.fillStyle = '#FFD2C2'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
  }
  function plainText(x, y, text, col, font) {
    if (snapping) return null;
    ctx.font = font; const w = ctx.measureText(text).width, r = { x0: x - w / 2 - 4, y0: y - 10, x1: x + w / 2 + 4, y1: y + 8 };
    if (placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) return null; placed.push(r);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 5; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(text, x, y + 4); ctx.restore(); return r;
  }
  function riskText(x, y, text) { return plainText(x, y, '! ' + text, '#FF8A70', '600 12px Figtree, sans-serif'); }
  function nameTag(x, y, name, sub, col, on, it, force, icon) {
    if (snapping) return null;
    ctx.font = '600 13px Figtree, sans-serif'; const tw = ctx.measureText(name).width; ctx.font = '500 9.5px "DM Mono", monospace'; const sw = ctx.measureText(sub).width + sub.length * 1.1;
    const w = 24 + Math.max(tw, sw), x0 = x - w / 2, r = { x0: x0 - 4, y0: y - 12, x1: x0 + w + 4, y1: y + 20 };
    if (!force && placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) return null; placed.push(r);
    const ix = x0 + 8, iy = y + 3; ctx.fillStyle = on ? PAL.own : col; ctx.beginPath(); ctx.arc(ix, iy, 8.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#0E1A21'; if (icon === 'leaf') { ctx.beginPath(); ctx.moveTo(ix - 4, iy + 4); ctx.quadraticCurveTo(ix - 4, iy - 4, ix + 4, iy - 4); ctx.quadraticCurveTo(ix + 4, iy + 4, ix - 4, iy + 4); ctx.fill(); } else if (icon === 'home') { ctx.beginPath(); ctx.moveTo(ix - 4.5, iy); ctx.lineTo(ix, iy - 4.5); ctx.lineTo(ix + 4.5, iy); ctx.lineTo(ix + 3.2, iy); ctx.lineTo(ix + 3.2, iy + 4.2); ctx.lineTo(ix - 3.2, iy + 4.2); ctx.lineTo(ix - 3.2, iy); ctx.closePath(); ctx.fill(); } else if (icon) { ctx.fillRect(ix - 4, iy - 4, 8, 8.5); ctx.fillStyle = on ? PAL.own : col; ctx.fillRect(ix - 2.3, iy - 2.2, 1.6, 1.6); ctx.fillRect(ix + 0.7, iy - 2.2, 1.6, 1.6); ctx.fillRect(ix - 2.3, iy + 0.8, 1.6, 1.6); ctx.fillRect(ix + 0.7, iy + 0.8, 1.6, 1.6); } else { ctx.beginPath(); ctx.arc(ix, iy - 2.6, 2.3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(ix, iy + 4, 4, 2.9, 0, Math.PI, 0); ctx.fill(); }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 5; ctx.textAlign = 'left';
    ctx.font = '600 13px Figtree, sans-serif'; ctx.fillStyle = on ? '#FFFFFF' : PAL.ink; ctx.fillText(name, x0 + 24, y + 3);
    ctx.font = '500 9.5px "DM Mono", monospace'; if ('letterSpacing' in ctx) ctx.letterSpacing = '1.1px'; ctx.fillStyle = PAL.subtle; ctx.fillText(sub, x0 + 24, y + 16); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore(); if (it) addHit(r, it); return r;
  }
  const TANG = { top: '#2F4753', left: '#1E3039', right: '#172832' }, WALLN = { top: '#4E6976', left: '#2C4350', right: '#223843' };
  function drawSurround(k, T, t, out) {
    I.box(ctx, k, T.w / 2, T.d / 2, T.w + PADS * 2, T.d + PADS * 2, -0.9, -0.46, { top: PAL.ground, left: PAL.groundSide, right: PAL.groundSideR });
    const list = (cs.inner && cs.inner.surround) || [], sides = { N: [0, -PADS + 0.5, T.w, -0.7], S: [0, T.d + 0.7, T.w, T.d + PADS - 0.5], W: [-PADS + 0.5, 0, -0.7, T.d], E: [T.w + 0.7, 0, T.w + PADS - 0.5, T.d] };
    const used = {};
    list.forEach((s, j) => {
      const R = sides[s.side] || sides.S, cnt = list.filter((q) => q.side === s.side).length, idx = (used[s.side] = (used[s.side] || 0) + 1) - 1, horiz = s.side === 'N' || s.side === 'S';
      const x0 = horiz ? R[0] + (R[2] - R[0]) * idx / cnt + 0.3 : R[0], x1 = horiz ? R[0] + (R[2] - R[0]) * (idx + 1) / cnt - 0.3 : R[2], y0 = horiz ? R[1] : R[1] + (R[3] - R[1]) * idx / cnt + 0.3, y1 = horiz ? R[3] : R[1] + (R[3] - R[1]) * (idx + 1) / cnt - 0.3, h = -0.45;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, fe = effects[s.id], bad = fe && fe[1] === 'harm', rn = I.rng(I.hash(s.id));
      if (s.kind === 'water') { I.groundRect(ctx, k, x0, y0, x1, y1, h + 0.01, PAL.water); const a = I.P(k, horiz ? x0 + 0.3 : cx, horiz ? cy : y0 + 0.3, h + 0.02), b = I.P(k, horiz ? x1 - 0.3 : cx, horiz ? cy : y1 - 0.3, h + 0.02); ctx.save(); ctx.setLineDash([6, 8]); ctx.lineDashOffset = reduced ? 0 : -t * 8; ctx.strokeStyle = PAL.waterHi; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); }
      else if (s.kind === 'road') { I.groundRect(ctx, k, x0, y0, x1, y1, h + 0.01, PAL.road); const a = I.P(k, horiz ? x0 : cx, horiz ? cy : y0, h + 0.02), b = I.P(k, horiz ? x1 : cx, horiz ? cy : y1, h + 0.02); ctx.save(); ctx.setLineDash([5, 6]); ctx.strokeStyle = PAL.roadLine; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); }
      else if (s.kind === 'homes') { I.groundRect(ctx, k, x0, y0, x1, y1, h + 0.01, PAL.lot); const nH = 3; for (let i = 0; i < nH; i++) { const u = (i + 0.5) / nH, gx = horiz ? x0 + (x1 - x0) * u : cx, gy = horiz ? cy : y0 + (y1 - y0) * u; I.box(ctx, k, gx, gy, 0.9, 0.9, h, h + 0.5 + rn() * 0.5, TANG); } }
      else if (s.kind === 'yard') { I.groundRect(ctx, k, x0, y0, x1, y1, h + 0.01, PAL.lot); I.box(ctx, k, cx - 0.5, cy, horiz ? 1.4 : 0.6, horiz ? 0.6 : 1.4, h, h + 0.55, TANG); I.box(ctx, k, cx + 0.7, cy + 0.1, 0.6, 0.6, h, h + 0.4, TANG); }
      else { I.groundRect(ctx, k, x0, y0, x1, y1, h + 0.01, PAL.field[s.kind === 'park' ? 3 : 0]); for (let i = 0; i < 4; i++) { const gx = x0 + 0.4 + rn() * (x1 - x0 - 0.8), gy = y0 + 0.4 + rn() * (y1 - y0 - 0.8); I.cyl(ctx, k, gx, gy, 0.28, h, h + 0.3, { top: '#3C5E58', left: '#2B4743', right: '#223936' }); } }
      if (bad) { I.poly(ctx, [I.P(k, x0, y0, h + 0.02), I.P(k, x1, y0, h + 0.02), I.P(k, x1, y1, h + 0.02), I.P(k, x0, y1, h + 0.02)]); ctx.strokeStyle = PAL.risk; ctx.lineWidth = 2; ctx.stroke(); }
      out.push({ s, p: I.P(k, cx, cy, h + 0.6), fe, bad });
    });
  }
  const BLDZ = { std: { slab: { top: '#B9B2A6', left: '#7E776D', right: '#666058' }, wall: { top: '#F1ECE3', left: '#E6DED2', right: '#CFC5B6' } }, hosp: { slab: { top: '#C9D2D5', left: '#8D9BA1', right: '#748389' }, wall: { top: '#FAFCFC', left: '#EEF3F4', right: '#D3DDE0' } } };
  function drawTier(c, t, M, allRooms, n, sur) {
    const k = c.k, T = c.T, ground = T.i === n - 1, Z = L && L.theme === 'campus' ? BLDZ.hosp : BLDZ.std; void sur;
    // floor plate + facade: back walls glazed, front walls cut low so you can look in
    I.box(ctx, k, T.w / 2, T.d / 2, T.w, T.d, -0.4, 0, Z.slab);
    const per = [[0, 0, T.w, 0, 0, -1], [T.w, 0, T.w, T.d, 1, 0], [T.w, T.d, 0, T.d, 0, 1], [0, T.d, 0, 0, -1, 0]], frontsB = [];
    per.forEach(([ax, ay, bx, by, nx, ny]) => { if (I.side(k, nx, ny).vis) frontsB.push(() => I.box(ctx, k, (ax + bx) / 2, (ay + by) / 2, nx ? 0.16 : T.w, nx ? T.d : 0.16, 0, 0.24, Z.wall)); else I.wall(ctx, k, ax, ay, bx, by, 0, 1.5, { windows: true, nx, ny, col: Z.wall, t: 0.16 }); });
    const wallH = M.walls === 'silo' ? 0.95 : M.walls === 'rooms' ? 0.65 : 0.35, WT = 0.1;
    const rs = T.rooms.concat(ground ? M.ext : []).slice().sort((a, b) => I.depth(k, (a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2) - I.depth(k, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2));
    rs.forEach((rm) => {
      const f = rm.f, isExt = !!f.ext, it = { kind: isExt ? 'ext' : 'floor', id: f.id }, on = same(hover, it) || same(sel, it), fe = effects[f.id], bad = fe && fe[1] === 'harm', hz = hot.find((q) => q.near === f.id);
      const w = rm.x1 - rm.x0, d = rm.y1 - rm.y0, cx = (rm.x0 + rm.x1) / 2, cy = (rm.y0 + rm.y1) / 2, kind = isExt ? null : roomKind(f);
      const pts = [I.P(k, rm.x0, rm.y0, 0.01), I.P(k, rm.x1, rm.y0, 0.01), I.P(k, rm.x1, rm.y1, 0.01), I.P(k, rm.x0, rm.y1, 0.01)];
      if (isExt) { I.box(ctx, k, cx, cy, w, d, -0.35, 0, { top: on ? '#5A6360' : '#454E4B', left: '#333A38', right: '#2A302E' }); I.poly(ctx, pts); ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(214,222,218,0.35)'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
      else I.floorTile(ctx, k, rm.x0, rm.y0, rm.x1, rm.y1, 0.01, kind, bad ? PAL.risk : on ? '#FFFFFF' : null);
      addHit({ poly: pts }, it);
      const fronts = [];
      if (!isExt) for (const [ax, ay, bx, by, nx, ny] of [[rm.x0, rm.y0, rm.x1, rm.y0, 0, -1], [rm.x1, rm.y0, rm.x1, rm.y1, 1, 0], [rm.x1, rm.y1, rm.x0, rm.y1, 0, 1], [rm.x0, rm.y1, rm.x0, rm.y0, -1, 0]]) {
        const gx = (ax + bx) / 2 - nx * WT / 2, gy = (ay + by) / 2 - ny * WT / 2, len = Math.hypot(bx - ax, by - ay), bw = nx ? WT : len, bd = nx ? len : WT;
        if (I.side(k, nx, ny).vis) fronts.push(() => I.box(ctx, k, gx, gy, bw, bd, 0, 0.08, Z.wall)); else I.box(ctx, k, gx, gy, bw, bd, 0, wallH, Z.wall);
      }
      const c0 = I.P(k, cx, cy, 0.02);
      if (bad || hz) riskGlow(c0.x, c0.y, Math.max(18, Math.min(w, d) * k.S * 0.32), t);
      const r = I.rng(I.hash(f.id)), nP = f.id === 'nature' ? 0 : isExt ? (f.id === 'community' ? 5 : 3) : Math.max(1, Math.min(7, Math.round(Math.sqrt(f.staff) * 1.1))), items = [], decals = [];
      if (!isExt) furnish(k, f, kind, rm, 0.01, items, decals, I.hash(f.id) % 997 + 3, 0, t);
      decals.forEach((fn) => fn());
      if (f.id === 'nature') for (let j = 0; j < 9; j++) { const gx = rm.x0 + 0.5 + r() * (w - 1), gy = rm.y0 + 0.5 + r() * (d - 1), rr2 = 0.25 + r() * 0.2, hh = 0.5 + r() * 0.7; items.push({ gx, gy, fn: () => I.cyl(ctx, k, gx, gy, rr2, 0, hh, { top: '#6F8F86', left: '#55706A', right: '#465D58' }) }); }
      if (isExt && f.id !== 'nature') (f.id === 'community' ? [[0.28, 0.3], [0.7, 0.62]] : [[0.7, 0.35]]).forEach(([u, v]) => { const gx = rm.x0 + w * u, gy = rm.y0 + d * v; items.push({ gx, gy, fn: () => I.box(ctx, k, gx, gy, 0.9, 0.9, 0, 0.7, { top: '#5E6764', left: '#444C49', right: '#373E3C' }) }); });
      for (let j = 0; j < nP; j++) { const ax = rm.x0 + 0.6 + r() * Math.max(0.1, w - 1.2), ay = rm.y0 + 0.6 + r() * Math.max(0.1, d - 1.2), walker = j % 4 === 1, ph = r() * 6.28, u = walker && !reduced ? Math.sin(t * 0.3 + ph) * 0.7 : 0, gx = Math.max(rm.x0 + 0.4, Math.min(rm.x1 - 0.4, ax + u)), gy = ay, wk = walker && !reduced ? t * 4.2 + ph : 0;
        items.push({ gx, gy, fn: () => { const p = I.P(k, gx, gy, 0); I.figure(ctx, p.x, p.y, Math.max(1.5, k.S * 0.13), isExt ? '#C9CFC9' : bad ? '#FFB3A1' : '#AFC0C8', { alpha: 0.92, walk: wk, idle: reduced ? 0 : t * 0.8 + ph }); } }); }
      items.sort((a, b) => I.depth(k, a.gx, a.gy) - I.depth(k, b.gx, b.gy)).forEach((q) => q.fn());
      fronts.forEach((fn) => fn());
      if (on || bad) { I.poly(ctx, pts); ctx.strokeStyle = bad ? PAL.risk : I.rgba(PAL.cream, 0.9); ctx.lineWidth = 2; ctx.stroke(); }
      rm.f0 = I.P(k, cx, cy, 0.3); rm.lab = { x: c0.x, y: c0.y - 6 };
      if (isExt) { const side = rm.x0 < 0 ? -1 : 1, ex = I.P(k, side < 0 ? rm.x0 : rm.x1, cy, 0); rm.lab = { x: ex.x, y: ex.y, side: (ex.x < c0.x ? -1 : 1) }; }
      rm.c = I.P(k, cx, cy, 3.1); rm.R = Math.max(14, Math.min(46, Math.min(w, d) * k.S * 0.3)); rm.on = on; rm.it = it; rm.bad = bad; rm.hz = hz; rm.pts = pts; allRooms.push(rm);
    });
    frontsB.forEach((fn) => fn());
  }
  // the intangible layer: translucent purple clouds hovering over each room, threaded down to where they land
  function drawClouds(allRooms, t, focus) {
    allRooms.forEach((rm, i) => {
      const dim = focus && focus !== rm.f.id, a = dim ? 0.35 : 1, c = rm.c, R = rm.R;
      ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([1.5, 4]); ctx.strokeStyle = 'rgba(196,181,253,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(rm.f0.x, rm.f0.y - 10); ctx.lineTo(c.x, c.y + R * 0.4); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'screen';
      for (let q = 0; q < 3; q++) { const ang = q * 1.7 + i, dr = R * 0.45, ox = Math.cos(ang + (reduced ? 0 : t * 0.15)) * dr, oy = Math.sin(ang + (reduced ? 0 : t * 0.15)) * dr * 0.45; I.aura(ctx, c.x + ox, c.y + oy, R * (0.85 + (q % 2) * 0.25), rm.bad ? PAL.risk : PAL.own, 0.2); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    });
  }
  function roomLabel(rm) {
    const f = rm.f, fe = effects[f.id], bad = fe && fe[1] === 'harm', on = rm.on, L = rm.lab;
    const col = bad ? PAL.risk : f.ext ? '#C9CFC9' : PAL.cat[f.cat] || PAL.muted, sub = f.ext ? 'OUTSIDE THE COMPANY' : f.staffKnown === false ? 'HEADCOUNT NOT STATED' : f.staff + (f.staff === 1 ? ' PERSON' : ' PEOPLE');
    if (f.ext) { const nm = short(f.name, 24); ctx.font = '600 12px Figtree, sans-serif'; const tw = ctx.measureText(nm).width + 22;
      for (const dy of [0, -16, 16, -32, 32]) { const x0 = L.side < 0 ? L.x - 10 - tw : L.x + 10, y = L.y + dy, rb = { x0: x0 - 3, y0: y - 10, x1: x0 + tw + 3, y1: y + 10 };
        if (!on && placed.some((q) => rb.x0 < q.x1 && rb.x1 > q.x0 && rb.y0 < q.y1 && rb.y1 > q.y0)) continue; placed.push(rb);
        const ix = x0 + 7; ctx.fillStyle = on ? PAL.own : '#C9CFC9'; ctx.beginPath(); ctx.arc(ix, y, 6.5, 0, 7); ctx.fill();
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 5; ctx.textAlign = 'left'; ctx.fillStyle = on ? '#FFFFFF' : '#DCE2DE'; ctx.fillText(nm, x0 + 18, y + 4); ctx.restore();
        addHit(rb, rm.it); return rb; }
      return null; }
    let r = null; for (const [dy, nm] of [[0, 30], [-20, 30], [20, 30], [0, 16], [-20, 16]]) { r = nameTag(L.x, L.y + dy, short(f.name, nm), sub, col, on, rm.it, false, f.ext); if (r) break; }
    if (!r) r = nameTag(L.x, L.y, short(f.name, 30), sub, col, on, rm.it, on || bad, f.ext);
    if (!r) return null;
    if (bad) riskText(L.x, L.y + 34, fe[0]); else if (fe) place(L.x, L.y + 36, fe[0], { kind: 'label', col: PAL.cat[fe[1]] }, rm.it, on);
    if (rm.hz) riskText(L.x, L.y + (fe ? 56 : 34), rm.hz.label);
    return r;
  }

  // ——— MICRO · invisible processes, lived by persona agents ———
  const BADW = /tired|anxious|worn|pressure|stretch|uneasy|over|unheard|press|urgent|concern|wary|scept|fatigue|strain|tension/i, GOODW = /hope|proud|steady|optim|excit|calm/i;
  function teamFor(fid) {
    if (cs.team && cs.team.floor === fid) return cs.team;
    const f = cs.floors.find((x) => x.id === fid) || cs.floors[0];
    const tg = f.tags || [], harmTag = tg.find((x) => x.cat === 'harm' || x.cat === 'emotion');
    const people = ((f.roles && f.roles.length) ? f.roles : [f.name]).map((n, i) => ({ id: 'r' + i, name: n, cat: 'culture', lead: i === 0 })); void harmTag;
    const ties = (f.ties || []).filter(([a, b]) => people[a] && people[b] && a !== b).map(([a, b, k2, label]) => ['r' + a, 'r' + b, k2, label]);
    return { title: f.name, medium: 'Medium · ' + f.sub, people, ties, clouds: tg.slice(0, 2).map((x, i) => ({ label: short(x.label.replace(/[“”"]/g, ''), 40), cat: x.cat, near: people[(i + 1) % people.length].id })), perceptions: [] };
  }
  function webFor(fid) {
    const key = '__web_' + fid; if (cs[key]) return cs[key];
    const out = [], fl = cs.floors.filter((f) => f.id !== fid).sort((a, b) => b.staff - a.staff).slice(0, 3);
    fl.forEach((f) => out.push({ id: 'w-' + f.id, name: short(f.name, 26), type: 'Team', col: PAL.cat[f.cat] || PAL.cat.culture, tie: 'decision', note: f.sub || '' }));
    (cs.places || []).filter((p) => !p.drill && p.persona !== false).slice(0, 2).forEach((p) => out.push({ id: 'w-' + p.id, name: short(p.label, 26), type: 'External stakeholder', col: PAL.cat.flow, tie: 'trust', note: p.note }));
    const inst = ((L && L.far) || []).find((f) => f.kind === 'institution');
    void inst; // institutions are not drawn as people
    return (cs[key] = out);
  }
  function bubble(x, y, text, col) {
    ctx.font = '500 12px Figtree, sans-serif'; const w = ctx.measureText(text).width + 30, h = 26, x0 = x - w / 2, y0 = y - h - 6;
    for (const q of placed) if (x0 < q.x1 && x0 + w > q.x0 && y0 < q.y1 && y > q.y0) return null;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; ctx.fillStyle = '#FBF8F2';
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, w, h, 9); else ctx.rect(x0, y0, w, h); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6, y0 + h - 1); ctx.lineTo(x, y0 + h + 6); ctx.lineTo(x + 6, y0 + h - 1); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x0 + 12, y0 + h / 2, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#221E2E'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x0 + 21, y0 + h / 2 + 0.5); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    const r = { x0: x0 - 3, y0: y0 - 3, x1: x0 + w + 3, y1: y + 2 }; placed.push(r); return r;
  }
  function drawMicro(t) {
    ctx.fillStyle = PAL.surface; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(159,179,188,0.06)'; for (let x = 14; x < W; x += 28) for (let y = 14; y < H; y += 28) ctx.fillRect(x, y, 1.2, 1.2);
    placed = []; reserve();
    const tm = teamFor(floorId), others = tm.people.filter((p) => !p.lead), lead = tm.people.find((p) => p.lead) || tm.people[0];
    const short_ = H < 420, s = (short_ ? 5.5 : Math.max(6, Math.min(13, Math.min(W, H - 140 - insetB) / 52))) * zoomM, headH = s * 8.5 + 30, footH = s * 1.3 + (short_ ? 22 : 36);
    const top = 76 + headH, bot = H - 64 - footH - insetB, SHm = Math.max(40, bot - top), CYm = top + SHm / 2;
    const pos = {}, rx = Math.max(40, Math.min((W - 420) / 2, W * 0.34, 380)) * zoomM, ry = Math.max(20, SHm / 2) * zoomM, tf = Math.max(0.45, Math.min(1.35, 1 + tiltM));
    pos[lead.id] = { x: W / 2, y: CYm, z: 0.6 };
    others.forEach((p, i) => { const a = -Math.PI / 2 + (i / others.length) * 6.2832 + 0.35 + yawM, sn = Math.sin(a); pos[p.id] = { x: W / 2 + Math.cos(a) * rx, y: CYm + sn * ry * tf, z: (sn + 1) / 2 }; });
    const fe = effects[floorId], under = fe && fe[1] === 'harm';
    // sim space: violet-black depth, a slow starfield and tilted orbital rings
    { const g = ctx.createRadialGradient(W / 2, CYm, 0, W / 2, CYm, Math.max(W, H) * 0.75); void g; ctx.fillStyle = PAL.surface; ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < 0; j++) { const rn = Math.random, SC = []; const z = 0.2 + rn() * 0.8, x = ((rn() * W * 1.4 + yawM * 60 * z) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2, y = rn() * H + tiltM * 40 * z, c = SC[Math.floor(rn() * SC.length)]; ctx.globalAlpha = 0.25 + z * 0.5; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 0.5 + z * 1.1, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      [0.45, 1, 1.5].forEach((f, j) => { ctx.setLineDash([2, 7]); ctx.lineDashOffset = reduced ? 0 : -t * (4 - j); ctx.strokeStyle = 'rgba(196,181,253,' + (0.28 - j * 0.07) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(W / 2, CYm, rx * f + (j === 2 ? 40 : 0), ry * tf * f + (j === 2 ? 24 : 0), 0, 0, 7); ctx.stroke(); }); ctx.setLineDash([]);
      if (under) { ctx.globalCompositeOperation = 'screen'; I.aura(ctx, W / 2, CYm, Math.max(rx, ry) * 1.1, PAL.risk, 0.12); ctx.globalCompositeOperation = 'source-over'; } }
    // the wider web: department heads, external stakeholders and policy makers on an outer orbit
    const web = webFor(floorId), wpos = {}, ox = Math.max(0, Math.min(rx * 1.55, W / 2 - 90)), oy = Math.min(ry * tf * 1.5, SHm / 2 + 70);
    web.forEach((p, i) => { const a = -Math.PI / 2 + ((i + 0.5) / web.length) * 6.2832 + yawM * 0.6, sn = Math.sin(a); wpos[p.id] = { x: W / 2 + Math.cos(a) * ox, y: Math.max(top - 20, Math.min(H - 100 - insetB, CYm + sn * oy)), z: (sn + 1) / 2 }; });
    ctx.setLineDash([2, 7]); ctx.strokeStyle = 'rgba(196,181,253,0.16)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(W / 2, CYm, ox, oy, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    web.forEach((p, i) => { const A = wpos[p.id], tgt = i % 2 && others.length ? others[i % others.length] : lead, B = pos[tgt.id], wh = same(hover, { kind: 'wp', id: p.id }) || same(sel, { kind: 'wp', id: p.id });
      ctx.save(); ctx.globalAlpha = wh ? 0.95 : 0.4; ctx.setLineDash(p.tie === 'trust' ? [] : [1.5, 4]); ctx.strokeStyle = p.tie === 'trust' ? PAL.cat.trust : PAL.cat.decision; ctx.lineWidth = wh ? 2 : 1.2; ctx.beginPath(); ctx.moveTo(A.x, A.y - s * 3); ctx.quadraticCurveTo((A.x + B.x) / 2, (A.y + B.y) / 2 - 30, B.x, B.y - s * 3); ctx.stroke(); ctx.restore(); });
    web.slice().sort((a, b) => wpos[a.id].y - wpos[b.id].y).forEach((p, i) => { const q = wpos[p.id], it = { kind: 'wp', id: p.id }, on = same(hover, it) || same(sel, it), sc = s * (0.72 + 0.2 * q.z), ph = I.hash(p.id) % 100 / 16;
      const h = I.figure(ctx, q.x, q.y, sc, p.col, { seed: I.hash(p.id), alpha: on ? 0.95 : 0.72, glow: on, idle: reduced ? 0 : t * 0.9 + ph, talk: !reduced && Math.sin(t * 0.5 + ph) > 0.7 });
      for (const dy of [14, 28, -sc * 7.4, 42]) if (plainText(q.x, q.y + dy, p.name, on ? '#FFFFFF' : PAL.muted, '500 11.5px Figtree, sans-serif')) break;
      placed.push({ x0: q.x - sc * 1.4, y0: h.top, x1: q.x + sc * 1.4, y1: q.y });
      addHit({ x0: q.x - sc * 2, y0: h.top - 6, x1: q.x + sc * 2, y1: q.y + 24 }, it); void i; });
    const TIE = { strong: ['rgba(246,243,236,0.7)', [], 2.2], weak: ['rgba(195,207,212,0.45)', [3, 5], 1.2], trust: [PAL.cat.trust, [], 1.8], tension: [PAL.risk, [5, 5], 1.8], decision: [PAL.cat.decision, [1.5, 4], 1.8] };
    tm.ties.forEach(([a, b, k, label], j) => { const A = pos[a], B = pos[b]; if (!A || !B) return; const st = TIE[k] || TIE.weak; const mx = (A.x + B.x) / 2 + (B.y - A.y) * 0.12, my = (A.y + B.y) / 2 - (B.x - A.x) * 0.12; ctx.setLineDash(st[1]); ctx.lineDashOffset = reduced ? 0 : -t * 8; ctx.strokeStyle = st[0]; ctx.lineWidth = st[2]; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(mx, my, B.x, B.y); ctx.stroke(); ctx.setLineDash([]); if (k === 'tension') { const qx = 0.25 * A.x + 0.5 * mx + 0.25 * B.x, qy = 0.25 * A.y + 0.5 * my + 0.25 * B.y; ctx.fillStyle = PAL.risk; ctx.font = '700 13px Figtree, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚡', qx, qy + 4); if (label) tm.__tl = (tm.__tl || []).concat([[qx, qy, label]]); } void j; });
    // perceptions: how one persona sees another
    (tm.perceptions || []).forEach(([a, b, text], j) => {
      const A = pos[a], B = pos[b]; if (!A || !B) return;
      const ay = A.y - s * 6.4, by = B.y - s * 6.4, mx = (A.x + B.x) / 2 + (j % 2 ? 1 : -1) * 30, my = Math.min(ay, by) - 50 - j * 8;
      ctx.setLineDash([1.5, 4]); ctx.strokeStyle = I.rgba(PAL.cat.emotion, 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(A.x, ay); ctx.quadraticCurveTo(mx, my, B.x, by); ctx.stroke(); ctx.setLineDash([]);
      const ang = Math.atan2(by - my, B.x - mx); ctx.fillStyle = PAL.cat.emotion; ctx.beginPath(); ctx.moveTo(B.x, by); ctx.lineTo(B.x - Math.cos(ang - 0.4) * 9, by - Math.sin(ang - 0.4) * 9); ctx.lineTo(B.x - Math.cos(ang + 0.4) * 9, by - Math.sin(ang + 0.4) * 9); ctx.closePath(); ctx.fill();
      tm.__pl = (tm.__pl || []).concat([[0.25 * A.x + 0.5 * mx + 0.25 * B.x, 0.25 * ay + 0.5 * my + 0.25 * by, text]]);
    });
    const order = tm.people.slice().sort((a, b) => pos[a.id].y - pos[b.id].y), heads = {};
    order.forEach((p, i) => {
      const q = pos[p.id], col = PAL.cat[p.cat] || PAL.cat.culture, it = { kind: 'person', id: p.id }, on = same(hover, it) || same(sel, it), sc = (p.lead ? s * 1.18 : s) * (0.8 + 0.32 * (q.z == null ? 0.6 : q.z));
      const bad = BADW.test(p.mood || '') || p.cat === 'harm', good = GOODW.test(p.mood || '');
      ctx.beginPath(); ctx.ellipse(q.x, q.y, sc * 2.3, sc * 0.82, 0, 0, 7); ctx.fillStyle = I.rgba(col, on ? 0.22 : 0.08); ctx.fill(); ctx.strokeStyle = I.rgba(on ? PAL.cream : col, on ? 0.95 : 0.55); ctx.lineWidth = on ? 2 : 1.2; ctx.stroke();
      const ph = I.hash(p.id) % 100 / 16, h = I.figure(ctx, q.x, q.y, sc * 1.35, col, { seed: I.hash(cs.id + p.id), alpha: 0.9, lead: p.lead, glow: on, idle: reduced ? 0 : t * 0.9 + I.hash(p.id) % 100 / 16, talk: !reduced && Math.sin(t * 0.45 + I.hash(p.id) % 7) > 0.75, mood: bad ? 'bad' : good ? 'good' : 'neutral', stress: under && bad, bob: reduced ? 0 : Math.abs(Math.sin(t * 1.6 + ph)) * sc * 0.12, wave: !reduced && on && Math.sin(t * 4) > 0 });
      heads[p.id] = h.top;
      I.pill(ctx, q.x, q.y + sc * 1.25 + 16, p.name, { kind: 'place', dot: col, col: on ? PAL.own : null, strong: on });
      placed.push({ x0: q.x - 60, y0: q.y + sc * 1.25 + 2, x1: q.x + 60, y1: q.y + sc * 1.25 + 34 }, { x0: q.x - sc * 1.6, y0: h.top, x1: q.x + sc * 1.6, y1: q.y });
      addHit({ x0: q.x - sc * 3.4, y0: h.top - 30, x1: q.x + sc * 3.4, y1: q.y + sc * 1.25 + 34 }, it);
    });
    // what each persona feels, fears and wishes
    order.slice().sort((a, b) => (same(hover, { kind: 'person', id: b.id }) || same(sel, { kind: 'person', id: b.id }) ? 1 : 0) - (same(hover, { kind: 'person', id: a.id }) || same(sel, { kind: 'person', id: a.id }) ? 1 : 0)).forEach((p) => {
      const q = pos[p.id], col = PAL.cat[p.cat] || PAL.cat.culture, on = same(hover, { kind: 'person', id: p.id }) || same(sel, { kind: 'person', id: p.id });
      if (p.mood) bubble(q.x, heads[p.id] - 6, p.mood, under && BADW.test(p.mood) ? PAL.risk : col);
      if (on) { const y = q.y + (p.lead ? s * 1.18 : s) * 1.25 + 52; if (p.fear) place(q.x, y, 'Fears · ' + p.fear, { kind: 'label', col: PAL.risk }, null, true); if (p.wish) place(q.x, y + 28, 'Wishes · ' + p.wish, { kind: 'label', col: PAL.cat.direction }, null, true); }
    });
    (tm.__tl || []).forEach(([x, y, label]) => place(x, y + 22, label, { kind: 'label', col: PAL.risk }, null)); tm.__tl = null;
    (tm.__pl || []).slice(0, 2).forEach(([x, y, text]) => place(x, y, text, { kind: 'label', col: PAL.cat.emotion }, null)); tm.__pl = null;
    (tm.clouds || []).forEach((cl, i) => {
      const P0 = pos[cl.near] || pos[lead.id], dx = P0.x - W / 2, dy = P0.y - CYm, l = Math.hypot(dx, dy) || 1, col = PAL.cat[cl.cat];
      const c0 = l < 5 ? { x: W / 2 + 150, y: CYm + 80 } : { x: P0.x + dx / l * 120, y: P0.y + dy / l * 70 + 30 };
      ctx.font = 'italic 500 12.5px Figtree, sans-serif'; const hw = ctx.measureText(cl.label).width / 2 + 16;
      const c = { x: Math.max(16 + hw, Math.min(W - 16 - hw, c0.x)), y: Math.max(76 + 30, Math.min(H - 64 - 20 - insetB, c0.y)) };
      if (c.y < 76 + 50 && c.x + hw > W - 210) c.x = W - 210 - hw;
      const r = place(c.x, c.y, cl.label, { kind: 'label', col, dot: col }, null);
      if (r) { ctx.globalCompositeOperation = 'screen'; I.aura(ctx, c.x, c.y, hw + 10, col, 0.12); ctx.globalCompositeOperation = 'source-over'; }
      void i;
    });
    { const words = String(tm.medium || '').split('·').slice(1).join('·').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 4), ys = top + 6;
      words.forEach((wd, i) => { const o2 = others[i % Math.max(1, others.length)] || lead, A = pos[lead.id], Bp = pos[o2.id], x = (A.x * 0.45 + Bp.x * 0.55), y = Math.max(ys + 20, Math.min(A.y, Bp.y) - s * 9) + (reduced ? 0 : Math.sin(t * 0.6 + i) * 3);
        ctx.globalCompositeOperation = 'screen'; I.aura(ctx, x, y, 46, PAL.own, 0.22); ctx.globalCompositeOperation = 'source-over';
        const tgt = pos[(tm.people[i % tm.people.length] || lead).id]; ctx.save(); ctx.setLineDash([1.5, 5]); ctx.strokeStyle = 'rgba(196,181,253,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.quadraticCurveTo(x, (y + heads[tgt ? (tm.people[i % tm.people.length] || lead).id : lead.id]) / 2, tgt ? tgt.x : x, (heads[(tm.people[i % tm.people.length] || lead).id] || y + 60) - 30); ctx.stroke(); ctx.restore();
        let ok = false; for (const dy of [0, -28, 28, -56]) if (place(x, y + dy, wd, { kind: 'label', col: '#D9CCFF' }, null)) { ok = true; break; } if (!ok && i === 0) place(W / 2, top + 10, wd, { kind: 'label', col: '#D9CCFF' }, null, true); }); }
    if (fe) place(W / 2, 92, (under ? '!  After this change · ' : 'After this change · ') + fe[0], { kind: under ? 'plan' : 'label', col: under ? PAL.risk : PAL.cat[fe[1]] }, null, true);
  }

  // ——— loop ———
  let raf = 0;
  function draw(now) {
    if (host.clientWidth !== W || host.clientHeight !== H) resize();
    if (!W || !H || !cs) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const t = now / 1000;
    yaw += (yawT - yaw) * 0.06; yawI += (yawIT - yawI) * 0.06; yawM += (yawMT - yawM) * 0.1;
    boost += (boostT - boost) * 0.08; km.fx += (focusT[0] - km.fx) * 0.08; km.fy += (focusT[1] - km.fy) * 0.08;
    if (pending && now >= pending.at) { pX = pY = 0; zoomUI = 1; level = pending.to; pending = null; fade = 0; boost = boostT = 1; focusT = [C.N / 2, C.N / 2]; km.fx = km.fy = C.N / 2; emitLevel(); }
    hits = [];
    if (level === 'macro') drawMacro(t, now); else if (level === 'meso') drawMeso(t); else drawMicro(t);
    if (pending) { const u = 1 - Math.max(0, (pending.at - now) / 650); ctx.fillStyle = I.rgba(PAL.meso, Math.max(0, u * 1.4 - 0.4)); ctx.fillRect(0, 0, W, H); }
    if (fade < 1) { fade = Math.min(1, fade + 0.06); ctx.fillStyle = I.rgba(level === 'meso' ? PAL.meso : PAL.surface, 1 - fade); ctx.fillRect(0, 0, W, H); }
  }
  function frame(now) { raf = requestAnimationFrame(frame); draw(now); }
  raf = requestAnimationFrame(frame);

  // ——— input ———
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const ptrs = new Map(); let pinch = null;
  function onDown(e) { ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; dragged = true; return; } drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pan: e.shiftKey || e.button === 2 || e.button === 1 }; dragged = false; lastInput = performance.now(); try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
  function onMove(e) {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = canvas.getBoundingClientRect(); if (pinch.d > 0 && d > 0) zoomAt(d / pinch.d, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); pinch.d = d; lastInput = performance.now(); return; }
    if (drag) {
      if (!dragged && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) { dragged = true; canvas.style.cursor = 'grabbing'; }
      if (dragged && level === 'macro') {
        if (!drag.pan) yawT += (e.clientX - drag.x) * 0.006;
        const dx = drag.pan ? e.clientX - drag.x : 0, dy = e.clientY - drag.y, a = -dx / (0.866 * km.S), b = -dy / (0.5 * km.S), rx = (a + b) / 2, ry = (b - a) / 2;
        const c = Math.cos(-km.yaw), s = Math.sin(-km.yaw); focusT = [Math.max(0, Math.min(C.N, focusT[0] + rx * c - ry * s)), Math.max(0, Math.min(C.N, focusT[1] + rx * s + ry * c))]; km.fx = focusT[0]; km.fy = focusT[1];
      } else if (dragged && level === 'meso') { if (drag.pan) pX += e.clientX - drag.x; else yawIT += (e.clientX - drag.x) * 0.005; pY += e.clientY - drag.y; }
      else if (dragged && level === 'micro') { yawMT += (e.clientX - drag.x) * 0.006; tiltM = Math.max(-0.5, Math.min(0.35, tiltM + (e.clientY - drag.y) * 0.003)); }
      drag.x = e.clientX; drag.y = e.clientY; lastInput = performance.now();
    } else { const [mx, my] = local(e); const h = pick(mx, my); hover = h && h.kind !== 'earth' && h.kind !== 'bridge' ? h : null; canvas.style.cursor = h ? 'pointer' : 'grab'; }
  }
  function onUp(e) {
    ptrs.delete(e.pointerId); if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
    if (drag && !dragged) {
      const [mx, my] = local(e); const h = pick(mx, my);
      if (h) {
        if (h.kind === 'zoom' || (h.kind === 'org' && same(sel, h))) setLevel('meso');
        else if (h.kind === 'team' || (h.kind === 'floor' && same(sel, h))) setLevel('micro', h.id);
        else if (h.kind === 'wp') { sel = h; }
        else { sel = Object.assign({}, h, { at: performance.now() }); }
        if (opts.onSelect) opts.onSelect(describe(sel && (h.kind === 'zoom' || h.kind === 'team') ? h : sel), { x: mx, y: my });
      } else { sel = null; if (opts.onSelect) opts.onSelect(null, null); }
    }
    if (drag && dragged && level === 'meso') yawIT = Math.round(yawIT / (Math.PI / 2)) * (Math.PI / 2);
    drag = null; canvas.style.cursor = 'grab';
  }
  function describe(it) {
    if (!it || !cs) return null;
    if (it.kind === 'org' || it.kind === 'zoom') return { kind: 'org', id: 'org', label: cs.org.label, note: cs.org.note };
    if (it.kind === 'place') { const dp = (L.depts || []).find((x) => x.id === it.id); if (dp) return { kind: 'place', id: dp.id, label: dp.label, note: dp.note, status: 'department', meso: true }; const p = cs.places.find((x) => x.id === it.id); return p && Object.assign({ kind: 'place' }, p); }
    if (it.kind === 'ext') { const e = (orgModel().ext || []).find((x) => x.f.id === it.id); return e && { kind: 'place', id: e.f.id, label: e.f.name, note: e.f.note || ('Outside the company, but directly affected by it' + (e.f.sub ? ': ' + e.f.sub : '') + '.'), status: 'beyond the company · outside space' }; }
    if (it.kind === 'wp') { const p = webFor(floorId).find((x) => x.id === it.id); return p && { kind: 'web', id: p.id, label: p.name, note: p.note, type: p.type }; }
    if (it.kind === 'floor' || it.kind === 'team') { const f = cs.floors.find((x) => x.id === it.id); return f && Object.assign({ kind: 'floor' }, f); }
    if (it.kind === 'person') { const p = teamFor(floorId).people.find((x) => x.id === it.id); return p && { kind: 'person', id: p.id, label: p.name, floor: floorId, mood: p.mood, fear: p.fear, wish: p.wish }; }
    if (it.kind === 'far') { const f = (L.far || []).find((x) => x.id === it.id); return f && { kind: 'place', id: f.id, label: f.label, note: f.note, status: f.kind === 'institution' ? 'institution' : 'beyond the city · ' + f.kind, view: effects[f.id] ? { word: effects[f.id][0], cat: effects[f.id][1] } : null }; }
    if (it.kind === 'global') { const g = (L.global || []).find((x) => x.id === it.id); return g && { kind: 'place', id: g.id, label: g.label, note: g.note, status: 'global · ' + g.kind, view: effects[g.id] ? { word: effects[g.id][0], cat: effects[g.id][1] } : null }; }
    if (it.kind === 'bridge') { const b = cs.bridge || {}; return { kind: 'place', id: 'bridge', label: b.state === 'broken' ? 'Bridge closed' : 'Old bridge', note: b.note, status: 'risk · infrastructure', view: { word: b.state === 'broken' ? 'Bottleneck' : 'Needs rebuilding', cat: 'harm' } }; }
    if (it.kind === 'force') { const f = cs.forces.find((x) => x.label === it.id); return f && Object.assign({ kind: 'force', id: f.label }, f); }
    return null;
  }
  function zoomAt(f, mx, my) {
    if (level === 'macro') { zoomU = Math.max(0.75, Math.min(4, zoomU * f)); return; }
    if (level === 'micro') { zoomM = Math.max(0.6, Math.min(1.8, zoomM * f)); return; }
    const z0 = zoomUI; zoomUI = Math.max(0.6, Math.min(3.2, zoomUI * f)); const g = zoomUI / z0, cx = W / 2, cy = 60 + Math.max(160, H - 84 - insetB) / 2;
    if (mx == null) { mx = cx; my = cy; } pX = mx - cx - (mx - cx - pX) * g; pY = my - cy - (my - cy - pY) * g;
  }
  function onWheel(e) { e.preventDefault(); lastInput = performance.now(); const [mx, my] = local(e); zoomAt(e.deltaY < 0 ? 1.1 : 0.91, mx, my); }
  function onLeave() { if (!drag) hover = null; }
  function onCtx(e) { e.preventDefault(); }
  canvas.style.touchAction = 'none'; canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('contextmenu', onCtx);

  return {
    setCase, setLevel, getLevel: () => level, getFloor: () => floorId,
    rotate(dir) { lastInput = performance.now(); if (level === 'meso') yawIT = Math.round(yawIT / (Math.PI / 2)) * (Math.PI / 2) + dir * Math.PI / 2; else if (level === 'micro') yawMT += dir * Math.PI / 4; else yawT += dir * Math.PI / 2; },
    zoom(f) { zoomAt(f); },
    relabel(names) { if (!cs || !L) return; (cs.places || []).forEach((p) => { if (names[p.id]) p.label = names[p.id]; }); L.blocks.forEach((b) => { if (b.place && names[b.place.id]) b.place.label = names[b.place.id]; }); },
    setInset(px) { insetB = Math.max(0, px || 0); },
    setEffects(map, hs) { effects = map || {}; hot = hs || []; if (map && Object.keys(map).length) ripples.push({ start: performance.now() }); },
    ripple() { ripples.push({ start: performance.now() }); },
    spotlight(id) { spot = id || null; },
    select(id) { sel = id ? { kind: id === 'org' ? 'org' : 'place', id } : null; },
    renderNow(n) { const t0 = performance.now(); for (let i = 0; i < (n || 1); i++) draw(t0 + i * 16); },
    destroy() { cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onCtx); },
  };
}
if (typeof window !== 'undefined') window.createWorldMap = createWorldMapImpl;

export const createWorldMap = createWorldMapImpl as (
  canvas: HTMLCanvasElement,
  opts?: WorldMapOptions,
) => WorldMapController;
