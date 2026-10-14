export type MediaErrorCode = "UNAVAILABLE" | "ABORTED" | "ACQUISITION_FAILED";

export class MediaError extends Error {
  constructor(
    readonly code: MediaErrorCode,
    readonly operation: string,
    cause?: unknown,
  ) {
    super(`${operation} failed (${code})`, { cause });
    this.name = "MediaError";
  }
}
