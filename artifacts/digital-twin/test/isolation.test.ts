/**
 * Leak and isolation guards.
 *
 * 1. Old fictional demo cases must not be reachable from the customer flow:
 *    walks the import graph from every customer-facing page and fails if any
 *    reachable file contains a former case name, figure, source id or the old
 *    shared localStorage keys.
 * 2. The development-only visual preview (and its synthetic data) is only
 *    referenced through the DEV-gated lazy import in App.tsx.
 * 3. Test fixtures are never imported by app code.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

const CUSTOMER_ENTRIES = ["Onboarding", "Twin", "DataManagement", "PathwaysV2", "Finish", "WrapUp", "Disclaimer", "PrepareLead"].map((p) => path.join(SRC, "pages", p + ".tsx"));

/** Names, figures and ids of the removed fictional cases, plus the old shared storage keys. */
const BANNED = [
  "FibreLoop", "Fibrell", "Lindenhaven", "Alder Home", "CommonGround", "St. Elin", "St Elin", "Nordlicht", "Paneloop", "Rooftide", "Shadewell",
  "Cellcycle", "Warmstack", "Rootwise", "Aquaround", "Verdicoat", "Pedalfreight", "Hydroforge", "Threadback", "Gridnest",
  "Eindhoven", "Riverside", "Eastbank", "Old Centre", "Poznań", "German customer", "panel maker", "€480k", "€420k", "€12M", "€2.4M",
  "FL-01", "AH-01", "LH-01", "CG-01", "HOS-01", "OZY_WORLD_CASES", "worldCases", "ozy-world-case", "ozy-applied-sources", "ozy-pathway-pick",
];

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const f = base + ext;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

function importsOf(file: string): string[] {
  const src = fs.readFileSync(file, "utf8");
  const specs = [...src.matchAll(/(?:import|export)\s[^"']*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  return specs.map((s) => resolveImport(file, s)).filter((x): x is string => !!x);
}

function reachable(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (/\.(ts|tsx)$/.test(f)) stack.push(...importsOf(f));
  }
  return seen;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

describe("customer flow cannot reach the old fictional cases", () => {
  const files = [...reachable(CUSTOMER_ENTRIES)].filter((f) => !f.endsWith(".test.ts"));

  it("walks a meaningful part of the app", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith("worldMapEngine.ts"))).toBe(true);
  });

  it("no reachable file contains old case names, figures, ids or storage keys", () => {
    const hits: string[] = [];
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      for (const b of BANNED) if (text.includes(b)) hits.push(`${path.relative(ROOT, f)}: ${b}`);
    }
    expect(hits).toEqual([]);
  });

  it("the old case data file is gone", () => {
    expect(fs.existsSync(path.join(SRC, "lib", "worldCases.ts"))).toBe(false);
  });

  it("no file anywhere in src contains them either (old routes and presets removed)", () => {
    const hits: string[] = [];
    for (const f of walk(SRC).filter((x) => /\.(ts|tsx|css)$/.test(x) && !x.endsWith(".test.ts"))) {
      const text = fs.readFileSync(f, "utf8");
      for (const b of BANNED) if (text.includes(b)) hits.push(`${path.relative(ROOT, f)}: ${b}`);
    }
    expect(hits).toEqual([]);
  });

  it("the retired routes are gone", () => {
    for (const p of ["Demo", "Pocket", "Map", "Artifact", "Profile", "ThankYou"]) expect(fs.existsSync(path.join(SRC, "pages", p + ".tsx"))).toBe(false);
    const app = fs.readFileSync(path.join(SRC, "App.tsx"), "utf8");
    for (const r of ["/demo", "/pocket", "/map", "/artifact", "/profile", "/thank-you"]) expect(app).not.toContain(`path="${r}"`);
  });
});

describe("preview and test data isolation", () => {
  const all = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));

  it("src/dev is referenced only through DEV-gated lazy imports (App.tsx, the /prepare editor)", () => {
    const refs = all.filter((f) => !f.startsWith(path.join(SRC, "dev")) && /["']@\/dev\/|["'](\.\.?\/)+dev\//.test(fs.readFileSync(f, "utf8")));
    expect(refs.map((f) => path.relative(SRC, f)).sort()).toEqual(["App.tsx", path.join("pages", "PrepareLead.tsx")]);
    const app = fs.readFileSync(path.join(SRC, "App.tsx"), "utf8");
    expect(app).toMatch(/import\.meta\.env\.DEV \? lazy\(\(\) => import\("@\/dev\/VisualPreview"\)\) : null/);
    const prep = fs.readFileSync(path.join(SRC, "pages", "PrepareLead.tsx"), "utf8");
    expect(prep).toMatch(/import\.meta\.env\.DEV \? lazy\(\(\) => import\("@\/dev\/DevSampleButton"\)\) : null/);
    // No other (static) reference to src/dev in either file.
    for (const t of [app, prep]) expect(t.match(/@\/dev\//g)?.length).toBe(1);
  });

  it("customer-facing pages never reach the preview or its sample data", () => {
    const files = [...reachable(CUSTOMER_ENTRIES.filter((f) => !f.endsWith("PrepareLead.tsx")))];
    expect(files.filter((f) => f.includes(`${path.sep}dev${path.sep}`))).toEqual([]);
  });

  it("demo presets are reachable only from the /prepare editor, never from customer pages", () => {
    const customer = [...reachable(CUSTOMER_ENTRIES.filter((f) => !f.endsWith("PrepareLead.tsx")))];
    expect(customer.filter((f) => f.includes(`${path.sep}presets${path.sep}`))).toEqual([]);
    const prep = [...reachable([path.join(SRC, "pages", "PrepareLead.tsx")])];
    expect(prep.some((f) => f.endsWith(path.join("presets", "climateKic.ts")))).toBe(true);
  });

  it("the Climate KIC preset is marked as a demonstration with synthetic planning data", () => {
    const preset = fs.readFileSync(path.join(SRC, "lib", "lead", "presets", "climateKic.ts"), "utf8");
    expect(preset).toContain("DEMONSTRATION PRESET");
    expect(preset).toContain("EVERYTHING ELSE IS SYNTHETIC");
    expect((preset.match(/SYNTHETIC DEMO DOCUMENT/g) ?? []).length).toBe(3);
    for (const b of BANNED) expect(preset).not.toContain(b);
  });

  it("app code never imports test fixtures", () => {
    const refs = all.filter((f) => !f.endsWith(".test.ts") && /fixtures|synthetic-lead/.test(fs.readFileSync(f, "utf8")));
    expect(refs.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the preview sample data is marked and contains no lead content", () => {
    const sample = fs.readFileSync(path.join(SRC, "dev", "previewSampleData.ts"), "utf8");
    expect(sample).toContain("SYNTHETIC SAMPLE DATA — VISUAL PREVIEW ONLY");
    for (const b of BANNED) expect(sample).not.toContain(b);
  });

  it("the dev sample lead is marked synthetic and contains none of the old cases", () => {
    const sample = fs.readFileSync(path.join(SRC, "dev", "sampleLead.ts"), "utf8");
    expect(sample).toContain("SYNTHETIC SAMPLE LEAD — DEVELOPMENT BUILDS ONLY");
    expect(sample).toContain("Sample organisation (synthetic)");
    for (const b of BANNED) expect(sample).not.toContain(b);
  });
});
