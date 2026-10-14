import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const root = resolve(import.meta.dirname, ".."),
  artifacts = resolve(root, ".artifacts");
await mkdir(artifacts, { recursive: true });
const directory = await mkdtemp(resolve(artifacts, "size-"));
const results = [];
try {
  for (const [name, symbol, limit] of [
    ["peer", "createPeer", 6000],
    ["media", "captureMedia", 2500],
    ["call", "createCall", 22000],
    ["signaling-websocket", "createSignalingChannel", 4000],
  ]) {
    const entry = resolve(directory, `${name}.js`);
    await writeFile(
      entry,
      `export {${symbol}} from ${JSON.stringify(resolve(root, `packages/${name}/dist/index.js`))};\n`,
    );
    const result = await build({
      configFile: false,
      logLevel: "silent",
      build: { write: false, minify: true, lib: { entry, formats: ["es"], fileName: "bundle.js" } },
    });
    const output = (Array.isArray(result) ? result[0] : result).output;
    const code = output
      .filter((item) => item.type === "chunk")
      .map((item) => item.code)
      .join("\n");
    const gzip = gzipSync(code).length;
    assert(gzip <= limit, `${name}: consumer bundle ${gzip} gzip bytes exceeds ${limit}`);
    results.push({
      package: `@peerweave/${name}`,
      bytes: Buffer.byteLength(code),
      gzipBytes: gzip,
      budgetGzipBytes: limit,
    });
  }
  await writeFile(resolve(artifacts, "bundle-sizes.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.table(results);
} finally {
  await rm(directory, { recursive: true, force: true });
}
