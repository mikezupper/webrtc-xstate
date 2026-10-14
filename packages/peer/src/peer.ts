import { PeerError } from "./errors.js";
import { createBrowserPort } from "./internal/browser.js";
import { createPeerController } from "./internal/controller.js";
import type { Peer, PeerOptions } from "./types.js";

export function createPeer(options: PeerOptions): Peer {
  if (
    !options ||
    typeof options.sessionId !== "string" ||
    !options.sessionId.trim() ||
    typeof options.polite !== "boolean" ||
    typeof options.sendSignal !== "function" ||
    [options.maxBufferedCandidates, options.maxPendingSignals].some(
      (value) => value !== undefined && (!Number.isInteger(value) || value < 1),
    )
  )
    throw new PeerError("INVALID_OPTIONS", "createPeer");
  return createPeerController(options, createBrowserPort(options.rtcConfiguration));
}
