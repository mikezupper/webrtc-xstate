# @peerweave/media

Independent camera, microphone and screen capture handles. No runtime dependencies and no
connection or calling layer is required. ESM with TypeScript declarations; unpublished preview.

```ts
import { captureMedia, captureScreen, enumerateDevices } from '@peerweave/media';

const abort = new AbortController();
const capture = await captureMedia(
  { audio: true, video: { deviceId: { exact: selectedCameraId } } },
  { signal: abort.signal },
);
video.srcObject = capture.stream;
const off = capture.onEnded(track => showDeviceEnded(track.kind));
const devices = await enumerateDevices();
// Invoke directly from a user gesture when requesting a screen:
const screen = await captureScreen({ video: true, audio: false });
// On termination:
off(); screen.dispose(); capture.dispose();
```

`captureMedia()` defaults to audio and video. `captureScreen()` defaults to video without system
audio. Both accept native constraints. Device enumeration returns native `MediaDeviceInfo`
objects; labels and availability follow browser permissions. Capture requires a secure context
(or localhost) and browser permission. Screen capture normally requires a user gesture.

Each returned `MediaCapture` owns the tracks acquired when the handle is created. `dispose()` stops them exactly once and
removes its end listeners. Removing an acquired track from the mutable stream does not release
that ownership; tracks later added by the caller are borrowed and are preserved on disposal. Aborting before acquisition prevents it; aborting during a prompt
rejects immediately and stops any stream arriving later. Aborting an acquired capture disposes
it. Browsers may keep their native prompt open until the user responds.

`onEnded(listener)` observes natural track endings and returns an unsubscribe function. Calling
`stop()` does not synthesize a native `ended` event. Treat native streams and tracks as borrowed
views of the handle; keep ownership until disposal. If another layer takes ownership of the
handle, that layer is responsible for disposing it.

Failures use `MediaError` with `code`, `operation` and the original `cause`. Native permission
errors such as `NotAllowedError` remain accessible through the cause. Imports are inert; browser
APIs are looked up only when invoked. `CaptureOptions.platform` is an optional `MediaPlatform`
port for controlled acquisition environments; it must return actual native streams in production.
