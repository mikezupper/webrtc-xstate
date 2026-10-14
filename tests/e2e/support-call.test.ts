import { expect, it } from "vitest";
import { withExample } from "./examples-fixture.js";

it("waits for invitation acceptance, connects native media/chat and releases both sessions on hangup", async () => {
  await withExample("/support/", async (a, b) => {
    await expect
      .poll(() => a.getByRole("heading", { name: "A support call, on your terms." }).count())
      .toBe(1);
    for (const page of [a, b]) {
      await page.getByLabel("Room", { exact: true }).fill("support-test");
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    }
    await expect
      .poll(() => a.getByRole("button", { name: "Invite peer", exact: true }).isEnabled())
      .toBe(true);
    await a.clock.install();
    await a.getByRole("button", { name: "Invite peer", exact: true }).click();
    await expect.poll(() => b.locator("#invitation-status").textContent()).toBe("incoming");
    await a.clock.runFor(25000);
    expect(await a.locator("#invitation-status").textContent()).toBe("outgoing");
    for (const page of [a, b])
      expect(
        await page.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
      ).toBeNull();
    await b.getByRole("button", { name: "Accept call", exact: true }).click();
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("active");
      await expect
        .poll(() => page.locator("#remote").evaluate((video: HTMLVideoElement) => video.videoWidth))
        .toBeGreaterThan(0);
      await expect
        .poll(() => page.getByRole("button", { name: "Send", exact: true }).isEnabled())
        .toBe(true);
    }
    await a.getByLabel("Message", { exact: true }).fill("How can I help?");
    await a.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => b.locator("#messages").textContent()).toContain("How can I help?");
    await b.getByRole("button", { name: "Hang up", exact: true }).click();
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("ended");
      expect(
        await page.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
      ).toBeNull();
    }
  });
});

it("resolves simultaneous invitations deterministically and permits a chat-only support session", async () => {
  await withExample("/support/", async (a, b) => {
    for (const page of [a, b])
      await page.evaluate(() => {
        const NativeSocket = WebSocket;
        const held: (() => void)[] = [];
        let delaying = true;
        const wrappers = new WeakMap<EventListener, EventListener>();
        class DelayedInvites extends NativeSocket {}
        Object.defineProperty(DelayedInvites.prototype, "addEventListener", {
          value: function (
            this: WebSocket,
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: AddEventListenerOptions | boolean,
          ) {
            if (!listener) return;
            if (type === "message" && typeof listener === "function") {
              const wrapped: EventListener = (event) => {
                const deliver = () => listener.call(this, event);
                if (
                  delaying &&
                  event instanceof MessageEvent &&
                  typeof event.data === "string" &&
                  event.data.includes('"kind":"support-invite"')
                )
                  held.push(deliver);
                else deliver();
              };
              wrappers.set(listener, wrapped);
              NativeSocket.prototype.addEventListener.call(this, type, wrapped, options);
            } else NativeSocket.prototype.addEventListener.call(this, type, listener, options);
          },
        });
        Object.defineProperty(DelayedInvites.prototype, "removeEventListener", {
          value: function (
            this: WebSocket,
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: EventListenerOptions | boolean,
          ) {
            if (!listener) return;
            NativeSocket.prototype.removeEventListener.call(
              this,
              type,
              typeof listener === "function" ? (wrappers.get(listener) ?? listener) : listener,
              options,
            );
          },
        });
        Reflect.set(window, "WebSocket", DelayedInvites);
        window.addEventListener(
          "release-invitations",
          () => {
            delaying = false;
            for (const deliver of held.splice(0)) deliver();
            Reflect.set(window, "WebSocket", NativeSocket);
          },
          { once: true },
        );
      });
    for (const page of [a, b]) {
      await page.getByLabel("Room", { exact: true }).fill("simultaneous-support");
      await page.getByRole("button", { name: "Join room", exact: true }).click();
      await page.locator("#audio").uncheck();
      await page.locator("#video").uncheck();
    }
    await expect
      .poll(() => a.getByRole("button", { name: "Invite peer", exact: true }).isEnabled())
      .toBe(true);
    await Promise.all([
      a.getByRole("button", { name: "Invite peer", exact: true }).click(),
      b.getByRole("button", { name: "Invite peer", exact: true }).click(),
    ]);
    for (const page of [a, b])
      await expect.poll(() => page.locator("#invitation-status").textContent()).toBe("outgoing");
    for (const page of [a, b])
      await page.evaluate(() => window.dispatchEvent(new Event("release-invitations")));
    await expect.poll(() => a.locator("#invitation-status").textContent()).toBe("outgoing");
    await expect.poll(() => b.locator("#invitation-status").textContent()).toBe("incoming");
    await b.getByRole("button", { name: "Accept call", exact: true }).click();
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#call-status").textContent()).toBe("active");
      expect(
        await page.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
      ).toBeNull();
    }
  });
});

it("declines and cancels invitations without capturing devices and locks the caller's selected preferences", async () => {
  await withExample("/support/", async (a, b) => {
    for (const page of [a, b]) {
      await page.getByLabel("Room", { exact: true }).fill("decline-call");
      await page.getByRole("button", { name: "Join room", exact: true }).click();
    }
    await a.getByRole("button", { name: "Invite peer", exact: true }).click();
    await b.getByRole("button", { name: "Decline call", exact: true }).click();
    for (const page of [a, b])
      await expect.poll(() => page.locator("#invitation-status").textContent()).toBe("declined");
    await a.getByRole("button", { name: "Invite peer", exact: true }).click();
    await expect.poll(() => b.locator("#invitation-status").textContent()).toBe("incoming");
    expect(await a.getByLabel("Camera", { exact: true }).isEnabled()).toBe(false);
    await a.getByRole("button", { name: "Cancel invitation", exact: true }).click();
    for (const page of [a, b]) {
      await expect.poll(() => page.locator("#invitation-status").textContent()).toBe("cancelled");
      expect(
        await page.locator("#local").evaluate((video: HTMLVideoElement) => video.srcObject),
      ).toBeNull();
      expect(await page.getByRole("button", { name: "Invite peer", exact: true }).isEnabled()).toBe(
        true,
      );
    }
  });
});
