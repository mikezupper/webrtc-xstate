import { expect, it } from "vitest";
import { createPeerController } from "../src/internal/controller.js";
import type { SignalMessage } from "../src/types.js";
import { deferred, FakePort, tick } from "./fake-port.js";

it("closes exactly once and detaches its connection listeners", () => {
  const port = new FakePort();
  const peer = createPeerController(
    { sessionId: "test", polite: true, sendSignal: () => {} },
    port,
  );
  peer.close();
  peer.close();
  expect(port.closes).toBe(1);
  expect(port.events).toBeUndefined();
  expect(peer.getState().closed).toBe(true);
});

it("isolates listener failures and preserves native error causes", async () => {
  const port = new FakePort();
  const peer = createPeerController(
    { sessionId: "test", polite: true, sendSignal: () => {} },
    port,
  );
  const errors: Error[] = [];
  peer.on("error", (error) => errors.push(error));
  peer.on("track", () => {
    throw new Error("consumer failure");
  });
  let delivered = false;
  peer.on("track", () => {
    delivered = true;
  });
  expect(() => port.events?.track({} as RTCTrackEvent)).not.toThrow();
  expect(delivered).toBe(true);
  expect(errors[0]).toMatchObject({
    code: "LISTENER_FAILED",
    cause: { message: "consumer failure" },
  });
  port.describeHook = () => Promise.reject(new Error("native failure"));
  port.events?.negotiation();
  await tick();
  expect(errors[1]).toMatchObject({
    code: "NEGOTIATION_FAILED",
    cause: { message: "native failure" },
  });
  peer.close();
});

it("bounds candidates waiting for a description", async () => {
  const port = new FakePort();
  const peer = createPeerController(
    { sessionId: "test", polite: true, maxBufferedCandidates: 1, sendSignal: () => {} },
    port,
  );
  const signal = { version: 1, sessionId: "test", kind: "candidate", candidate: null };
  await peer.receiveSignal(signal);
  await expect(peer.receiveSignal(signal)).rejects.toMatchObject({ code: "BUFFER_LIMIT" });
  peer.close();
});

it("keeps ICE generations separate across restart and ignored offers", async () => {
  const port = new FakePort();
  const peer = createPeerController(
    { sessionId: "test", polite: true, sendSignal: () => {} },
    port,
  );
  const offer = (generation: string) => ({
    version: 1,
    sessionId: "test",
    kind: "description",
    description: { type: "offer", sdp: `v=0\r\na=ice-ufrag:${generation}\r\n` },
  });
  await peer.receiveSignal(offer("old"));
  const fresh = { candidate: "candidate", usernameFragment: "fresh" };
  await peer.receiveSignal({ version: 1, sessionId: "test", kind: "candidate", candidate: fresh });
  expect(port.candidates).toEqual([]);
  await peer.receiveSignal(offer("fresh"));
  await peer.receiveSignal({
    version: 1,
    sessionId: "test",
    kind: "candidate",
    candidate: { candidate: "candidate", usernameFragment: "old" },
  });
  expect(port.candidates).toEqual([fresh]);
  peer.close();
});

it("delivers ICE candidates after the outgoing description", async () => {
  const port = new FakePort();
  const sent: SignalMessage[] = [];
  const peer = createPeerController(
    {
      sessionId: "test",
      polite: true,
      sendSignal: (message) => {
        sent.push(message);
      },
    },
    port,
  );
  port.describeHook = async () => {
    port.events?.candidate({ candidate: "candidate", usernameFragment: "local" });
    return port.nextDescription;
  };
  port.events?.negotiation();
  await tick();
  expect(sent.map((message) => message.kind)).toEqual(["description", "candidate"]);
  peer.close();
});

it("serializes descriptions and candidates during pending native work", async () => {
  const port = new FakePort();
  const gate = deferred<void>();
  port.acceptHook = () => gate.promise;
  const peer = createPeerController(
    { sessionId: "test", polite: true, sendSignal: () => {} },
    port,
  );
  const offer = peer.receiveSignal({
    version: 1,
    sessionId: "test",
    kind: "description",
    description: { type: "offer", sdp: "v=0\r\n" },
  });
  const candidate = peer.receiveSignal({
    version: 1,
    sessionId: "test",
    kind: "candidate",
    candidate: null,
  });
  let candidateDone = false;
  void candidate.then(() => {
    candidateDone = true;
  });
  await tick();
  expect(candidateDone).toBe(false);
  gate.resolve();
  await Promise.all([offer, candidate]);
  expect(port.candidates).toEqual([null]);
  peer.close();
});

