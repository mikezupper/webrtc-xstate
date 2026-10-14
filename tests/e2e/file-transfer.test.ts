import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { withExample } from "./examples-fixture.js";

it("offers a file, requires recipient acceptance and transfers exact bytes over a native channel", async () => {
  await withExample("/transfer/", async (a, b) => {
    await expect
      .poll(() => a.getByRole("heading", { name: "Send a file directly." }).count())
      .toBe(1);
    for (const page of [a, b]) {
      await page.getByLabel("Room", { exact: true }).fill("file-test");
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    }
    for (const page of [a, b])
      await expect.poll(() => page.locator("#connection-status").textContent()).toBe("connected");
    const content = Buffer.alloc(1048576 + 79);
    for (let index = 0; index < content.length; index++) content[index] = index % 251;
    await a
      .getByLabel("File to send")
      .setInputFiles({ name: "sample.bin", mimeType: "application/octet-stream", buffer: content });
    await a.getByRole("button", { name: "Offer file", exact: true }).click();
    await expect.poll(() => b.locator("#incoming-name").textContent()).toBe("sample.bin");
    expect(await a.locator("#transfer-status").textContent()).toBe("offered");
    expect(await b.locator("#transfer-progress").getAttribute("value")).toBe("0");
    await b.getByRole("button", { name: "Accept file", exact: true }).click();
    for (const page of [a, b])
      await expect
        .poll(() => page.locator("#transfer-status").textContent(), { timeout: 10000 })
        .toBe("complete");
    const downloaded = b.waitForEvent("download");
    await b.getByRole("link", { name: "Download sample.bin", exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe("sample.bin");
    const path = await download.path();
    if (!path) throw new Error("No downloaded file");
    expect(await readFile(path)).toEqual(content);
  });
});

it("rejects a premature receipt acknowledgement before any accepted transfer completes", async () => {
  await withExample("/transfer/", async (a, b) => {
    await b.evaluate(() => {
      const NativePeer = RTCPeerConnection;
      class ObservedPeer extends NativePeer {
        constructor(configuration?: RTCConfiguration) {
          super(configuration);
          this.addEventListener("datachannel", (event) =>
            Reflect.set(window, "fileChannel", event.channel),
          );
        }
      }
      Reflect.set(window, "RTCPeerConnection", ObservedPeer);
    });
    for (const page of [a, b]) {
      await page.getByLabel("Room", { exact: true }).fill("premature-receipt");
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    }
    await a.getByLabel("File to send").setInputFiles({
      name: "receipt.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(64, 1),
    });
    await a.getByRole("button", { name: "Offer file", exact: true }).click();
    await expect.poll(() => b.locator("#incoming-name").textContent()).toBe("receipt.bin");
    await b.evaluate(() => {
      const element = document.querySelector("peerweave-transfer");
      const state = element ? Reflect.get(element, "state") : undefined;
      const channel = Reflect.get(window, "fileChannel") as RTCDataChannel;
      channel.send(JSON.stringify({ kind: "received", id: state.view.incoming.id }));
    });
    await expect.poll(() => a.locator("#transfer-status").textContent()).toBe("failed");
    expect(await b.getByRole("link", { name: "Download receipt.bin", exact: true }).count()).toBe(
      0,
    );
  });
});

it("declines an offer and cancels during a pending file read without retaining a partial download", async () => {
  await withExample("/transfer/", async (a, b) => {
    for (const page of [a, b]) {
      await page.getByLabel("Room", { exact: true }).fill("cancel-file");
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    }
    for (const page of [a, b])
      await expect.poll(() => page.locator("#connection-status").textContent()).toBe("connected");
    await a.getByLabel("File to send").setInputFiles({
      name: "cancel.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(131072, 17),
    });
    await a.getByRole("button", { name: "Offer file", exact: true }).click();
    await b.getByRole("button", { name: "Decline file", exact: true }).click();
    for (const page of [a, b])
      await expect.poll(() => page.locator("#transfer-status").textContent()).toBe("declined");
    await a.evaluate(() => {
      const read = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function () {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          window.addEventListener(
            "resume-file-read",
            () => {
              Blob.prototype.arrayBuffer = read;
              void read.call(this).then(resolve, reject);
            },
            { once: true },
          );
        });
      };
    });
    await a.getByRole("button", { name: "Offer file", exact: true }).click();
    await b.getByRole("button", { name: "Accept file", exact: true }).click();
    await expect.poll(() => a.locator("#transfer-status").textContent()).toBe("sending");
    await a.getByRole("button", { name: "Cancel transfer", exact: true }).click();
    for (const page of [a, b])
      await expect.poll(() => page.locator("#transfer-status").textContent()).toBe("cancelled");
    await a.evaluate(() => window.dispatchEvent(new Event("resume-file-read")));
    expect(await b.getByRole("link", { name: "Download cancel.bin", exact: true }).count()).toBe(0);
    expect(await b.locator("#transfer-progress").getAttribute("value")).toBe("0");
    await a.getByRole("button", { name: "Offer file", exact: true }).click();
    await b.getByRole("button", { name: "Accept file", exact: true }).click();
    for (const page of [a, b])
      await expect.poll(() => page.locator("#transfer-status").textContent()).toBe("complete");
  });
});
