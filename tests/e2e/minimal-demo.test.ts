import { mkdir } from "node:fs/promises";
import { expect, it } from "vitest";
import { withDemo } from "./minimal-fixture.js";

it("offers one small video-call page with four native controls", async () => {
  await withDemo(async (page) => {
    await expect
      .poll(() => page.getByRole("heading", { name: "A simple video call." }).count())
      .toBe(1);
    expect(await page.getByRole("main").count()).toBe(1);
    expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
    expect(await page.locator("video").count()).toBe(2);
    expect(await page.getByRole("button").allTextContents()).toEqual([
      "Join room",
      "Start call",
      "Mute",
      "Leave",
    ]);
    expect(await page.getByRole("navigation").count()).toBe(0);
    expect(await page.getByRole("dialog").count()).toBe(0);
    expect(await page.getByLabel("Room", { exact: true }).inputValue()).toBe("hello");
    expect(await page.getByRole("button", { name: "Start call", exact: true }).isEnabled()).toBe(
      false,
    );
    expect(await page.getByRole("button", { name: "Mute", exact: true }).isEnabled()).toBe(false);
    expect(await page.getByRole("button", { name: "Leave", exact: true }).isEnabled()).toBe(false);
  });
});

it("cancels pending capture and stops a native result arriving after Leave", async () => {
  await withDemo(async (a, b) => {
    for (const page of [a, b])
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    await expect
      .poll(() => b.getByRole("button", { name: "Start call", exact: true }).isEnabled())
      .toBe(true);
    await a.evaluate(() => {
      const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        await new Promise<void>((resolve) =>
          window.addEventListener("late-media", () => resolve(), { once: true }),
        );
        const stream = await acquire(constraints);
        Reflect.set(window, "lateTracks", stream.getTracks());
        return stream;
      };
    });
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect
      .poll(() => a.locator("#status").textContent())
      .toBe("Allow camera and microphone access.");
    await a.getByRole("button", { name: "Leave", exact: true }).click();
    await a.evaluate(() => window.dispatchEvent(new Event("late-media")));
    await expect
      .poll(() =>
        a.evaluate(() => {
          const tracks = Reflect.get(window, "lateTracks") as MediaStreamTrack[] | undefined;
          return tracks?.length === 2 && tracks.every((track) => track.readyState === "ended");
        }),
      )
      .toBe(true);
    expect(await a.locator("#local").evaluate((v: HTMLVideoElement) => v.srcObject)).toBeNull();
    expect(await a.locator("#status").textContent()).toBe("Not joined.");
    expect(await a.getByRole("alert").count()).toBe(0);
    expect(await a.getByRole("button", { name: "Start call", exact: true }).isEnabled()).toBe(
      false,
    );
  });
});

it("shows denied media access and releases the other participant's waiting preview", async () => {
  await withDemo(async (a, b) => {
    for (const page of [a, b])
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    await expect
      .poll(() => b.getByRole("button", { name: "Start call", exact: true }).isEnabled())
      .toBe(true);
    await b.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      };
    });
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect
      .poll(() => a.locator("#local").evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    const tracks = await a
      .locator("#local")
      .evaluateHandle((v: HTMLVideoElement) => (v.srcObject as MediaStream).getTracks());
    await b.getByRole("button", { name: "Start call", exact: true }).click();
    await expect.poll(() => b.getByRole("alert").textContent()).toContain("Permission denied");
    await expect.poll(() => a.locator("#status").textContent()).toContain("Call ended");
    expect(await b.getByRole("button", { name: "Start call", exact: true }).isEnabled()).toBe(
      false,
    );
    await expect
      .poll(() => tracks.evaluate((all) => all.every((t) => t.readyState === "ended")))
      .toBe(true);
    for (const page of [a, b])
      expect(
        await page.locator("#local").evaluate((v: HTMLVideoElement) => v.srcObject),
      ).toBeNull();
    await tracks.dispose();
  });
});

it("waits beyond the connection deadline for a peer's pending media permission", async () => {
  await withDemo(async (a, b) => {
    for (const page of [a, b])
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    await expect
      .poll(() => b.getByRole("button", { name: "Start call", exact: true }).isEnabled())
      .toBe(true);
    await b.evaluate(() => {
      const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        await new Promise<void>((resolve) =>
          window.addEventListener("allow-media", () => resolve(), { once: true }),
        );
        return acquire(constraints);
      };
    });
    await a.clock.install();
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect
      .poll(() => a.locator("#local").evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    await b.getByRole("button", { name: "Start call", exact: true }).click();
    await a.clock.runFor(21000);
    expect(await a.locator("#status").textContent()).toBe(
      "Waiting for your peer to start and allow media.",
    );
    expect(await b.locator("#status").textContent()).toBe("Allow camera and microphone access.");
    expect(await a.getByRole("alert").count()).toBe(0);
    await b.evaluate(() => window.dispatchEvent(new Event("allow-media")));
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#status").textContent()).toBe("Connected.");
      await expect
        .poll(() => page.locator("#remote").evaluate((v: HTMLVideoElement) => v.videoWidth))
        .toBeGreaterThan(0);
    }
  });
});

