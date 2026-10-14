import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import base from "./vitest.config.js";
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    projects: [
      {
        extends: false,
        resolve: base.resolve ?? {},
        optimizeDeps: { entries: ["packages/call/src/index.ts"] },
        test: {
          name: "unit",
          environment: "node",
          include: [
            "packages/*/tests/**/*.test.ts",
            "tests/harness/**/*.test.ts",
            "apps/*/tests/**/*.test.ts",
          ],
          exclude: ["tests/browser/**"],
        },
      },
      {
        extends: false,
        resolve: base.resolve ?? {},
        optimizeDeps: { entries: ["packages/call/src/index.ts"] },
        test: {
          name: "native-contract",
          include: ["tests/browser/**/*.test.ts", "tests/browser-chromium/**/*.test.ts"],
          exclude: [],
          testTimeout: 15000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: {
                args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
              },
            }),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
