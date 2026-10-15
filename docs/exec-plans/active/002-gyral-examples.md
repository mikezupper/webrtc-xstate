# Gyral examples

Status: complete.

Historical decision: the richer app and its original regressions now live in
[peerweave-deployment-example](https://github.com/peerweavejs/peerweave-deployment-example).
The framework sample is simplified by the [minimal demo plan](../completed/008-minimal-demo.md).

## Scope

Refactor the current workbench with Gyral 0.3.6 and build media preflight, file transfer and
support-call examples. Apply the requested Gyral, modern CSS and semantic HTML skills. Use pnpm;
framework dependencies belong only to the private demo. The four public packages remain independent.

## Decisions

- One Vite multi-page example app: `/`, `/media/`, `/transfer/`, `/support/`.
- Gyral components use pure models/views, tagged intents, commands/drivers and subscriptions.
- Native streams, connections, files, channels and object URLs stay in disposable drivers/controllers.
- Semantic forms, headings, landmarks, progress and status elements; responsive CSS layers,
  logical properties, theme tokens, container queries and reduced-motion support.
- File transfer demonstrates the peer layer with bounded chunks, queue backpressure, explicit
  recipient acceptance, cancellation, size/protocol limits and byte-for-byte browser verification.
- Support calls demonstrate explicit invite/accept/decline/cancel, media readiness, managed calls,
  screen video, chat and terminal cleanup. The reference relay stays local and unauthenticated.
- Preserve existing room-pattern, delayed-start, pending/denied-capture and cleanup assertions.

## Test list and milestones

- [x] Green baseline and exact Gyral 0.3.6 installation.
- [x] Refactor the existing call example; all existing browser regressions stay green.
- [x] Media preflight: device selection, preview/replacement, permissions, pending cancellation, disposal.
- [x] File transfer: accepted offer, bounded binary transfer, progress, cancel/reject, complete download.
- [x] Support call: invite/accept/decline/cancel, readiness, native media/chat and cleanup.
- [x] Gyral model tests with DOM-free testing, native browser integration and packed-consumer validation.
- [x] Multi-page production build, semantic/theme/mobile/keyboard QA, full project gate.
- [x] Documentation, examples guide and measured quality record updated.

## Verification

- Baseline: eight existing demo browser tests pass; library checks from the previous milestone pass.
- Observe test failures before implementing new behaviors. Record results as each milestone completes.
- Observed missing Gyral registration and missing example behaviors before implementation.
- Existing regression caught premature idle during re-pairing; phase publication fixed without
  weakening assertions. Caller preference locking and premature file receipts were test-driven fixes.
- Native binary transfer verified byte-for-byte; late preview/file-read cancellation and deterministic
  simultaneous invitations pass. Seventeen DOM-free app model/protocol cases pass.
- Fresh archive-installed consumer built/typechecked all four pages and exchanged native video/chat.
- Final `pnpm check` passed: 151 coverage cases, 18 shared browser cases and 18 end-to-end cases;
  all four packed libraries and the fresh consumer app passed artifact validation.
- All four routes passed both themes in Chromium, Firefox and WebKit: 24 page/theme/engine
  combinations, keyboard skip links, mobile layout, 200% zoom and WCAG A/AA axe checks.
  Mobile screenshots reviewed locally; frozen pnpm installation passed.
- Examples guide, architecture, testing and measured quality records updated. Production
  authentication and actual-device/external-network checks remain the documented release work.
