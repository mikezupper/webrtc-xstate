import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";
import { expect, it } from "vitest";
import config from "../../apps/demo/vite.config.js";
import { createSignalingServer } from "../../apps/signaling-server/src/server.ts";

it("connects two demo tabs with native camera/microphone capture, exchanges chat and hangs up", async () => {
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
  const a = await browser.newPage(),
    b = await browser.newPage();
  const failures: string[] = [];
  a.on("pageerror", (e) => failures.push(e.message));
  b.on("pageerror", (e) => failures.push(e.message));
  try {
    await Promise.all([a.goto(url), b.goto(url)]);
    for (const page of [a, b]) {
      await page.getByLabel("Room").fill("e2e");
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    }
    await expect
      .poll(() => a.getByRole("button", { name: "Start call", exact: true }).isEnabled())
      .toBe(true);
    await Promise.all([
      a.getByRole("button", { name: "Start call", exact: true }).click(),
      b.getByRole("button", { name: "Start call", exact: true }).click(),
    ]);
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("active");
      await expect
        .poll(() => page.locator("#remote").evaluate((video: HTMLVideoElement) => video.videoWidth))
        .toBeGreaterThan(0);
    }
    await mkdir(".artifacts", { recursive: true });
    await a.screenshot({ path: ".artifacts/demo.png", fullPage: true });
    await a.getByLabel("Message").fill("Hello Peerweave");
    await expect
      .poll(() => a.getByRole("button", { name: "Send", exact: true }).isEnabled())
      .toBe(true);
    await a.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => b.locator("#messages").textContent()).toContain("Hello Peerweave");
    expect(await a.locator('#messages [data-from="you"]').textContent()).toContain(
      "Hello Peerweave",
    );
    expect(await b.locator('#messages [data-from="peer"]').textContent()).toContain(
      "Hello Peerweave",
    );
    const microphone = a.getByRole("button", { name: "Microphone", exact: true });
    expect(await microphone.getAttribute("aria-pressed")).toBe("true");
    await microphone.click();
    await expect.poll(() => microphone.getAttribute("aria-pressed")).toBe("false");
    await microphone.click();
    await expect.poll(() => microphone.getAttribute("aria-pressed")).toBe("true");
    await a.getByRole("button", { name: "Connection stats", exact: true }).click();
    const report = a.getByRole("dialog", { name: "Connection report" });
    await expect.poll(() => report.isVisible()).toBe(true);
    await expect.poll(() => a.locator("#report").textContent()).toContain("candidate-pair");
    await a.keyboard.press("Escape");
    // Closed at once; its exit transition may keep it painted a moment longer.
    await expect
      .poll(() => report.evaluate((dialog: HTMLDialogElement) => dialog.open))
      .toBe(false);
    await a.getByRole("button", { name: "Hang up", exact: true }).click();
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("ended");
      expect(
        await page.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
      ).toBeNull();
    }
    expect(failures).toEqual([]);
  } finally {
    await browser.close();
    await vite.close();
    await relay.close();
  }
}, 30000);

it("shows denied camera permission and ends an initialized peer without retaining preview media", async () => {
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
    args: ["--use-fake-device-for-media-stream"],
  });
  const context = await browser.newContext();
  const a = await context.newPage(),
    b = await browser.newPage();
  try {
    const devtools = await context.newCDPSession(a);
    await devtools.send("Browser.setPermission", {
      permission: { name: "camera" },
      setting: "denied",
      origin: new URL(url).origin,
    });
    await Promise.all([a.goto(url), b.goto(url)]);
    for (const page of [a, b]) {
      await page.getByLabel("Room").fill("denied");
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    }
    await expect
      .poll(() => a.getByRole("button", { name: "Start call", exact: true }).isEnabled())
      .toBe(true);
    await a.locator("#audio").uncheck();
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect.poll(() => a.locator("#call-status").textContent()).toBe("failed");
    await expect.poll(() => a.locator("#feedback").textContent()).toContain("START_FAILED");
    expect(
      await a.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
    ).toBeNull();
    expect(await a.getByRole("button", { name: "Hang up", exact: true }).isEnabled()).toBe(false);
  } finally {
    await browser.close();
    await vite.close();
    await relay.close();
  }
}, 30000);
