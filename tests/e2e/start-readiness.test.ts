import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { expect, it } from "vitest";
import config from "../../apps/demo/vite.config.js";
import { createSignalingServer } from "../../apps/signaling-server/src/server.ts";

async function withDemo(test: (a: Page, b: Page) => Promise<void>) {
  const relay = await createSignalingServer({ port: 0 });
  const vite = await createServer({
    ...config,
    configFile: false,
    root: new URL("../../apps/demo", import.meta.url).pathname,
    server: {
      host: "127.0.0.1",
      port: 0,
      proxy: { "/signaling": { target: relay.url.replace(/\/signaling$/, ""), ws: true } },
    },
  });
  await vite.listen();
  const url = vite.resolvedUrls?.local[0];
  if (!url) throw new Error("No demo URL");
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  try {
    const a = await browser.newPage();
    const b = await browser.newPage();
    await Promise.all([a.goto(url), b.goto(url)]);
    for (const page of [a, b]) {
      await page.getByLabel("Room").fill("delayed-start");
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    }
    await expect
      .poll(() => a.getByRole("button", { name: "Start call", exact: true }).isEnabled())
      .toBe(true);
    await test(a, b);
  } finally {
    await browser.close();
    await vite.close();
    await relay.close();
  }
}

it("waits for a later participant to start before connecting media and chat", async () => {
  await withDemo(async (a, b) => {
    await a.clock.install();
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect
      .poll(() => a.locator("#local").evaluate((video: HTMLVideoElement) => video.videoWidth))
      .toBeGreaterThan(0);
    // Advance past the previous 15-second connection deadline and 5-second recovery budget.
    await a.clock.runFor(21000);
    await expect.poll(() => a.locator("#call-status").textContent()).toBe("waiting");
    expect(await a.locator("#feedback").textContent()).not.toContain("RECOVERY_EXHAUSTED");
    expect(await a.getByRole("button", { name: "Send", exact: true }).isEnabled()).toBe(false);
    await b.getByRole("button", { name: "Start call", exact: true }).click();
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("active");
      await expect
        .poll(() => page.locator("#remote").evaluate((video: HTMLVideoElement) => video.videoWidth))
        .toBeGreaterThan(0);
    }
    await expect
      .poll(() => a.getByRole("button", { name: "Send", exact: true }).isEnabled())
      .toBe(true);
    await a.getByLabel("Message").fill("Ready when you are");
    await a.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => b.locator("#messages").textContent()).toContain("Ready when you are");
  });
});

it("waits for both chat-only participants and opens the data channel without capturing media", async () => {
  await withDemo(async (a, b) => {
    await a.clock.install();
    for (const page of [a, b]) {
      await page.locator("#audio").uncheck();
      await page.locator("#video").uncheck();
      await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = async () => {
          throw new Error("Chat-only calls must not acquire camera or microphone media");
        };
      });
    }
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await a.clock.runFor(21000);
    await expect.poll(() => a.locator("#call-status").textContent()).toBe("waiting");
    expect(await b.locator("#next-step").textContent()).toContain("Your peer is ready");
    await b.getByRole("button", { name: "Start call", exact: true }).click();
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("active");
      await expect
        .poll(() => page.getByRole("button", { name: "Send", exact: true }).isEnabled())
        .toBe(true);
      expect(
        await page.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
      ).toBeNull();
    }
    await b.getByLabel("Message").fill("Chat without a camera");
    await b.getByRole("button", { name: "Send", exact: true }).click();
    await expect
      .poll(() => a.locator("#messages").textContent())
      .toContain("Chat without a camera");
    await a.getByRole("button", { name: "Hang up", exact: true }).click();
    for (const page of [a, b])
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("ended");
  });
});

it("releases a waiting preview on leave and connects a fresh session after rejoining", async () => {
  await withDemo(async (a, b) => {
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect.poll(() => a.locator("#call-status").textContent()).toBe("waiting");
    const tracks = await a.locator("#local").evaluateHandle((video: HTMLVideoElement) => {
      if (!(video.srcObject instanceof MediaStream)) throw new Error("Missing preview stream");
      return video.srcObject.getTracks();
    });
    await a.getByRole("button", { name: "Leave room", exact: true }).click();
    await expect.poll(() => b.locator("#relay-status").textContent()).toBe("waiting");
    expect(
      await tracks.evaluate((tracks) => tracks.every((track) => track.readyState === "ended")),
    ).toBe(true);
    expect(
      await a.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
    ).toBeNull();
    await tracks.dispose();
    await a.getByRole("button", { name: "Join room", exact: true }).click();
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("idle");
      expect(await page.locator("#next-step").textContent()).toContain("Both participants joined");
    }
    await Promise.all([
      a.getByRole("button", { name: "Start call", exact: true }).click(),
      b.getByRole("button", { name: "Start call", exact: true }).click(),
    ]);
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("active");
      await expect
        .poll(() => page.getByRole("button", { name: "Send", exact: true }).isEnabled())
        .toBe(true);
    }
  });
});

it("ends the waiting participant and releases preview tracks when peer media acquisition is denied", async () => {
  await withDemo(async (a, b) => {
    // Fake-UI Chromium auto-allows capture; inject denial at the media acquisition boundary.
    await b.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      };
    });
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect.poll(() => a.locator("#call-status").textContent()).toBe("waiting");
    const tracks = await a.locator("#local").evaluateHandle((video: HTMLVideoElement) => {
      if (!(video.srcObject instanceof MediaStream)) throw new Error("Missing preview stream");
      return video.srcObject.getTracks();
    });
    await b.getByRole("button", { name: "Start call", exact: true }).click();
    await expect.poll(() => b.locator("#call-status").textContent()).toBe("failed");
    await expect.poll(() => a.locator("#call-status").textContent()).toBe("ended");
    expect(
      await tracks.evaluate((tracks) => tracks.every((track) => track.readyState === "ended")),
    ).toBe(true);
    expect(
      await a.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
    ).toBeNull();
    expect(await a.locator("#next-step").textContent()).toContain("leave and rejoin");
    await tracks.dispose();
  });
});

it("keeps waiting while the other participant's media permission request is pending", async () => {
  await withDemo(async (a, b) => {
    await a.clock.install();
    await b.evaluate(() => {
      const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        // Hold the permission boundary, then acquire actual native fake-device tracks.
        await new Promise<void>((resolve) => {
          window.addEventListener("allow-peer-media", () => resolve(), { once: true });
        });
        return acquire(constraints);
      };
    });
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect.poll(() => a.locator("#call-status").textContent()).toBe("waiting");
    await b.getByRole("button", { name: "Start call", exact: true }).click();
    await expect.poll(() => b.locator("#call-status").textContent()).toBe("starting");
    await a.clock.runFor(21000);
    expect(await a.locator("#call-status").textContent()).toBe("waiting");
    expect(await b.locator("#next-step").textContent()).toContain("Allow camera/microphone access");
    await b.evaluate(() => window.dispatchEvent(new Event("allow-peer-media")));
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("active");
      await expect
        .poll(() => page.getByRole("button", { name: "Send", exact: true }).isEnabled())
        .toBe(true);
    }
  });
});
