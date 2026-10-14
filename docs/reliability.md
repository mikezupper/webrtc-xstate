# Reliability contracts

- Native WebRTC states remain authoritative; session lifecycle is managed separately.
- Exactly one negotiation controller owns description and candidate application per peer.
- Follow perfect negotiation, including collisions during pending remote-answer work.
- Validate and session-match signals before applying them. The transport owns pairing and routing.
- Candidate handling accounts for description timing, ignored offers, and ICE restarts.
- Close and dispose are terminal and idempotent. Detach real handlers and invalidate late work.
- Keep borrowed media alive; release owned media on failure, cancellation, and disposal.
- Transient disconnection has a grace period under call policy. Retries are bounded.
- Support caller-provided TURN configuration; never embed production relay credentials.
- Return errors with operation context and original causes. Logs do not include SDP,
  candidates, authentication material, or user media by default.
- Rendering, autoplay, device prompts, and permission feedback belong to the application.

These are implemented contracts with unit/native validation. External device/network release checks
are recorded in [releasing](releasing.md). See [quality status](quality.md) for implementation progress
and [the active plan](exec-plans/active/001-foundation.md) for executable acceptance checks.

Capture handles retain ownership of the initially acquired track set even if a caller edits its
mutable stream. Peer candidate and signal queues are bounded; generation history retains 64 entries.
Calls have a startup deadline, cancel late work, and release resources under reentrant termination.