it("connects native video, mutes the actual microphone and releases tracks on leave", async () => {
  await withDemo(async (a, b) => {
    for (const page of [a, b])
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    for (const page of [a, b]) {
      await expect
        .poll(() => page.getByRole("button", { name: "Start call", exact: true }).isEnabled())
        .toBe(true);
      await page.getByRole("button", { name: "Start call", exact: true }).click();
    }
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#status").textContent()).toBe("Connected.");
      await expect
        .poll(() => page.locator("#remote").evaluate((v: HTMLVideoElement) => v.videoWidth))
        .toBeGreaterThan(0);
    }
    const tracks = await a
      .locator("#local")
      .evaluateHandle((v: HTMLVideoElement) => (v.srcObject as MediaStream).getTracks());
    const mute = a.getByRole("button", { name: "Mute", exact: true });
    await mute.click();
    await expect.poll(() => mute.getAttribute("aria-pressed")).toBe("true");
    expect(
      await tracks.evaluate((all) =>
        all.filter((t) => t.kind === "audio").every((t) => !t.enabled),
      ),
    ).toBe(true);
    await mute.click();
    expect(
      await tracks.evaluate((all) => all.filter((t) => t.kind === "audio").every((t) => t.enabled)),
    ).toBe(true);
    await a.getByRole("button", { name: "Leave", exact: true }).click();
    expect(await tracks.evaluate((all) => all.every((t) => t.readyState === "ended"))).toBe(true);
    for (const page of [a, b]) {
      await expect
        .poll(() => page.locator("#local").evaluate((v: HTMLVideoElement) => v.srcObject))
        .toBeNull();
      expect(
        await page.locator("#remote").evaluate((v: HTMLVideoElement) => v.srcObject),
      ).toBeNull();
      expect(await page.getByRole("button", { name: "Mute", exact: true }).isEnabled()).toBe(false);
    }
    await tracks.dispose();
  });
});

it("releases a waiting preview on pagehide and connects fresh instances after rejoining", async () => {
  await withDemo(async (a, b) => {
    for (const page of [a, b])
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    await expect
      .poll(() => a.getByRole("button", { name: "Start call", exact: true }).isEnabled())
      .toBe(true);
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect
      .poll(() => a.locator("#local").evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    const tracks = await a
      .locator("#local")
      .evaluateHandle((v: HTMLVideoElement) => (v.srcObject as MediaStream).getTracks());
    await a.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
    );
    await expect
      .poll(() => tracks.evaluate((all) => all.every((t) => t.readyState === "ended")))
      .toBe(true);
    await expect
      .poll(() => b.locator("#status").textContent())
      .toBe("Waiting for a peer to join this room.");
    await a.getByRole("button", { name: "Join room", exact: true }).click();
    for (const page of [a, b]) {
      await expect
        .poll(() => page.getByRole("button", { name: "Start call", exact: true }).isEnabled())
        .toBe(true);
      await page.getByRole("button", { name: "Start call", exact: true }).click();
    }
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#status").textContent()).toBe("Connected.");
      await expect
        .poll(() => page.locator("#remote").evaluate((v: HTMLVideoElement) => v.videoWidth))
        .toBeGreaterThan(0);
    }
    expect(await tracks.evaluate((all) => all.every((t) => t.readyState === "ended"))).toBe(true);
    await tracks.dispose();
    await mkdir(".artifacts/minimal", { recursive: true });
    await a.screenshot({ path: ".artifacts/minimal/connected.png", fullPage: true });
  });
});

it("shows signaling loss and releases media instead of leaving a stale preview", async () => {
  await withDemo(async (a, b, closeRelay) => {
    for (const page of [a, b])
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    await expect
      .poll(() => a.getByRole("button", { name: "Start call", exact: true }).isEnabled())
      .toBe(true);
    await a.getByRole("button", { name: "Start call", exact: true }).click();
    await expect
      .poll(() => a.locator("#local").evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    const tracks = await a
      .locator("#local")
      .evaluateHandle((v: HTMLVideoElement) => (v.srcObject as MediaStream).getTracks());
    await closeRelay();
    await expect.poll(() => a.getByRole("alert").textContent()).toContain("Signaling");
    await expect
      .poll(() => tracks.evaluate((all) => all.every((t) => t.readyState === "ended")))
      .toBe(true);
    expect(await a.locator("#local").evaluate((v: HTMLVideoElement) => v.srcObject)).toBeNull();
    expect(await a.getByRole("button", { name: "Join room", exact: true }).isEnabled()).toBe(true);
    expect(await a.getByRole("button", { name: "Start call", exact: true }).isEnabled()).toBe(
      false,
    );
    await tracks.dispose();
  });
});
