// @ts-nocheck
/**
 * pathwayMiniMap.ts — VERBATIM port of prototype/pathway-minimap.js.
 *
 * A small version of the organisational-model city that plays a pathway
 * out over 12 months. It reads window.OzyIso / window.OzyCity, so this
 * module imports worldMapEngine for its side effects (those globals are
 * set when the engine IIFEs run). Ported from the design handoff; the only
 * local change: no high/medium/low risk banding (it needed window.ozyPathwayRisk).
 */
import "./worldMapEngine";

export interface PathwayMiniMap {
  setT: (months: number) => void;
  rotate: (dir: number) => void;
  destroy: () => void;
}

// Ozy — pathway mini-map. A small version of the organisational model's city (same layout, same buildings, same colours),
// with the pathway playing out over 12 months:
// risk spots pulse until the pathway closes them, benefits glow. Drag to turn.
// createPathwayMiniMap(canvas, { caseData, pathway }) → { setT(months), destroy() }. Needs world-iso.js + world-city.js.
(function () {
  const LEVEL = { high: '#FF5A3C', medium: '#F2C230', low: '#3DD68C' };
  const RISK = '#FF5A3C', WIN = '#3DD68C';
  function createPathwayMiniMap(canvas, o) {
    const I = window.OzyIso, C = window.OzyCity; if (!I || !C) return { setT() {}, destroy() {} };
    const ctx = canvas.getContext('2d'), host = canvas.parentElement, DPR = Math.min(2, window.devicePixelRatio || 1);
    const cs = Object.assign({}, o.caseData, { far: [], global: [] }), pw = o.pathway; void LEVEL; // risk is no longer banded into high/medium/low (no universal thresholds)
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const L = C.layout(cs), drawables = C.buildDrawables(L), org = L.byId.org.block;
    // where each spot sits: places on their own lot; departments and outside partners around the organisation's lot
    const ids = []; [...(pw.risks || []), ...(pw.wins || [])].forEach((s) => { if (!ids.includes(s.near)) ids.push(s.near); });
    let inner = 0; const innerIds = ids.filter((id) => !L.byId[id]);
    const anchor = {}; ids.forEach((id) => { const p = L.byId[id]; if (p && p.block) anchor[id] = { gx: p.block.cx, gy: p.block.cy, h: (p.top || 1.2) + 0.4 }; else { const a = (inner++ / Math.max(1, innerIds.length)) * Math.PI * 2 - Math.PI / 2; anchor[id] = { gx: org.cx + Math.cos(a) * 1.7, gy: org.cy + Math.sin(a) * 1.7, h: 2.2 }; } });
    const name = (id) => { const f = (o.caseData.floors || []).find((x) => x.id === id); if (f) return f.name; const p = (o.caseData.places || []).find((x) => x.id === id) || (o.caseData.far || []).find((x) => x.id === id); return p ? p.label : id; };
    let W = 0, H = 0, T = 0, raf = 0, alive = true, yaw = 0.0, yawT = 0.0, base = null, mask = null, baseYaw = null, drag = null;
    const k = I.cam(); k.ox = k.oy = k.fx = k.fy = C.N / 2;
    function resize() { W = host.clientWidth; H = host.clientHeight; canvas.width = W * DPR; canvas.height = H * DPR; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; base = null; }
    resize(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; ro && ro.observe(host);
    function cam() { k.W = W; k.H = H; k.S = Math.min(W / 50, H / 31); k.yaw = yaw; k.cy0 = 0.56; I.prep(k); }
    // the city, drawn once per angle and recoloured by the risk level (hue + saturation from the tint, light from the model)
    function renderBase() {
      const off = base && base.canvas.width === canvas.width ? base : (() => { const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; return c.getContext('2d'); })();
      off.setTransform(1, 0, 0, 1, 0, 0); off.clearRect(0, 0, off.canvas.width, off.canvas.height); off.setTransform(DPR, 0, 0, DPR, 0, 0);
      C.drawGround(off, k, L, 0);
      drawables.slice().sort((a, b) => I.depth(k, a.gx, a.gy) - I.depth(k, b.gx, b.gy)).forEach((d) => d.fn(off, k));
      base = off; baseYaw = yaw;
    }
    let placed = [];
    function text(x, y, s, col, font) { ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(6,9,14,0.85)'; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = col; ctx.fillText(s, x, y); }
    function fits(x, y, s, font) { ctx.font = font; const w = ctx.measureText(s).width / 2 + 4, r = { x0: x - w, x1: x + w, y0: y - 8, y1: y + 8 }; if (r.x0 < 4 || r.x1 > W - 4 || r.y0 < 26 || r.y1 > H - 4) return false; if (placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) return false; placed.push(r); return true; }
    function label(x, y, s, col, font) { for (const dy of [0, -16, 16, -32, 32]) for (const dx of [0, -46, 46]) if (fits(x + dx, y + dy, s, font)) { text(x + dx, y + dy, s, col, font); return; } }
    const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
    function frame(now) {
      if (!alive) return; const t = now / 1000;
      yaw += (yawT - yaw) * 0.18; if (Math.abs(yawT - yaw) < 0.002) yaw = yawT;
      cam(); if (!base || Math.abs(baseYaw - yaw) > 0.004) renderBase();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(base.canvas, 0, 0);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const active = (s) => s.from <= T && (s.until == null || T < s.until);
      // your organisation stays findable: its ring in the brand purple
      I.groundEllipse(ctx, k, org.cx, org.cy, 2.9, 0.06); ctx.strokeStyle = I.rgba('#C4B5FD', 0.9); ctx.lineWidth = 1.6; ctx.stroke();
      const orgP = I.P(k, org.cx, org.cy, 2.6);
      placed = []; const labels = [];
      ids.forEach((id, i) => {
        const a = anchor[id], rs = pw.risks.filter((s) => s.near === id && active(s)), ws = pw.wins.filter((s) => s.near === id && active(s)), cl = pw.risks.filter((s) => s.near === id && s.until != null && T >= s.until);
        const g = I.P(k, a.gx, a.gy, 0.06), top = I.P(k, a.gx, a.gy, a.h);
        if (rs.length) {
          const pu = reduced ? 0.4 : (t % 1.6) / 1.6; I.groundEllipse(ctx, k, a.gx, a.gy, 1.2 + pu * 1.8, 0.07); ctx.strokeStyle = I.rgba(RISK, 0.9 * (1 - pu)); ctx.lineWidth = 2; ctx.stroke();
          I.aura(ctx, g.x, g.y, k.S * 2.2, RISK, 0.42); I.ribbon(ctx, orgP, top, RISK, reduced ? 0 : t + i * 0.3, null, 0.8);
        } else if (ws.length) { I.aura(ctx, g.x, g.y, k.S * 2, WIN, 0.38); I.ribbon(ctx, orgP, top, WIN, reduced ? 0 : t + i * 0.3, null, 0.7); }
        let y = top.y - 6;
        rs.forEach((s) => { labels.push([top.x, y, '! ' + short(s.label, 30), '#FFB4A6', '600 11.5px Figtree, sans-serif']); y -= 16; });
        ws.forEach((s) => { labels.push([top.x, y, '✓ ' + short(s.label, 30), '#9CF5C8', '600 11.5px Figtree, sans-serif']); y -= 16; });
        cl.forEach((s) => { labels.push([top.x, y, short(s.label, 24) + ' · closed', 'rgba(195,207,212,0.6)', 'italic 500 10.5px Figtree, sans-serif']); y -= 15; });
        if (rs.length || ws.length) labels.push([g.x, g.y + 16, short(name(id), 26), '#C3CFD4', '500 10.5px Figtree, sans-serif']);
      });
      labels.forEach((l) => label(...l));
      raf = requestAnimationFrame(frame);
    }
    const down = (e) => { drag = { x: e.clientX, yaw: yawT }; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); };
    const move = (e) => { if (drag) yawT = drag.yaw + (e.clientX - drag.x) * 0.008; };
    const up = () => { drag = null; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointerleave', up);
    canvas.style.cursor = 'grab';
    raf = requestAnimationFrame(frame);
    return { setT(m) { T = m; }, rotate(d) { yawT += d * Math.PI / 4; }, destroy() { alive = false; cancelAnimationFrame(raf); ro && ro.disconnect(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointerleave', up); } };
  }
  window.createPathwayMiniMap = createPathwayMiniMap;
})();

export const createPathwayMiniMap = ((typeof window !== "undefined" ? (window as any).createPathwayMiniMap : undefined)) as (
  canvas: HTMLCanvasElement,
  o: { caseData: unknown; pathway: unknown },
) => PathwayMiniMap;
