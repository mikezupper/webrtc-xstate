import { expect, it } from "vitest";
import { withExample } from "./examples-fixture.js";

it("captures a local preflight preview, replaces it and stops all owned tracks", async () => {
  await withExample("/media/", async (page) => {
    expect(
      await page.getByRole("heading", { name: "Check your camera and microphone." }).count(),
    ).toBe(1);
    await page.getByRole("button", { name: "Start preview", exact: true }).click();
    await expect.poll(() => page.locator("#preview-status").textContent()).toBe("ready");
    await expect
      .poll(() => page.locator("#local").evaluate((video: HTMLVideoElement) => video.videoWidth))
      .toBeGreaterThan(0);
    const tracks = await page
      .locator("#local")
      .evaluateHandle((video: HTMLVideoElement) => (video.srcObject as MediaStream).getTracks());
    expect(await page.getByLabel("Camera device").locator("option").count()).toBeGreaterThan(1);
    await page.getByRole("button", { name: "Update preview", exact: true }).click();
    await expect
      .poll(() =>
        tracks.evaluate((tracks) => tracks.every((track) => track.readyState === "ended")),
      )
      .toBe(true);
    await expect.poll(() => page.locator("#preview-status").textContent()).toBe("ready");
    const current = await page
      .locator("#local")
      .evaluateHandle((video: HTMLVideoElement) => (video.srcObject as MediaStream).getTracks());
    await page.getByRole("button", { name: "Stop preview", exact: true }).click();
    expect(
      await current.evaluate((tracks) => tracks.every((track) => track.readyState === "ended")),
    ).toBe(true);
    expect(
      await page.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
    ).toBeNull();
    await tracks.dispose();
    await current.dispose();
  });
});

it("cancels a pending preflight permission request and stops any late native result", async () => {
  await withExample("/media/", async (page) => {
    await page.evaluate(() => {
      const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (constraints) =>
        new Promise<MediaStream>((resolve, reject) => {
          window.addEventListener(
            "release-preview",
            () => {
              void acquire(constraints).then((stream) => {
                Reflect.set(window, "latePreviewTracks", stream.getTracks());
                resolve(stream);
              }, reject);
            },
            { once: true },
          );
        });
    });
    await page.getByRole("button", { name: "Start preview", exact: true }).click();
    await expect.poll(() => page.locator("#preview-status").textContent()).toBe("preparing");
    await page.getByRole("button", { name: "Cancel preview", exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event("release-preview")));
    await expect
      .poll(() =>
        page.evaluate(() => {
          const tracks = Reflect.get(window, "latePreviewTracks") as MediaStreamTrack[] | undefined;
          return tracks?.every((track) => track.readyState === "ended");
        }),
      )
      .toBe(true);
    expect(await page.locator("#preview-status").textContent()).toBe("idle");
    expect(
      await page.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
    ).toBeNull();
  });
});
