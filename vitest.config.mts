import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "node_modules"],
      thresholds: {
        statements: 83,
        branches: 69,
        functions: 81,
        lines: 85,
      },
    },
  },
});
