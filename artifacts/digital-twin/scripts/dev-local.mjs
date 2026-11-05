// Run the demo on your own computer (macOS, Windows or Linux): `pnpm demo`
// from the repository root.
//
// The Replit/Vercel setup expects PORT and BASE_PATH environment variables;
// this script fills in local defaults so the same command works in any
// terminal, binds to localhost only (not your whole network) and opens the
// browser. It runs a development build, so /prepare offers "Continue without
// a password" and "Load synthetic example (dev only)".
import path from "node:path";

process.env.PORT ||= "5173";
process.env.BASE_PATH ||= "/";

const root = path.resolve(import.meta.dirname, "..");
// Open the browser, except where there is no screen (e.g. a cloud container).
const canOpen = process.env.BROWSER !== "none" && !(process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY);
const { createServer } = await import("vite");

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { host: "localhost", port: Number(process.env.PORT), strictPort: false, open: canOpen ? "/prepare" : false },
});
await server.listen();
server.printUrls();
const url = (server.resolvedUrls?.local?.[0] ?? `http://localhost:${process.env.PORT}/`).replace(/\/$/, "");
console.log(`
  Ozy demo is running at ${url}/prepare — in the browser:
    1. /prepare → "Continue without a password" → "Load synthetic example (dev only)"
    2. "Show in the demo" → "Open the demo →"
    Visual vocabulary preview: /dev/visual-preview
  Press Ctrl+C to stop.
`);
