import { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  optimizeDeps: { entries: ["packages/call/src/index.ts"] },
  resolve: {
    alias: {
      "@peerweave/peer": resolve(import.meta.dirname, "packages/peer/src/index.ts"),
      "@peerweave/media": resolve(import.meta.dirname, "packages/media/src/index.ts"),
      "@peerweave/call": resolve(import.meta.dirname, "packages/call/src/index.ts"),
    },
  },
  test: {
    include: ["tests/browser/**/*.test.ts"],
    allowOnly: false,
    // Firefox uses the page's address family for its default ICE route lookup.
    api: { host: "127.0.0.1" },
    // Device enumeration requires a visible document; do not compete for focus.
    fileParallelism: false,
    testTimeout: 15000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
    },
  },
});
