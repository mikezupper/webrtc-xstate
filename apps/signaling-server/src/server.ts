import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
export interface ServerOptions {
  port?: number;
  host?: string;
  allowedOrigins?: readonly string[];
  maxClients?: number;
}
export async function createSignalingServer(options: ServerOptions = {}) {
  const http = createServer((request, response) => {
    response.writeHead(request.url === "/health" ? 200 : 404, {
      "content-type": "application/json",
    });
    response.end(
      JSON.stringify({
        service: "peerweave-signaling",
        status: request.url === "/health" ? "ok" : "not-found",
      }),
    );
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  const rooms = new Map<string, WebSocket[]>();
  const membership = new Map<WebSocket, { room: string; sessionId: string | null }>();
  const send = (socket: WebSocket, value: unknown) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
  };
  const reject = (socket: WebSocket, code: string) => send(socket, { kind: "error", code });
  const remove = (socket: WebSocket) => {
    const member = membership.get(socket);
    if (!member) return;
    membership.delete(socket);
    const remaining = (rooms.get(member.room) ?? []).filter((s) => s !== socket);
    if (!remaining.length) rooms.delete(member.room);
    else {
      rooms.set(member.room, remaining);
      for (const other of remaining) {
        const record = membership.get(other);
        if (record) record.sessionId = null;
        send(other, { kind: "peer-left" });
      }
    }
  };
  http.on("upgrade", (request, socket, head) => {
    const origin = request.headers.origin;
    const allowed =
      !origin ||
      (options.allowedOrigins
        ? options.allowedOrigins.includes(origin)
        : /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
    if (
      request.url !== "/signaling" ||
      !allowed ||
      sockets.clients.size >= (options.maxClients ?? 100)
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) =>
      sockets.emit("connection", client, request),
    );
  });
  sockets.on("connection", (socket) => {
    socket.on("error", () => remove(socket));
    socket.on("close", () => remove(socket));
    socket.on("message", (data, isBinary) => {
      let message: unknown;
      try {
        if (isBinary) throw new Error("binary");
        message = JSON.parse(data.toString());
      } catch {
        reject(socket, "INVALID_MESSAGE");
        return;
      }
      if (!message || typeof message !== "object" || !("kind" in message)) {
        reject(socket, "INVALID_MESSAGE");
        return;
      }
      if (message.kind === "join") {
        if (
          membership.has(socket) ||
          !("room" in message) ||
          typeof message.room !== "string" ||
          !/^[-\w]{1,64}$/.test(message.room)
        ) {
          reject(socket, "INVALID_ROOM");
          return;
        }
        const members = rooms.get(message.room) ?? [];
        if (members.length >= 2) {
          reject(socket, "ROOM_FULL");
          return;
        }
        members.push(socket);
        rooms.set(message.room, members);
        membership.set(socket, { room: message.room, sessionId: null });
        if (members.length === 1) {
          send(socket, { kind: "waiting" });
          return;
        }
        const sessionId = randomUUID();
        for (const [index, member] of members.entries()) {
          const record = membership.get(member);
          if (record) record.sessionId = sessionId;
          send(member, { kind: "ready", sessionId, polite: index === 1 });
        }
      } else if (message.kind === "signal") {
        const member = membership.get(socket);
        if (
          !member?.sessionId ||
          !("sessionId" in message) ||
          message.sessionId !== member.sessionId ||
          !("payload" in message)
        ) {
          reject(socket, "SESSION_MISMATCH");
          return;
        }
        for (const other of rooms.get(member.room) ?? [])
          if (other !== socket)
            send(other, { kind: "signal", sessionId: member.sessionId, payload: message.payload });
      } else reject(socket, "INVALID_MESSAGE");
    });
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(options.port ?? 8787, options.host ?? "127.0.0.1", () => {
      http.removeListener("error", reject);
      resolve();
    });
  });
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("No listening address");
  let closing: Promise<void> | undefined;
  return {
    url: `ws://${options.host ?? "127.0.0.1"}:${address.port}/signaling`,
    port: address.port,
    close() {
      closing ??= new Promise<void>((resolve, reject) => {
        for (const socket of sockets.clients) socket.terminate();
        sockets.close();
        http.close((error) => (error ? reject(error) : resolve()));
      });
      return closing;
    },
  };
}
