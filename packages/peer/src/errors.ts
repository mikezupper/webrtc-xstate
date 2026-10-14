export type PeerErrorCode =
  | "CLOSED"
  | "SESSION_MISMATCH"
  | "NEGOTIATION_FAILED"
  | "SIGNALING_FAILED"
  | "BROWSER_UNAVAILABLE"
  | "INVALID_OPTIONS"
  | "BUFFER_LIMIT"
  | "LISTENER_FAILED";

export class PeerError extends Error {
  constructor(
    readonly code: PeerErrorCode,
    readonly operation: string,
    cause?: unknown,
  ) {
    super(`${operation} failed (${code})`, { cause });
    this.name = "PeerError";
  }
}
