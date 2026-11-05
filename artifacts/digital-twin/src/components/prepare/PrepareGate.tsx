/**
 * Password gate for the team-only /prepare editor.
 *
 * The password is checked on the server (POST /api/prepare-unlock against the
 * PREPARE_PASSWORD environment variable) — it is never in this bundle. After a
 * correct password the editor stays unlocked for this browser tab only
 * (sessionStorage); "Lock" or closing the tab locks it again.
 *
 * Limits, stated plainly: this keeps casual visitors out of the editor UI. It
 * does not encrypt anything — lead cases remain readable in this browser's
 * localStorage by anyone with access to the device and developer tools.
 *
 * Production fails closed: if the check can't be reached or isn't configured,
 * the editor stays locked. Development builds only (import.meta.env.DEV) also
 * offer a "continue without a password" button, so local work and preview
 * sessions don't need the API server; production builds drop it (check:dist).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

const UNLOCK_KEY = "ozy-prepare:v1:unlocked";
const LOCK_EVENT = "ozy-prepare-lock-changed";

function readUnlocked(): boolean {
  try { return window.sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; }
}
function writeUnlocked(v: boolean) {
  try {
    if (v) window.sessionStorage.setItem(UNLOCK_KEY, "1");
    else window.sessionStorage.removeItem(UNLOCK_KEY);
  } catch { /* storage blocked — the gate simply stays per-render */ }
  window.dispatchEvent(new Event(LOCK_EVENT));
}

/** Lock the editor again (used by the "Lock" button in /prepare). */
export function lockPrepare() { writeUnlocked(false); }

type Problem = null | "wrong" | "not_configured" | "too_short" | "unreachable";

const MESSAGES: Record<Exclude<Problem, null>, string> = {
  wrong: "That password isn't right.",
  not_configured: "Password protection isn't set up on this server yet (PREPARE_PASSWORD is missing), so the editor stays locked.",
  too_short: "The team password on the server is too short (minimum 10 characters), so the editor stays locked. Set a longer one.",
  unreachable: "Couldn't reach the password check. Check the connection and try again.",
};

export function PrepareGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => setUnlocked(readUnlocked());
    window.addEventListener(LOCK_EVENT, on);
    return () => window.removeEventListener(LOCK_EVENT, on);
  }, []);
  useEffect(() => { if (!unlocked) inputRef.current?.focus(); }, [unlocked]);

  if (unlocked) return <>{children}</>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/prepare-unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && json?.ok === true) {
        setPassword("");
        writeUnlocked(true);
        return;
      }
      if (res.status === 401) setProblem("wrong");
      else if (json?.error === "not_configured") setProblem("not_configured");
      else if (json?.error === "password_too_short") setProblem("too_short");
      else setProblem("unreachable");
    } catch {
      setProblem("unreachable");
    } finally {
      setBusy(false);
    }
  }

  const devBypass = import.meta.env.DEV;

  return (
    <div className="tw-world" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#FCFBF8", color: "#221E2E", fontFamily: "var(--font-body)" }}>
      <main style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14, padding: "26px 24px", borderRadius: 20, background: "#FFFFFF", border: "1px solid #E9E2D4" }}>
        <span style={{ font: "600 12px/1 var(--font-body)", letterSpacing: "0.08em", textTransform: "uppercase", color: "#8E869C" }}>Team only</span>
        <h1 style={{ margin: 0, font: "700 24px/1.2 var(--font-display)", letterSpacing: "-0.01em" }}>Prepare a lead demo</h1>
        <p style={{ margin: 0, font: "400 14px/1.5 var(--font-body)", color: "#453E54" }}>
          Enter the team password to open the editor. It stays unlocked in this tab until you lock it or close the tab.
        </p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label htmlFor="prepare-password" style={{ font: "500 12.5px/1 var(--font-body)", color: "#6A6376" }}>Team password</label>
          <input
            ref={inputRef}
            id="prepare-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (problem === "wrong") setProblem(null); }}
            aria-invalid={problem === "wrong" || undefined}
            aria-describedby={problem ? "prepare-password-problem" : undefined}
            style={{ height: 42, padding: "0 14px", borderRadius: 12, border: "1.5px solid " + (problem === "wrong" ? "#B4232C" : "#E9E2D4"), background: "#FFFFFF", color: "#221E2E", font: "500 15px/1 var(--font-body)" }}
          />
          {problem && (
            <p id="prepare-password-problem" role="alert" style={{ margin: 0, font: "500 13px/1.45 var(--font-body)", color: problem === "wrong" ? "#B4232C" : "#6A4A00" }}>
              {MESSAGES[problem]}
            </p>
          )}
          <div>
            <button type="submit" disabled={!password || busy} style={{ height: 42, padding: "0 20px", borderRadius: 999, border: "none", background: "#1A51FF", color: "#FFFFFF", font: "600 14px/1 var(--font-body)", cursor: !password || busy ? "default" : "pointer", opacity: !password || busy ? 0.55 : 1 }}>
              {busy ? "Checking…" : "Unlock"}
            </button>
          </div>
        </form>
        {devBypass && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 12, background: "#FFF7E6", border: "1px dashed #D9A441" }}>
            <p style={{ margin: 0, font: "400 12.5px/1.45 var(--font-body)", color: "#6A4A00" }}>
              Development build: you can skip the password here. Production builds never show this option.
            </p>
            <div><button type="button" onClick={() => writeUnlocked(true)} style={{ height: 34, padding: "0 14px", borderRadius: 999, border: "1.5px solid #D9A441", background: "#FFFFFF", color: "#6A4A00", font: "600 12.5px/1 var(--font-body)", cursor: "pointer" }}>Continue without a password</button></div>
          </div>
        )}
        <p style={{ margin: 0, font: "400 12px/1.5 var(--font-body)", color: "#8E869C" }}>
          This keeps casual visitors out of the editor. It doesn't encrypt anything: lead cases are stored in this browser, readable by anyone who can use this device's developer tools.
        </p>
      </main>
    </div>
  );
}
