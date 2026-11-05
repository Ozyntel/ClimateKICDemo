# Lead-specific demo — team guide

The customer-facing demo is a **blank construct**. It shows exactly one *lead case*: a single JSON document that holds everything about one organisation (intake answers, numbers, places, teams, relationships, sources, findings, pathways and what-if scenarios). Nothing case-specific lives in page code, and there is no example data to fall back on: with no case loaded, every page says **"This demo has not been prepared yet"**.

## Preparing a demo for a new lead

1. Open **`/prepare`** in the browser you'll present from and enter the **team password**. The page is team-only and not linked from the customer flow. The editor stays unlocked in that tab until you click **Lock** or close the tab.
2. Enter an internal label (e.g. "Lead — intro call, Nov") and click **New blank case**. Every field starts empty or *unknown*.
3. Work through the sections. All are optional: skip what isn't relevant, and use **Decision & intake → Hide intake sections** to omit whole intake sections.
   - **Organisation & look**: name, overview and sector. *Organisation type* picks the presentation rules (world look, building, legend). It adds no facts.
   - **Decision & intake**: the decision, objectives, time horizon, scope boundaries and intake answers.
   - **Important numbers**: value, unit, date or period, source and evidence type. An empty value is shown as *Unknown*, never 0.
   - **Places & system elements**: choose a *visual element type* from the vocabulary, its *state* and any *overlays*. A live preview appears beside each row. Attributed types (culture, trust, sentiment …) need a holder.
   - **Teams & roles**: roles, not names of people. Headcount can stay empty ("not stated").
   - **Relationships**: type, state, label, map tone, interaction frequency (thickness only when known) and differing perspectives.
   - **Sources & uploads**: id, title, date, scope, owner and source text (paste it, or load a .md or .txt file). Add the *prepared reading* and any number updates/signals the source adds when "uploaded" in the demo.
   - **Findings & assumptions**: key signals and findings with evidence type and confidence, assumptions with their basis, and missing information.
   - **Limitations & notices**: case-specific limitations. Explain privacy- or safety-driven omissions here, never as a badge. Add normative-assumption or contestation notices **in their approved wording only**.
   - **Planning ledger** (optional): caps per separate constraint (e.g. cash, specialist hours), capacity metrics (ceilings, not participation) and components (baseline + candidates). Every pathway total, headroom figure and quick-change result is *calculated* from it — never typed twice.
   - **Pathways & scenarios**: up to three pathways (bigger strategies and structural change) with illustrative timeline risks/benefits and map effects. With a planning ledger, a pathway lists its components, up to three previewable proposed actions, its trade-off and the evidence it needs, plus proposed elements / connections drawn on the map only while it is shown. There is an optional outcome estimate, always labelled as a demo assumption. Prepared what-ifs and **quick changes** (small decisions on the spot; with a planning ledger they carry ledger adjustments and list what they do *not* change — kind `stress-test` in the JSON, a historic id) go here too. A quick change works on its own (applied to the current plan) or on top of the pathway being previewed. **Impact routes** (illustrative step-by-step questions, separate from the pathways) also go here.
4. Watch **Checks** (broken references, missing holders, unlabelled values) and **What's filled in**.
5. Click **Show in the demo**, then **Open the demo →** and walk the flow.
6. Click **Export JSON** and store the file **outside this repository** (`*.ozy-lead.json` is git-ignored as a safety net).

To present on another machine, open `/prepare` there and choose **Import a lead file**. An import always becomes a new, separate case, so it can never overwrite another lead.

### Starting from a demo case (preset)

`/prepare` → **Start from a demo case** lists ready-made demonstration cases (`src/lib/lead/presets/`). Choosing one creates a **new, separate, editable case** (a fresh id, like an import). It is *not* shown in the demo until you click **Show in the demo**, so the team always reviews the prefilled onboarding first. Presets are only imported by `/prepare`; customer-facing pages read the active case like any other lead (covered by `test/isolation.test.ts`).

- **Climate KIC — growth decision (demonstration case)** (`presets/climateKic.ts`). Public organisation context plus a *synthetic* bounded planning case: four fictional partners (A–D), six cohorts, a €300,000 / 420-hour planning ledger, three pathways (Expand quickly, Phased supported growth, Strengthen first), three SYNTHETIC source documents (CK-01 to CK-03), four quick changes (move one cohort online; host a buyer demo day; monthly partner check-ins; the discussed sponsor funding arrives — all amounts invented) and four illustrative impact routes. Office locations are public; the links between offices, partners and the programme on the island map are illustrative. Its limitations say all this. It is not an account of Climate KIC's operations, plans, finances, partners or people. The arithmetic is pinned by `src/lib/lead/climateKic.test.ts`.

## Where the data lives — and what that means

