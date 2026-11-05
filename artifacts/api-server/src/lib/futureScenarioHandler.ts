/**
 * Anthropic call + JSON extraction for the future-scenario route.
 * Server-only — relies on `fetch` and `process.env.ANTHROPIC_API_KEY`.
 * Mirrors the contract documented in
 *   artifacts/digital-twin/src/lib/futureScenarioSchema.ts
 * but does NOT depend on it (keeps the api-server package free of cross-app
 * imports). Validation is also re-done client-side after the response lands.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1800;
const TIMEOUT_MS = 25_000; // Anthropic call budget. Smoke-tests succeed in ~8s; full Twin payloads (11 nodes + 10 edges + scenario text + answers context) routinely take 12–20s, so 9s was too tight.

const SYSTEM_PROMPT = `You generate a structured JSON description of a near-future scenario for an organisational systems map.
RULES:
- Return JSON ONLY. No markdown fences. No preamble. No trailing text.
- Match the schema exactly. No extra keys.
- Keep summary to 1 sentence. Avoid long paragraphs anywhere.
- Bound: assumptions ≤ 6, earlyWarningSignals ≤ 6 per hotspot.
- Do NOT invent confidential or named details. If the user mentions specifics, generalise. Add an entry to "assumptions" when uncertain.
- Map effect ids MUST be drawn ONLY from the provided node/edge ids — never invent new ids.
- EVERY hotspot MUST set "showOnMapNodeIds" (at least one id) and may also set "showOnMapEdgeIds".
- EVERY predictedBottleneck MUST set "showOnMapNodeIds" (at least one id) and may also set "showOnMapEdgeIds".
- These id arrays are what wires the popup content to the clicked node/edge — without them the UI cannot show your insights when the user inspects a node.`;

const SCHEMA_BLOCK = `{
  "title": "string (short)",
  "summary": "string (1 sentence)",
  "assumptions": ["string", "…"],
  "levers": {
    "budgetCutPct": "number 0..50 (optional)",
    "deadlineWeeks": "number 1..52 (optional)",
    "governanceTightening": "boolean (optional)",
    "supplierShock": "boolean (optional)",
    "capacityDebt": "boolean (optional)",
    "dataIntegrationPush": "boolean (optional)",
    "auditScrutinyIncrease": "boolean (optional)",
    "marketShock": "demand_drop|demand_spike|price_volatility|competitor_move|null (optional)",
    "regulatoryShift": "tightening|relaxation|null (optional)",
    "environmentEvent": "heatwave|flooding|drought|storm|null (optional)"
  },
  "mapEffects": {
    "highlightNodeIds": ["nodeId", "…"],
    "highlightEdgeIds": ["edgeId", "…"],
    "bottleneckNodeIds": ["nodeId", "…"]
  },
  "hotspots": [{
    "id": "string",
    "title": "string",
    "severity": "high|medium|low",
    "likelihood": "high|medium|low",
    "confidence": "high|medium|low",
    "cadence": "weekly|biweekly|monthly (optional)",
    "ownerHint": "string (optional)",
    "earlyWarningSignals": ["string", "…"],
    "firstMove48h": "string (1 line)",
    "secondMove2w": "string (1 line, optional)",
    "showOnMapNodeIds": ["nodeId", "…"],
    "showOnMapEdgeIds": ["edgeId", "…"]
  }],
  "predictedBottlenecks": [{
    "id": "string",
    "title": "string (1 line)",
    "why": "string (≤ 2 sentences)",
    "firstMove": "string (1 line)",
    "proof30d": "string (1 line)",
    "showOnMapNodeIds": ["nodeId", "…"],
    "showOnMapEdgeIds": ["edgeId", "…"]
  }]
}`;

export interface FutureScenarioRequest {
  scenarioText: string;
  answersSummary?: unknown;
  selectedPathwayId?: string;
  selectedPathwayName?: string;
  mapSummary: {
    nodes: Array<{ id: string; label: string; kind?: string }>;
    edges: Array<{ id: string; source: string; target: string; label?: string }>;
  };
  /** Optional client-supplied external context (market + environment). */
  externalContext?: Record<string, unknown>;
}

