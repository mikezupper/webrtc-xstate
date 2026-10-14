import { expect, it } from "vitest";
import { createCall } from "../src/index.js";
import { captureFixture, FakePeer } from "./fakes.js";

it("starts an owned session and hangs up with exactly one cleanup", async () => {
  const peer = new FakePeer();
  const media = captureFixture();
  const sent: unknown[] = [];
  const call = createCall({
    sessionId: "session",
    polite: true,
    sendSignal: (m) => {
      sent.push(m);
    },
    peerFactory: () => peer,
    mediaFactory: async () => media.capture,
  });
  expect(call.getState().phase).toBe("idle");
  await call.start({ video: true });
  expect(call.getState().phase).toBe("connecting");
  peer.change("connected");
  expect(call.getState().phase).toBe("active");
  await call.hangUp();
  await call.hangUp();
  expect(call.getState().phase).toBe("ended");
  expect(peer.closes).toBe(1);
  expect(media.disposals).toBe(1);
  expect(sent).toEqual([{ version: 1, sessionId: "session", kind: "hangup" }]);
});

it("buffers early signals, rejects stale sessions, and treats remote hangup as terminal", async () => {
  const peer = new FakePeer();
  const sent: unknown[] = [];
  const call = createCall({
    sessionId: "session",
    polite: false,
    sendSignal: (m) => {
      sent.push(m);
    },
    peerFactory: () => peer,
  });
  const candidate = { version: 1, sessionId: "session", kind: "candidate", candidate: null };
  await call.receiveSignal(candidate);
  await expect(call.receiveSignal({ ...candidate, sessionId: "old" })).rejects.toMatchObject({
    code: "SESSION_MISMATCH",
  });
  await call.start(false);
  expect(peer.received).toEqual([candidate]);
  await call.receiveSignal({ version: 1, sessionId: "session", kind: "hangup" });
  expect(call.getState().phase).toBe("ended");
  expect(sent).toEqual([]);
  await expect(call.receiveSignal(candidate)).rejects.toMatchObject({ code: "CLOSED" });
});

it("recovers transient disconnects with bounded ICE restarts and releases resources on exhaustion", async () => {
  const peer = new FakePeer();
  const media = captureFixture();
  const jobs = new Set<() => void>();
  const call = createCall({
    sessionId: "session",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => media.capture,
    recovery: { maxRestarts: 2 },
    schedule: (fn) => {
      jobs.add(fn);
      return () => {
        jobs.delete(fn);
      };
    },
  });
  const run = () => {
    const fn = [...jobs][0];
    if (!fn) throw new Error("No recovery task scheduled");
    jobs.delete(fn);
    fn();
  };
  await call.start();
  peer.change("connected");
  peer.change("disconnected");
  expect(call.getState().phase).toBe("recovering");
  expect(peer.restarts).toBe(0);
  peer.change("connected");
  expect(jobs.size).toBe(0);
  expect(call.getState().phase).toBe("active");
  peer.change("failed");
  run();
  run();
  expect(peer.restarts).toBe(2);
  run();
  expect(call.getState()).toMatchObject({ phase: "failed", error: { code: "RECOVERY_EXHAUSTED" } });
  expect(media.disposals).toBe(1);
  expect(peer.closes).toBe(1);
  expect(jobs.size).toBe(0);
});

it("switches to an owned screen track and restores the camera on natural ending", async () => {
  const peer = new FakePeer();
  const camera = captureFixture();
  const screen = captureFixture();
  const call = createCall({
    sessionId: "session",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => camera.capture,
    screenFactory: async () => screen.capture,
  });
  await call.start();
  await call.shareScreen();
  expect(peer.senders[0]?.track).toBe(screen.track);
  expect(call.getState().screenSharing).toBe(true);
  screen.end();
  await new Promise((r) => setTimeout(r, 0));
  expect(peer.senders[0]?.track).toBe(camera.track);
  expect(screen.disposals).toBe(1);
  expect(call.getState().screenSharing).toBe(false);
  call.dispose();
  expect(camera.disposals).toBe(1);
});

