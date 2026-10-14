import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export function libraryConfig(directory: string) {
  const manifest = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  return defineConfig({
    build: {
      lib: { entry: resolve(directory, "src/index.ts"), formats: ["es"], fileName: "index" },
      sourcemap: true,
      rolldownOptions: { external: Object.keys(manifest.dependencies ?? {}) },
    },
  });
}
