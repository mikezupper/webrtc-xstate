import { captureMedia, enumerateDevices, type MediaCapture } from "@peerweave/media";
import { errorText, Observable } from "../shared/runtime.js";
export interface DeviceChoice {
  readonly id: string;
  readonly label: string;
  readonly kind: "audioinput" | "videoinput";
}
export interface TrackInfo {
  readonly kind: string;
  readonly label: string;
  readonly detail: string;
}
/** Pure: what the preview shows for one captured track. */
export function describeTrack(
  track: Pick<MediaStreamTrack, "kind" | "label" | "getSettings">,
): TrackInfo {
  const { width, height } = track.getSettings();
  return {
    kind: track.kind,
    label: track.label || "Browser device",
    detail: width && height ? `${width} × ${height}` : "",
  };
}
export interface MediaView {
  readonly phase: "idle" | "preparing" | "ready" | "failed";
  readonly devices: readonly DeviceChoice[];
  readonly tracks: readonly TrackInfo[];
  readonly feedback: string;
  readonly revision: number;
}
export const initialMediaView: MediaView = {
  phase: "idle",
  devices: [],
  tracks: [],
  feedback: "",
  revision: 0,
};
export type MediaAction =
  | {
      readonly _tag: "Preview";
      readonly audio: boolean;
      readonly video: boolean;
      readonly camera: string;
      readonly microphone: string;
    }
  | { readonly _tag: "Stop" }
  | { readonly _tag: "Devices" };
export class MediaController extends Observable<MediaView> {
  private capture: MediaCapture | undefined;
  private pending: AbortController | undefined;
  private generation = 0;
  private disposed = false;
  constructor() {
    super(initialMediaView);
  }
  private change(patch: Partial<MediaView>) {
    if (!this.disposed)
      this.publish({ ...this.snapshot, ...patch, revision: this.snapshot.revision + 1 });
  }
  getStream() {
    return this.capture?.stream ?? null;
  }
  private stop() {
    this.generation++;
    this.pending?.abort();
    this.pending = undefined;
    this.capture?.dispose();
    this.capture = undefined;
    this.change({ phase: "idle", tracks: [] });
  }
  private async devices() {
    const devices = await enumerateDevices();
    this.change({
      devices: devices
        // Before permission, browsers list placeholders without IDs: the default covers them.
        .filter(
          (device) =>
            device.deviceId && (device.kind === "audioinput" || device.kind === "videoinput"),
        )
        .map((device, index) => ({
          id: device.deviceId,
          kind: device.kind as DeviceChoice["kind"],
          label:
            device.label ||
            `${device.kind === "videoinput" ? "Camera" : "Microphone"} ${index + 1}`,
        })),
    });
  }
  async act(action: MediaAction) {
    if (this.disposed) return;
    if (action._tag === "Stop") {
      this.stop();
      this.change({ feedback: "Preview stopped. All captured tracks have been released." });
      return;
    }
    if (action._tag === "Devices") {
      await this.devices();
      return;
    }
    this.stop();
    if (!action.audio && !action.video) {
      this.change({
        phase: "failed",
        feedback: "Enable a camera or microphone before starting a preview.",
      });
      return;
    }
    const generation = this.generation;
    const pending = new AbortController();
    this.pending = pending;
    this.change({
      phase: "preparing",
      feedback: "Allow camera/microphone access when prompted. You can cancel while waiting.",
    });
    try {
      const capture = await captureMedia(
        {
          audio: action.audio
            ? action.microphone
              ? { deviceId: { exact: action.microphone } }
              : true
            : false,
          video: action.video
            ? action.camera
              ? { deviceId: { exact: action.camera } }
              : true
            : false,
        },
        { signal: pending.signal },
      );
      if (this.disposed || generation !== this.generation) {
        capture.dispose();
        return;
      }
      this.capture = capture;
      capture.onEnded(() => {
        if (this.capture === capture) {
          this.stop();
          this.change({
            feedback: "A device stopped. Choose your devices and start a fresh preview.",
          });
        }
      });
      this.change({
        phase: "ready",
        tracks: capture.stream.getTracks().map(describeTrack),
        feedback: "Preview ready. Media stays on this device; no peer connection is created.",
      });
      await this.devices();
    } catch (error) {
      if (generation === this.generation && !this.disposed)
        this.change({ phase: "failed", feedback: errorText(error) });
    }
  }
  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.listeners.clear();
  }
}
