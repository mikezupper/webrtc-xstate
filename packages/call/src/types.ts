import type { CaptureOptions, MediaCapture } from "@peerweave/media";
import type { Peer, PeerOptions, PeerState, SignalMessage } from "@peerweave/peer";
import type { CallError } from "./errors.js";
export type CallPhase =
  | "idle"
  | "starting"
  | "connecting"
  | "active"
  | "recovering"
  | "ending"
  | "ended"
  | "failed";
export type CallSignal =
  | SignalMessage
  | { readonly version: 1; readonly sessionId: string; readonly kind: "hangup" };
export interface CallState {
  readonly phase: CallPhase;
  readonly peer: PeerState | null;
  readonly microphoneEnabled: boolean;
  readonly cameraEnabled: boolean;
  readonly screenSharing: boolean;
  readonly error: CallError | null;
}
export interface CallOptions {
  readonly sessionId: string;
  readonly polite: boolean;
  readonly sendSignal: (signal: CallSignal) => void | Promise<void>;
  readonly rtcConfiguration?: RTCConfiguration;
  readonly connectionTimeoutMs?: number;
  readonly recovery?: {
    readonly gracePeriodMs?: number;
    readonly retryDelayMs?: number;
    readonly maxRestarts?: number;
  };
  readonly peerFactory?: (options: PeerOptions) => Peer;
  readonly mediaFactory?: (
    constraints: MediaStreamConstraints,
    options: CaptureOptions,
  ) => Promise<MediaCapture>;
  readonly screenFactory?: (
    constraints: DisplayMediaStreamOptions,
    options: CaptureOptions,
  ) => Promise<MediaCapture>;
  readonly schedule?: (task: () => void, delayMs: number) => () => void;
}
export interface CallEvents {
  readonly track: RTCTrackEvent;
  readonly datachannel: RTCDataChannelEvent;
  readonly error: CallError;
}
export type ScreenShareOptions = Omit<DisplayMediaStreamOptions, "audio"> & {
  readonly audio?: false;
};
export interface Call {
  start(constraints?: MediaStreamConstraints | false): Promise<void>;
  receiveSignal(input: unknown): Promise<void>;
  hangUp(): Promise<void>;
  dispose(): void;
  getState(): CallState;
  subscribe(listener: (state: CallState) => void): () => void;
  on<K extends keyof CallEvents>(event: K, listener: (value: CallEvents[K]) => void): () => void;
  getLocalStream(): MediaStream | null;
  setMicrophoneEnabled(enabled: boolean): void;
  setCameraEnabled(enabled: boolean): void;
  shareScreen(constraints?: ScreenShareOptions): Promise<void>;
  stopSharingScreen(): Promise<void>;
  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel;
  getStats(): Promise<RTCStatsReport>;
}
