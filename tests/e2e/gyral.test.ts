import { chromium } from "playwright";
import { createServer } from "vite";
import { expect, it } from "vitest";
import config from "../../apps/demo/vite.config.js";

it("renders the current example as a Gyral custom element with semantic navigation", async () => {
  const vite = await createServer({
    ...config,
    configFile: false,
    root: new URL("../../apps/demo", import.meta.url).pathname,
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(vite.resolvedUrls?.local[0] ?? "");
    await expect
      .poll(() => page.evaluate(() => Boolean(customElements.get("peerweave-workbench"))))
      .toBe(true);
    expect(await page.getByRole("main").count()).toBe(1);
    expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
    expect(
      await page
        .getByRole("navigation", { name: "Examples" })
        .getByRole("link", { name: "Media preflight" })
        .getAttribute("href"),
    ).toBe("/media/");
  } finally {
    await browser.close();
    await vite.close();
  }
});