it("isolates consumer listener errors while forwarding peer events", async () => {
  const peer = new FakePeer();
  const call = createCall({
    sessionId: "session",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
  });
  const errors: unknown[] = [];
  call.on("error", (e) => {
    errors.push(e);
  });
  call.subscribe(() => {
    throw new Error("UI");
  });
  let tracks = 0;
  call.on("track", () => {
    tracks++;
  });
  await call.start(false);
  for (const fn of peer.listeners.track) fn({} as RTCTrackEvent);
  expect(tracks).toBe(1);
  expect(errors).toContainEqual(expect.objectContaining({ code: "LISTENER_FAILED" }));
  call.dispose();
  expect(peer.listeners.track.size).toBe(0);
});

it.each([
  { sessionId: "" },
  { polite: "yes" },
  { sendSignal: null },
  { recovery: { maxRestarts: -1 } },
  { recovery: { gracePeriodMs: NaN } },
  { recovery: { retryDelayMs: -5 } },
])("rejects invalid configuration before creating resources: %j", (bad) => {
  let created = 0;
  expect(() =>
    createCall({
      ...{
        sessionId: "session",
        polite: true,
        sendSignal: () => {},
        peerFactory: () => {
          created++;
          return new FakePeer();
        },
      },
      ...bad,
    } as never),
  ).toThrowError(expect.objectContaining({ code: "INVALID_OPTIONS" }));
  expect(created).toBe(0);
});

it("releases local resources before a failed hangup acknowledgement and tags the failure", async () => {
  const peer = new FakePeer();
  const media = captureFixture();
  const cause = new Error("Offline");
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: async () => {
      throw cause;
    },
    peerFactory: () => peer,
    mediaFactory: async () => media.capture,
  });
  await call.start();
  await expect(call.hangUp()).rejects.toMatchObject({ code: "SIGNALING_FAILED", cause });
  expect(peer.closes).toBe(1);
  expect(media.disposals).toBe(1);
  expect(() => call.setCameraEnabled(false)).toThrowError(
    expect.objectContaining({ code: "CLOSED" }),
  );
});

it("disposes screen capture immediately if hangup interrupts track restoration", async () => {
  const peer = new FakePeer();
  const camera = captureFixture(),
    screen = captureFixture();
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => camera.capture,
    screenFactory: async () => screen.capture,
  });
  await call.start();
  await call.shareScreen();
  let resolve!: () => void;
  const sender = peer.senders[0];
  if (!sender) throw new Error("Missing sender");
  sender.replaceTrack = () =>
    new Promise<void>((yes) => {
      resolve = yes;
    });
  const restore = call.stopSharingScreen();
  await call.hangUp();
  expect(screen.disposals).toBe(1);
  resolve();
  await restore;
});

