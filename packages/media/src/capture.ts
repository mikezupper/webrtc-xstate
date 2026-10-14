import { MediaError } from "./errors.js";
import { browserMedia } from "./platform.js";
import type { CaptureOptions, MediaCapture } from "./types.js";

export async function captureMedia(
  constraints: MediaStreamConstraints = { audio: true, video: true },
  options: CaptureOptions = {},
): Promise<MediaCapture> {
  return acquire(
    () => (options.platform ?? browserMedia).userMedia(constraints),
    options,
    "getUserMedia",
  );
}

export async function captureScreen(
  constraints: DisplayMediaStreamOptions = { video: true, audio: false },
  options: CaptureOptions = {},
): Promise<MediaCapture> {
  return acquire(
    () => (options.platform ?? browserMedia).displayMedia(constraints),
    options,
    "getDisplayMedia",
  );
}

export async function enumerateDevices(
  options: Pick<CaptureOptions, "platform"> = {},
): Promise<MediaDeviceInfo[]> {
  try {
    return await (options.platform ?? browserMedia).devices();
  } catch (error) {
    throw error instanceof MediaError
      ? error
      : new MediaError("ACQUISITION_FAILED", "enumerateDevices", error);
  }
}

function acquire(
  request: () => Promise<MediaStream>,
  options: CaptureOptions,
  operation: string,
): Promise<MediaCapture> {
  if (options.signal?.aborted)
    return Promise.reject(new MediaError("ABORTED", operation, options.signal.reason));
  return new Promise((resolve, reject) => {
    let capture: MediaCapture | undefined;
    const detach = () => options.signal?.removeEventListener("abort", abort);
    const abort = () => {
      if (capture) capture.dispose();
      else reject(new MediaError("ABORTED", operation, options.signal?.reason));
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    let pending: Promise<MediaStream>;
    try {
      pending = request();
    } catch (error) {
      detach();
      reject(
        error instanceof MediaError
          ? error
          : new MediaError("ACQUISITION_FAILED", operation, error),
      );
      return;
    }
    pending.then(
      (stream) => {
        const ownedTracks = stream.getTracks();
        if (options.signal?.aborted) {
          for (const track of ownedTracks) track.stop();
          detach();
          return;
        }
        let disposed = false;
        const ended = new Set<(track: MediaStreamTrack) => void>();
        const cleanups = ownedTracks.map((track) => {
          const handler = () => {
            for (const listener of [...ended]) listener(track);
          };
          track.addEventListener("ended", handler);
          return () => track.removeEventListener("ended", handler);
        });
        capture = {
          stream,
          get disposed() {
            return disposed;
          },
          onEnded(listener) {
            if (!disposed) ended.add(listener);
            return () => {
              ended.delete(listener);
            };
          },
          dispose() {
            if (disposed) return;
            disposed = true;
            detach();
            for (const cleanup of cleanups) cleanup();
            ended.clear();
            for (const track of ownedTracks) track.stop();
          },
        };
        resolve(capture);
      },
      (error) => {
        detach();
        reject(
          error instanceof MediaError
            ? error
            : new MediaError("ACQUISITION_FAILED", operation, error),
        );
      },
    );
  });
}
