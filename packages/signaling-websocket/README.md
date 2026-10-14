# @peerweave/signaling-websocket

Optional native WebSocket transport for the Peerweave reference relay. No runtime dependencies;
it can carry any JSON payload and does not depend on peer/media/call. Unpublished preview.

```ts
import { createSignalingChannel } from '@peerweave/signaling-websocket';
const channel = createSignalingChannel({ url: 'wss://your-relay.example/signaling', room: 'demo' });
const off = channel.subscribe(state => {
  if (state.phase === 'ready' && state.session) {
    // Create your peer/call with state.session.sessionId and state.session.polite.
    initializeSession(state.session, message => channel.send(message));
  }
});
channel.onMessage(message => receiveSessionSignal(message));
channel.onError(error => displayError(error));
// On termination:
off(); channel.dispose();
```

`getState()` returns phase (`connecting`, `waiting`, `ready`, `closed`, `error`), session metadata
and a structured error. `subscribe`, `onMessage`, `onError` return unsubscribe functions.
`send()` accepts delivery into the native socket; it does not acknowledge remote processing.
Send only while ready. Pairing is limited to two members in a room. When a member leaves, the
remaining channel returns to waiting with no session; dispose that peer/call. A new pairing
receives a fresh session ID. Reconnect by creating a new channel; reconnect does not resume a call.

The wire protocol is JSON: client `{kind:'join',room}`; server `{kind:'waiting'}` then
`{kind:'ready',sessionId,polite}`. Client/server signals use `{kind:'signal',sessionId,payload}`.
Departure uses `{kind:'peer-left'}`; rejection uses `{kind:'error',code}`. Room names contain
1–64 letters, digits, underscores or hyphens. Frames are bounded to 64 KiB and outgoing native
backlog to 256 KiB. Session mismatches and malformed frames fail the channel. Connection opening
has a 10-second deadline (`connectionTimeoutMs`); room waiting is deliberately indefinite.

`SignalingError` retains its code and cause. Listener failures are isolated. `dispose()` is
terminal and idempotent, removes socket handlers/timers and closes the socket. Imports are inert.
The optional `socketFactory(url)` is a test/environment port returning a native-compatible socket.

The repository's private server is a local development reference, with origin checks and limits.
Production deployments need authenticated membership, authorization and operational rate limits.
Use your existing transport with the peer/call packages if it already provides those guarantees.
