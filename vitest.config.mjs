import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/helpers/serverOnlyStub.js",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,mjs}"],
    setupFiles: ["tests/setup.js"],
    // Reset call history AND stubbed return values between tests
    mockReset: true,
    restoreMocks: true,
  },
});
