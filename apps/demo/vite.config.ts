import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: { entries: ["src/main.ts"] },
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
    allowedHosts: ["mzlinux.xode.live"],
    proxy: {
      "/signaling": { target: `ws://127.0.0.1:${process.env.PEERWEAVE_PORT ?? 8787}`, ws: true },
    },
  },
});
