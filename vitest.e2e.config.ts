import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    allowOnly: false,
    // These files start Vite against the same dependency cache and use native media devices.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
