import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { assertPublicDeclarations } from "./public-declarations.mjs";

const root = resolve(import.meta.dirname, "..");
const scratch = mkdtempSync(resolve(tmpdir(), "peerweave-artifacts-"));
const fixture = resolve(scratch, "consumer");
mkdirSync(fixture);

const tarballs = {};
try {
  for (const name of ["peer", "media", "call", "signaling-websocket"]) {
    const directory = resolve(root, "packages", name);
    const manifest = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
    const destination = resolve(scratch, name);
    mkdirSync(destination);
    execFileSync("pnpm", ["pack", "--pack-destination", destination], {
      cwd: directory,
      stdio: "inherit",
    });
    const archive = readdirSync(destination).find((file) => file.endsWith(".tgz"));
    if (!archive) throw new Error(`${name}: pnpm pack did not create an archive`);
    const archivePath = resolve(destination, archive);
    execFileSync("pnpm", ["exec", "publint", archivePath, "--strict"], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(
      "pnpm",
      ["exec", "attw", archivePath, "--profile", "esm-only", "--no-definitely-typed"],
      { cwd: root, stdio: "inherit" },
    );
    execFileSync("tar", ["-xzf", archivePath, "-C", destination]);
    const packed = resolve(destination, "package");
    const packedManifest = JSON.parse(readFileSync(resolve(packed, "package.json"), "utf8"));
    if (
      Object.values(packedManifest.dependencies ?? {}).some((version) =>
        version.startsWith("workspace:"),
      )
    ) {
      throw new Error(`${name}: workspace protocol escaped into the packed manifest`);
    }
    assertPublicDeclarations(resolve(packed, "dist/index.d.ts"));
    tarballs[manifest.name] = `file:${archivePath}`;
  }

  writeFileSync(
    resolve(fixture, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      packageManager: "pnpm@12.11.2",
      dependencies: tarballs,
    }),
  );
  writeFileSync(
    resolve(fixture, "pnpm-workspace.yaml"),
    `packages: [.]\noverrides:\n${Object.entries(tarballs)
      .map(([name, path]) => `  '${name}': '${path}'`)
      .join("\n")}\n`,
  );
  const store = dirname(
    execFileSync("pnpm", ["store", "path"], { cwd: root, encoding: "utf8" }).trim(),
  );
  execFileSync(
    "pnpm",
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--store-dir",
      store,
      "--package-import-method=copy",
    ],
    {
      cwd: fixture,
      stdio: "inherit",
    },
  );
  for (const name of Object.keys(tarballs))
    execFileSync(
      process.execPath,
      ["--input-type=module", "-e", `await import(${JSON.stringify(name)});`],
      { cwd: fixture, stdio: "inherit" },
    );
  writeFileSync(
    resolve(fixture, "consumer.ts"),
    [
      'import { parseSignal, type SignalMessage } from "@peerweave/peer";',
      'import { captureMedia, type MediaCapture } from "@peerweave/media";',
      'import {createCall, type CallPhase } from "@peerweave/call";',
      'const message: SignalMessage = parseSignal({version: 1, sessionId: "fixture", kind: "candidate", candidate: null});',
      'const phase: CallPhase = "idle";',
      "function dispose(capture: MediaCapture) { capture.dispose(); }",
      'import {createSignalingChannel} from "@peerweave/signaling-websocket";',
      'const call=createCall({sessionId:"fixture",polite:true,sendSignal:async signal=>{void signal;}});call.subscribe(state=>{const phase:CallPhase=state.phase;void phase;});call.dispose();',
      "void message; void phase; void dispose;void captureMedia;void createSignalingChannel;",
    ].join("\n"),
  );
  writeFileSync(
    resolve(fixture, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        types: [],
      },
      include: ["consumer.ts"],
    }),
  );
  execFileSync("pnpm", ["exec", "tsc", "-p", resolve(fixture, "tsconfig.json")], {
    cwd: root,
    stdio: "inherit",
  });
  console.log(
    "All 4 freshly installed packed packages passed metadata, type-resolution, inert-import, and consumer compilation checks.",
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
