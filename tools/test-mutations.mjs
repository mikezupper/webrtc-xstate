import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mutations = [
  [
    "peer cancellation",
    "packages/peer/src/internal/controller.ts",
    "      closed = true;",
    "      closed = false;",
    "packages/peer/tests/peer.test.ts",
  ],
  [
    "capture late-result cleanup",
    "packages/media/src/capture.ts",
    "for (const track of ownedTracks) track.stop();",
    "for (const track of ownedTracks) void track;",
    "packages/media/tests/media.test.ts",
  ],
  [
    "recovery bound",
    "packages/call/src/call.ts",
    "attempts >= recovery.maxRestarts",
    "attempts > recovery.maxRestarts",
    "packages/call/tests/call.test.ts",
  ],
];
for (const [name, file, from, to, test] of mutations) {
  const path = resolve(root, file),
    original = readFileSync(path, "utf8");
  assert(original.includes(from), `${name}: update the mutation site after refactoring`);
  const changed = original.replace(from, to);
  try {
    writeFileSync(path, changed);
    const result = spawnSync("pnpm", ["exec", "vitest", "run", test], {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
    });
    assert(
      result.status !== 0 && /AssertionError/.test(result.stdout + result.stderr),
      `${name}: mutation survived or failed for an unrelated reason\n${result.stdout}\n${result.stderr}`,
    );
    console.log(`${name}: killed by behavioral assertions.`);
  } finally {
    assert.equal(
      readFileSync(path, "utf8"),
      changed,
      `${name}: source changed concurrently; refusing to overwrite it`,
    );
    writeFileSync(path, original);
  }
}
const restored = spawnSync("pnpm", ["test"], { cwd: root, stdio: "inherit", timeout: 30000 });
assert.equal(restored.status, 0, "Restored sources must pass");
