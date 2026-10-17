import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  resolve: { alias: { "server-only": r("./tests/stubs/server-only.ts"), "@": r("./src") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
