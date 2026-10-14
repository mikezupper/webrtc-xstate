import { PeerError } from "../errors.js";
import type { ConnectionPort } from "./port.js";

export function createBrowserPort(configuration?: RTCConfiguration): ConnectionPort {
  if (typeof globalThis.RTCPeerConnection !== "function")
    throw new PeerError("BROWSER_UNAVAILABLE", "createPeer");
  let connection: RTCPeerConnection;
  try {
    connection = new RTCPeerConnection(configuration);
  } catch (cause) {
    throw new PeerError("INVALID_OPTIONS", "createPeer", cause);
  }
  const lifetime = new AbortController();
  let initial = true;
  const allocated = () => {
    if (
      connection.iceGatheringState === "complete" ||
      /a=candidate:/.test(connection.localDescription?.sdp ?? "")
    )
      return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        connection.removeEventListener("icecandidate", ready);
        connection.removeEventListener("icegatheringstatechange", change);
        lifetime.signal.removeEventListener("abort", cancel);
      };
      const ready = () => {
        cleanup();
        resolve();
      };
      const change = () => {
        if (connection.iceGatheringState === "complete") ready();
      };
      const cancel = () => {
        cleanup();
        reject(new PeerError("CLOSED", "localDescription"));
      };
      connection.addEventListener("icecandidate", ready, { once: true });
      connection.addEventListener("icegatheringstatechange", change);
      lifetime.signal.addEventListener("abort", cancel, { once: true });
      if (lifetime.signal.aborted) cancel();
    });
  };
  return {
    get state() {
      return {
        connectionState: connection.connectionState,
        signalingState: connection.signalingState,
        iceConnectionState: connection.iceConnectionState,
        iceGatheringState: connection.iceGatheringState,
      };
    },
    get remoteDescription() {
      return connection.remoteDescription;
    },
    listen(events) {
      connection.onconnectionstatechange = events.state;
      connection.onsignalingstatechange = events.state;
      connection.oniceconnectionstatechange = events.state;
      connection.onicegatheringstatechange = events.state;
      connection.onnegotiationneeded = events.negotiation;
      connection.onicecandidate = (event) => events.candidate(event.candidate?.toJSON() ?? null);
      connection.ontrack = events.track;
      connection.ondatachannel = events.datachannel;
      return () => {
        connection.onconnectionstatechange = null;
        connection.onsignalingstatechange = null;
        connection.oniceconnectionstatechange = null;
        connection.onicegatheringstatechange = null;
        connection.onnegotiationneeded = null;
        connection.onicecandidate = null;
        connection.ontrack = null;
        connection.ondatachannel = null;
      };
    },
    async describe() {
      await connection.setLocalDescription();
      // Let the initial native transport allocate before glare can roll it back.
      // Later candidates still trickle; no timer or full-gathering delay is required.
      if (initial) {
        await allocated();
        initial = false;
      }
      const description = connection.localDescription;
      if (!description || (description.type !== "offer" && description.type !== "answer"))
        throw new PeerError("NEGOTIATION_FAILED", "localDescription");
      return { type: description.type, sdp: description.sdp };
    },
    accept: (description) => connection.setRemoteDescription(description),
    addCandidate: (candidate) => connection.addIceCandidate(candidate),
    addTrack: (track, ...streams) => connection.addTrack(track, ...streams),
    removeTrack: (sender) => connection.removeTrack(sender),
    addTransceiver: (track, init) => connection.addTransceiver(track, init),
    getTransceivers: () => connection.getTransceivers(),
    createDataChannel: (label, options) => connection.createDataChannel(label, options),
    getStats: (selector) => connection.getStats(selector),
    restartIce: () => connection.restartIce(),
    close: () => {
      lifetime.abort();
      connection.close();
    },
  };
}
