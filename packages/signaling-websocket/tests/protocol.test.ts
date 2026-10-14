import { expect, it, vi } from "vitest";
import { createSignalingChannel, SignalingError } from "../src/index.js";
import { FakeSocket } from "./fake-socket.js";

const fixture = (timeout?: number) => {
  const socket = new FakeSocket();
  const channel = createSignalingChannel({
    url: "ws://localhost/signaling",
    room: "test",
    socketFactory: () => socket.asSocket(),
    ...(timeout ? { connectionTimeoutMs: timeout } : {}),
  });
  return { socket, channel };
};
it.each([
  { room: "" },
  { room: "a/b" },
  { url: "https://host" },
  { connectionTimeoutMs: 0 },
  { connectionTimeoutMs: Infinity },
])("rejects invalid signaling options: %j", (bad) => {
  expect(() =>
    createSignalingChannel({ ...{ url: "ws://localhost", room: "test" }, ...bad }),
  ).toThrow(SignalingError);
});
it("sends one join, reports states, isolates listeners and removes observers", () => {
  const { socket, channel } = fixture();
  const states: string[] = [],
    errors: SignalingError[] = [];
  const offError = channel.onError((e) => {
    errors.push(e);
  });
  channel.onError(() => {
    throw new Error("Ignored observer");
  });
  const off = channel.subscribe((s) => {
    states.push(s.phase);
  });
  channel.subscribe(() => {
    throw new Error("UI");
  });
  socket.open();
  expect(socket.sent).toEqual([JSON.stringify({ kind: "join", room: "test" })]);
  socket.message({ kind: "waiting" });
  socket.message({ kind: "ready", sessionId: "s", polite: true });
  expect(channel.getState().session).toEqual({ sessionId: "s", polite: true });
  let received = 0;
  const offMessage = channel.onMessage(() => {
    received++;
  });
  channel.onMessage(() => {
    throw new Error("UI");
  });
  socket.message({ kind: "signal", sessionId: "s", payload: {} });
  expect(received).toBe(1);
  offMessage();
  socket.message({ kind: "signal", sessionId: "s", payload: {} });
  expect(received).toBe(1);
  expect(errors.some((e) => e.code === "LISTENER_FAILED")).toBe(true);
  off();
  offError();
  socket.message({ kind: "peer-left" });
  expect(states.at(-1)).toBe("ready");
  channel.dispose();
  channel.dispose();
  expect(socket.closes).toBe(1);
  socket.open();
  expect(socket.sent).toHaveLength(1);
});
it.each([
  null,
  {},
  "bad",
  { kind: "unknown" },
  { kind: "ready", sessionId: "", polite: true },
  { kind: "signal", sessionId: "stale", payload: {} },
  { kind: "error", code: "ROOM_FULL" },
])("rejects malformed/stale server frames: %j", (value) => {
  const { socket, channel } = fixture();
  const errors: unknown[] = [];
  channel.onError((e) => errors.push(e));
  socket.message(value);
  expect(channel.getState().phase).toBe("error");
  expect(errors).toHaveLength(1);
  expect(socket.closes).toBe(1);
  channel.dispose();
});
it.each(["{", new ArrayBuffer(1), "x".repeat(65537)])("rejects invalid wire encodings", (data) => {
  const { socket, channel } = fixture();
  socket.raw(data);
  expect(channel.getState().error?.code).toBe("PROTOCOL_ERROR");
});
it("bounds outgoing frames and native backlog and preserves native send errors", () => {
  const { socket, channel } = fixture();
  expect(() => channel.send({})).toThrowError(expect.objectContaining({ code: "NOT_READY" }));
  socket.open();
  socket.message({ kind: "ready", sessionId: "s", polite: false });
  expect(() => channel.send("x".repeat(65536))).toThrowError(
    expect.objectContaining({ code: "BACKPRESSURE" }),
  );
  socket.bufferedAmount = 300000;
  expect(() => channel.send({})).toThrow();
  socket.bufferedAmount = 0;
  const cause = new Error("closed");
  socket.sendFailure = cause;
  expect(() => channel.send({})).toThrowError(
    expect.objectContaining({ code: "TRANSPORT_FAILED", cause }),
  );
  channel.dispose();
});
it("reports connection timeout and native failure, and disposes pending connections", () => {
  vi.useFakeTimers();
  try {
    const first = fixture(10);
    vi.advanceTimersByTime(10);
    expect(first.channel.getState().error?.code).toBe("TIMEOUT");
    const second = fixture();
    second.socket.dispatchEvent(new Event("error"));
    expect(second.channel.getState().error?.code).toBe("TRANSPORT_FAILED");
    const third = fixture();
    third.socket.dispatchEvent(new Event("close"));
    expect(third.channel.getState().phase).toBe("closed");
    const fourth = fixture();
    fourth.channel.dispose();
    vi.runAllTimers();
    expect(fourth.channel.getState().phase).toBe("closed");
    expect(fourth.socket.closes).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});
it("tags socket construction errors", () => {
  const cause = new Error("URL");
  expect(() =>
    createSignalingChannel({
      url: "ws://bad",
      room: "test",
      socketFactory: () => {
        throw cause;
      },
    }),
  ).toThrowError(expect.objectContaining({ code: "TRANSPORT_FAILED", cause }));
});

it("tags join failures and serialization errors without leaking native exceptions", () => {
  const first = fixture();
  first.socket.sendFailure = new Error("Closed before join");
  first.socket.open();
  expect(first.channel.getState().error?.code).toBe("TRANSPORT_FAILED");
  const second = fixture();
  second.socket.open();
  second.socket.message({ kind: "ready", sessionId: "s", polite: true });
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  expect(() => second.channel.send(cycle)).toThrowError(
    expect.objectContaining({ code: "PROTOCOL_ERROR" }),
  );
  expect(() => second.channel.send(undefined)).toThrowError(
    expect.objectContaining({ code: "PROTOCOL_ERROR" }),
  );
  second.channel.dispose();
});

it("applies incoming frame limits to UTF-8 bytes, including multibyte payloads", () => {
  const { socket, channel } = fixture();
  socket.message({ kind: "waiting", extra: "é".repeat(40000) });
  expect(channel.getState().error?.code).toBe("PROTOCOL_ERROR");
});
