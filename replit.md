# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/digital-twin run dev` — run digital twin app locally

## Artifacts

### Digital Twin App (`artifacts/digital-twin`)

> The current customer-facing flow is a blank, lead-tailored construct — see `artifacts/digital-twin/docs/LEAD-DEMO.md` and `artifacts/digital-twin/README.md`. The notes below describe the original v1 flow for history only: its routes (`/profile`, `/map`, `/pocket`, `/demo` …) and most of the files named below were removed in November 2026 and survive only in git history.

A React + Vite (TypeScript + Tailwind) SPA — Digital Twin for Organisations (DTO) pilot. 7-step flow, fully localStorage-persisted, no backend.

**Routes (step order):**
- `/questionnaire` — Step 1: Org basics, transformation theme, where stalls, stakeholders (3–8), constraint checkboxes. Demo load button (Nordlicht Materials). CTA → generates profile + twin.
- `/profile` — Step 2: Editable textarea of auto-generated profile summary.
- `/twin` — Step 3: Hotspot cards (High/Medium/Low severity), missing signals, system map preview. CTAs: Full map, Upload artefacts, Skip to diagnostics.
- `/map` — Step 4: SVG circular graph coloured by node kind, node table with summaries, edge table.
- `/upload` — Step 5: Drag-and-drop up to 3 files (metadata only). CTA → generates diagnostics + pathways.
- `/diagnostics` — Step 6: 4 expandable sections (Baseline 3 text blocks, Hypotheses with falsifiers, Risk hotspots with earlyWarning/firstMove, Interventions with type/effort/impact). Collapsible assumptions + data gaps panel.
- `/pathways` — Step 7: 3 sustainability-lever pathway cards (goal-driven, 90-day roadmap format) with intent, workstreams, key decisions, resistance, and proof plan. IDs: energy-operations / materials-circularity / supplier-scope3 / csrd-audit-ready (top 3 chosen by keyword scoring on transformation goal). Select stores `selectedPathwayId`.

**Key files:**
- `src/lib/types.ts` — All domain types per spec: `Questionnaire`, `Twin`, `Graph`, `Diagnostics`, `Pathway`, `Project`, `ArtefactMeta`, etc.
- `src/lib/projectStore.ts` — `loadProject()`, `saveProject()`, `updateProject()` using key `dto_project_v0`
- `src/lib/project.ts` — Compatibility shim re-exporting from `projectStore.ts`
- `src/lib/stubAi.ts` — Deterministic stubs: `generateProfileSummary(q)`, `generateTwin(q)`, `generateDiagnostics(project)`, `generatePathways(project, diagnostics)`. Interventions pool includes sustainability-specific items (i-energy-metering, i-capex-memo, i-supplier-pack, i-scope3-registry, i-circularity-kpi, i-supplier-triage). Pathway domain inference uses keyword matching on `transformationGoal` + extraction.
- `src/lib/demo.ts` — Nordlicht Materials GmbH demo questionnaire (new field schema)
- `src/components/StepNav.tsx` — Sticky numbered step navigation with active/completed state
- `src/pages/*.tsx` — One file per route, all with guardrails if earlier steps are missing

**Persistence:** All data stored in browser `localStorage` under `dto_project_v0` as a single `Project` JSON. No auth, no database.

**v1.1 LLM Extraction + Twin Versioning:**
- `/upload` page has a paste-text box + "Extract with AI (v1.1)" button → calls `/api/extract` (proxied to `localhost:8080`). Requires `OPENAI_API_KEY` secret; falls back gracefully to stub.
- Successful extraction produces `project.twinV2` via `updateTwinWithExtraction()` (deterministic mapping: entities → nodes, constraints → hotspots, gaps → hotspots/signals, co-occurrence → edges). Sets `project.twinActiveVersion = "v2"`.
- `/twin` and `/map` show a v1/v2 toggle (pill buttons) when `twinV2` exists. New nodes/edges highlighted with indigo border + Sparkles icon.
- `/diagnostics` shows expandable "What we extracted" panel (entities, gaps, signals with evidence snippets).
- Diagnostics generation uses the active twin version (`twinV2` if `twinActiveVersion === "v2"`).
- All fallbacks: if extraction fails, twin stays on v1, no toggle appears, amber banner shown.

**Key new files:**
- `src/lib/llmClient.ts` — client-side fetch wrapper calling `/api/extract`
- `src/lib/twinFromExtraction.ts` — deterministic `updateTwinWithExtraction()` function
- `artifacts/api-server/src/routes/extract.ts` — POST /api/extract, calls OpenAI gpt-4o-mini

