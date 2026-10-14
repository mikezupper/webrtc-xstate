/** Wire messages belong to one application-provided, shared session. */
export type SignalMessage = {
  readonly version: 1;
  readonly sessionId: string;
} & (
  | {
      readonly kind: "description";
      readonly description: { readonly type: "offer" | "answer"; readonly sdp: string };
    }
  | { readonly kind: "candidate"; readonly candidate: RTCIceCandidateInit | null }
);

/** Native state is authoritative. This object does not expose an actor. */
export interface PeerState {
  readonly closed: boolean;
  readonly connectionState: RTCPeerConnectionState;
  readonly signalingState: RTCSignalingState;
  readonly iceConnectionState: RTCIceConnectionState;
  readonly iceGatheringState: RTCIceGatheringState;
}

export interface PeerOptions {
  readonly sessionId: string;
  readonly polite: boolean;
  readonly sendSignal: (message: SignalMessage) => void | Promise<void>;
  readonly rtcConfiguration?: RTCConfiguration;
  readonly maxBufferedCandidates?: number;
  readonly maxPendingSignals?: number;
}

export interface PeerEvents {
  readonly track: RTCTrackEvent;
  readonly datachannel: RTCDataChannelEvent;
  readonly error: Error;
}

export interface Peer {
  receiveSignal(input: unknown): Promise<void>;
  getState(): PeerState;
  subscribe(listener: (state: PeerState) => void): () => void;
  on<K extends keyof PeerEvents>(event: K, listener: (value: PeerEvents[K]) => void): () => void;
  addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): RTCRtpSender;
  removeTrack(sender: RTCRtpSender): void;
  addTransceiver(track: MediaStreamTrack | string, init?: RTCRtpTransceiverInit): RTCRtpTransceiver;
  getTransceivers(): RTCRtpTransceiver[];
  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel;
  getStats(selector?: MediaStreamTrack | null): Promise<RTCStatsReport>;
  restartIce(): void;
  close(): void;
}
