import { createSignalingServer } from "./server.ts";

const server = await createSignalingServer({
  port: Number(process.env.PEERWEAVE_PORT ?? 8787),
  host: process.env.PEERWEAVE_HOST ?? "127.0.0.1",
});
console.log(`Peerweave development relay: ${server.url}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void server.close().then(() => {
      process.exitCode = 0;
    });
  });
