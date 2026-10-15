import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { build, createServer } from "vite";
import config from "../apps/demo/vite.config.ts";
import { createSignalingServer } from "../apps/signaling-server/src/server.ts";

const root = resolve(import.meta.dirname, "..");
const pnpm = process.env.npm_execpath ?? "pnpm";
const expectedManager = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
).packageManager;
const actualManager = `pnpm@${execFileSync(pnpm, ["--version"], { cwd: root, encoding: "utf8" }).trim()}`;
assert.equal(actualManager, expectedManager, `Run this gate with ${expectedManager}`);
const scratch = mkdtempSync(resolve(tmpdir(), "peerweave-examples-"));
const fixture = resolve(scratch, "apps/demo");
let browser, vite, relay;
try {
  mkdirSync(fixture, { recursive: true });
  cpSync(resolve(root, "apps/demo"), fixture, {
    recursive: true,
    filter: (path) =>
      !["node_modules", "dist", ".gyral"].some((name) => path.split("/").includes(name)),
  });
  cpSync(resolve(root, "tsconfig.base.json"), resolve(scratch, "tsconfig.base.json"));
  const tarballs = {};
  for (const name of ["peer", "media", "call", "signaling-websocket"]) {
    const destination = resolve(scratch, "archives", name);
    mkdirSync(destination, { recursive: true });
    execFileSync("pnpm", ["pack", "--pack-destination", destination], {
      cwd: resolve(root, "packages", name),
      stdio: "pipe",
    });
    const archive = readdirSync(destination).find((file) => file.endsWith(".tgz"));
    if (!archive) throw new Error(`No archive for ${name}`);
    tarballs[`@peerweave/${name}`] = `file:${resolve(destination, archive)}`;
  }
  const rootManifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  writeFileSync(
    resolve(fixture, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      packageManager: rootManifest.packageManager,
      dependencies: tarballs,
      devDependencies: {
        vite: rootManifest.devDependencies.vite,
        typescript: rootManifest.devDependencies.typescript,
        "@types/node": rootManifest.devDependencies["@types/node"],
      },
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
  // Resolve the independent graph; a frozen workspace install need not cache registry metadata.
  execFileSync(
    pnpm,
    ["install", "--lockfile-only", "--ignore-scripts", "--pm-on-fail=ignore", "--store-dir", store],
    { cwd: fixture, stdio: "pipe" },
  );
  execFileSync(pnpm, ["fetch", "--pm-on-fail=ignore", "--store-dir", store], {
    cwd: fixture,
    stdio: "pipe",
  });
  execFileSync(
    pnpm,
    [
      "install",
      "--offline",
      // The active executable is already version-checked; do not resolve pnpm again offline.
      "--pm-on-fail=ignore",
      "--ignore-scripts",
      "--store-dir",
      store,
      "--package-import-method=copy",
    ],
    { cwd: fixture, stdio: "pipe" },
  );
  const tsconfig = JSON.parse(readFileSync(resolve(fixture, "tsconfig.json"), "utf8"));
  tsconfig.compilerOptions.paths = {};
  writeFileSync(resolve(fixture, "tsconfig.json"), JSON.stringify(tsconfig));
  execFileSync("pnpm", ["exec", "tsc", "--noEmit"], { cwd: fixture, stdio: "inherit" });
  const packedConfig = {
    ...config,
    configFile: false,
    root: fixture,
    resolve: { ...config.resolve, alias: {} },
  };
  await build(packedConfig);
  relay = await createSignalingServer({ port: 0 });
  vite = await createServer({
    ...packedConfig,
    server: {
      host: "127.0.0.1",
      port: 0,
      fs: { allow: [scratch, root] },
      proxy: { "/signaling": { target: relay.url.replace(/\/signaling$/, ""), ws: true } },
    },
  });
  await vite.listen();
  const url = vite.resolvedUrls?.local[0];
  if (!url) throw new Error("No packed example URL");
  browser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  const a = await browser.newPage(),
    b = await browser.newPage();
  const errors = [];
  for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
  await Promise.all([a.goto(url), b.goto(url)]);
  for (const page of [a, b]) {
    await page.getByLabel("Room", { exact: true }).fill("packed-consumer");
    await page.getByRole("button", { name: "Join room", exact: true }).click();
  }
  await Promise.all([
    a.getByRole("button", { name: "Start call", exact: true }).click(),
    b.getByRole("button", { name: "Start call", exact: true }).click(),
  ]);
  for (const page of [a, b])
    await page.waitForFunction(
      () =>
        document.getElementById("status")?.textContent === "Connected." &&
        document.getElementById("remote") instanceof HTMLVideoElement &&
        document.querySelector("#remote").videoWidth > 0,
      { timeout: 10000 },
    );
  await a.getByRole("button", { name: "Mute", exact: true }).click();
  assert.equal(await a.locator("#mute").getAttribute("aria-pressed"), "true");
  await a.getByRole("button", { name: "Leave", exact: true }).click();
  for (const page of [a, b])
    await page.waitForFunction(
      () =>
        document.querySelector("#local").srcObject === null &&
        document.querySelector("#remote").srcObject === null,
    );
  assert.deepEqual(errors, []);
  console.log(
    "The minimal demo built and typed against freshly installed pnpm tarballs; native video, microphone control and leave cleanup passed.",
  );
} finally {
  await browser?.close();
  await vite?.close();
  await relay?.close();
  rmSync(scratch, { recursive: true, force: true });
}
