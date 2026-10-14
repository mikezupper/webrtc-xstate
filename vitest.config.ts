import { defineConfig } from "vitest/config";

export default defineConfig({
  optimizeDeps: { entries: ["packages/call/src/index.ts"] },
  resolve: {
    alias: Object.fromEntries(
      ["peer", "media", "call", "signaling-websocket"].map((name) => [
        `@peerweave/${name}`,
        new URL(`./packages/${name}/src/index.ts`, import.meta.url).pathname,
      ]),
    ),
  },
  test: {
    environment: "node",
    include: ["packages/*/tests/**/*.test.ts", "tests/**/*.test.ts", "apps/*/tests/**/*.test.ts"],
    exclude: ["tests/browser/**", "tests/e2e/**", "tests/browser-chromium/**"],
    restoreMocks: true,
    clearMocks: true,
    allowOnly: false,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      reporter: ["text", "json-summary", "html", "lcov"],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 85,
        "packages/peer/src/**": { lines: 85, statements: 85, functions: 85, branches: 85 },
        "packages/media/src/**": { lines: 85, statements: 85, functions: 85, branches: 85 },
        "packages/signaling-websocket/src/**": {
          lines: 85,
          statements: 85,
          functions: 85,
          branches: 85,
        },
        "packages/call/src/**": { lines: 85, statements: 85, functions: 85, branches: 85 },
      },
    },
  },
});
