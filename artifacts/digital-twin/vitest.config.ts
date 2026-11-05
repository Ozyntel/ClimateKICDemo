import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests for the lead-case construct, the visual registry and the
// isolation / leak guards. Kept separate from vite.config.ts, which needs
// PORT and BASE_PATH for the dev server.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
  },
});
