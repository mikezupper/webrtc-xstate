# Signaling contract v1

Status: implemented and verified against native browsers.

`@peerweave/peer` exports `SignalMessage` and `parseSignal(input: unknown)`.
Parsing creates a normalized plain message, preserving supported fields and dropping unknown metadata.
Malformed input throws `InvalidSignalError`, with code `INVALID_SIGNAL` and a useful field-specific message.

## Envelope

Every message includes `version: 1`, a nonblank `sessionId`, and `kind`.
The application assigns the same session ID to both endpoints. The peer runtime must
reject a valid message for another session before applying it. Parser validation alone
cannot determine whether a message belongs to a particular peer.

Description messages contain `kind: "description"` and `description: { type, sdp }`.
The supported types are `offer` and `answer`, and SDP is a nonblank string. A signaling
client ID is not a description. Rollback is an internal negotiation operation.

Candidate messages contain `kind: "candidate"` and `candidate`, either a native
`RTCIceCandidateInit`-shaped object or `null` for completion. The candidate string may
be empty, matching native end-of-candidates semantics. Optional fields are `sdpMid`,
`sdpMLineIndex`, and `usernameFragment`; their types must be native-compatible.
The browser validates candidate syntax and applicable negotiation state.

## Delivery contract

The peer implementation assumes reliable, ordered delivery within one session.
Transport acknowledgement means acceptance for delivery, not remote acceptance of an offer.
The runtime must serialize incoming work, handle candidate timing and ICE generations,
park candidates from ignored offers until a matching answer can accept the reused ICE generation, and reject stale-session messages.

The parser never accesses browser globals. It does not parse JSON strings; a transport
decodes JSON before passing the result to it.

## Tests

- Accept offers and answers without creating browser resources.
- Reject malformed root values, version, session ID, and kind.
- Reject missing/invalid descriptions, including the original ID-message regression.
- Accept candidates, nullable optional fields, empty candidates, and completion markers.
- Reject invalid candidate field types and invalid media-line indices.
- Normalize supported fields without retaining unknown application metadata.

## Managed sessions and reference relay

Call adds `{version:1,sessionId,kind:"hangup"}`. Local disposal does not send it; hangup does.
Pairing, invitations and authentication are application responsibilities. Signals before start
are bounded and buffered. Ended calls accept repeated matching hangup idempotently.

The private demo adds an application message `{version:1,sessionId,kind:"demo-ready"}`.
Each participant sends it only after pressing Start and completing local capture, or selecting
chat only. The demo consumes it before passing managed signals to Call, validates the shared
session and ignores duplicate readiness. Media negotiation and the connection deadline wait
for both participants; permission prompts and an idle peer do not spend the ICE recovery budget.
Waiting previews remain tied to Call's cancellation signal. Leaving or hangup releases them;
local startup failure sends matching hangup so the peer does not wait indefinitely. A re-pairing
creates a fresh readiness gate. This invitation behavior leaves the npm API unchanged.

The optional adapter implements the [reference WebSocket protocol](../../packages/signaling-websocket/README.md).
The server caps rooms at two members and clients at 100, checks origins, limits frames to 64 KiB,
rejects stale sessions and assigns a fresh ID on every re-pairing. It does not authenticate users.
