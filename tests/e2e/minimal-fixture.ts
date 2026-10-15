import { type Browser, chromium, type Page } from "playwright";
import { createServer } from "vite";
import config from "../../apps/demo/vite.config.js";
import { createSignalingServer } from "../../apps/signaling-server/src/server.ts";

export async function withDemo(
  run: (a: Page, b: Page, closeRelay: () => Promise<void>) => Promise<void>,
) {
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
  let browser: Browser | undefined;
  try {
    await vite.listen();
    browser = await chromium.launch({
      headless: true,
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    });
    const a = await browser.newPage(),
      b = await browser.newPage();
    const errors: string[] = [];
    for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
    const url = vite.resolvedUrls?.local[0];
    if (!url) throw new Error("No demo URL");
    await Promise.all([a.goto(url), b.goto(url)]);
    await run(a, b, () => relay.close());
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  } finally {
    await browser?.close();
    await vite.close();
    await relay.close();
  }
}
