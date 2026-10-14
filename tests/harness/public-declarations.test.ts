import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { assertPublicDeclarations } from "../../tools/public-declarations.mjs";

it("rejects state machine types exposed through a re-exported declaration", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "peerweave-types-"));
  try {
    writeFileSync(
      resolve(directory, "index.d.ts"),
      'export { createCall } from "./controller.js";',
    );
    writeFileSync(
      resolve(directory, "controller.d.ts"),
      'import type { AnyActorRef } from "xstate"; export declare function createCall(): AnyActorRef;',
    );
    expect(() => assertPublicDeclarations(resolve(directory, "index.d.ts"))).toThrow(
      "state machine types",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("allows native public types while keeping unrelated private declarations private", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "peerweave-types-"));
  try {
    writeFileSync(
      resolve(directory, "index.d.ts"),
      'export type CallPhase = "idle"; export type { CallHandle } from "./native.js";',
    );
    writeFileSync(
      resolve(directory, "native.d.ts"),
      'export interface CallHandle { phase: import("./index.js").CallPhase; close(): void; }',
    );
    writeFileSync(
      resolve(directory, "private.d.ts"),
      'import type { AnyActorRef } from "xstate"; export type PrivateController = AnyActorRef;',
    );
    expect(() => assertPublicDeclarations(resolve(directory, "index.d.ts"))).not.toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