| What | Where |
|---|---|
| Case content | Browser `localStorage`, key `ozy-lead:v1:case:<id>` |
| Demo progress (simulated uploads applied, chosen pathway) | `ozy-lead:v1:progress:<id>` — per case |
| List of cases / the case shown in the demo | `ozy-lead:v1:index` / `ozy-lead:v1:active` |
| Durable copy | The exported `.ozy-lead.json` file you keep |

- **This is not a server or a database.** Nothing is synced, backed up or shared between browsers or devices. Clearing site data deletes it, so export the file.
- **Password-protected editor, not encrypted data.** `/prepare` asks for the team password. The server checks it against `PREPARE_PASSWORD`, so the password is never in the page code. This keeps casual visitors, such as someone at the presenting laptop, out of the editor. It does **not** encrypt anything: cases sit in plain `localStorage`, and anyone with that device's developer tools can read them. There is no lockout after repeated attempts, only a short delay per wrong password, so use a long passphrase. This is not production-grade security.
- **Isolation between leads**: every page reads only the active case. Progress is stored per case, and the brief export, LOI and CRM context are built from the active case only. Imports get a new id. Covered by `src/lib/lead/store.test.ts` and `derive.test.ts`.

**Reset or remove a case safely**
- **Reset demo progress** clears simulated uploads and the chosen pathway. Content is kept. Do this before each presentation.
- **Delete case** permanently removes content and progress from this browser, after a confirmation. Export first if you might need it. If it was the case shown in the demo, the demo goes back to "not prepared"; it never falls back to another case.

## Setting the team password

| Where | How |
|---|---|
| Vercel (demo.ozyntel.ai) | Project → Settings → Environment Variables → add `PREPARE_PASSWORD` (at least 10 characters) for Production, and Preview if you use preview links. Vercel applies it from the next deployment. |
| Replit | Add the `PREPARE_PASSWORD` secret for the API Server. |
| Local development | Set `PREPARE_PASSWORD` for the API server. If the API server isn't running, development builds offer **Continue without a password**. Production builds never show that option, and `check:dist` verifies it. |

Until the password is set, production `/prepare` stays locked and says so. To change the password, change the variable and redeploy. Tabs that are already unlocked stay unlocked until they are closed or locked.

## What leaves the browser

Only the two forms on the wrap-up page (`/brief`) send anything, and only when the visitor submits. The main call to action is **Register your interest**. The fine print under the button says that this is done by signing a short letter of intent, non-binding apart from standard clauses such as confidentiality, and screen readers announce that text with the button.
- **LOI**: the organisation field is pre-filled with the lead's organisation name and stays editable, for example to enter the legal name. The PDF, the copy to the signer and the email to Ozyntel all name the organisation. The subject reads "New LOI signed — *organisation*", and the body adds "Demo prepared for: *lead organisation*".
- **Stay in touch**: the visitor gets a confirmation ("… on behalf of *organisation*"). Ozyntel gets "New contact request — *organisation*" with the email, the "reaching out as" choice, the sector and the chosen pathway. Replying answers the visitor directly.
- If the lead case has no organisation name, the forms send none. The emails say "organisation not named" and never use a placeholder.
- Nothing else from the case (findings, numbers, sources, notes) is sent.

## What is simulated

- **Uploads**: "Upload" on the Data management page applies a reading the team prepared in advance. No file is read or analysed, and the page says so. Re-uploading changes nothing. If two applied sources give different values for one number, both are shown as a conflict; neither is chosen.
- **What-if**: only prepared scenarios can be played. The demo does not analyse free text.
- **Pathways**: timelines, effects and any outcome % are illustrative and labelled as such. Risk is shown as a plain count of open risk spots, never as a low/medium/high band. Selecting a pathway marks it *under consideration* — never approved. Cases with a planning ledger show resource arithmetic, capacity ceilings and conditions instead of the 12-month timeline.
- **What the map shows** is driven only by the two bottom menus, which work on their own or together: **Run a quick scenario or change** (small decisions on the spot; typed text is matched to the prepared scenarios by their keywords — nothing else is analysed; a non-match says so) and **Pathways forward** (bigger strategies; click to preview, click again to clear). A quick change applies to the current plan, or on top of the previewed pathway, and each pathway card shows what is left *including* the quick change. With neither, the map shows the case plus the documents actually added. All three views — isometric **Map**, labelled **Systems** view and **List** view — and every *Read more* card read one composed state (`src/lib/lead/mapState.ts`), so they cannot disagree, and switching pathway or scenario leaves nothing behind. **Key risks** lists what the shown pathway / scenario puts at risk first (red on the map), then the case's own signals.
- **Systems view** fills the screen: scroll or pinch to zoom around the pointer, drag to pan, or use − / + / fit. A drag never counts as a click. Map and Systems views have a full-screen button where the browser supports it.
- **Islands look**: with the *Portfolio islands* world look, elements can choose an inner or outer **ring** and a **building** (including city-style offices such as `city-amsterdam`, `city-london`); the organisation can have its own building. Every connection between two islands is drawn as a faint dashed line (bowed away from the centre), so the network reads as one ecosystem; an effect on a group that is not drawn itself (e.g. *partners A–D*) shows on each drawn member. Teams become separate islands at the meso level, and each team's **role links** are drawn at the micro level (roles, not people).
- **Source documents** can also say what they change on the map (each finding with its heading or row, adding overlays such as *pending* or *missing evidence* — never resolving a condition) and state planning figures, which are cross-checked against the ledger (match or conflict, never added). Re-uploading changes nothing.

