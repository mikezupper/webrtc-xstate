import { createCall } from "@peerweave/call";
import { expect, it } from "vitest";

it("composes native camera, microphone and screen capture without leaking owned tracks", async () => {
  const a = createCall({
      sessionId: "capture",
      polite: false,
      sendSignal: (m) => b.receiveSignal(m),
    }),
    b = createCall({ sessionId: "capture", polite: true, sendSignal: (m) => a.receiveSignal(m) });
  const errors: unknown[] = [];
  a.on("error", (e) => errors.push(e));
  b.on("error", (e) => errors.push(e));
  try {
    await Promise.all([a.start(), b.start()]);
    await expect.poll(() => a.getState().phase, { timeout: 10000 }).toBe("active");
    const local = a.getLocalStream();
    if (!local) throw new Error("Missing capture");
    expect(local.getTracks()).toHaveLength(2);
    a.setMicrophoneEnabled(false);
    expect(local.getAudioTracks()[0]?.enabled).toBe(false);
    a.setCameraEnabled(false);
    await a.shareScreen();
    expect(a.getState().screenSharing).toBe(true);
    await a.stopSharingScreen();
    expect(a.getState().screenSharing).toBe(false);
    a.setCameraEnabled(true);
    await a.hangUp();
    expect(local.getTracks().every((t) => t.readyState === "ended")).toBe(true);
    expect(
      b
        .getLocalStream()
        ?.getTracks()
        .every((t) => t.readyState === "ended"),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    a.dispose();
    b.dispose();
  }
});
