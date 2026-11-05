/**
 * Server-side password check for /prepare: correct / wrong / fails closed.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { POST, passwordMatches } from "@/app/api/prepare-unlock/route";

const ROOT = path.resolve(import.meta.dirname, "..");

function post(body: unknown): Request {
  return new Request("https://demo.test/api/prepare-unlock", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

afterEach(() => { delete process.env.PREPARE_PASSWORD; });

describe("POST /api/prepare-unlock", () => {
  it("fails closed when PREPARE_PASSWORD is not set", async () => {
    const res = await POST(post({ password: "anything at all" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "not_configured" });
  });

  it("fails closed when the configured password is too short", async () => {
    process.env.PREPARE_PASSWORD = "short";
    const res = await POST(post({ password: "short" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("password_too_short");
  });

  it("accepts the right password and rejects a wrong one", async () => {
    process.env.PREPARE_PASSWORD = "correct horse battery";
    const ok = await POST(post({ password: "correct horse battery" }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    expect(ok.headers.get("cache-control")).toBe("no-store");

    const bad = await POST(post({ password: "correct horse battery " }));
    expect(bad.status).toBe(401);
    expect((await bad.json()).error).toBe("wrong_password");
  });

  it("rejects malformed bodies", async () => {
    process.env.PREPARE_PASSWORD = "correct horse battery";
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post({ password: 42 }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
  });

  it("compares in constant time over equal-length digests", () => {
    expect(passwordMatches("a", "a")).toBe(true);
    expect(passwordMatches("a", "a much longer value")).toBe(false);
  });
});

describe("the password never ships to the browser", () => {
  it("no client file reads PREPARE_PASSWORD or a VITE_ password variable", () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const clientFiles = walk(path.join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${path.sep}app${path.sep}api${path.sep}`));
    const hits = clientFiles.filter((f) => /PREPARE_PASSWORD|VITE_[A-Z_]*PASS/.test(fs.readFileSync(f, "utf8")));
    expect(hits.map((f) => path.relative(ROOT, f))).toEqual(["src/components/prepare/PrepareGate.tsx"]);
    // PrepareGate only names the variable in a message — it never reads it.
    const gate = fs.readFileSync(path.join(ROOT, "src/components/prepare/PrepareGate.tsx"), "utf8");
    expect(gate).not.toMatch(/import\.meta\.env\.[A-Z_]*PASS|process\.env/);
  });
});
