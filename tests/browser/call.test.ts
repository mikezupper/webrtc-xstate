import { createCall } from "@peerweave/call";
import { expect, it } from "vitest";

it("composes managed data-only calls with native peers and terminal cleanup", async () => {
  const a = createCall({
      sessionId: "managed",
      polite: false,
      sendSignal: (m) => b.receiveSignal(m),
    }),
    b = createCall({ sessionId: "managed", polite: true, sendSignal: (m) => a.receiveSignal(m) });
  const errors: unknown[] = [];
  a.on("error", (e) => errors.push(e));
  b.on("error", (e) => errors.push(e));
  let received = "";
  b.on("datachannel", (e) => {
    e.channel.onmessage = (m) => {
      received = m.data;
    };
  });
  try {
    await Promise.all([a.start(false), b.start(false)]);
    const channel = a.createDataChannel("managed");
    b.createDataChannel("glare");
    await expect.poll(() => a.getState().phase, { timeout: 10000 }).toBe("active");
    await expect.poll(() => channel.readyState, { timeout: 10000 }).toBe("open");
    channel.send("managed");
    await expect.poll(() => received).toBe("managed");
    expect((await a.getStats()).size).toBeGreaterThan(0);
    await a.hangUp();
    expect(a.getState().phase).toBe("ended");
    expect(b.getState().phase).toBe("ended");
    expect(errors).toEqual([]);
  } finally {
    a.dispose();
    b.dispose();
  }
});
