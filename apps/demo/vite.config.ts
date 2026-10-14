import { resolve } from "node:path";
import { gyralVitePreset } from "@gyral/core/vite";
import { defineConfig } from "vite";

const preset = gyralVitePreset({ clientOnly: true });
export default defineConfig({
  ...preset,
  optimizeDeps: {
    ...preset.optimizeDeps,
    entries: ["src/main.ts", "src/media/main.ts", "src/transfer/main.ts", "src/support/main.ts"],
  },
  build: {
    rolldownOptions: {
      input: {
        workbench: resolve(import.meta.dirname, "index.html"),
        media: resolve(import.meta.dirname, "media/index.html"),
        transfer: resolve(import.meta.dirname, "transfer/index.html"),
        support: resolve(import.meta.dirname, "support/index.html"),
      },
    },
  },
  resolve: {
    alias: Object.fromEntries(
      ["peer", "media", "call", "signaling-websocket"].map((name) => [
        `@peerweave/${name}`,
        resolve(import.meta.dirname, `../../packages/${name}/src/index.ts`),
      ]),
    ),
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.PEERWEAVE_DEMO_PORT ?? 5173),
    proxy: {
      "/signaling": { target: `ws://127.0.0.1:${process.env.PEERWEAVE_PORT ?? 8787}`, ws: true },
    },
  },
});
