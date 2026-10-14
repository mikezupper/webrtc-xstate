import { expect, it } from "vitest";
import { createSignalingServer } from "../../../apps/signaling-server/src/server.ts";
import { createSignalingChannel } from "../src/index.js";

it("pairs channels and relays payloads while clearing sessions when a peer leaves", async () => {
  const server = await createSignalingServer({ port: 0 });
  const a = createSignalingChannel({ url: server.url, room: "adapter" }),
    b = createSignalingChannel({ url: server.url, room: "adapter" });
  try {
    await expect.poll(() => a.getState().phase).toBe("ready");
    await expect.poll(() => b.getState().phase).toBe("ready");
    expect(a.getState().session?.sessionId).toBe(b.getState().session?.sessionId);
    const received: unknown[] = [];
    b.onMessage((m) => {
      received.push(m);
    });
    a.send({ hello: "world" });
    await expect.poll(() => received).toEqual([{ hello: "world" }]);
    a.dispose();
    a.dispose();
    await expect.poll(() => b.getState().phase).toBe("waiting");
    expect(b.getState().session).toBeNull();
    expect(() => a.send({})).toThrow();
  } finally {
    a.dispose();
    b.dispose();
    await server.close();
  }
});
