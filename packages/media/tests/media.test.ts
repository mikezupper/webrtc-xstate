import { expect, it } from "vitest";
import { captureMedia, captureScreen, enumerateDevices } from "../src/index.js";
import type { MediaPlatform } from "../src/types.js";

export function mediaFixture() {
  const track = Object.assign(new EventTarget(), {
    kind: "video",
    enabled: true,
    readyState: "live",
    stops: 0,
    stop() {
      this.stops++;
      this.readyState = "ended";
    },
  });
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
  const platform: MediaPlatform = {
    userMedia: async () => stream,
    displayMedia: async () => stream,
    devices: async () => [],
  };
  return { track, stream, platform };
}

it("returns an owned capture and disposes its tracks exactly once", async () => {
  const fixture = mediaFixture();
  const capture = await captureMedia({ video: true }, { platform: fixture.platform });
  expect(capture.stream).toBe(fixture.stream);
  capture.dispose();
  capture.dispose();
  expect(fixture.track.stops).toBe(1);
  expect(capture.disposed).toBe(true);
});

it("supports screen capture and device enumeration through the media platform", async () => {
  const fixture = mediaFixture();
  const screen = await captureScreen({ video: true }, { platform: fixture.platform });
  expect(screen.stream).toBe(fixture.stream);
  expect(await enumerateDevices({ platform: fixture.platform })).toEqual([]);
  screen.dispose();
});

it("notifies natural track endings and removes listeners on disposal", async () => {
  const fixture = mediaFixture();
  const capture = await captureMedia({ video: true }, { platform: fixture.platform });
  const ended: MediaStreamTrack[] = [];
  capture.onEnded((track) => ended.push(track));
  fixture.track.dispatchEvent(new Event("ended"));
  expect(ended).toEqual([fixture.track]);
  capture.dispose();
  fixture.track.dispatchEvent(new Event("ended"));
  expect(ended).toHaveLength(1);
});

it("cancels a pending prompt and stops a late capture result", async () => {
  const fixture = mediaFixture();
  let resolve!: (stream: MediaStream) => void;
  fixture.platform.userMedia = () =>
    new Promise((yes) => {
      resolve = yes;
    });
  const abort = new AbortController();
  const pending = captureMedia(
    { video: true },
    { platform: fixture.platform, signal: abort.signal },
  );
  abort.abort();
  resolve(fixture.stream);
  await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
  expect(fixture.track.stops).toBe(1);
});

it("does not acquire after a prior abort and releases resolved captures on abort", async () => {
  const f = mediaFixture();
  const abort = new AbortController();
  abort.abort("cancelled");
  await expect(
    captureMedia({}, { platform: f.platform, signal: abort.signal }),
  ).rejects.toMatchObject({ code: "ABORTED", cause: "cancelled" });
  expect(f.track.stops).toBe(0);
  const active = new AbortController();
  const capture = await captureMedia({}, { platform: f.platform, signal: active.signal });
  active.abort();
  expect(capture.disposed).toBe(true);
  expect(f.track.stops).toBe(1);
});

it("preserves permission errors, handles synchronous failures and missing browser APIs", async () => {
  const f = mediaFixture();
  const denied = new DOMException("Denied", "NotAllowedError");
  f.platform.userMedia = async () => {
    throw denied;
  };
  await expect(captureMedia({}, { platform: f.platform })).rejects.toMatchObject({
    code: "ACQUISITION_FAILED",
    cause: denied,
  });
  f.platform.displayMedia = () => {
    throw denied;
  };
  await expect(captureScreen({}, { platform: f.platform })).rejects.toMatchObject({
    code: "ACQUISITION_FAILED",
    cause: denied,
  });
  f.platform.devices = async () => {
    throw denied;
  };
  await expect(enumerateDevices({ platform: f.platform })).rejects.toMatchObject({ cause: denied });
  await expect(captureMedia()).rejects.toMatchObject({ code: "UNAVAILABLE" });
  await expect(captureScreen()).rejects.toMatchObject({ code: "UNAVAILABLE" });
  await expect(enumerateDevices()).rejects.toMatchObject({ code: "UNAVAILABLE" });
});

it("forwards device constraints and removes individual end observers", async () => {
  const f = mediaFixture();
  let received: MediaStreamConstraints | undefined;
  f.platform.userMedia = async (c) => {
    received = c;
    return f.stream;
  };
  const constraints = { video: { deviceId: { exact: "camera" } }, audio: false };
  const capture = await captureMedia(constraints, { platform: f.platform });
  expect(received).toBe(constraints);
  let ended = 0;
  const off = capture.onEnded(() => {
    ended++;
  });
  off();
  f.track.dispatchEvent(new Event("ended"));
  expect(ended).toBe(0);
  capture.dispose();
  capture.onEnded(() => {
    ended++;
  });
  f.track.dispatchEvent(new Event("ended"));
  expect(ended).toBe(0);
});

it("retains ownership of removed acquired tracks and preserves tracks added by the caller", async () => {
  const acquired = mediaFixture(),
    borrowed = mediaFixture();
  let tracks = [acquired.track];
  const stream = {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
    getAudioTracks: () => [],
  } as unknown as MediaStream;
  acquired.platform.userMedia = async () => stream;
  const capture = await captureMedia({}, { platform: acquired.platform });
  tracks = [borrowed.track];
  capture.dispose();
  expect(acquired.track.stops).toBe(1);
  expect(borrowed.track.stops).toBe(0);
  borrowed.track.stop();
});
