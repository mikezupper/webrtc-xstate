import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "vite";
import { expect, it } from "vitest";
import config from "../../apps/demo/vite.config.js";

it("keeps all Gyral examples accessible in both themes and narrow layouts across browser engines", async () => {
  const vite = await createServer({
    ...config,
    configFile: false,
    root: new URL("../../apps/demo", import.meta.url).pathname,
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  const url = vite.resolvedUrls?.local[0];
  if (!url) throw new Error("No example URL");
  try {
    await mkdir(".artifacts/examples", { recursive: true });
    for (const [name, engine] of [
      ["chromium", chromium],
      ["firefox", firefox],
      ["webkit", webkit],
    ] as const) {
      const browser = await engine.launch();
      try {
        for (const theme of ["light", "dark"] as const) {
          const context = await browser.newContext({
            colorScheme: theme,
            reducedMotion: "reduce",
            viewport: { width: 390, height: 844 },
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          for (const path of ["/", "/media/", "/transfer/", "/support/"]) {
            await page.goto(new URL(path, url).href);
            await page.locator("#main").waitFor();
            expect(await page.getByRole("main").count()).toBe(1);
            expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            const accessibility = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze();
            expect(
              accessibility.violations.map((violation) => ({
                id: violation.id,
                nodes: violation.nodes.map((node) => node.target),
              })),
              `${name}/${theme}/${path}`,
            ).toEqual([]);
            if (name === "chromium")
              await page.screenshot({
                path: `.artifacts/examples/${path === "/" ? "workbench" : path.replaceAll("/", "")}-${theme}.png`,
                fullPage: true,
              });
            await page.keyboard.press("Tab");
            expect(await page.evaluate(() => document.activeElement?.textContent)).toContain(
              "Skip to main content",
            );
            await page.keyboard.press("Enter");
            expect(await page.evaluate(() => location.hash)).toBe("#main");
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.evaluate(() => {
              document.documentElement.style.zoom = "2";
            });
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              `${name}/${theme}/${path}: 200% zoom`,
            ).toBe(true);
            await page.setViewportSize({ width: 390, height: 844 });
          }
          expect(errors).toEqual([]);
          await context.close();
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await vite.close();
  }
}, 60000);
