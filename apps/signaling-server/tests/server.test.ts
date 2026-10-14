import { expect, it } from "vitest";
import WebSocket from "ws";
import { createSignalingServer } from "../src/server.ts";

function client(url: string) {
  const socket = new WebSocket(url);
  const messages: unknown[] = [];
  socket.on("message", (m) => messages.push(JSON.parse(m.toString())));
  return {
    socket,
    messages,
    async open() {
      await new Promise<void>((yes, no) => {
        socket.once("open", yes);
        socket.once("error", no);
      });
    },
    async next(kind: string) {
      await expect
        .poll(() => messages.find((m) => (m as { kind: string }).kind === kind))
        .toBeTruthy();
      return messages.find((m) => (m as { kind: string }).kind === kind) as {
        kind: string;
        sessionId: string;
        polite: boolean;
      };
    },
  };
}
it("pairs two clients, assigns opposite glare roles and relays only the current session", async () => {
  const server = await createSignalingServer({ port: 0 });
  const a = client(server.url),
    b = client(server.url);
  try {
    await Promise.all([a.open(), b.open()]);
    a.socket.send(JSON.stringify({ kind: "join", room: "test" }));
    await a.next("waiting");
    b.socket.send(JSON.stringify({ kind: "join", room: "test" }));
    const one = await a.next("ready"),
      two = await b.next("ready");
    expect(one.sessionId).toBe(two.sessionId);
    expect(one.polite).toBe(false);
    expect(two.polite).toBe(true);
    a.socket.send(
      JSON.stringify({ kind: "signal", sessionId: one.sessionId, payload: { hello: "world" } }),
    );
    await b.next("signal");
    expect(b.messages).toContainEqual({
      kind: "signal",
      sessionId: one.sessionId,
      payload: { hello: "world" },
    });
    a.socket.send(JSON.stringify({ kind: "signal", sessionId: "old", payload: { bad: true } }));
    await a.next("error");
    expect(b.messages).not.toContainEqual(expect.objectContaining({ payload: { bad: true } }));
  } finally {
    a.socket.close();
    b.socket.close();
    await server.close();
  }
});

it("rejects malformed joins and full rooms and gives re-paired clients a fresh session", async () => {
  const server = await createSignalingServer({ port: 0 });
  const a = client(server.url),
    b = client(server.url),
    c = client(server.url);
  try {
    await Promise.all([a.open(), b.open(), c.open()]);
    a.socket.send("{");
    await a.next("error");
    expect(a.messages).toContainEqual({ kind: "error", code: "INVALID_MESSAGE" });
    a.messages.length = 0;
    a.socket.send(JSON.stringify({ kind: "join", room: "bad/room" }));
    await a.next("error");
    expect(a.messages).toContainEqual({ kind: "error", code: "INVALID_ROOM" });
    a.messages.length = 0;
    for (const peer of [a, b]) peer.socket.send(JSON.stringify({ kind: "join", room: "again" }));
    const original = await b.next("ready");
    c.socket.send(JSON.stringify({ kind: "join", room: "again" }));
    await c.next("error");
    expect(c.messages).toContainEqual({ kind: "error", code: "ROOM_FULL" });
    c.messages.length = 0;
    b.messages.length = 0;
    a.socket.close();
    await b.next("peer-left");
    c.socket.send(JSON.stringify({ kind: "join", room: "again" }));
    const repaired = await b.next("ready");
    expect(repaired.sessionId).not.toBe(original.sessionId);
    expect((await c.next("ready")).sessionId).toBe(repaired.sessionId);
  } finally {
    a.socket.close();
    b.socket.close();
    c.socket.close();
    await server.close();
  }
});
it("provides metadata-only health and rejects unauthorized browser origins", async () => {
  const server = await createSignalingServer({ port: 0 });
  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/health`);
    expect(await response.json()).toEqual({ service: "peerweave-signaling", status: "ok" });
    const socket = new WebSocket(server.url, { origin: "https://untrusted.example" });
    await expect(
      new Promise<void>((resolve, reject) => {
        socket.once("open", resolve);
        socket.once("error", reject);
      }),
    ).rejects.toThrow("403");
    await server.close();
    await server.close();
  } finally {
    await server.close();
  }
});