export type FutureScenarioServerResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

function buildUserPrompt(req: FutureScenarioRequest): string {
  const ans = req.answersSummary
    ? JSON.stringify(req.answersSummary).slice(0, 1200)
    : "(none)";
  const ext = req.externalContext
    ? JSON.stringify(req.externalContext).slice(0, 400)
    : "(none)";
  const pathway = req.selectedPathwayName
    ? `${req.selectedPathwayName} (${req.selectedPathwayId ?? ""})`
    : "(none)";
  // Trim node/edge labels to keep the prompt compact.
  const nodes = req.mapSummary.nodes
    .slice(0, 60)
    .map((n) => `${n.id}\t${(n.kind ?? "").slice(0, 16)}\t${n.label.slice(0, 60)}`)
    .join("\n");
  const edges = req.mapSummary.edges
    .slice(0, 80)
    .map((e) => `${e.id}\t${e.source}->${e.target}\t${(e.label ?? "").slice(0, 30)}`)
    .join("\n");
  return `Scenario described by user:
${(req.scenarioText ?? "").slice(0, 1500)}

Active pathway: ${pathway}
Answers summary: ${ans}
External context (market + environment, may be empty): ${ext}

Systems map nodes (id\tkind\tlabel):
${nodes}

Systems map edges (id\tsrc->tgt\tlabel):
${edges}

When the external context indicates market or environmental pressure, set the appropriate
levers.marketShock / levers.regulatoryShift / levers.environmentEvent and let those flow
through to hotspots / predicted bottlenecks. If a synthetic "ext-market" or "ext-env" node
appears in the map, prefer it as an anchor for highlightNodeIds when relevant.

Return JSON matching this schema exactly:
${SCHEMA_BLOCK}`;
}

function stripFences(s: string): string {
  // Some models return fenced JSON despite "no markdown" — strip if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fence ? fence[1] : s).trim();
}

function parseFirstJsonObject(text: string): unknown {
  const cleaned = stripFences(text);
  // Try whole-string first
  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through */
  }
  // Try to locate the outermost {...}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON object found");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ─── Minimal schema validator (mirror of the client-side validator) ────────
// Duplicated intentionally — the api-server is a separate workspace package
// and can't import from artifacts/digital-twin without monorepo wiring. The
// client re-validates after the response, so the two are kept in sync via
// the same error-code surface.

function isStr(v: unknown): v is string { return typeof v === "string"; }
function isNonEmptyStr(v: unknown): v is string { return typeof v === "string" && v.trim().length > 0; }
function isStrArr(v: unknown): v is string[] { return Array.isArray(v) && v.every((x) => typeof x === "string"); }

const SEV = new Set(["high", "medium", "low"]);

