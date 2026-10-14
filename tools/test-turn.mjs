import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { connect } from "node:net";
import { chromium } from "playwright";
import { createServer } from "vite";

// Coturn 4.18.0-r0, pinned to the verified image digest.
const image =
  "coturn/coturn@sha256:bbefd3e1fdfdc0d58770fe01b581fd8b00d9f3a5580d00acb77cf719a6bc78e3";
const name = `peerweave-turn-${randomUUID()}`,
  credential = randomUUID();
let vite,
  browser,
  started = false;
try {
  execFileSync(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      name,
      "--network",
      "host",
      image,
      "-n",
      "--log-file=stdout",
      "--listening-ip=127.0.0.1",
      "--relay-ip=127.0.0.1",
      "--listening-port=34780",
      "--min-port=49600",
      "--max-port=49700",
      "--realm=peerweave.test",
      "--lt-cred-mech",
      `--user=peerweave:${credential}`,
      "--allow-loopback-peers",
      "--no-tls",
      "--relay-threads=2",
    ],
    { stdio: "pipe" },
  );
  started = true;
  const deadline = Date.now() + 10000;
  let ready = false;
  while (!ready && Date.now() < deadline) {
    ready = await new Promise((resolve) => {
      const socket = connect(34780, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Coturn did not open its local TCP listener");
  vite = await createServer({
    configFile: false,
    root: new URL("..", import.meta.url).pathname,
    server: { host: "127.0.0.1", port: 0 },
  });
  vite.middlewares.use((request, response, next) => {
    if (request.url !== "/") {
      next();
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end("<!doctype html><title>Peerweave TURN verification</title>");
  });
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(vite.resolvedUrls.local[0]);
  for (const protocol of ["udp", "tcp"]) {
    const result = await page.evaluate(
      async (configuration) => {
        const { createPeer } = await import("/packages/peer/src/index.ts");
        let offers = 0;
        const errors = [];
        const received = [];
        const a = createPeer({
          sessionId: "turn",
          polite: false,
          rtcConfiguration: configuration,
          sendSignal: (message) => {
            if (message.kind === "description" && message.description.type === "offer") offers++;
            return b.receiveSignal(message);
          },
        });
        const b = createPeer({
          sessionId: "turn",
          polite: true,
          rtcConfiguration: configuration,
          sendSignal: (message) => a.receiveSignal(message),
        });
        a.on("error", (e) => errors.push(e.message));
        b.on("error", (e) => errors.push(e.message));
        b.on("datachannel", (e) => {
          e.channel.onmessage = (m) => received.push(m.data);
        });
        const until = async (predicate) => {
          const deadline = Date.now() + 15000;
          while (!predicate()) {
            if (Date.now() > deadline)
              throw new Error(
                `TURN connection timeout: ${JSON.stringify({ a: a.getState(), b: b.getState(), errors })}`,
              );
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        };
        try {
          const channel = a.createDataChannel("relay");
          await until(() => channel.readyState === "open");
          channel.send("relay-before");
          await until(() => received.length === 1);
          a.restartIce();
          await until(
            () =>
              offers >= 2 &&
              a.getState().signalingState === "stable" &&
              a.getState().connectionState === "connected",
          );
          channel.send("relay-after");
          await until(() => received.length === 2);
          const stats = await a.getStats();
          let localCandidateType;
          stats.forEach((item) => {
            if (item.type === "candidate-pair" && item.state === "succeeded" && item.nominated)
              localCandidateType = stats.get(item.localCandidateId)?.candidateType;
          });
          return { received, localCandidateType, errors };
        } finally {
          a.close();
          b.close();
        }
      },
      {
        iceTransportPolicy: "relay",
        iceServers: [
          { urls: `turn:127.0.0.1:34780?transport=${protocol}`, username: "peerweave", credential },
        ],
      },
    );
    assert.deepEqual(result, {
      received: ["relay-before", "relay-after"],
      localCandidateType: "relay",
      errors: [],
    });
    console.log(`TURN ${protocol}: relay-only data exchange and ICE restart passed.`);
  }
} catch (error) {
  if (started)
    console.error(execFileSync("docker", ["logs", "--tail", "40", name], { encoding: "utf8" }));
  throw error;
} finally {
  await browser?.close();
  await vite?.close();
  if (started) execFileSync("docker", ["rm", "--force", name], { stdio: "pipe" });
}
