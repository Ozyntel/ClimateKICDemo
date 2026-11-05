import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/models", async (_req: Request, res: Response) => {
  const apiKey = process.env["ANTHROPIC_API_KEY"];

  if (!apiKey) {
    return res.json({ ok: false, error: "ANTHROPIC_API_KEY not configured on server" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    });

    const body = await response.json();

    if (!response.ok) {
      return res.json({ ok: false, status: response.status, body });
    }

    return res.json({ ok: true, status: response.status, body });
  } catch (err) {
    return res.json({
      ok: false,
      error: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

export default router;
