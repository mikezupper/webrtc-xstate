import { createSignalingServer } from "./server.ts";

const allowedOrigins = process.env.PEERWEAVE_ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const server = await createSignalingServer({
  port: Number(process.env.PEERWEAVE_PORT ?? 8787),
  host: process.env.PEERWEAVE_HOST ?? "127.0.0.1",
  ...(allowedOrigins === undefined ? {} : { allowedOrigins }),
});
console.log(`Peerweave development relay: ${server.url}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void server.close().then(() => {
      process.exitCode = 0;
    });
  });
