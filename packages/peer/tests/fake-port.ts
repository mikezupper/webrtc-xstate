import type { ConnectionEvents, ConnectionPort } from "../src/internal/port.js";

export class FakePort implements ConnectionPort {
  state: ConnectionPort["state"] = {
    connectionState: "new",
    signalingState: "stable",
    iceConnectionState: "new",
    iceGatheringState: "new",
  };
  remoteDescription: RTCSessionDescriptionInit | null = null;
  events: ConnectionEvents | undefined;
  closes = 0;
  restarts = 0;
  descriptions = 0;
  accepted: RTCSessionDescriptionInit[] = [];
  candidates: (RTCIceCandidateInit | null)[] = [];
  nextDescription: { type: "offer" | "answer"; sdp: string } = {
    type: "offer",
    sdp: "v=0\r\na=ice-ufrag:local\r\n",
  };
  describeHook: (() => Promise<{ type: "offer" | "answer"; sdp: string }>) | undefined;
  acceptHook: (() => Promise<void>) | undefined;
  listen(events: ConnectionEvents) {
    this.events = events;
    return () => {
      this.events = undefined;
    };
  }
  async describe() {
    this.descriptions++;
    const description = this.describeHook ? await this.describeHook() : this.nextDescription;
    this.state = {
      ...this.state,
      signalingState: description.type === "offer" ? "have-local-offer" : "stable",
    };
    return description;
  }
  async accept(description: RTCSessionDescriptionInit) {
    if (this.acceptHook) await this.acceptHook();
    this.accepted.push(description);
    this.remoteDescription = description;
    this.state = {
      ...this.state,
      signalingState: description.type === "offer" ? "have-remote-offer" : "stable",
    };
    this.nextDescription = { type: "answer", sdp: "v=0\r\na=ice-ufrag:local\r\n" };
  }
  async addCandidate(candidate: RTCIceCandidateInit | null) {
    this.candidates.push(candidate);
  }
  addTrack(track: MediaStreamTrack) {
    return { track } as RTCRtpSender;
  }
  removeTrack(_sender: RTCRtpSender) {}
  addTransceiver(_track: MediaStreamTrack | string, _init?: RTCRtpTransceiverInit) {
    return {} as RTCRtpTransceiver;
  }
  getTransceivers() {
    return [];
  }
  createDataChannel(label: string) {
    return { label } as RTCDataChannel;
  }
  async getStats() {
    return new Map() as RTCStatsReport;
  }
  restartIce() {
    this.restarts++;
  }
  close() {
    this.closes++;
    this.state = {
      ...this.state,
      connectionState: "closed",
      signalingState: "closed",
      iceConnectionState: "closed",
    };
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
