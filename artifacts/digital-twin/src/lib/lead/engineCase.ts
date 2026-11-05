/**
 * LeadCase → world-map engine input.
 *
 * The isometric canvas engine (worldMapEngine.ts) was ported from the design
 * handoff and expects a "world case" object. This adapter builds that object
 * from a lead case using the visual registry and the org-type presentation
 * rules, so the engine stays generic and holds no case data.
 *
 * Nothing is invented here: missing values stay empty, unknown states are
 * labelled "State unknown", and team headcount is never shown as a number
 * when it was not stated (the engine only uses it to size rooms).
 */
import { getElementType, getState, type Tone } from "@/lib/visuals/registry";
import { activePathways, orgName } from "./derive";
import { engineTheme, orgTypeRule } from "./orgTypes";
import type { CaseElement, Effect, LeadCase, Relationship } from "./types";

/** The shape the engine reads. Kept loose: the engine is untyped (@ts-nocheck). */
export interface WorldCase {
  id: string;
  name: string;
  theme: string;
  org: { label: string; shape: string; note: string };
  places: Array<Record<string, unknown>>;
  far: Array<Record<string, unknown>>;
  global: Array<Record<string, unknown>>;
  forces: Array<{ label: string; cat: string; near: string }>;
  ties: Array<[string, string, string, string]>;
  links: Array<[string, string, string]>;
  floors: Array<{ id: string; name: string; sub: string; staff: number; staffKnown: boolean; cat: string; tags: Array<{ label: string; cat: string }>; roles: string[]; ties: Array<[number, number, string, string]> }>;
  threads: Array<[string, string, string, string]>;
  inner: { tiers?: string[][]; links: Array<[string, string, string, string, number]>; ext: Array<Record<string, unknown>>; surround: unknown[]; walls: string };
  options: Array<{ t: string; p: string; effects: Record<string, [string, string]>; hot: Array<{ near: string; label: string }> }>;
  bridge: null;
  [k: string]: unknown;
}

const ZONE: Record<string, string> = {
  facility: "industry", supplier: "industry", machine: "industry", road: "industry", vehicle: "industry", portfolio: "downtown",
  customer: "downtown", organisation: "downtown", city: "downtown", regulation: "downtown", ward: "downtown",
  "external-stakeholder": "edge", home: "res", "care-home": "res", school: "res", community: "res", district: "res",
  "green-space": "fields", river: "river",
};

const FAR_KIND: Record<string, string> = {
  regulation: "institution", customer: "city", demand: "city", city: "city", community: "community", district: "community",
  "external-stakeholder": "partner", supplier: "partner", organisation: "partner",
};

/** Places that may be drawn as a person figure around a team (people or organisations of people). */
const PEOPLE_LIKE = new Set(["external-stakeholder", "community", "customer", "supplier", "role"]);

const FORCE_CAT: Record<string, string> = {
  culture: "culture", trust: "trust", tension: "harm", sentiment: "emotion", alignment: "direction", voice: "emotion", "speaking-up": "emotion", workload: "harm",
};

export function toneCat(t: Tone | undefined): string {
  return t === "negative" || t === "caution" ? "harm" : t === "positive" ? "earth" : t === "proposed" ? "decision" : t === "scenario" ? "direction" : "flow";
}

const EFFECT_CAT: Record<Effect["tone"], string> = { risk: "harm", benefit: "earth", mixed: "trust", neutral: "direction" };
const TIE_TONE: Record<Relationship["tone"], string> = { tension: "risk", synergy: "good", mixed: "mixed", neutral: "none" };
const MESO_KIND: Partial<Record<Relationship["type"], string>> = { tension: "tension", handover: "handoff", flow: "handoff", information: "info", trust: "trust" };

export function effectsMap(effects: Effect[]): Record<string, [string, string]> {
  const out: Record<string, [string, string]> = {};
  for (const e of effects) if (e.target && e.label.trim()) out[e.target] = [e.label, EFFECT_CAT[e.tone] ?? "direction"];
  return out;
}

export function hotSpots(effects: Effect[]): Array<{ near: string; label: string }> {
  return effects.filter((e) => e.target && e.tone === "risk" && e.label.trim()).map((e) => ({ near: e.target, label: e.label }));
}

export function layerOf(e: CaseElement): string {
  return e.layer || getElementType(e.visual)?.layer || "list";
}

function viewOf(e: CaseElement): { word: string; cat: string } {
  const st = getState(e.visual, e.state);
  const ov = e.overlays.find((o) => o === "active-problem" || o === "possible-risk" || o === "literal-fire");
  if (st.id === "unknown" && !ov) return { word: "State unknown", cat: "flow" };
  const word = [st.id === "unknown" ? "" : st.label, ov === "active-problem" ? "Active problem" : ov === "possible-risk" ? "Possible risk" : ov === "literal-fire" ? "Fire (literal)" : ""].filter(Boolean).join(" · ");
  return { word, cat: ov ? "harm" : toneCat(st.t.tone) };
}

