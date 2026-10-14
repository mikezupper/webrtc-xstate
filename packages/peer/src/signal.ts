import type { SignalMessage } from "./types.js";

export class InvalidSignalError extends TypeError {
  readonly code = "INVALID_SIGNAL";

  constructor(message: string) {
    super(message);
    this.name = "InvalidSignalError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSignal(input: unknown): SignalMessage {
  if (!isRecord(input)) throw new InvalidSignalError("signal must be an object");
  if (input.version !== 1) throw new InvalidSignalError("version must be 1");
  if (typeof input.sessionId !== "string" || input.sessionId.trim().length === 0) {
    throw new InvalidSignalError("sessionId must be a nonblank string");
  }
  if (input.kind !== "description" && input.kind !== "candidate") {
    throw new InvalidSignalError("kind must be description or candidate");
  }
  const envelope = { version: 1 as const, sessionId: input.sessionId };
  if (input.kind === "description") {
    const description = input.description;
    if (!isRecord(description)) throw new InvalidSignalError("description must be an object");
    if (description.type !== "offer" && description.type !== "answer") {
      throw new InvalidSignalError("description.type must be offer or answer");
    }
    if (typeof description.sdp !== "string" || description.sdp.trim().length === 0) {
      throw new InvalidSignalError("description.sdp must be a nonblank string");
    }
    return {
      ...envelope,
      kind: "description",
      description: { type: description.type, sdp: description.sdp },
    };
  }
  if (input.candidate === null) return { ...envelope, kind: "candidate", candidate: null };
  const candidate = input.candidate;
  if (!isRecord(candidate) || typeof candidate.candidate !== "string") {
    throw new InvalidSignalError("candidate must be null or an object with a candidate string");
  }
  for (const field of ["sdpMid", "usernameFragment"]) {
    const value = candidate[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new InvalidSignalError(`candidate.${field} must be a string or null`);
    }
  }
  const index = candidate.sdpMLineIndex;
  if (
    index !== undefined &&
    index !== null &&
    (typeof index !== "number" || !Number.isInteger(index) || index < 0)
  ) {
    throw new InvalidSignalError("candidate.sdpMLineIndex must be a nonnegative integer or null");
  }
  const normalized: RTCIceCandidateInit = { candidate: candidate.candidate };
  if (candidate.sdpMid === null || typeof candidate.sdpMid === "string")
    normalized.sdpMid = candidate.sdpMid;
  if (candidate.usernameFragment === null || typeof candidate.usernameFragment === "string")
    normalized.usernameFragment = candidate.usernameFragment;
  if (index === null || typeof index === "number") normalized.sdpMLineIndex = index;
  return { ...envelope, kind: "candidate", candidate: normalized };
}
