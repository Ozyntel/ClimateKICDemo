import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

const MAX_INPUT_CHARS = 20_000;
const MAX_TOKENS = 1500;
const CALL_TIMEOUT_MS = 25_000;
const MODEL_PRIMARY = "claude-sonnet-4-6";
const MODEL_FALLBACK = "claude-sonnet-4-20250514";

const LIMIT_ENTITIES = 8;
const LIMIT_GAPS = 5;
const LIMIT_SIGNALS = 5;
const LIMIT_EVIDENCE_CHARS = 160;
const LIMIT_SUMMARY_CHARS = 600;

const VALID_KINDS = ["team", "role", "process", "initiative", "constraint"];
const VALID_CONF = ["High", "Medium", "Low"];

const SYSTEM_PROMPT = `You are an expert organisational analyst. Output NDJSON: one JSON object per line, nothing else.

RULES — any violation causes lines to be silently discarded:
- Every line must be a single complete JSON object on one line. No multi-line objects.
- No markdown fences, no preamble, no postamble, no blank lines between records.
- Output at most ${LIMIT_ENTITIES} entity lines, ${LIMIT_GAPS} gap lines, ${LIMIT_SIGNALS} signal lines, 1 summary line.
- Each "evidence" value must be a verbatim quote of at most ${LIMIT_EVIDENCE_CHARS} characters.
- Only extract facts directly stated in the provided text. Never guess or hallucinate.`;

function buildUserPrompt(
  orgName: string,
  questionnaireSummary: string,
  artefactText: string,
): string {
  return `Organisation: ${orgName}
Background context: ${questionnaireSummary}

ARTEFACT TEXT TO ANALYSE:
---
${artefactText}
---

Output one NDJSON record per line using exactly these shapes (no other fields, no blank lines):

Entity:  {"type":"entity","id":"e1","label":"name","kind":"team|role|process|initiative|constraint","evidence":"verbatim ≤${LIMIT_EVIDENCE_CHARS} chars","confidence":"High|Medium|Low"}
Gap:     {"type":"gap","id":"g1","text":"description","evidence":"optional verbatim ≤${LIMIT_EVIDENCE_CHARS} chars"}
Signal:  {"type":"signal","id":"s1","name":"signal name","whyItMatters":"why this matters"}
Summary: {"type":"summary","text":"3-5 bullet points ≤${LIMIT_SUMMARY_CHARS} chars total, each starting with •"}

Output the summary record last. Each line must be valid JSON parseable by JSON.parse.`;
}

function clampEvidence(s: string): string {
  return s.length > LIMIT_EVIDENCE_CHARS ? s.slice(0, LIMIT_EVIDENCE_CHARS - 1) + "…" : s;
}

interface NdjsonEntity {
  type: "entity";
  id: string;
  label: string;
  kind: string;
  evidence: string;
  confidence: string;
}
interface NdjsonGap {
  type: "gap";
  id: string;
  text: string;
  evidence?: string;
}
interface NdjsonSignal {
  type: "signal";
  id: string;
  name: string;
  whyItMatters: string;
}
interface NdjsonSummary {
  type: "summary";
  text: string;
}
type NdjsonRecord = NdjsonEntity | NdjsonGap | NdjsonSignal | NdjsonSummary;

