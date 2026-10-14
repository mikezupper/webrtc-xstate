import { captureMedia, captureScreen, enumerateDevices } from "@peerweave/media";
import { expect, it } from "vitest";

it("captures native audio/video, enumerates devices and releases owned tracks", async () => {
  const capture = await captureMedia();
  try {
    expect(capture.stream.getAudioTracks()).toHaveLength(1);
    expect(capture.stream.getVideoTracks()).toHaveLength(1);
    expect((await enumerateDevices()).length).toBeGreaterThan(0);
  } finally {
    capture.dispose();
  }
  expect(capture.stream.getTracks().every((t) => t.readyState === "ended")).toBe(true);
});
it("reports invalid native screen constraints without acquiring resources", async () => {
  await expect(captureScreen({ video: false })).rejects.toMatchObject({
    code: "ACQUISITION_FAILED",
    cause: expect.any(Error),
  });
});

it("owns and disposes a native screen capture", async () => {
  const screen = await captureScreen();
  expect(screen.stream.getVideoTracks().length).toBeGreaterThan(0);
  screen.dispose();
  expect(screen.stream.getTracks().every((t) => t.readyState === "ended")).toBe(true);
});
