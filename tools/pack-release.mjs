import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, ".."),
  destination = resolve(root, ".artifacts/packages");
mkdirSync(destination, { recursive: true });
for (const name of ["peer", "media", "call", "signaling-websocket"])
  execFileSync("pnpm", ["pack", "--pack-destination", destination], {
    cwd: resolve(root, "packages", name),
    stdio: "inherit",
  });
console.log(`Reviewable package archives: ${destination}`);
