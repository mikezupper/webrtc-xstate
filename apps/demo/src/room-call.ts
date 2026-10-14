import { type Call, CallError, createCall } from "@peerweave/call";
import { captureMedia } from "@peerweave/media";

interface RoomCallOptions {
  readonly sessionId: string;
  readonly polite: boolean;
  readonly rtcConfiguration?: RTCConfiguration;
  readonly sendSignal: (signal: unknown) => void | Promise<void>;
  readonly onChange: () => void;
  readonly onLocalStream: (stream: MediaStream) => void;
}

export interface RoomCall {
  readonly call: Call;
  readonly waiting: boolean;
  readonly requested: boolean;
  readonly peerReady: boolean;
  start(constraints: MediaStreamConstraints | false): Promise<void>;
  receiveSignal(signal: unknown): Promise<void>;
  dispose(): void;
}

// Readiness belongs to this demo's invitation flow, outside the managed call protocol.
export function createRoomCall(options: RoomCallOptions): RoomCall {
  let requested = false;
  let localReady = false;
  let peerReady = false;
  let cancelled = false;
  let release: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    release();
    options.onChange();
  };
  const announce = async () => {
    localReady = true;
    options.onChange();
    await options.sendSignal({ version: 1, sessionId: options.sessionId, kind: "demo-ready" });
    await ready;
  };
  const call = createCall({
    sessionId: options.sessionId,
    polite: options.polite,
    sendSignal: options.sendSignal,
    ...(options.rtcConfiguration ? { rtcConfiguration: options.rtcConfiguration } : {}),
    async mediaFactory(constraints, captureOptions) {
      const capture = await captureMedia(constraints, captureOptions);
      try {
        if (!cancelled) {
          options.onLocalStream(capture.stream);
          await announce();
        }
        return capture;
      } catch (error) {
        capture.dispose();
        throw error;
      }
    },
  });
  call.subscribe((state) => {
    if (state.phase === "ended" || state.phase === "failed") stop();
    if (state.phase === "failed") {
      try {
        void Promise.resolve(
          options.sendSignal({ version: 1, sessionId: options.sessionId, kind: "hangup" }),
        ).catch(() => {});
      } catch {
        // The original failure is shown locally; disconnected signaling cannot notify the peer.
      }
    }
  });
  return {
    call,
    get waiting() {
      return localReady && !peerReady && !cancelled;
    },
    get requested() {
      return requested;
    },
    get peerReady() {
      return peerReady;
    },
    async start(constraints) {
      if (requested || cancelled) throw new CallError("INVALID_STATE", "start");
      requested = true;
      try {
        if (constraints === false) {
          await announce();
          if (cancelled) return;
        }
        await call.start(constraints);
      } catch (error) {
        if (cancelled && call.getState().phase === "ended") return;
        if (constraints === false) call.dispose();
        throw error;
      }
    },
    async receiveSignal(signal) {
      if (
        typeof signal === "object" &&
        signal !== null &&
        "kind" in signal &&
        signal.kind === "demo-ready"
      ) {
        if (
          !("version" in signal) ||
          signal.version !== 1 ||
          !("sessionId" in signal) ||
          signal.sessionId !== options.sessionId
        )
          throw new CallError("SESSION_MISMATCH", "ready");
        if (cancelled || peerReady) return;
        peerReady = true;
        release();
        options.onChange();
      } else await call.receiveSignal(signal);
    },
    dispose() {
      call.dispose();
      stop();
    },
  };
}
