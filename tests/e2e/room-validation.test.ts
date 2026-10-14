import { chromium } from "playwright";
import { createServer } from "vite";
import { expect, it } from "vitest";
import config from "../../apps/demo/vite.config.js";

it("validates room names with native form constraints without pattern errors", async () => {
  const vite = await createServer({
    ...config,
    configFile: false,
    root: new URL("../../apps/demo", import.meta.url).pathname,
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  const url = vite.resolvedUrls?.local[0];
  if (!url) throw new Error("No demo URL");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const patternErrors: string[] = [];
    page.on("console", (message) => {
      if (/Pattern attribute value|Invalid regular expression/.test(message.text())) {
        patternErrors.push(message.text());
      }
    });
    await page.goto(`${url}?room=hello`);
    const room = page.getByLabel("Room");
    for (const value of ["hello", "Peer-weave_42", "-", "_", "a".repeat(64)]) {
      expect(
        await room.evaluate((input: HTMLInputElement, value) => {
          input.value = value;
          return input.checkValidity();
        }, value),
        `Room ${JSON.stringify(value)} should be valid`,
      ).toBe(true);
    }
    for (const value of ["room space", "room/name", "café", "room|name", "a".repeat(65)]) {
      expect(
        await room.evaluate((input: HTMLInputElement, value) => {
          input.value = value;
          return { valid: input.checkValidity(), patternMismatch: input.validity.patternMismatch };
        }, value),
        `Room ${JSON.stringify(value)} should fail pattern validation`,
      ).toEqual({ valid: false, patternMismatch: true });
    }
    await room.fill("");
    expect(
      await room.evaluate((input: HTMLInputElement) => ({
        valid: input.checkValidity(),
        valueMissing: input.validity.valueMissing,
      })),
    ).toEqual({ valid: false, valueMissing: true });
    expect(patternErrors).toEqual([]);
  } finally {
    await browser.close();
    await vite.close();
  }
});
