export type SignalingErrorCode =
  | "INVALID_OPTIONS"
  | "UNAVAILABLE"
  | "NOT_READY"
  | "TRANSPORT_FAILED"
  | "PROTOCOL_ERROR"
  | "TIMEOUT"
  | "BACKPRESSURE"
  | "LISTENER_FAILED";
export class SignalingError extends Error {
  constructor(
    readonly code: SignalingErrorCode,
    readonly cause?: unknown,
  ) {
    super(`Signaling: ${code}`, { cause });
    this.name = "SignalingError";
  }
}
export interface SignalingOptions {
  readonly url: string;
  readonly room: string;
  readonly connectionTimeoutMs?: number;
  readonly socketFactory?: (url: string) => WebSocket;
}
export interface SignalingState {
  readonly phase: "connecting" | "waiting" | "ready" | "closed" | "error";
  readonly session: { readonly sessionId: string; readonly polite: boolean } | null;
  readonly error: SignalingError | null;
}
export interface SignalingChannel {
  getState(): SignalingState;
  subscribe(listener: (state: SignalingState) => void): () => void;
  onMessage(listener: (message: unknown) => void): () => void;
  onError(listener: (error: SignalingError) => void): () => void;
  send(message: unknown): void;
  dispose(): void;
}
export function createSignalingChannel(options: SignalingOptions): SignalingChannel {
  if (
    !options ||
    typeof options.room !== "string" ||
    !/^[-\w]{1,64}$/.test(options.room) ||
    typeof options.url !== "string" ||
    !/^wss?:\/\//.test(options.url) ||
    (options.connectionTimeoutMs !== undefined &&
      (!Number.isFinite(options.connectionTimeoutMs) || options.connectionTimeoutMs < 1))
  )
    throw new SignalingError("INVALID_OPTIONS");
  if (!options.socketFactory && typeof globalThis.WebSocket !== "function")
    throw new SignalingError("UNAVAILABLE");
  let socket: WebSocket;
  try {
    socket = options.socketFactory
      ? options.socketFactory(options.url)
      : new WebSocket(options.url);
  } catch (cause) {
    throw new SignalingError("TRANSPORT_FAILED", cause);
  }
  let state: SignalingState = Object.freeze({ phase: "connecting", session: null, error: null });
  const observers = new Set<(state: SignalingState) => void>(),
    messages = new Set<(v: unknown) => void>(),
    errors = new Set<(e: SignalingError) => void>();
  const terminal = () => state.phase === "closed" || state.phase === "error";
  const report = (error: SignalingError) => {
    for (const fn of [...errors]) {
      try {
        fn(error);
      } catch {
        /* An error observer must not recurse. */
      }
    }
  };
  const invoke = <T>(fn: (value: T) => void, value: T) => {
    try {
      fn(value);
    } catch (cause) {
      report(new SignalingError("LISTENER_FAILED", cause));
    }
  };
  const update = (
    phase: SignalingState["phase"],
    session: SignalingState["session"] = null,
    error: SignalingError | null = null,
  ) => {
    state = Object.freeze({ phase, session, error });
    for (const fn of [...observers]) invoke(fn, state);
  };
  const detach = () => {
    clearTimeout(timeout);
    socket.removeEventListener("open", open);
    socket.removeEventListener("message", message);
    socket.removeEventListener("error", failure);
    socket.removeEventListener("close", close);
  };
  const fail = (error: SignalingError) => {
    if (terminal()) return;
    detach();
    socket.close();
    update("error", null, error);
    report(error);
    observers.clear();
    messages.clear();
    errors.clear();
  };
  const open = () => {
    if (terminal()) return;
    clearTimeout(timeout);
    try {
      socket.send(JSON.stringify({ kind: "join", room: options.room }));
      update("waiting");
    } catch (cause) {
      fail(new SignalingError("TRANSPORT_FAILED", cause));
    }
  };
  const message = (event: MessageEvent) => {
    if (terminal()) return;
    let value: unknown;
    try {
      if (typeof event.data !== "string" || new TextEncoder().encode(event.data).length > 65536)
        throw new Error("Invalid frame");
      value = JSON.parse(event.data);
    } catch (cause) {
      fail(new SignalingError("PROTOCOL_ERROR", cause));
      return;
    }
    if (!value || typeof value !== "object" || !("kind" in value)) {
      fail(new SignalingError("PROTOCOL_ERROR"));
      return;
    }
    if (value.kind === "waiting" || value.kind === "peer-left") update("waiting");
    else if (
      value.kind === "ready" &&
      "sessionId" in value &&
      typeof value.sessionId === "string" &&
      value.sessionId.trim() &&
      "polite" in value &&
      typeof value.polite === "boolean"
    )
      update("ready", Object.freeze({ sessionId: value.sessionId, polite: value.polite }));
    else if (
      value.kind === "signal" &&
      "sessionId" in value &&
      value.sessionId === state.session?.sessionId &&
      "payload" in value
    ) {
      for (const fn of [...messages]) invoke(fn, value.payload);
    } else if (value.kind === "error")
      fail(new SignalingError("PROTOCOL_ERROR", "code" in value ? value.code : undefined));
    else fail(new SignalingError("PROTOCOL_ERROR"));
  };
  const failure = (event: Event) => fail(new SignalingError("TRANSPORT_FAILED", event));
  const close = () => {
    if (terminal()) return;
    detach();
    update("closed");
    observers.clear();
    messages.clear();
    errors.clear();
  };
  const timeout = setTimeout(
    () => fail(new SignalingError("TIMEOUT")),
    options.connectionTimeoutMs ?? 10000,
  );
  socket.addEventListener("open", open);
  socket.addEventListener("message", message);
  socket.addEventListener("error", failure);
  socket.addEventListener("close", close);
  return {
    getState: () => state,
    subscribe(fn) {
      invoke(fn, state);
      if (!terminal()) observers.add(fn);
      return () => {
        observers.delete(fn);
      };
    },
    onMessage(fn) {
      if (!terminal()) messages.add(fn);
      return () => {
        messages.delete(fn);
      };
    },
    onError(fn) {
      if (!terminal()) errors.add(fn);
      return () => {
        errors.delete(fn);
      };
    },
    send(payload) {
      if (state.phase !== "ready" || !state.session) throw new SignalingError("NOT_READY");
      let encoded: string;
      try {
        encoded = JSON.stringify({ kind: "signal", sessionId: state.session.sessionId, payload });
        if (!Object.hasOwn(JSON.parse(encoded), "payload"))
          throw new TypeError("Payload must be JSON serializable");
      } catch (cause) {
        throw new SignalingError("PROTOCOL_ERROR", cause);
      }
      if (new TextEncoder().encode(encoded).length > 65536 || socket.bufferedAmount > 262144)
        throw new SignalingError("BACKPRESSURE");
      try {
        socket.send(encoded);
      } catch (cause) {
        throw new SignalingError("TRANSPORT_FAILED", cause);
      }
    },
    dispose() {
      if (terminal()) return;
      detach();
      socket.close();
      update("closed");
      observers.clear();
      messages.clear();
      errors.clear();
    },
  };
}