function parseNdjson(
  raw: string,
  model: string,
): { ok: true; extraction: object } | { ok: false; error: string } {
  const lines = raw.split("\n");
  const entities: NdjsonEntity[] = [];
  const gaps: NdjsonGap[] = [];
  const signals: NdjsonSignal[] = [];
  let summaryText = "";
  let linesAttempted = 0;
  let linesFailed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) continue;
    linesAttempted++;

    let rec: NdjsonRecord;
    try {
      rec = JSON.parse(trimmed) as NdjsonRecord;
    } catch {
      linesFailed++;
      continue;
    }

    if (rec.type === "entity" && entities.length < LIMIT_ENTITIES) {
      entities.push({
        type: "entity",
        id: String(rec.id ?? `e${entities.length + 1}`),
        label: String(rec.label ?? ""),
        kind: VALID_KINDS.includes(String(rec.kind)) ? rec.kind : "process",
        evidence: clampEvidence(String(rec.evidence ?? "")),
        confidence: VALID_CONF.includes(String(rec.confidence)) ? rec.confidence : "Medium",
      });
    } else if (rec.type === "gap" && gaps.length < LIMIT_GAPS) {
      const g = rec as NdjsonGap;
      gaps.push({
        type: "gap",
        id: String(g.id ?? `g${gaps.length + 1}`),
        text: String(g.text ?? ""),
        evidence: g.evidence ? clampEvidence(String(g.evidence)) : undefined,
      });
    } else if (rec.type === "signal" && signals.length < LIMIT_SIGNALS) {
      const s = rec as NdjsonSignal;
      signals.push({
        type: "signal",
        id: String(s.id ?? `s${signals.length + 1}`),
        name: String(s.name ?? ""),
        whyItMatters: String(s.whyItMatters ?? ""),
      });
    } else if (rec.type === "summary" && !summaryText) {
      const raw = String((rec as NdjsonSummary).text ?? "");
      summaryText = raw.length > LIMIT_SUMMARY_CHARS ? raw.slice(0, LIMIT_SUMMARY_CHARS - 1) + "…" : raw;
    }
  }

  if (linesFailed > 0 || linesAttempted === 0) {
    console.error(
      `[extract] NDJSON parse: ${linesAttempted} lines attempted, ${linesFailed} failed. ` +
      `entities=${entities.length} gaps=${gaps.length} signals=${signals.length}. ` +
      `rawLen=${raw.length}, endsWithNewline=${raw.endsWith("\n")}`,
    );
  }

  if (entities.length < 2) {
    return { ok: false, error: "Extraction incomplete" };
  }

  return {
    ok: true,
    extraction: {
      entities,
      gapsContradictions: gaps,
      signals,
      summary: summaryText,
      rawModel: model,
    },
  };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ ok: true; text: string } | { ok: false; notFound: boolean; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const isNotFound =
        response.status === 404 ||
        errText.includes("not_found_error") ||
        errText.includes("model_not_found");
      return {
        ok: false,
        notFound: isNotFound,
        error: `Anthropic API returned ${response.status}: ${errText.slice(0, 300)}`,
      };
    }

    const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
    const textBlock = data.content?.find((b) => b.type === "text");
    return { ok: true, text: textBlock?.text ?? "" };
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
    return {
      ok: false,
      notFound: false,
      error: isTimeout ? "LLM timeout" : `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

router.post("/extract", async (req: Request, res: Response) => {
  const apiKey = process.env["ANTHROPIC_API_KEY"];

  if (!apiKey) {
    return res.status(200).json({ ok: false, error: "ANTHROPIC_API_KEY not configured on server" });
  }

  const { orgName, questionnaireSummary, artefactText } = req.body as Record<string, unknown>;

  if (!artefactText || typeof artefactText !== "string" || artefactText.trim().length === 0) {
    return res.status(400).json({ ok: false, error: "artefactText is required and must be non-empty" });
  }

  const userContent = buildUserPrompt(
    typeof orgName === "string" ? orgName : "",
    typeof questionnaireSummary === "string" ? questionnaireSummary : "",
    artefactText.slice(0, MAX_INPUT_CHARS),
  );

  try {
    let result = await callAnthropic(apiKey, MODEL_PRIMARY, [
      { role: "user", content: userContent },
    ]);
    let modelUsed = MODEL_PRIMARY;

    if (!result.ok && result.notFound) {
      result = await callAnthropic(apiKey, MODEL_FALLBACK, [
        { role: "user", content: userContent },
      ]);
      modelUsed = MODEL_FALLBACK;
    }

    if (!result.ok) {
      return res.status(200).json({ ok: false, error: result.error });
    }

    const parsed = parseNdjson(result.text, modelUsed);
    if (!parsed.ok) {
      return res.status(200).json({ ok: false, error: parsed.error });
    }

    return res.json({ ok: true, extraction: parsed.extraction });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: `LLM request failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

export default router;