it("stops late capture results after terminal cancellation and preserves acquisition failures", async () => {
  const peer = new FakePeer(),
    late = captureFixture();
  let resolve!: (capture: typeof late.capture) => void;
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  });
  const pending = call.start();
  call.dispose();
  resolve(late.capture);
  await expect(pending).rejects.toMatchObject({ code: "CLOSED" });
  expect(late.disposals).toBe(1);
  expect(peer.closes).toBe(1);
  const second = new FakePeer(),
    cause = new Error("Permission denied");
  const failed = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => second,
    mediaFactory: async () => {
      throw cause;
    },
  });
  let failure: unknown;
  failed.on("error", (e) => {
    failure = e;
  });
  await expect(failed.start()).rejects.toMatchObject({ code: "START_FAILED", cause });
  expect(failure).toMatchObject({ code: "START_FAILED" });
  expect(failed.getState().phase).toBe("failed");
  expect(second.closes).toBe(1);
  failed.dispose();
});
it("exposes native channels, stats, camera and microphone controls and unsubscribe", async () => {
  const peer = new FakePeer(),
    audio = captureFixture("audio"),
    video = captureFixture();
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => ({
      ...audio.capture,
      stream: {
        getTracks: () => [audio.track, video.track],
        getAudioTracks: () => [audio.track],
        getVideoTracks: () => [video.track],
      } as unknown as MediaStream,
    }),
  });
  let notifications = 0;
  const off = call.subscribe(() => {
    notifications++;
  });
  await call.start();
  expect(call.getLocalStream()).not.toBeNull();
  call.setMicrophoneEnabled(false);
  call.setCameraEnabled(false);
  expect(audio.track.enabled).toBe(false);
  expect(video.track.enabled).toBe(false);
  const channel = call.createDataChannel("data");
  expect(channel.label).toBe("data");
  expect((await call.getStats()).size).toBe(0);
  off();
  const before = notifications;
  call.setMicrophoneEnabled(true);
  expect(notifications).toBe(before);
  let delivered = 0;
  const remove = call.on("datachannel", () => {
    delivered++;
  });
  remove();
  for (const fn of peer.listeners.datachannel) fn({} as RTCDataChannelEvent);
  expect(delivered).toBe(0);
  call.dispose();
  await expect(call.getStats()).rejects.toMatchObject({ code: "CLOSED" });
  expect(() => call.createDataChannel("x")).toThrow();
  expect(() => call.on("track", () => {})).toThrow();
  await expect(call.start(false)).rejects.toMatchObject({ code: "INVALID_STATE" });
});
it("terminates on asynchronous peer failure and bounds unstarted signal queues", async () => {
  const peer = new FakePeer(),
    call = createCall({
      sessionId: "s",
      polite: true,
      sendSignal: () => {},
      peerFactory: () => peer,
    });
  const candidate = { version: 1, sessionId: "s", kind: "candidate", candidate: null };
  for (let i = 0; i < 256; i++) await call.receiveSignal(candidate);
  await expect(call.receiveSignal(candidate)).rejects.toMatchObject({ code: "BUFFER_LIMIT" });
  await call.start(false);
  expect(peer.received).toHaveLength(256);
  const errors: unknown[] = [];
  call.on("error", (e) => errors.push(e));
  for (const fn of [...peer.listeners.error])
    fn(Object.assign(new Error("UI"), { code: "LISTENER_FAILED" }));
  expect(call.getState().phase).toBe("connecting");
  for (const fn of [...peer.listeners.error]) fn(new Error("Network"));
  expect(call.getState().phase).toBe("failed");
  expect(errors).toHaveLength(2);
  expect(peer.closes).toBe(1);
});
it("handles missing screen video, denied picker and native renegotiation fallback", async () => {
  const peer = new FakePeer(),
    camera = captureFixture(),
    screen = captureFixture();
  let next = screen.capture;
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => camera.capture,
    screenFactory: async () => next,
  });
  await call.start();
  const sender = peer.senders[0];
  if (!sender) throw new Error("Missing sender");
  sender.replaceTrack = async () => {
    throw new DOMException("Needs negotiation", "InvalidModificationError");
  };
  await call.shareScreen();
  expect(peer.senders[0]?.track).toBe(screen.track);
  await expect(call.shareScreen()).rejects.toMatchObject({ code: "INVALID_STATE" });
  await call.stopSharingScreen();
  await call.stopSharingScreen();
  const empty = captureFixture("audio");
  next = empty.capture;
  await expect(call.shareScreen()).rejects.toMatchObject({ code: "SCREEN_FAILED" });
  expect(empty.disposals).toBe(1);
  call.dispose();
  await expect(call.shareScreen()).rejects.toMatchObject({ code: "CLOSED" });
  const denied = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => new FakePeer(),
    screenFactory: async () => {
      throw new Error("Denied");
    },
  });
  await denied.start(false);
  await expect(denied.shareScreen()).rejects.toMatchObject({ code: "SCREEN_FAILED" });
  denied.dispose();
});

