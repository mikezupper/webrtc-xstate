import { initial, inputsFor, step } from "@gyral/testing";
import { describe, expect, it } from "vitest";
import { callActions, Workbench } from "../src/call/component.js";
import { appendMessage, type CallView, initialCallView } from "../src/call/controller.js";
import { callMood } from "../src/call/parts.js";
import { summarizeStats } from "../src/call/stats.js";
import { mediaMood } from "../src/media/component.js";
import { describeTrack, initialMediaView } from "../src/media/controller.js";
import { supportMood } from "../src/support/component.js";
import { transferMood } from "../src/transfer/component.js";
import { initialTransferView } from "../src/transfer/controller.js";

const call = (patch: Partial<CallView>): CallView => ({ ...initialCallView, ...patch });

describe("chat history", () => {
  it("records who sent each message and keeps the latest hundred", () => {
    const first = appendMessage([], "you", "Hello", 1_000);
    expect(first).toEqual([{ id: 0, from: "you", text: "Hello", at: 1_000 }]);
    const reply = appendMessage(first, "peer", "Hi there", 2_000);
    expect(reply.map((message) => [message.id, message.from])).toEqual([
      [0, "you"],
      [1, "peer"],
    ]);
    let long = reply;
    for (let index = 0; index < 120; index++) long = appendMessage(long, "peer", `${index}`, index);
    expect(long).toHaveLength(100);
    expect(long.at(-1)).toMatchObject({ id: 121, text: "119" });
  });
});

describe("connection report", () => {
  const sample = (time: number, bytesSent: number, bytesReceived: number) =>
    new Map<string, Record<string, unknown>>([
      [
        "pair",
        {
          type: "candidate-pair",
          state: "succeeded",
          nominated: true,
          localCandidateId: "local",
          remoteCandidateId: "remote",
          currentRoundTripTime: 0.0384,
          timestamp: time,
        },
      ],
      ["local", { type: "local-candidate", candidateType: "host", protocol: "udp" }],
      ["remote", { type: "remote-candidate", candidateType: "srflx", protocol: "udp" }],
      [
        "in-video",
        {
          type: "inbound-rtp",
          kind: "video",
          packetsReceived: 990,
          packetsLost: 10,
          jitter: 0.006,
          bytesReceived,
          frameWidth: 1280,
          frameHeight: 720,
          framesPerSecond: 30,
          timestamp: time,
        },
      ],
      [
        "in-audio",
        {
          type: "inbound-rtp",
          kind: "audio",
          packetsReceived: 500,
          packetsLost: 0,
          jitter: 0.012,
          bytesReceived: 4_000,
          timestamp: time,
        },
      ],
      [
        "out-video",
        {
          type: "outbound-rtp",
          kind: "video",
          bytesSent,
          frameWidth: 640,
          frameHeight: 360,
          framesPerSecond: 24,
          timestamp: time,
        },
      ],
    ]);

  it("summarizes the selected pair, loss, jitter and video from native statistics", () => {
    const summary = summarizeStats(sample(10_000, 50_000, 80_000));
    expect(summary).toMatchObject({
      roundTripMs: 38,
      packetLossPercent: 0.7,
      jitterMs: 12,
      route: "host → srflx · udp",
      outgoingVideo: "640 × 360 · 24 fps",
      incomingVideo: "1280 × 720 · 30 fps",
      bytesSent: 50_000,
      bytesReceived: 84_000,
      sentKbps: null,
      receivedKbps: null,
    });
  });

  it("derives bitrates from the previous sample and tolerates missing statistics", () => {
    const before = summarizeStats(sample(10_000, 50_000, 80_000));
    const after = summarizeStats(sample(12_000, 300_000, 584_000), before);
    expect(after.sentKbps).toBe(1000);
    expect(after.receivedKbps).toBe(2016);
    expect(summarizeStats(new Map())).toMatchObject({
      roundTripMs: null,
      packetLossPercent: null,
      jitterMs: null,
      route: null,
      outgoingVideo: null,
      incomingVideo: null,
    });
  });
});

describe("phase moods drive the colour of each example", () => {
  it("maps call relay, readiness and call phases", () => {
    expect(callMood(call({}))).toBe("idle");
    expect(callMood(call({ relay: "waiting" }))).toBe("lobby");
    expect(callMood(call({ relay: "ready", paired: true }))).toBe("ready");
    expect(callMood(call({ relay: "ready", paired: true, phase: "waiting" }))).toBe("starting");
    expect(callMood(call({ relay: "ready", paired: true, phase: "connecting" }))).toBe(
      "connecting",
    );
    expect(callMood(call({ relay: "ready", paired: true, phase: "active" }))).toBe("active");
    expect(callMood(call({ relay: "ready", paired: true, phase: "recovering" }))).toBe(
      "recovering",
    );
    expect(callMood(call({ phase: "failed" }))).toBe("failed");
    expect(callMood(call({ phase: "ended" }))).toBe("ended");
  });

  it("rings while a support invitation is pending", () => {
    const paired = { relay: "ready", paired: true } as const;
    expect(supportMood(call({ ...paired, invitation: "outgoing" }))).toBe("ringing");
    expect(supportMood(call({ ...paired, invitation: "incoming" }))).toBe("ringing");
    expect(supportMood(call({ ...paired, invitation: "declined" }))).toBe("ready");
    expect(supportMood(call({ ...paired, invitation: "accepted", phase: "active" }))).toBe(
      "active",
    );
  });

  it("maps media preview and file transfer phases", () => {
    expect(mediaMood({ ...initialMediaView, phase: "ready" })).toBe("live");
    expect(mediaMood({ ...initialMediaView, phase: "preparing" })).toBe("preparing");
    expect(transferMood(initialTransferView)).toBe("idle");
    expect(transferMood({ ...initialTransferView, relay: "waiting" })).toBe("lobby");
    const open = { ...initialTransferView, relay: "ready", ready: true } as const;
    expect(transferMood(open)).toBe("ready");
    expect(transferMood({ ...open, phase: "offered" })).toBe("offered");
    expect(transferMood({ ...open, phase: "receiving" })).toBe("sending");
    expect(transferMood({ ...open, phase: "complete" })).toBe("complete");
    expect(transferMood({ ...open, phase: "declined" })).toBe("ready");
    expect(transferMood({ ...open, phase: "failed" })).toBe("failed");
  });
});

it("describes captured tracks by kind, label and resolution", () => {
  const track = (kind: string, label: string, settings: MediaTrackSettings) => ({
    kind,
    label,
    getSettings: () => settings,
  });
  expect(describeTrack(track("video", "FaceTime HD", { width: 1280, height: 720 }))).toEqual({
    kind: "video",
    label: "FaceTime HD",
    detail: "1280 × 720",
  });
  expect(describeTrack(track("audio", "", {}))).toEqual({
    kind: "audio",
    label: "Browser device",
    detail: "",
  });
});

it("opens the connection report with a stats request and closes it from the dialog", () => {
  const state = {
    ...initial(Workbench.spec, { initialRoom: "room" }).state,
    view: call({ relay: "ready", paired: true, phase: "active" }),
  };
  const opened = step(Workbench.spec, state, { _tag: "Report", open: true });
  expect(opened.state.reportOpen).toBe(true);
  expect(inputsFor(opened.commands, callActions)).toEqual([{ _tag: "Stats" }]);
  const closed = step(Workbench.spec, opened.state, { _tag: "Report", open: false });
  expect(closed.state.reportOpen).toBe(false);
  expect(closed.commands).toEqual([]);
});
