import { type Call, type CallState, createCall } from "@peerweave/call";
import { captureMedia } from "@peerweave/media";
import { createSignalingChannel, type SignalingChannel } from "@peerweave/signaling-websocket";

export interface DemoState {
  readonly joined: boolean;
  readonly paired: boolean;
  readonly requested: boolean;
  readonly phase: CallState["phase"] | "waiting";
  readonly muted: boolean;
  readonly local: MediaStream | null;
  readonly remote: MediaStream | null;
  readonly error: string;
}

interface Participant {
  call: Call;
  requested: boolean;
  localReady: boolean;
  peerReady: boolean;
  release(): void;
}

const initial: DemoState = {
  joined: false,
  paired: false,
  requested: false,
  phase: "idle",
  muted: false,
  local: null,
  remote: null,
  error: "",
};
function errorText(error: unknown): string {
  let message = String(error);
  const seen = new Set<Error>();
  while (error instanceof Error && !seen.has(error)) {
    seen.add(error);
    message = error.message;
    error = error.cause;
  }
  return message;
}

/** Application-owned room readiness; Peerweave owns negotiation, recovery and captured tracks. */
export function createDemoSession(url: string, render: (state: DemoState) => void) {
  let state = initial;
  let signaling: SignalingChannel | undefined;
  let participant: Participant | undefined;
  const change = (patch: Partial<DemoState>) => {
    state = { ...state, ...patch };
    render(state);
  };
  const closeCall = () => {
    const previous = participant;
    participant = undefined;
    previous?.release();
    previous?.call.dispose();
    change({
      paired: false,
      requested: false,
      phase: "idle",
      local: null,
      remote: null,
      muted: false,
    });
  };
  const pair = (session: { sessionId: string; polite: boolean }, channel: SignalingChannel) => {
    closeCall();
    let release = () => {};
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current: Participant = {
      requested: false,
      localReady: false,
      peerReady: false,
      release,
      call: createCall({
        ...session,
        sendSignal: (signal) => channel.send(signal),
        // Capture after Start, but wait for both permissions before starting ICE's deadline.
        async mediaFactory(constraints, options) {
          const capture = await captureMedia(constraints, options);
          try {
            if (participant === current) {
              current.localReady = true;
              change({ local: capture.stream });
              update(current.call.getState());
              channel.send({ version: 1, sessionId: session.sessionId, kind: "demo-ready" });
              await ready;
            }
            return capture;
          } catch (error) {
            capture.dispose();
            throw error;
          }
        },
      }),
    };
    const update = (call: CallState) => {
      if (participant !== current) return;
      const terminal = call.phase === "ended" || call.phase === "failed";
      if (terminal) current.release();
      change({
        paired: true,
        requested: current.requested,
        phase: current.localReady && !current.peerReady && !terminal ? "waiting" : call.phase,
        muted: !call.microphoneEnabled,
        ...(terminal ? { local: null, remote: null } : {}),
      });
      if (call.phase === "failed") {
        try {
          channel.send({ version: 1, sessionId: session.sessionId, kind: "hangup" });
        } catch {
          // The local failure is already visible; transport loss also closes the other session.
        }
      }
    };
    participant = current;
    current.call.subscribe(update);
    current.call.on("error", (error) => {
      if (participant === current) change({ error: errorText(error) });
    });
    current.call.on("track", ({ track }) => {
      if (participant !== current) return;
      const remote = state.remote ?? new MediaStream();
      if (!remote.getTracks().includes(track)) remote.addTrack(track);
      change({ remote });
    });
  };
  const leave = () => {
    closeCall();
    const previous = signaling;
    signaling = undefined;
    previous?.dispose();
    change(initial);
  };
  render(state);
  return {
    join(room: string) {
      leave();
      try {
        const channel = createSignalingChannel({ url, room });
        signaling = channel;
        change({ joined: true });
        channel.onMessage((signal) => {
          const current = participant;
          if (!current) return;
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
              signal.sessionId !== channel.getState().session?.sessionId
            ) {
              change({ error: "Invalid readiness signal." });
              return;
            }
            current.peerReady = true;
            current.release();
          } else {
            void current.call.receiveSignal(signal).catch((error) => {
              if (participant === current) change({ error: errorText(error) });
            });
          }
        });
        channel.subscribe((next) => {
          if (signaling !== channel) return;
          if (next.phase === "ready" && next.session) pair(next.session, channel);
          else {
            closeCall();
            if (next.phase === "error" || next.phase === "closed") {
              change({
                joined: false,
                error: next.error?.message ?? "Signaling disconnected. Join again.",
              });
            }
          }
        });
      } catch (error) {
        change({ error: errorText(error) });
      }
    },
    async start() {
      const current = participant;
      if (!current || current.requested) return;
      current.requested = true;
      change({ requested: true, error: "" });
      try {
        await current.call.start({ audio: true, video: true });
      } catch (error) {
        if (participant === current) change({ error: errorText(error) });
      }
    },
    mute() {
      if (state.phase === "active" || state.phase === "recovering")
        participant?.call.setMicrophoneEnabled(state.muted);
    },
    leave,
  };
}
