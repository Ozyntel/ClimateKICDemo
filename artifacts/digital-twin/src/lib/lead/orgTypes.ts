/**
 * Organisation-type presentation rules.
 *
 * Generalised from the five former demo cases: each organisation type keeps
 * its own *look* (world theme, building, map legend, wording), but carries no
 * facts. A lead picks an org type in /prepare; the theme can be overridden.
 */
import type { EngineShape } from "@/lib/visuals/registry";
import type { OrgTypeId, ThemeId } from "./types";

export interface OrgTypeRule {
  id: OrgTypeId;
  label: string;
  hint: string;
  /** Default world theme. */
  theme: Exclude<ThemeId, "">;
  /** Default building for the organisation itself. */
  orgShape: EngineShape;
  /** Inside view name, e.g. "room by room". */
  insideLabel: string;
  /** Legend for the macro level. */
  legend: "default" | "portfolio";
}

export const ORG_TYPES: OrgTypeRule[] = [
  { id: "company", label: "Company / scale-up", hint: "A single company. Innovation-ecosystem world (towers, forest, few streets).", theme: "innovation", orgShape: "factory", insideLabel: "room by room", legend: "default" },
  { id: "enterprise", label: "Producing enterprise", hint: "An established producer with sites. Town plus forests.", theme: "industrial", orgShape: "hq", insideLabel: "room by room", legend: "default" },
  { id: "public", label: "Municipality / public authority", hint: "A city or public body. Canal-city world with landmarks.", theme: "canal-city", orgShape: "townhall", insideLabel: "department by department", legend: "default" },
  { id: "portfolio", label: "Fund / portfolio", hint: "A fund and its holdings, each on its own island. Holdings can be marked by data tier.", theme: "portfolio", orgShape: "fund", insideLabel: "team by team", legend: "portfolio" },
  { id: "network", label: "Non-profit / innovation network", hint: "A non-profit that coordinates a network of partners. Innovation-ecosystem world around a civic building.", theme: "innovation", orgShape: "civic", insideLabel: "team by team", legend: "default" },
  { id: "care", label: "Hospital / care provider", hint: "A campus: each team gets its own block around the main building.", theme: "campus", orgShape: "care", insideLabel: "department by department", legend: "default" },
  { id: "other", label: "Other organisation", hint: "A neutral town around the organisation.", theme: "town", orgShape: "office", insideLabel: "room by room", legend: "default" },
];

export const THEMES: Array<{ id: Exclude<ThemeId, "">; label: string; engine: string }> = [
  { id: "town", label: "Town", engine: "city" },
  { id: "canal-city", label: "Canal city", engine: "amsterdam" },
  { id: "innovation", label: "Innovation ecosystem", engine: "eco" },
  { id: "portfolio", label: "Portfolio islands", engine: "isles" },
  { id: "industrial", label: "Town and forests", engine: "forest" },
  { id: "campus", label: "Campus", engine: "campus" },
];

export function orgTypeRule(id: OrgTypeId | undefined): OrgTypeRule {
  return ORG_TYPES.find((o) => o.id === id) ?? ORG_TYPES[ORG_TYPES.length - 1];
}

export function resolveTheme(orgType: OrgTypeId, theme: ThemeId): Exclude<ThemeId, ""> {
  return theme || orgTypeRule(orgType).theme;
}

export function engineTheme(orgType: OrgTypeId, theme: ThemeId): string {
  const id = resolveTheme(orgType, theme);
  return THEMES.find((t) => t.id === id)?.engine ?? "city";
}
