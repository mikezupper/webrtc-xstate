import { describe, expect, it } from "vitest";
import { InvalidSignalError, parseSignal } from "../src/index.js";

describe("parseSignal", () => {
  it("provides a tagged validation error for callers", () => {
    expect.assertions(2);
    try {
      parseSignal(null);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSignalError);
      expect(error).toHaveProperty("code", "INVALID_SIGNAL");
    }
  });
  it("accepts a description for a shared session", () => {
    const message = {
      version: 1,
      sessionId: "session-a",
      kind: "description",
      description: { type: "offer", sdp: "v=0\r\n" },
    };
    expect(parseSignal(message)).toEqual(message);
  });

  it.each([null, undefined, [], 42, "message", true])("rejects non-object input %j", (input) => {
    expect(() => parseSignal(input)).toThrow("signal must be an object");
  });

  it.each([
    [{ version: undefined }, "version"],
    [{ version: 2 }, "version"],
    [{ version: "1" }, "version"],
    [{ sessionId: undefined }, "sessionId"],
    [{ sessionId: 42 }, "sessionId"],
    [{ sessionId: " " }, "sessionId"],
    [{ kind: "id" }, "kind"],
    [{ kind: undefined }, "kind"],
  ])("rejects malformed envelope %j", (fields, fieldName) => {
    const message = {
      version: 1,
      sessionId: "session-a",
      kind: "description",
      description: { type: "offer", sdp: "v=0\r\n" },
      ...fields,
    };
    expect(() => parseSignal(message)).toThrow(fieldName as string);
  });

  it.each([
    undefined,
    null,
    [],
    "offer",
    { type: "id", id: "client-a" },
    { type: "rollback", sdp: "v=0\r\n" },
    { type: "pranswer", sdp: "v=0\r\n" },
    { type: "offer" },
    { type: "answer", sdp: 42 },
    { type: "offer", sdp: " " },
  ])("rejects invalid descriptions %j", (description) => {
    expect(() =>
      parseSignal({ version: 1, sessionId: "session-a", kind: "description", description }),
    ).toThrow("description");
  });

  it.each([
    undefined,
    [],
    42,
    "candidate",
    {},
    { candidate: 42 },
    { candidate: "candidate", sdpMid: 42 },
    { candidate: "candidate", sdpMLineIndex: "0" },
    { candidate: "candidate", sdpMLineIndex: -1 },
    { candidate: "candidate", sdpMLineIndex: 0.5 },
    { candidate: "candidate", sdpMLineIndex: Infinity },
    { candidate: "candidate", usernameFragment: 42 },
  ])("rejects invalid candidate fields %j", (candidate) => {
    expect(() =>
      parseSignal({ version: 1, sessionId: "session-a", kind: "candidate", candidate }),
    ).toThrow("candidate");
  });

  it.each([
    { kind: "description", description: { type: "answer", sdp: "v=0\r\n" } },
    { kind: "candidate", candidate: null },
    { kind: "candidate", candidate: { candidate: "" } },
    {
      kind: "candidate",
      candidate: {
        candidate: "candidate",
        sdpMid: null,
        sdpMLineIndex: null,
        usernameFragment: null,
      },
    },
    {
      kind: "candidate",
      candidate: {
        candidate: "candidate",
        sdpMid: "video",
        sdpMLineIndex: 0,
        usernameFragment: "ice-a",
      },
    },
  ])("accepts native message forms %j", (payload) => {
    const message = { version: 1, sessionId: "session-a", ...payload };
    expect(parseSignal(message)).toEqual(message);
  });

  it.each([
    { kind: "description", description: { type: "offer", sdp: "v=0\r\n" } },
    { kind: "candidate", candidate: { candidate: "candidate", sdpMid: "video", sdpMLineIndex: 0 } },
  ])("normalizes supported fields without changing the input %j", (payload) => {
    const expected = { version: 1, sessionId: "session-a", ...payload };
    const nestedField = "description" in payload ? "description" : "candidate";
    const nested = nestedField === "description" ? payload.description : payload.candidate;
    const input = {
      ...expected,
      applicationMetadata: "private",
      [nestedField]: { ...nested, applicationMetadata: "private" },
    };
    expect(parseSignal(input)).toEqual(expected);
    expect(input.applicationMetadata).toBe("private");
  });
});
