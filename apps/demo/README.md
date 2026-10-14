# Peerweave examples

Run `pnpm install --frozen-lockfile` and `pnpm dev` from the workspace root. Open
`http://127.0.0.1:5173`. All four pages use Gyral **0.3.6**, light DOM, pure models/views,
tagged intents and disposable drivers. Runtime framework dependencies stay in this private app.

| Page | Route | Public packages demonstrated |
| --- | --- | --- |
| Call workbench | `/` | call, media, optional WebSocket signaling |
| Media preflight | `/media/` | media independently |
| File transfer | `/transfer/` | peer, optional WebSocket signaling |
| Support call | `/support/` | managed call with application invitation/readiness flow |

Every page has instructions and live status. Call/transfer participants must use the same
example and room. Their room namespaces are separate. The examples are local references;
the development relay has no user authentication.

## Media preflight

Start a preview and allow camera/microphone access. Device labels become available after
permission. Choose devices and press Update preview to apply changes. Stop/cancel releases
owned tracks, including a native result arriving after cancellation. No peer or signaling
connection is created. See `src/media/controller.ts` and `src/media/component.ts`.

```ts
import { captureMedia, enumerateDevices } from '@peerweave/media';
const capture = await captureMedia({ video: true, audio: true }, { signal });
video.srcObject = capture.stream;
const devices = await enumerateDevices();
// Preview replacement, cancellation or unmount:
capture.dispose();
```

## File transfer

Join the same room in two tabs; the native data channel connects automatically. Select a
file, Offer file, then Accept file in the other tab. The sender transmits only after acceptance.
Download the complete file in the receiving tab. Decline/cancel discards partial transfers.

This app-owned protocol uses a reliable ordered `RTCDataChannel`: offer metadata, accept/reject,
16 KiB binary chunks, finish, recipient acknowledgement and cancel. It validates names/IDs/sizes,
limits files to 32 MiB, enforces exact chunk lengths and bounds receive memory. The sender waits
above a 256 KiB queue watermark and resumes below 64 KiB; one further chunk can be queued at
the boundary. Received bytes are buffered into one local Blob. Object URLs are revoked on
replacement, leaving or unmount. There is no resumable transfer or server upload.

See `src/transfer/protocol.ts`, `controller.ts` and `component.ts`. Transfers are example logic,
not an additional published package. Production transfers need authenticated peers, application
quotas, suitable storage and their own validation policy.

## Support call

Join in both tabs. One participant chooses media preferences and invites; the other chooses
preferences and accepts/declines. Invitations can be cancelled. No devices are acquired before
acceptance. Both sides finish capture before negotiation begins, so human waiting does not
consume the connection/recovery deadline. Simultaneous invitations use the relay's polite role
to pick one invitation deterministically. Invitation messages are session-bound and matched by ID.

After connection, use microphone/camera controls, screen video, chat and stats. Hangup releases
both sessions. Leave/rejoin in both tabs to create a fresh terminal call instance. No automatic
speech captions are provided; text chat is available for written communication.

See `src/support/controller.ts`, `component.ts`, `src/room-call.ts`, and the shared managed-call
controller. Application invitations (`support-invite/accept/decline/cancel`) and readiness
(`demo-ready`) are consumed before managed signals reach the call facade. They do not change
the public package protocol or expose XState.

## Production integration

The controllers accept caller-provided native ICE configuration. Obtain it from an authenticated
backend before creating the runtime; do not embed long-lived relay credentials in source.

```ts
// getIceServers() is your application's authenticated credential endpoint.
const rtcConfiguration: RTCConfiguration = { iceServers: await getIceServers() };
const runtime = new SupportController(rtcConfiguration);
app.drivers = bindRuntime(app, runtime);
```

The workbench accepts `new CallController('', rtcConfiguration)` and file transfer accepts
`new TransferController(rtcConfiguration)`. Integrate signaling with authenticated room membership,
routing, rate limits and departure/reconnect policy. Choose how long sessions refresh ICE
configuration; the native wrapper currently accepts configuration at creation. Verify real
Safari/mobile hardware and separate/restricted networks, including TURN/TLS, before production.
See [release checks](../../docs/releasing.md).

## Verification and structure

- `pnpm test:e2e`: actual native media/chat/file bytes, permission boundaries, cancellation,
  rejoining, invitation races and cross-engine keyboard/theme/layout/accessibility checks.
- `pnpm exec vitest run apps/demo/tests`: DOM-free Gyral model tests and app protocol validation.
- `pnpm check:examples`: fresh pnpm tarball installation, strict app typing, four compiled page
  builds, and actual native video/chat/hangup without workspace source aliases.
- `pnpm check`: the complete workspace gate, including consumer package/bundle validation.

Native streams, files, channels and URLs stay in controllers. Gyral receives serializable UI
snapshots through subscriptions; actions execute through drivers. Element hooks own only small
native helpers: `mediaBinding` attaches a stream to its video, `audioLevel` reads loudness through
its own Web Audio analyser, and `fileDrop` forwards dropped files to a file input. Each disposes
with its element. Removing the component or leaving the page disposes its runtime.
Create a fresh component/runtime after terminal disposal.

## Visual design

Each page sets `main[data-phase]` from its state (idle, lobby, ready, ringing, starting,
connecting, active, recovering, failed, ended; preparing/live for media; offered/sending/complete
for transfers). `src/style.css` maps the phase to one hue, and every surface, button, thread and
focus ring derives from it with `oklch()`, `color-mix()` and `light-dark()`. The call and support
pages share the stage, dock, chat and report dialog in `src/call/parts.ts`; the masthead, hero,
connection thread and step tracker live in `src/shared/shell.ts`.

The stylesheet is layered (`reset, tokens, base, layout, components, states, enhancements,
utilities`), uses logical properties and container queries, and supports both system themes,
increased contrast, forced colours, reduced motion and visible keyboard focus. Newer features
(cross-document view transitions, scroll-driven animation, customizable select, squircle corners)
are progressive enhancements. Fonts in `src/fonts` are self-hosted under the SIL Open Font License.
See the [visual design plan](../../docs/exec-plans/active/003-example-visual-design.md).