function validateMinimalSchema(raw: unknown): { ok: true } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "root" };
  const r = raw as Record<string, unknown>;
  if (!isNonEmptyStr(r.title)) return { ok: false, reason: "title" };
  if (!isNonEmptyStr(r.summary)) return { ok: false, reason: "summary" };
  if (!isStrArr(r.assumptions) || (r.assumptions as string[]).length > 6) return { ok: false, reason: "assumptions" };
  if (!r.levers || typeof r.levers !== "object") return { ok: false, reason: "levers" };
  if (!r.mapEffects || typeof r.mapEffects !== "object") return { ok: false, reason: "mapEffects" };
  const M = r.mapEffects as Record<string, unknown>;
  if (!isStrArr(M.highlightNodeIds)) return { ok: false, reason: "mapEffects.highlightNodeIds" };
  if (!isStrArr(M.highlightEdgeIds)) return { ok: false, reason: "mapEffects.highlightEdgeIds" };
  if (!isStrArr(M.bottleneckNodeIds)) return { ok: false, reason: "mapEffects.bottleneckNodeIds" };
  if (!Array.isArray(r.hotspots)) return { ok: false, reason: "hotspots" };
  for (const h of r.hotspots) {
    const H = (h as Record<string, unknown>) ?? {};
    if (!isNonEmptyStr(H.id) || !isNonEmptyStr(H.title) || !isNonEmptyStr(H.firstMove48h)) {
      return { ok: false, reason: "hotspot.required" };
    }
    if (!SEV.has(String(H.severity)) || !SEV.has(String(H.likelihood)) || !SEV.has(String(H.confidence))) {
      return { ok: false, reason: "hotspot.sev" };
    }
    if (!isStrArr(H.earlyWarningSignals) || (H.earlyWarningSignals as string[]).length > 6) {
      return { ok: false, reason: "hotspot.signals" };
    }
  }
  if (!Array.isArray(r.predictedBottlenecks)) return { ok: false, reason: "predictedBottlenecks" };
  for (const b of r.predictedBottlenecks) {
    const B = (b as Record<string, unknown>) ?? {};
    if (!isNonEmptyStr(B.id) || !isNonEmptyStr(B.title) || !isNonEmptyStr(B.why)) return { ok: false, reason: "bottleneck.required" };
    if (!isNonEmptyStr(B.firstMove) || !isNonEmptyStr(B.proof30d)) return { ok: false, reason: "bottleneck.required" };
  }
  return { ok: true };
}

/**
 * Calls Anthropic, parses the first JSON object, validates against the schema,
 * and returns the validated raw value. Never logs `scenarioText`.
 *
 * Error codes returned in `{ok:false, error}`:
 *   - "missing_api_key"
 *   - "scenario_text_required"
 *   - "anthropic_http_<status>"
 *   - "timeout"
 *   - "empty_response"
 *   - "invalid_json"
 *   - "schema_validation_failed:<short>"
 *   - "fetch_failed"
 */
export async function callFutureScenario(
  req: FutureScenarioRequest,
): Promise<FutureScenarioServerResponse> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  const apiKeyPresent = !!apiKey;

  if (!apiKey) {
    // Safe log: no secrets, no user text — just structured fact.
    console.warn("[future-scenario] error=missing_api_key apiKeyPresent=false");
    return { ok: false, error: "missing_api_key" };
  }
  if (!isNonEmptyStr(req.scenarioText)) {
    console.warn(`[future-scenario] error=scenario_text_required apiKeyPresent=${apiKeyPresent}`);
    return { ok: false, error: "scenario_text_required" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const userPrompt = buildUserPrompt(req);
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const code = `anthropic_http_${response.status}`;
      console.warn(`[future-scenario] error=${code} apiKeyPresent=${apiKeyPresent}`);
      return { ok: false, error: code };
    }

    const data = (await response.json()) as { content?: Array<{ type: string; text: string }> };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";
    if (!text) {
      console.warn(`[future-scenario] error=empty_response apiKeyPresent=${apiKeyPresent}`);
      return { ok: false, error: "empty_response" };
    }

    let parsed: unknown;
    try {
      parsed = parseFirstJsonObject(text);
    } catch {
      console.warn(`[future-scenario] error=invalid_json apiKeyPresent=${apiKeyPresent}`);
      return { ok: false, error: "invalid_json" };
    }

    const v = validateMinimalSchema(parsed);
    if (!v.ok) {
      const code = `schema_validation_failed:${v.reason}`;
      console.warn(`[future-scenario] error=${code} apiKeyPresent=${apiKeyPresent}`);
      return { ok: false, error: code };
    }

    return { ok: true, result: parsed };
  } catch (err) {
    const isAbort = err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message));
    const code = isAbort ? "timeout" : "fetch_failed";
    console.warn(`[future-scenario] error=${code} apiKeyPresent=${apiKeyPresent}`);
    return { ok: false, error: code };
  } finally {
    clearTimeout(timer);
  }
}