**New Project fields:** `twinV2`, `twinActiveVersion`, `artefactText`, `extraction`, `llmMode`

**v1.2 Session Mode + Multi-stakeholder Perspectives:**
- 5-person synthetic respondent pool (Amina/Ops, Jonas/Finance, Lea/Procurement, Marco/HR, Sofie/IT) with viewpoints on every alignment item.
- `/twin` alignment cards have "Show perspectives" toggle showing per-respondent stance, reason, and evidence.
- `/map` alignment edges are clickable (midpoint dot, wide hit area) → "Who says what and why" detail panel.
- **Session mode** — guided 6-step demo walk-through:
  - `/twin`: "Start session" button (indigo, top-right) starts a guided session stored in `project.session`.
  - Dark indigo `SessionWidget` banner shows at the top of all hub pages with 6 step pills + "End session".
  - Step order: **1 Twin review → 2 Upload → 3 Diagnostics → 4 Pathways → 5 Map bottlenecks → 6 DTO Brief**.
  - Each page shows a session CTA block (data-testid="session-{step}-cta") with a "Next: …" button.
  - `/upload` CTA: warns "Continuing with limited evidence" when no evidence; runs diagnostics generation.
  - `/diagnostics` CTA: calls existing `handleGoToPathways()` which generates pathways if needed, then advances.
  - `/pathways` CTA: disabled until a pathway is selected; then enables "Next: View bottlenecks".
  - `/map` auto-expands the bottleneck panel and scrolls to it when `session.step === "map"`.
  - `/brief`: "Finish session" button in toolbar marks session done and shows green "Session complete" badge.
  - "End session" → confirmation → "Reset session" clears `project.session` from storage.

**Key new files (session mode):**
- `src/lib/session.ts` — `startSession()`, `endSession()`, `resetSession()`, `advanceSession()`, `getSession()`
- `src/components/SessionWidget.tsx` — Progress banner with step pills, End session + confirmation flow

**New Project fields:** `session` (type `Session`: `active`, `step: "twin"|"upload"|"diagnostics"|"pathways"|"map"|"brief"|"done"`, `startedAt`, `ui`)

**v1.3 Twin Timeline + Model Transparency:**
- `/twin` shows a "Twin timeline" collapsible module (expanded by default) between QuickOverview and "What would change the model?".
- Vertical stepper with one entry per version (v1/v2/v3), each with a colour-coded dot (sky/indigo/purple), version badge, trigger label, timestamp, and expandable change bullets.
- Clicking any entry expands inline change bullets + a CTA to the relevant page (v1→/twin, v2→/upload, v3→/map).
- History is created at three trigger points: questionnaire submission (v1), artefact extraction (v2), pathway selection (v3).
- `ensureHistory()` backfills history for existing sessions that pre-date the feature on next `/twin` load.
- v2 entry diffs v1 vs v2 twin to produce specific change bullets (new actors, new edges, new hotspots, new data gaps).

**Key new files:**
- `src/lib/twinHistory.ts` — `recordV1History`, `recordV2History`, `recordV3History`, `ensureHistory`, `diffTwins`

**New Project fields:** `twinHistory: TwinHistoryEntry[]` (type in `types.ts`: `TwinHistoryEntry`, `TwinHistoryChange`, `HistoryChangeType`)

**v1.4 Shared SystemMapRenderer + Map View Model:**
- `/twin` System Map Preview now renders the identical full visualization as `/map` (same overlays: alignment edges, resistance warnings, asset markers) in read-only mode.
- `getMapViewModel(project, activeVersion?)` — single selector computing all map render inputs (graph, positions, alignment items, asset nodes, predicted warnings) used by both pages to prevent drift.
- `SystemMapRenderer` — shared SVG + legend component with `mode: "interactive" | "readonly"`. In readonly mode: all click handlers, cursor pointers, and hit-area elements are disabled; visual styling is identical.
- `/map` uses SystemMapRenderer in interactive mode (node/edge/alignment click-to-inspect panel).
- `/twin` preview uses SystemMapRenderer in readonly mode; clicking does nothing.
- Both pages pass `getMapViewModel` result so they cannot diverge.
- `getActiveGraph.ts` — single source of truth for v1 vs v2 graph resolution (used by getMapViewModel).

**Key new/updated files:**
- `src/lib/getMapViewModel.ts` — all map data selectors in one place
- `src/components/SystemMapRenderer.tsx` — shared SVG map + legend (interactive + readonly)
- `src/lib/getActiveGraph.ts` — graph version selector

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
