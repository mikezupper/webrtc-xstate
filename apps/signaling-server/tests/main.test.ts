import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import WebSocket from "ws";

async function withRelay(allowedOrigins: string | undefined, run: (url: string) => Promise<void>) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PEERWEAVE_PORT: "0",
    PEERWEAVE_HOST: "127.0.0.1",
  };
  delete env.PEERWEAVE_ALLOWED_ORIGINS;
  if (allowedOrigins !== undefined) env.PEERWEAVE_ALLOWED_ORIGINS = allowedOrigins;
  const server = spawn(
    process.execPath,
    [fileURLToPath(new URL("../src/main.ts", import.meta.url))],
    {
      env,
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  const exited = once(server, "exit");
  const lines = createInterface({ input: server.stdout });
  try {
    for await (const line of lines) {
      const url = line.match(/ws:\/\/\S+/)?.[0];
      if (url) {
        await run(url);
        return;
      }
    }
    throw new Error("Relay exited before listening");
  } finally {
    lines.close();
    server.kill("SIGTERM");
    await exited;
  }
}

async function connect(url: string, origin: string) {
  const socket = new WebSocket(url, { origin, handshakeTimeout: 2000 });
  try {
    await once(socket, "open");
  } finally {
    socket.close();
  }
}

it("accepts a tunnel page origin configured through the relay environment", async () => {
  await withRelay(" http://127.0.0.1:5173, https://demo.example.com, ", async (url) => {
    await expect(connect(url, "https://demo.example.com")).resolves.toBeUndefined();
  });
});

it.each(["http://127.0.0.1:5173", "https://demo.example.com.evil.example"])(
  "rejects an unlisted origin %s when the environment provides an exact allowlist",
  async (origin) => {
    await withRelay("https://demo.example.com", async (url) => {
      await expect(connect(url, origin)).rejects.toThrow("403");
    });
  },
);

it("keeps the localhost default when the origin environment variable is unset", async () => {
  await withRelay(undefined, async (url) => {
    await expect(connect(url, "http://127.0.0.1:5173")).resolves.toBeUndefined();
  });
});
