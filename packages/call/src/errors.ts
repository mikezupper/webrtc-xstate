export type CallErrorCode =
  | "CLOSED"
  | "INVALID_OPTIONS"
  | "INVALID_STATE"
  | "SESSION_MISMATCH"
  | "START_FAILED"
  | "SIGNALING_FAILED"
  | "RECOVERY_EXHAUSTED"
  | "SCREEN_FAILED"
  | "LISTENER_FAILED"
  | "BUFFER_LIMIT";
export class CallError extends Error {
  constructor(
    readonly code: CallErrorCode,
    readonly operation: string,
    readonly cause?: unknown,
  ) {
    super(`${operation}: ${code}`, { cause });
    this.name = "CallError";
  }
}
