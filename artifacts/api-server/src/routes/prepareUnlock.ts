/**
 * Local-dev Express mirror of
 * `artifacts/digital-twin/src/app/api/prepare-unlock/route.ts` — keep in sync.
 *
 *   POST /api/prepare-unlock   body → { password }
 *     200 { ok: true } | 401 wrong_password | 400 invalid_body
 *     503 not_configured | password_too_short   (fails closed)
 *
 * The password comes from the PREPARE_PASSWORD environment variable only.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";

const MIN_PASSWORD_LENGTH = 10;
const WRONG_PASSWORD_DELAY_MS = 600;

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

const router: IRouter = Router();

router.post("/prepare-unlock", async (req: Request, res: Response) => {
  res.setHeader("cache-control", "no-store");
  const expected = process.env.PREPARE_PASSWORD ?? "";
  if (!expected) return res.status(503).json({ ok: false, error: "not_configured" });
  if (expected.length < MIN_PASSWORD_LENGTH) return res.status(503).json({ ok: false, error: "password_too_short" });

  const password = (req.body as { password?: unknown } | undefined)?.password;
  if (typeof password !== "string" || password.length === 0 || password.length > 500) {
    return res.status(400).json({ ok: false, error: "invalid_body" });
  }
  if (!timingSafeEqual(digest(password), digest(expected))) {
    await new Promise((r) => setTimeout(r, WRONG_PASSWORD_DELAY_MS));
    return res.status(401).json({ ok: false, error: "wrong_password" });
  }
  return res.json({ ok: true });
});

export default router;