it("buffers candidates until their remote description has been applied", async () => {
  const port = new FakePort();
  const peer = createPeerController(
    { sessionId: "test", polite: true, sendSignal: () => {} },
    port,
  );
  const candidate = { candidate: "candidate", usernameFragment: "remote" };
  await peer.receiveSignal({ version: 1, sessionId: "test", kind: "candidate", candidate });
  expect(port.candidates).toEqual([]);
  await peer.receiveSignal({
    version: 1,
    sessionId: "test",
    kind: "description",
    description: { type: "offer", sdp: "v=0\r\na=ice-ufrag:remote\r\n" },
  });
  expect(port.candidates).toEqual([candidate]);
  peer.close();
});

it("ignores a colliding offer on the impolite peer", async () => {
  const port = new FakePort();
  port.state = { ...port.state, signalingState: "have-local-offer" };
  const peer = createPeerController(
    { sessionId: "test", polite: false, sendSignal: () => {} },
    port,
  );
  await peer.receiveSignal({
    version: 1,
    sessionId: "test",
    kind: "description",
    description: { type: "offer", sdp: "v=0\r\na=ice-ufrag:ignored\r\n" },
  });
  await peer.receiveSignal({
    version: 1,
    sessionId: "test",
    kind: "candidate",
    candidate: { candidate: "candidate", usernameFragment: "ignored" },
  });
  expect(port.accepted).toEqual([]);
  expect(port.candidates).toEqual([]);
  peer.close();
});

it("cancels pending and future signaling when closed", async () => {
  const port = new FakePort();
  const pending = deferred<void>();
  port.acceptHook = () => pending.promise;
  const sent: SignalMessage[] = [];
  const peer = createPeerController(
    {
      sessionId: "test",
      polite: true,
      sendSignal: (message) => {
        sent.push(message);
      },
    },
    port,
  );
  const receive = peer.receiveSignal({
    version: 1,
    sessionId: "test",
    kind: "description",
    description: { type: "offer", sdp: "v=0\r\n" },
  });
  await tick();
  peer.close();
  pending.resolve();
  await expect(receive).rejects.toMatchObject({ code: "CLOSED" });
  await expect(
    peer.receiveSignal({ version: 1, sessionId: "test", kind: "candidate", candidate: null }),
  ).rejects.toMatchObject({ code: "CLOSED" });
  expect(sent).toEqual([]);
});

it("rejects a signal for another session before applying it", async () => {
  const port = new FakePort();
  const peer = createPeerController(
    { sessionId: "test", polite: true, sendSignal: () => {} },
    port,
  );
  await expect(
    peer.receiveSignal({ version: 1, sessionId: "other", kind: "candidate", candidate: null }),
  ).rejects.toMatchObject({ code: "SESSION_MISMATCH" });
  expect(port.candidates).toEqual([]);
  peer.close();
});

it("accepts an incoming offer before creating its answer", async () => {
  const port = new FakePort();
  const sent: SignalMessage[] = [];
  const peer = createPeerController(
    {
      sessionId: "test",
      polite: true,
      sendSignal: (signal) => {
        sent.push(signal);
      },
    },
    port,
  );
  const offer = {
    version: 1,
    sessionId: "test",
    kind: "description",
    description: { type: "offer", sdp: "v=0\r\na=ice-ufrag:remote\r\n" },
  };
  await peer.receiveSignal(offer);
  expect(port.accepted).toEqual([offer.description]);
  expect(sent[0]).toMatchObject({ kind: "description", description: { type: "answer" } });
  peer.close();
});

it("sends a local offer when native negotiation is needed", async () => {
  const port = new FakePort();
  const sent: SignalMessage[] = [];
  const peer = createPeerController(
    {
      sessionId: "test",
      polite: true,
      sendSignal: (signal) => {
        sent.push(signal);
      },
    },
    port,
  );
  port.events?.negotiation();
  await tick();
  expect(sent).toEqual([
    { version: 1, sessionId: "test", kind: "description", description: port.nextDescription },
  ]);
  peer.close();
});

