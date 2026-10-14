import { expect, it } from "vitest";

it("establishes native data transport when initial ICE allocation precedes rollback", async () => {
  const a = new RTCPeerConnection(),
    b = new RTCPeerConnection();
  const channel = a.createDataChannel("a");
  b.createDataChannel("b");
  try {
    await Promise.all([a.setLocalDescription(), b.setLocalDescription()]);
    await expect.poll(() => a.iceGatheringState, { timeout: 10000 }).toBe("complete");
    await expect.poll(() => b.iceGatheringState, { timeout: 10000 }).toBe("complete");
    const offer = a.localDescription;
    if (!offer) throw new Error("Missing offer");
    await b.setRemoteDescription(offer);
    await b.setLocalDescription();
    await expect.poll(() => b.iceGatheringState, { timeout: 10000 }).toBe("complete");
    const answer = b.localDescription;
    if (!answer) throw new Error("Missing answer");
    await a.setRemoteDescription(answer);
    await expect.poll(() => channel.readyState, { timeout: 10000 }).toBe("open");
  } finally {
    a.close();
    b.close();
  }
});
