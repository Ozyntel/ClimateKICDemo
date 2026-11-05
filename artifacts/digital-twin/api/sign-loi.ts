/**
 * Vercel serverless function entry for the LOI signing endpoint.
 *
 * The actual implementation lives in `src/app/api/sign-loi/route.ts`
 * (Next.js App Router format with a Web-standard `POST(Request) => Response`
 * signature). This shim adapts between Vercel's classic Node-style runtime
 * `(req, res) => void` and the Web-standard handler so the business logic
 * doesn't need to know what runtime style the platform happens to expose.
 *
 * Earlier attempts to return a Promise<Response> from the default export
 * caused every request to hang to the function's maxDuration limit:
 * Vercel's Node runtime waits for `res.end()` to be called, not for a
 * Promise resolution, and the returned Response object never reached the
 * client. The adapter below converts the Node request into a Web
 * `Request`, calls POST(), then drains the `Response` body back into the
 * Node `res` so the runtime knows the function is done.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { POST } from "../src/app/api/sign-loi/route.js";

export const config = { maxDuration: 30 };

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
    // Reconstruct the body Vercel parsed for us. @vercel/node parses JSON
    // bodies onto req.body automatically — we just re-serialise so the
    // Web Request looks like a plain JSON POST to the Web handler.
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
    // Last-ditch safety net — never let an uncaught error in the adapter
    // leave the request hanging until maxDuration. The underlying POST
    // already catches its own errors and returns a typed JSON response;
    // this only fires if the adapter itself blew up.
    console.warn(
      "[sign-loi] adapter error:",
      err instanceof Error ? err.message : "unknown",
    );
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "adapter_failed" }));
  }
}
