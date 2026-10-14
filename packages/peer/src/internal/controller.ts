import { PeerError } from "../errors.js";
import { parseSignal } from "../signal.js";
import type { Peer, PeerEvents, PeerOptions, PeerState } from "../types.js";
import type { ConnectionPort } from "./port.js";

export function createPeerController(options: PeerOptions, port: ConnectionPort): Peer {
  let closed = false;
  let makingOffer = false;
  let ignoreOffer = false;
  const candidates: (RTCIceCandidateInit | null)[] = [];
  let remoteGenerations = new Set<string>();
  const retiredGenerations = new Set<string>();
  const ignoredGenerations = new Set<string>();
  const remember = (set: Set<string>, value: string) => {
    set.add(value);
    if (set.size > 64) {
      const oldest = set.values().next().value;
      if (oldest !== undefined) set.delete(oldest);
    }
  };
  const generations = (sdp: string) =>
    new Set(
      [...sdp.matchAll(/(?:^|\n)a=ice-ufrag:([^\r\n]+)/g)].map((match) => match[1] as string),
    );
  const outgoingCandidates: (RTCIceCandidateInit | null)[] = [];
  let pendingOutbound = 0;
  let pendingInbound = 0;
  const limit = options.maxPendingSignals ?? 256;
  let outbound = Promise.resolve();
  let queue = Promise.resolve();
  const lifetime = new AbortController();
  const assertOpen = () => {
    if (closed) throw new PeerError("CLOSED", "peer");
  };
  const wait = <T>(task: Promise<T>): Promise<T> => {
    assertOpen();
    return new Promise((resolve, reject) => {
      const cancel = () => reject(new PeerError("CLOSED", "peer"));
      lifetime.signal.addEventListener("abort", cancel, { once: true });
      task.then(
        (value) => {
          lifetime.signal.removeEventListener("abort", cancel);
          if (closed) cancel();
          else resolve(value);
        },
        (error) => {
          lifetime.signal.removeEventListener("abort", cancel);
          reject(error);
        },
      );
    });
  };
  const enqueue = (task: () => Promise<void>) => {
    if (pendingInbound >= limit)
      return Promise.reject(new PeerError("BUFFER_LIMIT", "receiveSignal"));
    pendingInbound++;
    const result = queue
      .then(() => {
        assertOpen();
        return task();
      })
      .finally(() => {
        pendingInbound--;
      });
    queue = result.catch(() => {});
    return result;
  };
  const acceptCandidate = async (candidate: RTCIceCandidateInit | null) => {
    const generation =
      candidate?.usernameFragment ?? candidate?.candidate?.match(/\bufrag\s+(\S+)/)?.[1];
    if (generation && retiredGenerations.has(generation)) return;
    if (ignoreOffer && !generation) return;
    if (
      !port.remoteDescription ||
      (generation && ignoredGenerations.has(generation)) ||
      (generation && remoteGenerations.size > 0 && !remoteGenerations.has(generation))
    ) {
      if (candidates.length >= (options.maxBufferedCandidates ?? 256))
        throw new PeerError("BUFFER_LIMIT", "bufferCandidate");
      candidates.push(candidate);
    } else await wait(port.addCandidate(candidate));
  };
  const observers = new Set<(state: PeerState) => void>();
  const state = (): PeerState => Object.freeze({ ...port.state, closed });
  const notify = (listener: (state: PeerState) => void) => {
    try {
      listener(state());
    } catch (error) {
      emit("error", new PeerError("LISTENER_FAILED", "state", error));
    }
  };
  const publish = () => {
    for (const listener of [...observers]) notify(listener);
  };
  const listeners: { [K in keyof PeerEvents]: Set<(value: PeerEvents[K]) => void> } = {
    track: new Set(),
    datachannel: new Set(),
    error: new Set(),
  };
  const emit = <K extends keyof PeerEvents>(event: K, value: PeerEvents[K]) => {
    for (const listener of [...listeners[event]]) {
      try {
        listener(value);
      } catch (error) {
        if (event !== "error") emit("error", new PeerError("LISTENER_FAILED", event, error));
      }
    }
  };
  const send = (signal: import("../types.js").SignalMessage) => {
    if (pendingOutbound >= limit) {
      emit("error", new PeerError("BUFFER_LIMIT", "sendSignal"));
      return;
    }
    pendingOutbound++;
    outbound = outbound
      .then(async () => {
        assertOpen();
        await wait(Promise.resolve(options.sendSignal(signal)));
      })
      .catch((error) => {
        if (!closed) emit("error", new PeerError("SIGNALING_FAILED", "sendSignal", error));
      })
      .finally(() => {
        pendingOutbound--;
      });
  };
  const negotiate = async () => {
    assertOpen();
    makingOffer = true;
    try {
      const description = await wait(port.describe());
      send({ version: 1, sessionId: options.sessionId, kind: "description", description });
      for (const candidate of outgoingCandidates.splice(0))
        send({ version: 1, sessionId: options.sessionId, kind: "candidate", candidate });
    } finally {
      makingOffer = false;
      outgoingCandidates.length = 0;
    }
  };
  const detach = port.listen({
    state: publish,
    negotiation() {
      void enqueue(async () => {
        if (port.state.signalingState === "stable") await negotiate();
      }).catch((error) => {
        if (!closed) emit("error", new PeerError("NEGOTIATION_FAILED", "negotiate", error));
      });
    },
    candidate(candidate) {
      if (closed) return;
      if (makingOffer) outgoingCandidates.push(candidate);
      else send({ version: 1, sessionId: options.sessionId, kind: "candidate", candidate });
    },
    track(value) {
      emit("track", value);
    },
    datachannel(value) {
      emit("datachannel", value);
    },
  });
  return {
    addTrack(track, ...streams) {
      assertOpen();
      return port.addTrack(track, ...streams);
    },
    removeTrack(sender) {
      assertOpen();
      port.removeTrack(sender);
    },
    addTransceiver(track, init) {
      assertOpen();
      return port.addTransceiver(track, init);
    },
    getTransceivers() {
      assertOpen();
      return port.getTransceivers();
    },
    createDataChannel(label, init) {
      assertOpen();
      return port.createDataChannel(label, init);
    },
    async getStats(selector) {
      assertOpen();
      return wait(port.getStats(selector));
    },
    restartIce() {
      assertOpen();
      port.restartIce();
    },
    async receiveSignal(input: unknown) {
      assertOpen();
      const signal = parseSignal(input);
      if (signal.sessionId !== options.sessionId)
        throw new PeerError("SESSION_MISMATCH", "receiveSignal");
      return enqueue(async () => {
        if (signal.kind === "description") {
          const collision =
            signal.description.type === "offer" &&
            (makingOffer || port.state.signalingState !== "stable");
          ignoreOffer = !options.polite && collision;
          if (ignoreOffer) {
            for (const generation of generations(signal.description.sdp))
              remember(ignoredGenerations, generation);
            return;
          }
          await wait(port.accept(signal.description));
          const next = generations(signal.description.sdp);
          for (const previous of remoteGenerations)
            if (!next.has(previous)) remember(retiredGenerations, previous);
          remoteGenerations = next;
          for (const generation of next) {
            retiredGenerations.delete(generation);
            ignoredGenerations.delete(generation);
          }
          for (const candidate of candidates.splice(0)) await acceptCandidate(candidate);
          if (signal.description.type === "offer") await negotiate();
        } else await acceptCandidate(signal.candidate);
      }).catch((cause) => {
        throw cause instanceof PeerError
          ? cause
          : new PeerError("NEGOTIATION_FAILED", "receiveSignal", cause);
      });
    },
    on<K extends keyof PeerEvents>(event: K, listener: (value: PeerEvents[K]) => void) {
      assertOpen();
      listeners[event].add(listener);
      return () => {
        listeners[event].delete(listener);
      };
    },
    subscribe(listener: (state: PeerState) => void) {
      notify(listener);
      if (!closed) observers.add(listener);
      return () => {
        observers.delete(listener);
      };
    },
    getState: state,
    close() {
      if (closed) return;
      closed = true;
      candidates.length = 0;
      outgoingCandidates.length = 0;
      remoteGenerations.clear();
      ignoredGenerations.clear();
      retiredGenerations.clear();
      lifetime.abort();
      detach();
      port.close();
      publish();
      observers.clear();
      for (const collection of Object.values(listeners)) collection.clear();
    },
  };
}
