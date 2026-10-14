# API direction and ownership

Status: implemented. Package READMEs contain the consumer contracts and examples.

The peer layer forwards native track, sender, transceiver, channel and stats values. It owns
negotiation and cleanup, borrows media and exposes frozen native-state snapshots. A serialized
native-operation queue is separate from ordered outbound delivery, preventing delivery callbacks
that await a remote `receiveSignal` from deadlocking. Candidate/native/outbound queues are bounded.

The initial local description waits for the first native candidate or gathering completion.
This is an event-driven transport allocation guard: Chromium reproduced a data-only initial
rollback failure without it. Remaining candidates trickle normally. The real browser glare
regression remains enabled for Chromium, Firefox and WebKit.

Media helpers return owning capture handles. Aborting pending acquisition rejects immediately;
late streams are stopped. Disposal removes end/abort listeners and stops acquired tracks once.
Native device constraints and native errors remain available.

Calls own peers and captures. `start` resolves on local initialization; `active` requires native
connectivity. Remote signals can arrive first. Hangup closes locally before awaiting transport
acceptance. Startup deadlines, disconnect grace periods and ICE restart limits prevent indefinite
sessions. Screen video replaces/restores the native video sender and falls back to renegotiation.
Caller listener failures are isolated. XState lifecycle objects never reach exported declarations.

The optional WebSocket package is now implemented together with its private reference relay.
It assigns fresh sessions on pairing and invalidates them on departure. Applications may use any
other ordered transport with peer/call. Framework bindings and room/SFU packages remain deferred.
