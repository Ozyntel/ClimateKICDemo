import { Router } from "express";
import type { Request, Response } from "express";
import { callFutureScenario, type FutureScenarioRequest } from "../lib/futureScenarioHandler";

const router = Router();

router.post("/future-scenario", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Partial<FutureScenarioRequest>;
  // Don't log scenarioText (may contain sensitive context the user pasted).
  const result = await callFutureScenario({
    scenarioText: typeof body.scenarioText === "string" ? body.scenarioText : "",
    answersSummary: body.answersSummary,
    selectedPathwayId: body.selectedPathwayId,
    selectedPathwayName: body.selectedPathwayName,
    mapSummary: body.mapSummary ?? { nodes: [], edges: [] },
    externalContext: body.externalContext,
  });
  // Always 200; client switches on `ok` and falls back deterministically.
  res.status(200).json(result);
});

export default router;
