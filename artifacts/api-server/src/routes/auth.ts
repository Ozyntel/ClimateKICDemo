import { Router } from "express";

const router = Router();

router.post("/auth", (req, res): void => {
  const { password } = req.body as { password?: string };
  const expected = process.env.DEMO_PASSWORD;
  if (!expected) {
    res.status(503).json({ ok: false, error: "Password not configured" });
    return;
  }
  res.json({ ok: password === expected });
});

export default router;
