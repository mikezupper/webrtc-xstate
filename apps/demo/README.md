# Minimal Peerweave demo

One video-call page in plain TypeScript, HTML and CSS. It demonstrates public call, capture and
WebSocket signaling APIs without a UI framework. The richer four-page Gyral app lives in
[peerweave-deployment-example](https://github.com/peerweavejs/peerweave-deployment-example).

## Run

Use the pinned pnpm version and Node 24+ from the workspace root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173` in two tabs, join the same room, then press **Start call** in both.
Allow camera and microphone access. **Mute** toggles the microphone; **Leave** stops owned
media and closes signaling. Leaving while permission is pending also discards late capture.
Leave/rejoin creates a fresh session. Add `?room=your-room` to share a room name.

The page keeps one status line, inline errors and local/remote video. Room names contain 1–64
ASCII letters, digits, dashes or underscores. There is no authentication in the development relay.

## Read the code

- [index.html](index.html): semantic controls and two video elements.
- [main.ts](src/main.ts): DOM bindings, WS/WSS selection, rendering and navigation cleanup.
- [session.ts](src/session.ts): signaling, permission readiness and public Peerweave call APIs.
- [style.css](src/style.css): compact layered styling, shared typography, light/dark themes and focus states.

Readiness is app-owned: captured media waits for both participants to allow access before the
managed connection deadline begins. Peerweave owns negotiation, bounded recovery and capture
cleanup. Remote tracks are borrowed; this page attaches them without taking ownership.
No resources are created by importing library packages. App startup creates the UI bindings;
joining and starting are explicit user actions.

Production authentication, TURN credential fetching, file transfer, chat, screen sharing,
preflight and support invitations belong to the
[deployment app](https://github.com/peerweavejs/peerweave-deployment-example).

## Configuration and tunnels

`PEERWEAVE_DEMO_PORT` defaults to 5173; `PEERWEAVE_PORT` defaults to 8787. Use distinct ports
for concurrent worktrees. Vite forwards `/signaling` to the loopback reference relay. HTTP pages
use WS; HTTPS pages use WSS automatically.

For a Cloudflare Tunnel, route a hostname to `http://127.0.0.1:5173`, add its exact hostname to
`server.allowedHosts` in [vite.config.ts](vite.config.ts), and restart with the exact page Origin:

```sh
PEERWEAVE_ALLOWED_ORIGINS='https://demo.example.com,http://127.0.0.1:5173,http://localhost:5173' pnpm dev
# In a second terminal:
cloudflared tunnel --url http://127.0.0.1:5173
```

Replace the example hostname with the tunnel's hostname. Explicit origins replace the local
defaults; include scheme and any non-default port, with no path or trailing slash. Vite's hostname
allowlist and the relay's Origin policy are separate checks. The WebSocket upgrade should return
101; inspect rejected origins if it returns 403. Tunnel traffic carries signaling; this minimal
demo uses direct ICE and may not connect across restrictive networks. Use the deployment app for
authenticated TURN and [production network guidance](https://github.com/peerweavejs/peerweave-deployment-example/blob/main/docs/webrtc-production.md).

## Verify

```sh
pnpm test:e2e       # Minimal UI, native video/mute/cleanup, readiness, permission and layout checks
pnpm check:examples # Build/typecheck and native call against fresh installed package archives
pnpm check         # Complete framework gate
```

The original richer-app browser assertions moved to that app's `tests/e2e`; its existing
model/protocol tests remain there unchanged. Framework library/native contracts stay here.
See [testing](../../docs/testing.md) and [quality](../../docs/quality.md) for measured evidence.
