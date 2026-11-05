// Post-build guard: the production bundle must not contain the development
// visual preview, its synthetic sample data, the dev-only password bypass, the removed fictional cases or
// their old shared storage keys. Run after `pnpm run build`.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "..", "dist", "public");
if (!fs.existsSync(dir)) { console.error("No build found at " + dir + " — run the build first."); process.exit(2); }
const files = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|html|css)$/.test(e.name) && files.push(path.join(d, e.name))));
walk(dir);

const BANNED = [
  "Visual preview — illustrative data", "SYNTHETIC SAMPLE DATA", "Sample organisation", "SAMPLE-1", "SCENE_AFTER_PATCH",
  // Development-only bypass of the /prepare password gate and the dev sample lead.
  "Continue without a password", "SYNTHETIC SAMPLE —", "Load synthetic example",
  "FibreLoop", "Fibrell", "Lindenhaven", "Alder Home", "CommonGround", "St. Elin", "Nordlicht", "Paneloop", "Rooftide", "Shadewell",
  "Eindhoven", "Eastbank", "Poznań", "German customer", "OZY_WORLD_CASES", "ozy-world-case", "ozy-applied-sources", "ozy-pathway-pick",
];
const hits = [];
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  for (const b of BANNED) if (t.includes(b)) hits.push(`${path.relative(dir, f)}: ${b}`);
}
if (hits.length) { console.error("Forbidden content in the production bundle:\n" + hits.join("\n")); process.exit(1); }
console.log(`check:dist OK — ${files.length} files scanned, no preview data, removed cases or old storage keys.`);
