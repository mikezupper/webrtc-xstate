# @peerweave/peer

A small, framework-independent wrapper over native browser WebRTC. No runtime dependencies.
ES modules and TypeScript declarations are included. This package is currently an unpublished preview.

```ts
import { createPeer } from '@peerweave/peer';

// Both endpoints use the same sessionId and opposite polite roles.
const peer = createPeer({
  sessionId: session.sessionId,
  polite: session.polite,
  sendSignal: message => transport.send(message),
  rtcConfiguration: { iceServers: await getIceServers() },
});
transport.onMessage(message => {
  peer.receiveSignal(message).catch(handleError);
});
peer.on('error', error => { handleError(error); peer.close(); });
peer.on('track', event => attachRemoteTrack(event.track, event.streams));
const sender = peer.addTrack(cameraTrack, cameraStream);
await sender.replaceTrack(replacementTrack);
const channel = peer.createDataChannel('chat');
peer.subscribe(state => renderConnection(state.connectionState));
// On termination:
peer.close();
```

`session`, `transport`, rendering, error handling and ICE-server provisioning are application code.
The transport must deliver parsed objects reliably and in order, within a single session.
`sendSignal` resolves when the transport accepts delivery. Incoming calls to `receiveSignal`
resolve when applied or safely buffered; direct in-memory delivery is also supported.

The peer handles perfect negotiation, description-before-candidate ordering, early candidates,
ICE generations, stale sessions and terminal cancellation. Initial signaling waits for the first
native ICE candidate or gathering completion before an offer can be rolled back; subsequent
candidates still trickle. This avoids the observed Chromium initial data-only rollback race.

Native capabilities stay native: `addTrack`, `removeTrack`, `addTransceiver`, `getTransceivers`,
`createDataChannel`, `getStats` and `restartIce`. You own channel handlers and application message
formats. Closing the peer closes its connection/channels but **does not stop supplied tracks**.

`getState()` returns a frozen native-state snapshot. `subscribe()` immediately delivers one and
returns an unsubscribe function. `on('track' | 'datachannel' | 'error', listener)` also returns one.
`close()` is idempotent; future operations reject/throw `PeerError` with code `CLOSED`.
Async signaling/negotiation failures are error events. Negotiated signaling failures retain their native causes. Forwarding methods and native
sender/channel methods preserve native browser error behavior, apart from terminal cancellation.

`maxBufferedCandidates` and `maxPendingSignals` default to 256. Exceeding a bound reports
`BUFFER_LIMIT`; finish that session and create a new peer after addressing stalled delivery.
Recent rejected/replaced ICE generation history is bounded to 64 entries. Unknown generations
wait within the candidate bound. `parseSignal(unknown)` validates and normalizes v1 envelopes;
SDP and ICE grammar are validated by the browser. Invalid envelopes throw `InvalidSignalError`.

Imports are inert, including in server-side tooling. Creating a peer requires browser WebRTC.
For calls across networks, provide authenticated STUN/TURN configuration. Tested engines are
Chromium, Firefox and WebKit through Playwright; real device support requires release validation.
