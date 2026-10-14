export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export const CHUNK_BYTES = 16 * 1024;
export interface FileOffer {
  readonly kind: "offer";
  readonly id: string;
  readonly name: string;
  readonly size: number;
}
export type FileControl =
  | FileOffer
  | { readonly kind: "accept" | "reject" | "cancel" | "finish" | "received"; readonly id: string };
export function parseControl(text: string): FileControl {
  if (text.length > 2048) throw new Error("Transfer metadata is too large.");
  const value: unknown = JSON.parse(text);
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(value.id) ||
    !("kind" in value)
  )
    throw new Error("Invalid transfer metadata.");
  if (value.kind === "offer") {
    if (
      !("name" in value) ||
      typeof value.name !== "string" ||
      value.name.length < 1 ||
      value.name.length > 128 ||
      value.name.includes("/") ||
      value.name.includes("\\") ||
      [...value.name].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      !("size" in value) ||
      typeof value.size !== "number" ||
      !Number.isSafeInteger(value.size) ||
      value.size < 0 ||
      value.size > MAX_FILE_BYTES
    )
      throw new Error("Files must have a safe name and be at most 32 MiB.");
    return { kind: "offer", id: value.id, name: value.name, size: value.size };
  }
  if (
    value.kind === "accept" ||
    value.kind === "reject" ||
    value.kind === "cancel" ||
    value.kind === "finish" ||
    value.kind === "received"
  )
    return { kind: value.kind, id: value.id };
  throw new Error("Unknown transfer message.");
}

export function drain(channel: RTCDataChannel, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (channel.readyState !== "open") return Promise.reject(new Error("The data channel closed."));
  if (channel.bufferedAmount <= 256 * 1024) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      channel.removeEventListener("bufferedamountlow", low);
      channel.removeEventListener("close", close);
      channel.removeEventListener("error", close);
      signal.removeEventListener("abort", abort);
    };
    const low = () => {
      cleanup();
      resolve();
    };
    const close = () => {
      cleanup();
      reject(new Error("The data channel closed."));
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("The transfer queue stalled. Try a fresh connection."));
    }, 10000);
    channel.addEventListener("bufferedamountlow", low, { once: true });
    channel.addEventListener("close", close, { once: true });
    channel.addEventListener("error", close, { once: true });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else if (channel.bufferedAmount <= 64 * 1024) low();
  });
}
