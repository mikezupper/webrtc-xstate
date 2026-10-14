# @peerweave/call

Managed one-to-one calls composed from the peer and media packages. Plain TypeScript methods,
state objects and callbacks; no framework or orchestration API is required. Unpublished preview.

```ts
import { createCall } from '@peerweave/call';

const call = createCall({
  sessionId: session.sessionId,
  polite: session.polite,
  sendSignal: message => transport.send(message),
  rtcConfiguration: { iceServers: await getIceServers() },
});
transport.onMessage(message => { call.receiveSignal(message).catch(handleError); });
call.on('error', handleError);
call.on('track', event => attachRemoteTrack(event.track, event.streams));
const unsubscribe = call.subscribe(state => renderCall(state));
await call.start({ audio: true, video: true });
localVideo.srcObject = call.getLocalStream();
call.setMicrophoneEnabled(false);
// From a user gesture:
await call.shareScreen();
await call.stopSharingScreen();
await call.hangUp();
unsubscribe();
```

The application owns pairing, invitations, authentication, transport and rendering. Both endpoints
start their own call with a shared session ID and complementary roles. Start resolves after local
initialization; subscribe to phase `active` to observe actual connectivity. Use `start(false)` for
a data-only session, then create a data channel on at least one endpoint. Incoming signals can be
buffered before start (maximum 256). The v1 peer envelope is extended with `kind: 'hangup'`.

Phases are `idle`, `starting`, `connecting`, `active`, `recovering`, `ending`, `ended` and `failed`.
`getState()` returns a frozen snapshot containing native peer state, media-control flags and the
last terminal error. `subscribe()` immediately delivers a snapshot and returns an unsubscribe.
`on('track' | 'datachannel' | 'error', listener)` forwards plain events and isolates listener errors.
`createDataChannel()` and `getStats()` expose native capabilities.

The call owns its peer and capture handles. Ending, startup failure and exhausted recovery release
owned resources, cancel pending acquisition and suppress late work. `hangUp()` cleans up locally
before sending the terminal signal; a failed acknowledgement rejects with `SIGNALING_FAILED`.
`dispose()` ends locally without sending. Both are idempotent. Ended/failed instances are terminal;
create a new call with a new shared session ID for another session.

Default startup deadline: 15 seconds (`connectionTimeoutMs`). Recovery defaults to a 1-second
grace period, two ICE restarts, and a 2-second interval (`recovery.gracePeriodMs`, `maxRestarts`,
`retryDelayMs`). Recovery limits belong to each disconnect episode and reset on connectivity.
Exhaustion emits `CallError` with code `RECOVERY_EXHAUSTED` and ends the session.

Microphone/camera controls toggle native track `enabled`. Controls and camera restoration remain
attached to the initially captured tracks if the caller edits the preview stream. Screen sharing replaces the video
sender, restores the camera on stop/natural ending, and renegotiates if the browser requires it.
The managed screen feature sends video only. Use media/peer directly for system-audio mixing,
multiple cameras or custom track routing. Calls use a single camera/microphone capture.

`peerFactory`, `mediaFactory`, `screenFactory` and `schedule` are optional plain function ports for
controlled environments. Returned resources are transferred to the call; capture handles must
honor `CaptureOptions.signal` and idempotent disposal. No browser resources are created on import.