it("publishes native state snapshots and a terminal closed snapshot", () => {
  const port = new FakePort();
  const peer = createPeerController(
    { sessionId: "test", polite: true, sendSignal: () => {} },
    port,
  );
  const seen: string[] = [];
  peer.subscribe((state) => seen.push(state.connectionState));
  port.state = { ...port.state, connectionState: "connected" };
  port.events?.state();
  peer.close();
  expect(seen).toEqual(["new", "connected", "closed"]);
});

it("validates peer options before touching the browser", async () => {
  const { createPeer } = await import("../src/index.js");
  for (const bad of [
    { sessionId: "" },
    { polite: null },
    { sendSignal: null },
    { maxBufferedCandidates: 0 },
    { maxBufferedCandidates: 1.5 },
  ])
    expect(() =>
      createPeer({ ...{ sessionId: "s", polite: true, sendSignal: () => {} }, ...bad } as never),
    ).toThrowError(expect.objectContaining({ code: "INVALID_OPTIONS" }));
  expect(() => createPeer({ sessionId: "s", polite: true, sendSignal: () => {} })).toThrowError(
    expect.objectContaining({ code: "BROWSER_UNAVAILABLE" }),
  );
});

it("provides context for incoming native failures and permits a later valid signal", async () => {
  const port = new FakePort();
  const cause = new DOMException("Bad SDP", "OperationError");
  port.acceptHook = async () => {
    throw cause;
  };
  const peer = createPeerController(
    { sessionId: "session", polite: true, sendSignal: () => {} },
    port,
  );
  const signal = {
    version: 1,
    sessionId: "session",
    kind: "description",
    description: { type: "offer", sdp: "v=0" },
  };
  await expect(peer.receiveSignal(signal)).rejects.toMatchObject({
    code: "NEGOTIATION_FAILED",
    operation: "receiveSignal",
    cause,
  });
  port.acceptHook = undefined;
  await peer.receiveSignal(signal);
  expect(port.accepted).toHaveLength(1);
  peer.close();
});

it("retains glare candidates when the answer reuses the ignored offer's ICE generation", async () => {
  const port = new FakePort();
  port.state = { ...port.state, signalingState: "have-local-offer" };
  const peer = createPeerController({ sessionId: "s", polite: false, sendSignal: () => {} }, port);
  const signal = {
    version: 1,
    sessionId: "s",
    kind: "description",
    description: { type: "offer", sdp: "v=0\na=ice-ufrag:reused\n" },
  };
  await peer.receiveSignal(signal);
  const candidate = { candidate: "candidate", usernameFragment: "reused" };
  await peer.receiveSignal({ version: 1, sessionId: "s", kind: "candidate", candidate });
  expect(port.candidates).toEqual([]);
  await peer.receiveSignal({ ...signal, description: { ...signal.description, type: "answer" } });
  expect(port.candidates).toEqual([candidate]);
  peer.close();
});

it("bounds signals waiting for native operations or transport acknowledgement", async () => {
  const port = new FakePort();
  const gate = deferred<void>();
  port.acceptHook = () => gate.promise;
  const peer = createPeerController(
    { sessionId: "s", polite: true, maxPendingSignals: 1, sendSignal: () => {} },
    port,
  );
  const description = {
    version: 1,
    sessionId: "s",
    kind: "description",
    description: { type: "offer", sdp: "v=0" },
  };
  const pending = peer.receiveSignal(description);
  await tick();
  await expect(peer.receiveSignal(description)).rejects.toMatchObject({ code: "BUFFER_LIMIT" });
  peer.close();
  gate.resolve();
  await expect(pending).rejects.toMatchObject({ code: "CLOSED" });
  const next = new FakePort(),
    delivery = deferred<void>();
  const stalled = createPeerController(
    { sessionId: "s", polite: true, maxPendingSignals: 1, sendSignal: () => delivery.promise },
    next,
  );
  const errors: unknown[] = [];
  stalled.on("error", (e) => errors.push(e));
  await stalled.receiveSignal(description);
  await tick();
  await stalled.receiveSignal(description);
  await tick();
  expect(errors).toContainEqual(
    expect.objectContaining({ code: "BUFFER_LIMIT", operation: "sendSignal" }),
  );
  stalled.close();
  delivery.resolve();
});
