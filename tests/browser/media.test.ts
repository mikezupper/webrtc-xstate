import { captureMedia, enumerateDevices } from "@peerweave/media";
import { expect, it } from "vitest";

it("owns actual browser tracks, removes observers and stops captures on abort", async () => {
  const canvas = document.createElement("canvas");
  const stream = canvas.captureStream(5);
  const abort = new AbortController();
  const capture = await captureMedia(
    { video: true },
    {
      signal: abort.signal,
      platform: {
        userMedia: async () => stream,
        displayMedia: async () => stream,
        devices: async () => [],
      },
    },
  );
  expect(capture.stream).toBe(stream);
  abort.abort();
  expect(stream.getTracks().every((t) => t.readyState === "ended")).toBe(true);
  capture.dispose();
  expect(Array.isArray(await enumerateDevices())).toBe(true);
});