export function toWorldCase(lead: LeadCase): WorldCase {
  const rule = orgTypeRule(lead.presentation.orgType);
  const named = lead.elements.filter((e) => e.label.trim());
  const teams = lead.teams.filter((t) => t.name.trim());
  const teamIds = new Set(teams.map((t) => t.id));
  const elIds = new Set(named.map((e) => e.id));
  const orgVisual = getElementType(lead.organisation.visual);
  const orgShape = lead.organisation.shape || (lead.organisation.visual && lead.organisation.visual !== "organisation" && orgVisual?.engineShape ? orgVisual.engineShape : rule.orgShape);

  const places = named.filter((e) => layerOf(e) === "macro").map((e) => {
    const et = getElementType(e.visual);
    const base: Record<string, unknown> = { id: e.id, label: e.label, shape: e.shape || et?.engineShape || "office", zone: ZONE[e.visual] ?? "res", note: e.note, view: viewOf(e), persona: PEOPLE_LIKE.has(e.visual) };
    if (e.ring) base.ring = e.ring;
    if (e.portfolio.tier) {
      base.tier = e.portfolio.tier;
      if (e.portfolio.health) base.health = e.portfolio.health; // no health = no coloured ring (unknown is not "on track")
      if (e.portfolio.status) base.status = e.portfolio.status;
      base.cat = e.portfolio.health === "risk" ? "harm" : e.portfolio.health === "mixed" ? "trust" : e.portfolio.health === "good" ? "direction" : "flow";
    }
    return base;
  });

  const far = named.filter((e) => layerOf(e) === "beyond").map((e) => ({ id: e.id, label: e.label, kind: FAR_KIND[e.visual] ?? getElementType(e.visual)?.engineKind ?? "partner", shape: getElementType(e.visual)?.engineShape ?? "office", note: e.note }));
  const global = named.filter((e) => layerOf(e) === "earth").map((e) => ({ id: e.id, label: e.label, kind: getElementType(e.visual)?.engineKind ?? "climate", link: "earth", note: e.note }));
  const forces = named.filter((e) => layerOf(e) === "force").map((e) => ({ label: e.label, cat: FORCE_CAT[e.visual] ?? "decision", near: e.near && (elIds.has(e.near) || e.near === "org") ? e.near : "org" }));

  const rels = lead.relationships.filter((r) => r.from && r.to && r.from !== r.to);
  const known = (id: string) => id === "org" || elIds.has(id) || teamIds.has(id);
  const macroRels = rels.filter((r) => known(r.from) && known(r.to) && !teamIds.has(r.from) && !teamIds.has(r.to));
  const ties = macroRels.map((r) => [r.from, r.to, TIE_TONE[r.tone] ?? "none", r.label] as [string, string, string, string]);
  const links = macroRels.map((r) => [r.from, r.to, r.tone === "tension" ? "harm" : "flow"] as [string, string, string]);

  const floors = teams.map((t) => ({
    id: t.id,
    name: t.name,
    sub: t.purpose,
    staff: t.headcount && t.headcount > 0 ? t.headcount : Math.max(1, t.roles.filter((r) => r.trim()).length), // only sizes rooms (roles when headcount is unknown); never printed when unknown
    staffKnown: t.headcount != null,
    ties: (() => { const rs = t.roles.filter((r) => r.trim()); return (t.roleLinks ?? []).map((l) => [rs.indexOf(l.from), rs.indexOf(l.to), l.kind === "handover" ? "weak" : l.kind, l.label] as [number, number, string, string]).filter(([a, b]) => a >= 0 && b >= 0); })(),
    cat: "culture",
    tags: [
      ...t.views.filter((v) => v.text.trim()).map((v) => ({ label: v.holder.trim() ? `${v.holder}: “${v.text}”` : `“${v.text}”`, cat: "culture" })),
      ...t.overlays.map((o) => ({ label: o === "workload" ? "Workload pressure (reported)" : o.replace(/-/g, " "), cat: "harm" })),
    ],
    roles: t.roles.filter((r) => r.trim()),
  }));

  const teamRels = rels.filter((r) => teamIds.has(r.from) || teamIds.has(r.to));
  const extIds = Array.from(new Set(teamRels.flatMap((r) => [r.from, r.to]).filter((id) => elIds.has(id))));
  const ext = extIds.slice(0, 4).map((id, i) => {
    const e = named.find((x) => x.id === id)!;
    return { id: e.id, name: e.label, icon: "org", side: i % 2 ? "E" : "W", sub: getState(e.visual, e.state).label, note: e.note || getElementType(e.visual)?.label || "" };
  });
  const innerLinks = teamRels
    .filter((r) => (teamIds.has(r.from) || extIds.includes(r.from)) && (teamIds.has(r.to) || extIds.includes(r.to)))
    .map((r) => [r.from, r.to, MESO_KIND[r.type] ?? "decision", r.label, r.tone === "tension" || !!r.label ? 1 : 0] as [string, string, string, string, number]);
  const threads = teamRels.filter((r) => teamIds.has(r.from) && teamIds.has(r.to)).map((r) => [r.from, r.to, r.label, r.tone === "tension" ? "harm" : "decision"] as [string, string, string, string]);

  const tiered = teams.some((t) => t.tier != null);
  const tiers = tiered
    ? Array.from(new Set(teams.map((t) => t.tier ?? 0))).sort((a, b) => a - b).map((k) => teams.filter((t) => (t.tier ?? 0) === k).map((t) => t.id))
    : undefined;

  const options = activePathways(lead).map((p) => ({ t: p.title, p: p.summary || p.idea, effects: effectsMap(p.effects), hot: hotSpots(p.effects) }));

  return {
    id: lead.id,
    name: orgName(lead),
    theme: engineTheme(lead.presentation.orgType, lead.presentation.theme),
    org: { label: orgName(lead), shape: orgShape, note: lead.organisation.overview },
    places, far, global, forces, ties, links, floors, threads,
    inner: { ...(tiers ? { tiers } : {}), links: innerLinks, ext, surround: [], walls: "open" },
    options,
    bridge: null,
  };
}