it("bounds initial connection time and detects failure during capture", async () => {
  const peer = new FakePeer(),
    media = captureFixture();
  const jobs = new Set<() => void>();
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    connectionTimeoutMs: 10,
    recovery: { maxRestarts: 0 },
    peerFactory: () => peer,
    schedule: (fn) => {
      jobs.add(fn);
      return () => {
        jobs.delete(fn);
      };
    },
    mediaFactory: async () => {
      peer.change("failed");
      return media.capture;
    },
  });
  await call.start();
  expect(call.getState().phase).toBe("recovering");
  const job = [...jobs][0];
  if (!job) throw new Error("Missing recovery job");
  jobs.delete(job);
  job();
  expect(call.getState().phase).toBe("failed");
  const next = new FakePeer();
  const pending = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    connectionTimeoutMs: 10,
    recovery: { maxRestarts: 0 },
    peerFactory: () => next,
    schedule: (fn) => {
      jobs.add(fn);
      return () => {
        jobs.delete(fn);
      };
    },
  });
  await pending.start(false);
  const timeout = [...jobs][0];
  if (!timeout) throw new Error("Missing startup deadline");
  jobs.delete(timeout);
  timeout();
  expect(pending.getState().phase).toBe("recovering");
  const recovery = [...jobs][0];
  if (!recovery) throw new Error("Missing retry");
  jobs.delete(recovery);
  recovery();
  expect(pending.getState().phase).toBe("failed");
});

it("reports failed native screen restoration while always stopping the screen", async () => {
  const peer = new FakePeer(),
    camera = captureFixture(),
    screen = captureFixture();
  const cause = new Error("Sender closed");
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => camera.capture,
    screenFactory: async () => screen.capture,
  });
  await call.start();
  await call.shareScreen();
  const sender = peer.senders[0];
  if (!sender) throw new Error("Missing sender");
  sender.replaceTrack = async () => {
    throw cause;
  };
  await expect(call.stopSharingScreen()).rejects.toMatchObject({ code: "SCREEN_FAILED", cause });
  expect(screen.disposals).toBe(1);
  call.dispose();
});
it("cancels a pending screen acquisition and rejects concurrent sharing", async () => {
  const peer = new FakePeer(),
    screen = captureFixture();
  let resolve!: (capture: typeof screen.capture) => void;
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    screenFactory: () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  });
  await call.start(false);
  const pending = call.shareScreen();
  await expect(call.shareScreen()).rejects.toMatchObject({ code: "INVALID_STATE" });
  call.dispose();
  resolve(screen.capture);
  await expect(pending).rejects.toMatchObject({ code: "CLOSED" });
  expect(screen.disposals).toBe(1);
});
it("handles native restart failure without leaving timers or media alive", async () => {
  const peer = new FakePeer(),
    media = captureFixture();
  peer.restartIce = () => {
    throw new Error("Native restart failed");
  };
  let job: (() => void) | undefined;
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => media.capture,
    schedule: (fn) => {
      job = fn;
      return () => {
        job = undefined;
      };
    },
  });
  await call.start();
  peer.change("connected");
  peer.change("disconnected");
  if (!job) throw new Error("Missing timer");
  job();
  expect(call.getState()).toMatchObject({
    phase: "failed",
    error: { code: "RECOVERY_EXHAUSTED", operation: "restartIce" },
  });
  expect(media.disposals).toBe(1);
});
it("is active only after initialization and safely notifies terminal subscribers", async () => {
  const peer = new FakePeer(),
    media = captureFixture();
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => {
      peer.change("connected");
      return media.capture;
    },
  });
  await call.start();
  expect(call.getState().phase).toBe("active");
  call.on("error", () => {
    throw new Error("Error observer");
  });
  call.on("track", () => {
    throw new Error("Track observer");
  });
  let tracks = 0;
  call.on("track", () => {
    tracks++;
  });
  for (const fn of peer.listeners.track) fn({} as RTCTrackEvent);
  expect(tracks).toBe(1);
  call.dispose();
  let terminal = "";
  call.subscribe((state) => {
    terminal = state.phase;
  });
  expect(terminal).toBe("ended");
  const idle = createCall({ sessionId: "s", polite: true, sendSignal: () => {} });
  await expect(
    idle.receiveSignal({ version: 2, sessionId: "s", kind: "hangup" }),
  ).rejects.toMatchObject({ code: "SESSION_MISMATCH" });
  await idle.hangUp();
  expect(idle.getState().phase).toBe("ended");
});

