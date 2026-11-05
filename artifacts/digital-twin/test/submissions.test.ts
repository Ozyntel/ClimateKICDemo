/**
 * The LOI and "Stay in touch" submissions name the organisation the demo was
 * prepared for. Runs the real route handlers with a fake mail client — no
 * email is sent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent: Array<{ to: string; subject: string; html: string; replyTo?: string }> = [];

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (args: { to: string; subject: string; html: string; replyTo?: string }) => {
        sent.push(args);
        return { data: { id: "test-" + sent.length }, error: null };
      },
    };
  },
}));

const ENV = { RESEND_API_KEY: "test-key", EMAIL_FROM: "demo@example.test", EMAIL_TO_INTERNAL: "team@example.test" };

beforeEach(() => {
  sent.length = 0;
  Object.assign(process.env, ENV);
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
});

function post(body: unknown): Request {
  return new Request("https://demo.test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("Stay in touch submission", () => {
  it("emails the team with the organisation in the subject and body, and names it in the confirmation", async () => {
    const { POST } = await import("@/app/api/submit-crm/route");
    const res = await POST(post({
      email: "visitor@example.test",
      intent: "customer",
      organisationName: "Test Organisation Alpha",
      selectedPathwayName: "Option A",
      leadContext: { organisationName: "Test Organisation Alpha", sector: "Testing", caseId: "c1" },
      conversion: "ozyntel_overview_request",
    }));
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, emailSent: true, internalSent: true });

    const internal = sent.find((m) => m.to === "team@example.test")!;
    expect(internal.subject).toBe("New contact request — Test Organisation Alpha");
    expect(internal.html).toContain("Test Organisation Alpha");
    expect(internal.html).toContain("visitor@example.test");
    expect(internal.replyTo).toBe("visitor@example.test");

    const confirmation = sent.find((m) => m.to === "visitor@example.test")!;
    expect(confirmation.html).toContain("on behalf of");
    expect(confirmation.html).toContain("Test Organisation Alpha");
  });

  it("says so plainly when no organisation name was set — never a placeholder", async () => {
    const { POST } = await import("@/app/api/submit-crm/route");
    await POST(post({ email: "visitor@example.test", intent: "other", organisationName: null, leadContext: { organisationName: null } }));
    const internal = sent.find((m) => m.to === "team@example.test")!;
    expect(internal.subject).toBe("New contact request — organisation not named");
    expect(internal.html).toContain("not set in the demo");
    expect(internal.html).not.toContain("Organisation (name not set)");
    const confirmation = sent.find((m) => m.to === "visitor@example.test")!;
    expect(confirmation.html).not.toContain("on behalf of");
  });

  it("keeps the subject on one line and escapes HTML in the organisation name", async () => {
    const { POST } = await import("@/app/api/submit-crm/route");
    await POST(post({ email: "visitor@example.test", organisationName: "Evil\r\nBcc: x@y.test <b>Org</b>" }));
    const internal = sent.find((m) => m.to === "team@example.test")!;
    expect(internal.subject).not.toMatch(/[\r\n]/);
    expect(internal.html).not.toContain("<b>Org</b>");
    expect(internal.html).toContain("&lt;b&gt;Org&lt;/b&gt;");
  });
});

describe("LOI submission", () => {
  it("names the organisation in the internal subject, body and PDF context", async () => {
    const { POST } = await import("@/app/api/sign-loi/route");
    const res = await POST(post({
      signer: { name: "Test Signer", organisation: "Test Organisation Alpha B.V.", title: null, email: "signer@example.test", jurisdiction: null, address: null },
      consent: true,
      // 1×1 transparent PNG
      signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      selectedPathwayId: null,
      selectedPathwayName: "Option A",
      signedAt: "2026-11-04T10:00:00.000Z",
      context: { organisationName: "Test Organisation Alpha", sector: "Testing", caseId: "c1" },
    }));
    const json = await res.json();
    expect(json.ok).toBe(true);
    const internal = sent.find((m) => m.to === "team@example.test")!;
    expect(internal.subject).toBe("New LOI signed — Test Organisation Alpha B.V.");
    expect(internal.html).toContain("Demo prepared for: Test Organisation Alpha");
  });
});
