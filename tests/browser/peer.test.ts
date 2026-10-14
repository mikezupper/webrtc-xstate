import { createPeer } from "@peerweave/peer";
import { expect, it } from "vitest";

it("creates and closes a real browser connection without stopping borrowed media", () => {
  const canvas = document.createElement("canvas");
  const stream = canvas.captureStream(5);
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error("Missing captured track");
  const peer = createPeer({ sessionId: "native", polite: true, sendSignal: () => {} });
  const sender = peer.addTrack(track, stream);
  expect(sender.track).toBe(track);
  peer.close();
  peer.close();
  expect(peer.getState().closed).toBe(true);
  expect(track.readyState).toBe("live");
  track.stop();
});

it("exchanges data while both real peers negotiate simultaneous offers", async () => {
  const errors: Error[] = [];
  const trace: unknown[] = [];
  const note = (side: string, message: import("@peerweave/peer").SignalMessage) => {
    trace.push({
      side,
      kind: message.kind,
      type: message.kind === "description" ? message.description.type : null,
      media: message.kind === "description" ? message.description.sdp.match(/^m=.*$/gm) : null,
      generation:
        message.kind === "description"
          ? message.description.sdp.match(/a=ice-ufrag:([^\r\n]+)/)?.[1]
          : message.candidate?.usernameFragment,
    });
  };
  const a = createPeer({
    sessionId: "data",
    polite: false,
    sendSignal: (message) => {
      note("a", message);
      return b.receiveSignal(message);
    },
  });
  const b = createPeer({
    sessionId: "data",
    polite: true,
    sendSignal: (message) => {
      note("b", message);
      return a.receiveSignal(message);
    },
  });
  a.on("error", (error) => errors.push(error));
  b.on("error", (error) => errors.push(error));
  const messages: string[] = [];
  b.on("datachannel", ({ channel }) => {
    channel.onmessage = (event) => messages.push(event.data);
  });
  const channel = a.createDataChannel("chat");
  b.createDataChannel("simultaneous");
  try {
    await expect.poll(() => channel.readyState, { timeout: 10000 }).toBe("open");
    channel.send("peerweave");
    await expect.poll(() => messages).toEqual(["peerweave"]);
    expect(errors).toEqual([]);
    expect((await a.getStats()).size).toBeGreaterThan(0);
  } catch (error) {
    console.warn(
      JSON.stringify({
        trace,
        a: a.getState(),
        b: b.getState(),
        errors: errors.map((e) => ({ message: e.message, cause: String(e.cause) })),
      }),
    );
    throw error;
  } finally {
    a.close();
    b.close();
  }
});

it("renegotiates bidirectional video, native transceivers and ICE restarts", async () => {
  const errors: unknown[] = [];
  const streams = [
    document.createElement("canvas").captureStream(20),
    document.createElement("canvas").captureStream(20),
  ];
  const a = createPeer({
      sessionId: "video",
      polite: false,
      sendSignal: (m) => b.receiveSignal(m),
    }),
    b = createPeer({ sessionId: "video", polite: true, sendSignal: (m) => a.receiveSignal(m) });
  a.on("error", (e) => errors.push(e));
  b.on("error", (e) => errors.push(e));
  const tracks: MediaStreamTrack[] = [];
  a.on("track", (e) => tracks.push(e.track));
  b.on("track", (e) => tracks.push(e.track));
  try {
    const first = streams[0],
      second = streams[1];
    if (!first || !second) throw new Error("Missing streams");
    const track = first.getVideoTracks()[0];
    if (!track) throw new Error("Missing video");
    const sender = a.addTrack(track, first);
    await expect.poll(() => tracks.length, { timeout: 10000 }).toBe(1);
    const back = second.getVideoTracks()[0];
    if (!back) throw new Error("Missing video");
    const transceiver = b.addTransceiver(back, { direction: "sendrecv", streams: [second] });
    expect(b.getTransceivers()).toContain(transceiver);
    await expect.poll(() => tracks.length, { timeout: 10000 }).toBe(2);
    await expect.poll(() => a.getState().connectionState, { timeout: 10000 }).toBe("connected");
    await sender.replaceTrack(back);
    a.restartIce();
    await expect.poll(() => a.getState().signalingState, { timeout: 10000 }).toBe("stable");
    a.removeTrack(sender);
    expect((await b.getStats()).size).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  } finally {
    a.close();
    b.close();
    for (const stream of streams) for (const track of stream.getTracks()) track.stop();
  }
});
