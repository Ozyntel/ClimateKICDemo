/**
 * Vercel serverless function entry for the /prepare password check.
 *
 * Same Node-runtime ↔ Web-standard adapter as `api/sign-loi.ts` — see
 * that file's header for the long version. Without this bridge every
 * request hangs until maxDuration because Vercel's Node runtime never
 * sees `res.end()` get called.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { POST } from "../src/app/api/prepare-unlock/route.js";

export const config = { maxDuration: 10 };

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return;
  }

  try {
    const bodyText =
      typeof req.body === "string"
        ? req.body
        : req.body != null
          ? JSON.stringify(req.body)
          : "";
    const host = req.headers["host"] ?? "localhost";
    const webReq = new Request(`https://${host}${req.url ?? "/"}`, {
      method: "POST",
      headers: {
        "content-type":
          (req.headers["content-type"] as string | undefined) ?? "application/json",
      },
      body: bodyText,
    });

    const webRes = await POST(webReq);

    res.statusCode = webRes.status;
    webRes.headers.forEach((value, key) => res.setHeader(key, value));
    const buf = Buffer.from(await webRes.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.warn(
      "[prepare-unlock] adapter error:",
      err instanceof Error ? err.message : "unknown",
    );
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "adapter_failed" }));
  }
}
