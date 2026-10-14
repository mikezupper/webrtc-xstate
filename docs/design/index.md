# Design decisions

| Decision | Status | Document |
| --- | --- | --- |
| Independent peer/media capabilities; call composes them | Accepted | [Architecture](../../ARCHITECTURE.md) |
| Versioned, session-scoped signaling validation | Implemented | [Signaling](001-signaling.md) |
| Native values and explicit resource ownership | Implemented | [API direction](002-api-direction.md) |
| pnpm workspace; ESM artifacts and declaration checks | Accepted | [Foundation plan](../exec-plans/active/001-foundation.md) |

Public package names use the agreed Peerweave family. An npm scope must be owned before publication.

The optional WebSocket adapter and its reference relay now implement the v1 pairing protocol.
See [release checks](../releasing.md) for browser targets and remaining external validation.
