/** Map lead-case content onto the generic visual components' props. */
import type { ConnectionItem } from "@/components/visuals/VisualConnection";
import type { VisualItem } from "@/components/visuals/VisualNode";
import type { SourceRef } from "@/components/visuals/InspectPanel";
import { nameOf, orgName } from "./derive";
import type { LeadCase } from "./types";

export function orgItem(lead: LeadCase): VisualItem {
  return { id: "org", label: orgName(lead), visual: lead.organisation.visual || "organisation", state: lead.organisation.state || "unknown", overlays: [], note: lead.organisation.overview };
}

export function elementItems(lead: LeadCase): VisualItem[] {
  return lead.elements.filter((e) => e.label.trim()).map((e) => ({
    id: e.id, label: e.label, visual: e.visual, state: e.state, overlays: e.overlays, evidence: e.evidence, confidence: e.confidence,
    confidenceWhy: e.confidenceWhy, holder: e.holder, note: e.note, measure: e.measure, sourceIds: e.sourceIds,
  }));
}

export function teamItems(lead: LeadCase): VisualItem[] {
  return lead.teams.filter((t) => t.name.trim()).map((t) => ({
    id: t.id, label: t.name, visual: t.visual || "team", state: t.state || "unknown", overlays: t.overlays,
    note: [t.purpose, t.headcount != null ? `${t.headcount} people` : "Headcount not stated", t.roles.length ? `Roles: ${t.roles.join(", ")}` : ""].filter(Boolean).join(" · "),
    evidence: t.views[0]?.evidence ?? "", holder: t.views[0]?.holder, sourceIds: Array.from(new Set(t.views.flatMap((v) => v.sourceIds))),
  }));
}

export function connectionItems(lead: LeadCase): ConnectionItem[] {
  return lead.relationships.filter((r) => r.from && r.to).map((r) => ({
    id: r.id, fromLabel: nameOf(lead, r.from), toLabel: nameOf(lead, r.to), type: r.type, state: r.state, label: r.label, frequency: r.frequency, evidence: r.evidence,
  }));
}

export function sourceRefs(lead: LeadCase): SourceRef[] {
  return lead.sources.map((s) => ({ id: s.id, title: s.title, date: s.date, scope: s.scope, docType: s.docType, owner: s.owner }));
}
