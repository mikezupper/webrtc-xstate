import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "vite";
import { expect, it } from "vitest";
import config from "../../apps/demo/vite.config.js";

it("keeps the small page accessible in both themes, narrow layouts and three engines", async () => {
  const web = await createServer({
    ...config,
    configFile: false,
    root: new URL("../../apps/demo", import.meta.url).pathname,
    server: { host: "127.0.0.1", port: 0 },
  });
  try {
    await web.listen();
    const url = web.resolvedUrls?.local[0];
    if (!url) throw new Error("No demo URL");
    await mkdir(".artifacts/minimal", { recursive: true });
    for (const [name, engine] of [
      ["chromium", chromium],
      ["firefox", firefox],
      ["webkit", webkit],
    ] as const) {
      const browser = await engine.launch();
      try {
        for (const colorScheme of ["light", "dark"] as const) {
          const context = await browser.newContext({
            colorScheme,
            reducedMotion: "reduce",
            viewport: { width: 390, height: 844 },
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto(url);
          expect(await page.getByRole("main").count()).toBe(1);
          expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          expect(
            result.violations.map(({ id, nodes }) => ({
              id,
              targets: nodes.map((node) => node.target),
            })),
            `${name}/${colorScheme}`,
          ).toEqual([]);
          if (name === "chromium")
            await page.screenshot({
              path: `.artifacts/minimal/${colorScheme}-mobile.png`,
              fullPage: true,
            });
          await page.keyboard.press("Tab");
          expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(
            "Skip to main content",
          );
          await page.keyboard.press("Enter");
          expect(await page.evaluate(() => document.activeElement?.id)).toBe("main");
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.evaluate(() => {
            document.documentElement.style.zoom = "2";
          });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${name}/${colorScheme}/zoom`,
          ).toBe(true);
          await page.evaluate(() => {
            document.documentElement.style.zoom = "";
          });
          if (name === "chromium")
            await page.screenshot({
              path: `.artifacts/minimal/${colorScheme}-desktop.png`,
              fullPage: true,
            });
          expect(errors).toEqual([]);
          await context.close();
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await web.close();
  }
}, 60000);
