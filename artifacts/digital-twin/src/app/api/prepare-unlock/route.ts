/**
 * Password check for the team-only /prepare editor.
 *
 *   POST /api/prepare-unlock   body → { password: string }
 *     200 { ok: true }                         password matches PREPARE_PASSWORD
 *     401 { ok: false, error: "wrong_password" }
 *     400 { ok: false, error: "invalid_body" }
 *     503 { ok: false, error: "not_configured" | "password_too_short" }
 *
 * The password lives only in the server environment (PREPARE_PASSWORD), never
 * in the browser bundle. When it is missing or too short the check fails
 * closed, so the editor stays locked.
 *
 * What this protects: casual access to the editor UI (e.g. someone at the
 * presenting laptop opening /prepare). What it does not: lead cases are still
 * stored unencrypted in that browser's localStorage, and the unlocked state is
 * a per-tab sessionStorage flag. There is no lockout after repeated attempts —
 * only a short delay per wrong password — so use a long passphrase.
 *
 * Runs on Vercel through the `api/prepare-unlock.ts` shim; the Express mirror
 * in `artifacts/api-server/src/routes/prepareUnlock.ts` serves local dev.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 10;
const WRONG_PASSWORD_DELAY_MS = 600;

function digest(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

/** Constant-time comparison (both sides hashed to equal length first). */
export function passwordMatches(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

const noStore = { "cache-control": "no-store" };

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.PREPARE_PASSWORD ?? "";
  if (!expected) {
    console.warn("[prepare-unlock] error=not_configured");
    return Response.json({ ok: false, error: "not_configured" }, { status: 503, headers: noStore });
  }
  if (expected.length < MIN_PASSWORD_LENGTH) {
    console.warn("[prepare-unlock] error=password_too_short");
    return Response.json({ ok: false, error: "password_too_short" }, { status: 503, headers: noStore });
  }

  let password: unknown;
  try {
    password = ((await req.json()) as { password?: unknown })?.password;
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400, headers: noStore });
  }
  if (typeof password !== "string" || password.length === 0 || password.length > 500) {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400, headers: noStore });
  }

  if (!passwordMatches(password, expected)) {
    await new Promise((r) => setTimeout(r, WRONG_PASSWORD_DELAY_MS));
    console.warn("[prepare-unlock] result=wrong_password");
    return Response.json({ ok: false, error: "wrong_password" }, { status: 401, headers: noStore });
  }
  return Response.json({ ok: true }, { headers: noStore });
}
