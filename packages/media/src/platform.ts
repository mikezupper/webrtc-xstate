import { MediaError } from "./errors.js";
import type { MediaPlatform } from "./types.js";

function devices() {
  const api = globalThis.navigator?.mediaDevices;
  if (!api) throw new MediaError("UNAVAILABLE", "mediaDevices");
  return api;
}

export const browserMedia: MediaPlatform = {
  userMedia: (constraints) => devices().getUserMedia(constraints),
  displayMedia: (options) => devices().getDisplayMedia(options),
  devices: () => devices().enumerateDevices(),
};
