import type { PeerState } from "../types.js";

export interface ConnectionEvents {
  state(): void;
  negotiation(): void;
  candidate(value: RTCIceCandidateInit | null): void;
  track(value: RTCTrackEvent): void;
  datachannel(value: RTCDataChannelEvent): void;
}

/** Owned adapter seam; native behavior is verified in browser contract tests. */
export interface ConnectionPort {
  readonly state: Omit<PeerState, "closed">;
  readonly remoteDescription: RTCSessionDescriptionInit | null;
  listen(events: ConnectionEvents): () => void;
  describe(): Promise<{ type: "offer" | "answer"; sdp: string }>;
  accept(description: RTCSessionDescriptionInit): Promise<void>;
  addCandidate(candidate: RTCIceCandidateInit | null): Promise<void>;
  addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): RTCRtpSender;
  removeTrack(sender: RTCRtpSender): void;
  addTransceiver(track: MediaStreamTrack | string, init?: RTCRtpTransceiverInit): RTCRtpTransceiver;
  getTransceivers(): RTCRtpTransceiver[];
  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel;
  getStats(selector?: MediaStreamTrack | null): Promise<RTCStatsReport>;
  restartIce(): void;
  close(): void;
}
