import type { MediaCapture } from "@peerweave/media";
import { captureMedia, captureScreen } from "@peerweave/media";
import type { Peer } from "@peerweave/peer";
import { createPeer, parseSignal } from "@peerweave/peer";
import { CallError } from "./errors.js";
import { createLifecycle } from "./internal/lifecycle.js";
import type { Call, CallEvents, CallOptions, CallPhase, CallState } from "./types.js";

// Browser-owned track state can change across awaits despite its readonly DOM type.
const trackEnded = (track: MediaStreamTrack) => track.readyState === "ended";

export function createCall(options: CallOptions): Call {
  if (
    !options ||
    typeof options.sessionId !== "string" ||
    !options.sessionId.trim() ||
    typeof options.polite !== "boolean" ||
    typeof options.sendSignal !== "function" ||
    [
      options.recovery?.gracePeriodMs,
      options.recovery?.retryDelayMs,
      options.connectionTimeoutMs,
    ].some((v) => v !== undefined && (!Number.isFinite(v) || v < 0)) ||
    (options.recovery?.maxRestarts !== undefined &&
      (!Number.isInteger(options.recovery.maxRestarts) || options.recovery.maxRestarts < 0))
  )
    throw new CallError("INVALID_OPTIONS", "createCall");
  const lifecycle = createLifecycle();
  lifecycle.start();
  const pending: unknown[] = [];
  const captures = new Set<MediaCapture>();
  let peer: Peer | undefined;
  let media: MediaCapture | undefined;
  let localTracks: MediaStreamTrack[] = [];
  let screen: MediaCapture | undefined;
  let videoSender: RTCRtpSender | undefined;
  let screenBusy = false;
  let detachScreen: (() => void) | undefined;
  let error: CallError | null = null;
  let cancelInitial: (() => void) | undefined;
  let cancelRecovery: (() => void) | undefined;
  let attempts = 0;
  const recovery = {
    gracePeriodMs: options.recovery?.gracePeriodMs ?? 1000,
    retryDelayMs: options.recovery?.retryDelayMs ?? 2000,
    maxRestarts: options.recovery?.maxRestarts ?? 2,
  };
  const schedule =
    options.schedule ??
    ((fn: () => void, ms: number) => {
      const timer = setTimeout(fn, ms);
      return () => clearTimeout(timer);
    });
  const abort = new AbortController();
  const cleanups: (() => void)[] = [];
  const observers = new Set<(s: CallState) => void>();
  const listeners: { [K in keyof CallEvents]: Set<(v: CallEvents[K]) => void> } = {
    track: new Set(),
    datachannel: new Set(),
    error: new Set(),
  };
  const phase = () => lifecycle.getSnapshot().value as CallPhase;
  const state = (): CallState =>
    Object.freeze({
      phase: phase(),
      peer: peer?.getState() ?? null,
      microphoneEnabled: localTracks.some((t) => t.kind === "audio" && t.enabled),
      cameraEnabled: localTracks.some((t) => t.kind === "video" && t.enabled),
      screenSharing: screen !== undefined,
      error,
    });
  const emit = <K extends keyof CallEvents>(event: K, value: CallEvents[K]) => {
    for (const fn of [...listeners[event]]) {
      try {
        fn(value);
      } catch (cause) {
        if (event !== "error") emit("error", new CallError("LISTENER_FAILED", event, cause));
      }
    }
  };
  const notify = (fn: (s: CallState) => void) => {
    try {
      fn(state());
    } catch (cause) {
      emit("error", new CallError("LISTENER_FAILED", "subscribe", cause));
    }
  };
  const publish = () => {
    for (const fn of [...observers]) notify(fn);
  };
  const terminal = () => phase() === "ended" || phase() === "failed" || phase() === "ending";
  const cleanup = () => {
    cancelInitial?.();
    cancelInitial = undefined;
    cancelRecovery?.();
    cancelRecovery = undefined;
    pending.length = 0;
    abort.abort();
    for (const fn of cleanups.splice(0)) fn();
    detachScreen?.();
    for (const capture of captures) capture.dispose();
    captures.clear();
    screen?.dispose();
    screen = undefined;
    media?.dispose();
    peer?.close();
  };
  const end = () => {
    if (terminal()) return;
    lifecycle.send({ type: "END" });
    cleanup();
    lifecycle.send({ type: "DONE" });
    publish();
    observers.clear();
    for (const set of Object.values(listeners)) set.clear();
  };
  const fail = (failure: CallError) => {
    if (terminal()) return;
    error = failure;
    lifecycle.send({ type: "FAIL" });
    cleanup();
    publish();
    emit("error", failure);
    observers.clear();
    for (const set of Object.values(listeners)) set.clear();
  };
  const restart = () => {
    cancelRecovery = undefined;
    if (terminal() || phase() !== "recovering") return;
    if (attempts >= recovery.maxRestarts) {
      fail(new CallError("RECOVERY_EXHAUSTED", "recover"));
      return;
    }
    attempts++;
    try {
      peer?.restartIce();
    } catch (cause) {
      fail(new CallError("RECOVERY_EXHAUSTED", "restartIce", cause));
      return;
    }
    cancelRecovery = schedule(restart, recovery.retryDelayMs);
  };
  const recover = () => {
    cancelInitial?.();
    cancelInitial = undefined;
    lifecycle.send({ type: "RECOVER" });
    cancelRecovery = schedule(restart, recovery.gracePeriodMs);
  };
  const observe = (s: import("@peerweave/peer").PeerState) => {
    if (terminal()) return;
    if (s.connectionState === "connected") {
      cancelInitial?.();
      cancelInitial = undefined;
      cancelRecovery?.();
      cancelRecovery = undefined;
      attempts = 0;
      if (phase() !== "starting") lifecycle.send({ type: "CONNECTED" });
    } else if (
      (s.connectionState === "disconnected" || s.connectionState === "failed") &&
      (phase() === "connecting" || phase() === "active")
    )
      recover();
    publish();
  };
  const switchVideo = async (track: MediaStreamTrack | null, stream: MediaStream) => {
    if (!peer || terminal()) throw new CallError("CLOSED", "switchVideo");
    if (videoSender) {
      try {
        await videoSender.replaceTrack(track);
        return;
      } catch (cause) {
        if (!(cause instanceof DOMException) || cause.name !== "InvalidModificationError")
          throw cause;
        if (terminal()) throw new CallError("CLOSED", "switchVideo");
        peer.removeTrack(videoSender);
        videoSender = undefined;
      }
    }
    if (track) videoSender = peer.addTrack(track, stream);
  };
  const stopScreen = async () => {
    if (!screen) return;
    if (screenBusy) throw new CallError("INVALID_STATE", "stopSharingScreen");
    screenBusy = true;
    const owned = screen;
    screen = undefined;
    detachScreen?.();
    detachScreen = undefined;
    try {
      if (!terminal())
        await switchVideo(
          localTracks.find((t) => t.kind === "video") ?? null,
          media?.stream ?? owned.stream,
        );
    } catch (cause) {
      throw new CallError("SCREEN_FAILED", "stopSharingScreen", cause);
    } finally {
      owned.dispose();
      captures.delete(owned);
      screenBusy = false;
      publish();
    }
  };
  return {
    async start(constraints = { audio: true, video: true }) {
      if (phase() !== "idle") throw new CallError("INVALID_STATE", "start");
      lifecycle.send({ type: "START" });
      publish();
      try {
        if (terminal()) throw new CallError("CLOSED", "start");
        peer = (options.peerFactory ?? createPeer)({
          sessionId: options.sessionId,
          polite: options.polite,
          sendSignal: options.sendSignal,
          ...(options.rtcConfiguration ? { rtcConfiguration: options.rtcConfiguration } : {}),
        });
        if (terminal()) {
          peer.close();
          throw new CallError("CLOSED", "start");
        }
        cleanups.push(
          peer.on("track", (v) => emit("track", v)),
          peer.on("datachannel", (v) => emit("datachannel", v)),
          peer.on("error", (cause) => {
            if ("code" in cause && cause.code === "LISTENER_FAILED")
              emit("error", new CallError("LISTENER_FAILED", "peer", cause));
            else fail(new CallError("SIGNALING_FAILED", "peer", cause));
          }),
        );
        const detachPeerState = peer.subscribe(observe);
        if (terminal()) {
          detachPeerState();
          throw new CallError("CLOSED", "start");
        }
        cleanups.push(detachPeerState);
        if (constraints !== false) {
          media = await (options.mediaFactory ?? captureMedia)(constraints, {
            signal: abort.signal,
          });
          captures.add(media);
          if (terminal()) {
            media.dispose();
            captures.delete(media);
            throw new CallError("CLOSED", "start");
          }
          localTracks = [...media.stream.getTracks()];
          for (const track of localTracks) {
            const sender = peer.addTrack(track, media.stream);
            if (track.kind === "video") videoSender = sender;
          }
        }
        for (const signal of pending.splice(0)) await peer.receiveSignal(signal);
        if (terminal()) throw new CallError("CLOSED", "start");
        lifecycle.send({ type: "READY" });
        cancelInitial = schedule(() => {
          cancelInitial = undefined;
          if (phase() === "connecting") recover();
        }, options.connectionTimeoutMs ?? 15000);
        observe(peer.getState());
        publish();
      } catch (cause) {
        if (terminal()) throw new CallError("CLOSED", "start", cause);
        const failure = new CallError("START_FAILED", "start", cause);
        fail(failure);
        throw failure;
      }
    },
    async hangUp() {
      if (terminal()) return;
      end();
      try {
        await options.sendSignal({ version: 1, sessionId: options.sessionId, kind: "hangup" });
      } catch (cause) {
        throw new CallError("SIGNALING_FAILED", "hangUp", cause);
      }
    },
    dispose: end,
    getState: state,
    getLocalStream: () => media?.stream ?? null,
    subscribe(fn) {
      notify(fn);
      if (!terminal()) observers.add(fn);
      return () => {
        observers.delete(fn);
      };
    },
    on(event, fn) {
      if (terminal()) throw new CallError("CLOSED", "on");
      listeners[event].add(fn);
      return () => {
        listeners[event].delete(fn);
      };
    },
    async receiveSignal(input) {
      const hangup =
        typeof input === "object" && input !== null && "kind" in input && input.kind === "hangup";
      const signal = hangup
        ? (input as { version: unknown; sessionId: unknown; kind: "hangup" })
        : parseSignal(input);
      if (signal.version !== 1 || signal.sessionId !== options.sessionId)
        throw new CallError("SESSION_MISMATCH", "receiveSignal");
      if (hangup) {
        end();
        return;
      }
      if (terminal()) throw new CallError("CLOSED", "receiveSignal");
      if (!peer) {
        if (pending.length >= 256) throw new CallError("BUFFER_LIMIT", "receiveSignal");
        pending.push(signal);
        return;
      }
      await peer.receiveSignal(signal);
    },
    setMicrophoneEnabled(enabled) {
      if (terminal()) throw new CallError("CLOSED", "setMicrophoneEnabled");
      for (const t of localTracks) if (t.kind === "audio") t.enabled = enabled;
      publish();
    },
    setCameraEnabled(enabled) {
      if (terminal()) throw new CallError("CLOSED", "setCameraEnabled");
      for (const t of localTracks) if (t.kind === "video") t.enabled = enabled;
      publish();
    },
    async shareScreen(constraints = { video: true, audio: false }) {
      if (constraints.audio !== undefined && constraints.audio !== false)
        throw new CallError("INVALID_OPTIONS", "shareScreen");
      if (!peer || terminal()) throw new CallError("CLOSED", "shareScreen");
      if (screenBusy || screen) throw new CallError("INVALID_STATE", "shareScreen");
      screenBusy = true;
      let owned: MediaCapture | undefined;
      try {
        owned = await (options.screenFactory ?? captureScreen)(constraints, {
          signal: abort.signal,
        });
        captures.add(owned);
        if (terminal()) throw new CallError("CLOSED", "shareScreen");
        const track = owned.stream.getVideoTracks()[0];
        if (!track || trackEnded(track)) throw new CallError("SCREEN_FAILED", "screenTrack");
        await switchVideo(track, owned.stream);
        if (terminal()) throw new CallError("CLOSED", "shareScreen");
        if (trackEnded(track)) {
          await switchVideo(
            localTracks.find((t) => t.kind === "video") ?? null,
            media?.stream ?? owned.stream,
          );
          throw new CallError("SCREEN_FAILED", "screenTrack");
        }
        screen = owned;
        detachScreen = screen.onEnded(() => {
          void stopScreen().catch((cause) => {
            emit("error", cause as CallError);
          });
        });
        publish();
      } catch (cause) {
        owned?.dispose();
        if (owned) captures.delete(owned);
        throw cause instanceof CallError
          ? cause
          : new CallError("SCREEN_FAILED", "shareScreen", cause);
      } finally {
        screenBusy = false;
      }
    },
    stopSharingScreen: stopScreen,
    createDataChannel(label, init) {
      if (!peer || terminal()) throw new CallError("CLOSED", "createDataChannel");
      return peer.createDataChannel(label, init);
    },
    async getStats() {
      if (!peer || terminal()) throw new CallError("CLOSED", "getStats");
      return peer.getStats();
    },
  };
}