## The visual vocabulary

Defined in `src/lib/visuals/registry.ts` (from the Notion "Demo Visual Elements" page) and drawn by `src/components/visuals/`:

- **Base element** = a glyph per element type (83 types across the five categories).
- **State** = a reusable *treatment* (solid / dashed / dotted / hatched outline, fill level, counted marks, corner badge, tone). Every element has an **Unknown** state: grey, dashed, "?", never green.
- **Overlays** (16): possible risk ≠ active problem (flame metaphor) ≠ literal fire, plus delay, pending (not confirmed), blocked, missing evidence, different accounts, stale and others. There is deliberately no privacy-omission badge.
- **Connections** (8 types): thickness only when frequency is known; dashed means proposed/uncertain; barrier means blocked.
- **Evidence tags** (observed / stakeholder view / assumption / illustrative) and a **confidence meter** that never shares a channel with severity.
- **Fixed "Limitations of this baseline" section**: shown on Onboarding, Data management, the brief and its export.

### Visual preview (development only)

```bash
pnpm demo                                          # on your own computer, from the repository root
pnpm --filter @workspace/digital-twin run dev   # Replit-style; needs PORT and BASE_PATH, e.g. PORT=5173 BASE_PATH=/
```

Open `http://localhost:5173/dev/visual-preview`. It uses synthetic placeholder data from `src/dev/`. The route only exists in development builds, and `pnpm --filter @workspace/digital-twin run check:dist` verifies the production bundle contains no preview data.

To click through the whole demo in a development build, open `/prepare` and choose **Continue without a password**, then **Load synthetic example (dev only)**, then **Show in the demo**. The example is a made-up manufacturer, "Sample organisation (synthetic)", defined in `src/dev/sampleLead.ts`. Production builds contain neither button nor the example, and `check:dist` verifies this.

## Checks

```bash
pnpm --filter @workspace/digital-twin run typecheck
pnpm --filter @workspace/digital-twin run test        # unit, leak/isolation, password and submission tests
pnpm --filter @workspace/digital-twin run build && pnpm --filter @workspace/digital-twin run check:dist
```

## Code map

| Area | Files |
|---|---|
| Case schema, blank case, import normalisation | `src/lib/lead/types.ts`, `blank.ts` |
| Storage, import/export, reset/delete | `src/lib/lead/store.ts` |
| Derived views (numbers after uploads, signals, brief) | `src/lib/lead/derive.ts`, `brief.ts` |
| Organisation-type presentation rules | `src/lib/lead/orgTypes.ts` |
| Case → isometric map engine | `src/lib/lead/engineCase.ts` (engine: `src/lib/worldMapEngine.ts`) |
| Map stages (baseline → evidence → pathway → scenario) | `src/lib/lead/mapState.ts`; systems view `src/components/visuals/SystemsMap.tsx`; detail cards `MapDetail.tsx` |
| Planning ledger arithmetic, quick changes, source cross-checks | `src/lib/lead/planning.ts`; views `src/components/planning/` |
| Demo presets | `src/lib/lead/presets/` |
| Checks shown in /prepare | `src/lib/lead/validate.ts` |
| Editor | `src/pages/PrepareLead.tsx`, `src/components/prepare/` |
| Team password | `src/components/prepare/PrepareGate.tsx`, `src/app/api/prepare-unlock/route.ts` (Vercel shim `api/prepare-unlock.ts`, local mirror `artifacts/api-server/src/routes/prepareUnlock.ts`) |
| LOI and contact emails | `src/app/api/sign-loi/route.ts`, `src/app/api/submit-crm/route.ts` (+ local mirrors in `artifacts/api-server/src/routes/`) |
| Visual registry and components | `src/lib/visuals/registry.ts`, `src/components/visuals/` |
| Customer pages | `src/pages/{Onboarding,Twin,DataManagement,PathwaysV2,Finish,WrapUp}.tsx` |