it("rejects unsupported managed system audio before opening a picker", async () => {
  let prompts = 0;
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => new FakePeer(),
    screenFactory: async () => {
      prompts++;
      return captureFixture().capture;
    },
  });
  await call.start(false);
  await expect(call.shareScreen({ audio: true } as never)).rejects.toMatchObject({
    code: "INVALID_OPTIONS",
  });
  expect(prompts).toBe(0);
  call.dispose();
});

it("does not create resources when a starting subscriber ends the call", async () => {
  let created = 0;
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => {
      created++;
      return new FakePeer();
    },
  });
  call.subscribe((state) => {
    if (state.phase === "starting") call.dispose();
  });
  await expect(call.start(false)).rejects.toMatchObject({ code: "CLOSED" });
  expect(created).toBe(0);
  expect(call.getState().phase).toBe("ended");
});

it("closes resources returned during reentrant startup cancellation and removes subscriptions", async () => {
  const peer = new FakePeer();
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => {
      call.dispose();
      return peer;
    },
  });
  await expect(call.start(false)).rejects.toMatchObject({ code: "CLOSED" });
  expect(peer.closes).toBe(1);
  expect(peer.observers.size).toBe(0);
  const next = new FakePeer(),
    subscribed = createCall({
      sessionId: "s",
      polite: true,
      sendSignal: () => {},
      peerFactory: () => next,
    });
  subscribed.subscribe((state) => {
    if (state.phase === "starting" && state.peer) subscribed.dispose();
  });
  await expect(subscribed.start(false)).rejects.toMatchObject({ code: "CLOSED" });
  expect(next.closes).toBe(1);
  expect(next.observers.size).toBe(0);
});

it("restores the camera if screen capture ends while native replacement is pending", async () => {
  const peer = new FakePeer(),
    camera = captureFixture(),
    screen = captureFixture();
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => camera.capture,
    screenFactory: async () => screen.capture,
  });
  await call.start();
  const sender = peer.senders[0];
  if (!sender) throw new Error("Missing sender");
  const replace = sender.replaceTrack.bind(sender);
  sender.replaceTrack = async (track) => {
    await replace(track);
    if (track === screen.track) screen.track.stop();
  };
  await expect(call.shareScreen()).rejects.toMatchObject({ code: "SCREEN_FAILED" });
  expect(sender.track).toBe(camera.track);
  expect(call.getState().screenSharing).toBe(false);
  expect(screen.disposals).toBe(1);
  call.dispose();
});

it("controls and restores the original camera when the preview stream is edited", async () => {
  const peer = new FakePeer(),
    camera = captureFixture(),
    borrowed = captureFixture(),
    screen = captureFixture();
  let tracks = [camera.track];
  Object.assign(camera.capture, {
    stream: {
      getTracks: () => tracks,
      getVideoTracks: () => tracks,
      getAudioTracks: () => [],
    } as unknown as MediaStream,
  });
  const call = createCall({
    sessionId: "s",
    polite: true,
    sendSignal: () => {},
    peerFactory: () => peer,
    mediaFactory: async () => camera.capture,
    screenFactory: async () => screen.capture,
  });
  await call.start();
  tracks = [borrowed.track];
  call.setCameraEnabled(false);
  expect(camera.track.enabled).toBe(false);
  expect(borrowed.track.enabled).toBe(true);
  await call.shareScreen();
  await call.stopSharingScreen();
  expect(peer.senders[0]?.track).toBe(camera.track);
  call.dispose();
  expect(borrowed.track.readyState).toBe("live");
  borrowed.capture.dispose();
});
