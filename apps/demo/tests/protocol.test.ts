import { expect, it } from "vitest";
import { parseInvitation } from "../src/support/controller.js";
import { CHUNK_BYTES, MAX_FILE_BYTES, parseControl } from "../src/transfer/protocol.js";

it("normalizes file offers and allows zero-byte files within the bounded transfer size", () => {
  expect(
    parseControl(
      JSON.stringify({ kind: "offer", id: "id", name: "file.bin", size: 0, ignored: "metadata" }),
    ),
  ).toEqual({ kind: "offer", id: "id", name: "file.bin", size: 0 });
  expect(
    parseControl(
      JSON.stringify({ kind: "offer", id: "id", name: "file.bin", size: MAX_FILE_BYTES }),
    ),
  ).toMatchObject({ size: MAX_FILE_BYTES });
  expect(CHUNK_BYTES).toBe(16384);
});
it.each([
  null,
  [],
  { kind: "accept", id: "bad/id" },
  { kind: "unknown", id: "id" },
  { kind: "offer", id: "id", name: "../secret", size: 1 },
  { kind: "offer", id: "id", name: "file\u0000.bin", size: 1 },
  { kind: "offer", id: "id", name: "file", size: -1 },
  { kind: "offer", id: "id", name: "file", size: 1.2 },
  { kind: "offer", id: "id", name: "file", size: MAX_FILE_BYTES + 1 },
])("rejects malformed or unbounded transfer metadata: %j", (input) => {
  expect(() => parseControl(JSON.stringify(input))).toThrow();
});
it("rejects an oversized control frame", () => {
  expect(() => parseControl(" ".repeat(2049))).toThrow("too large");
});
it("keeps invitation messages session-bound and leaves managed messages to the call layer", () => {
  expect(parseInvitation({ kind: "description" }, "session")).toBeNull();
  expect(
    parseInvitation(
      { version: 1, kind: "support-invite", sessionId: "session", id: "invite", extra: true },
      "session",
    ),
  ).toEqual({ version: 1, kind: "support-invite", sessionId: "session", id: "invite" });
  expect(() =>
    parseInvitation(
      { version: 1, kind: "support-accept", sessionId: "old", id: "invite" },
      "session",
    ),
  ).toThrow("stale");
  expect(() =>
    parseInvitation(
      { version: 1, kind: "support-unknown", sessionId: "session", id: "invite" },
      "session",
    ),
  ).toThrow();
});
