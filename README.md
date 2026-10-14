# Peerweave

Composable browser WebRTC, from a small native peer wrapper to managed one-to-one calls.
A pnpm workspace using TypeScript, Vite and Vitest. The package family is implemented and
verified locally; packages remain private pending the first publication review.
The private example app uses Gyral 0.3.6; the library architecture stays framework independent.

| Package | Purpose | Runtime dependencies |
| --- | --- | --- |
| [`@peerweave/peer`](packages/peer/README.md) | Perfect negotiation, tracks, channels, native state/stats | None |
| [`@peerweave/media`](packages/media/README.md) | Owned camera/microphone/screen capture and cancellation | None |
| [`@peerweave/call`](packages/call/README.md) | Managed lifecycle, controls, screen switching, ICE recovery | Peer, media, private orchestration |
| [`@peerweave/signaling-websocket`](packages/signaling-websocket/README.md) | Optional reference-protocol signaling | None |

Use only the layer you need. Public APIs are plain TypeScript and native browser values.
The core packages do not choose a framework, backend, media renderer or signaling service.

## Run the example

Use Node 24 and the pinned pnpm version.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173` in two tabs. Join the same room, then click **Start call** in each tab.
Allow camera/microphone access when prompted. The demo shows your preview and waits until both
participants finish this step before starting the connection deadline. Follow the live guidance
under the room controls; the data channel opens after both participants are ready.
The example supports video/audio, microphone/camera controls, screen video, data-channel chat,
connection stats and cleanup. Leave and rejoin for another session. Disable microphone and camera
before starting for data-only calls. The relay binds localhost and carries session setup only.

The navigation also provides [media preflight](http://127.0.0.1:5173/media/),
[file transfer](http://127.0.0.1:5173/transfer/) and [support calls](http://127.0.0.1:5173/support/).
See the [examples guide](apps/demo/README.md) for flows, implementation structure, verification
and production integration. Media preflight works independently; file transfers require explicit
acceptance; support calls demonstrate invite/accept/decline/cancel before media acquisition.

Set `PEERWEAVE_PORT` and `PEERWEAVE_DEMO_PORT` for an independent development instance.
Browser permissions require localhost or a secure context. Supply application-owned STUN/TURN
configuration for calls across networks; the example is a local reference rather than an
authenticated production calling service.

## Verify

```sh
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm check
pnpm test:turn       # Linux + Docker: local relay-only UDP/TCP and ICE restart
pnpm test:mutations  # Small mutation audit of the critical lifecycle paths
pnpm pack:release   # Reviewable tarballs in .artifacts/packages; no publication
pnpm release:status # Preview Changeset versions and dependency propagation
pnpm check:examples # Fresh packed-package app build/types and actual native media/chat
```

`pnpm check` includes lint, package boundaries, documentation links, builds, strict type checks,
unit/native-browser coverage, Chromium/Firefox/WebKit contracts, the two-tab example, fresh
packed-package installs and consumer bundle budgets. Every package has an 85% floor across
all four coverage metrics, with 95% as the target. See [measured quality](docs/quality.md).

## Repository map

- [Architecture and ownership](ARCHITECTURE.md)
- [Design decisions](docs/design/index.md)
- [Testing](docs/testing.md) and [reliability](docs/reliability.md)
- [Implementation plan](docs/exec-plans/active/001-foundation.md)
- [Release procedure and remaining external checks](docs/releasing.md)
- [Agent navigation map](AGENTS.md)

The original prototype is retained unchanged in `examples/legacy` as an archival reference.
