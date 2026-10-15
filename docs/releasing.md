# Release procedure

Status: implementation and local artifact checks are available. All package manifests remain
private. Registry publication is a separate, explicitly authorized action.

## Preparation

1. Claim/verify the `@peerweave` npm scope and final registry metadata. Repository metadata uses
   `peerweavejs/peerweave`; the GitHub organization does not establish npm-scope ownership.
2. Run `pnpm check`, `pnpm test:turn`, `pnpm test:mutations`, and the real-device checks below.
3. Review `pnpm release:status`. Changesets propagate compatible workspace dependency versions;
   `pnpm release:version` applies release intents and generates changelog entries. Review its diff.
4. Run `pnpm pack:release` and inspect `.artifacts/packages`. Package licenses, READMEs,
   declarations, JS/source maps and changelogs are included; tests and apps are excluded.
5. Review the API and publish metadata, then change library privacy only after scope ownership
   and publication authorization. Keep the workspace/apps private. Publish dependency packages
   before call, using pnpm and registry provenance in the release environment.

No publish script or credential configuration is checked in. The current first-release intent
is a minor version for each package. Package versions can evolve independently; call receives
compatible internal dependency updates through Changesets.

## Supported targets

The verified preview uses ESM, modern browser DOM APIs and TypeScript 7 consumer compilation.
Packed artifacts pass NodeNext ESM and bundler resolution analysis. CommonJS callers use dynamic
import; no CommonJS build is promised. Node 24 is the development/tooling runtime, not a native
WebRTC runtime. Library imports work in Node without touching browser resources.

Chromium, Firefox and WebKit are tested with the pinned Playwright builds on Linux. The WebKit
engine test is not a claim about actual iPhone/macOS Safari hardware. Before the first publication,
record actual device/browser versions for camera/microphone permissions, screen picker, autoplay,
audio output, capture ending, backgrounding, device unplug and repeated new sessions. Also record
a call between separate networks, including restricted enterprise/mobile networks and TURN/TLS.

## Executable checks

`check:packages` packs each library with pnpm, runs publint and type-resolution analysis, checks
public declaration isolation, installs every archive plus its real transitive dependencies in a
fresh consumer using an offline pinned pnpm store, imports all packages without browser globals,
and compiles a strict consumer. ESM-only resolution is intentional.

`check:size` builds minified consumer entry bundles, including all runtime dependencies, and checks
gzip budgets: peer 6 kB, media 2.5 kB, call 22 kB, signaling 4 kB. Results are written to
`.artifacts/bundle-sizes.json`; the call measurement includes its orchestration runtime.

`test:turn` creates an authenticated, loopback-only Coturn container with temporary credentials,
forces `iceTransportPolicy:'relay'`, verifies UDP and TCP relay data exchange and ICE restart,
checks the selected candidate is a relay, and tears down everything in `finally`. It requires
Linux host networking/Docker and reserves local port 34780 plus relay ports 49600–49700. The
image is [Coturn 4.18.0-r0](https://github.com/coturn/coturn/releases/tag/docker/4.18.0-r0), pinned by digest.
This is a controlled test fixture, not a production relay configuration.

The reference signaling server binds localhost, bounds client count/frame size and checks browser
origins. Production membership authentication, authorization, operational rate limits and a
credential service remain application responsibilities. Do not expose the development relay as
a production service.
