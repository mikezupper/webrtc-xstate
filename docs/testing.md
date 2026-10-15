# Testing and verification

## Commands

- `pnpm test`: deterministic controller/media/protocol/harness tests and local relay integration.
- `pnpm test:coverage`: Node tests plus native Chromium contracts, with one combined V8 report.
- `pnpm test:browser`: the shared native contract suite in Chromium, Firefox and WebKit.
- `pnpm test:e2e`: two real demo tabs using Chromium's fake capture devices.
- `pnpm test:turn`: Linux/Docker relay-only data exchange and ICE restart over UDP/TCP.
- `pnpm test:mutations`: targeted mutation audit, restoring sources and rerunning tests afterward.
- `pnpm check`: lint, boundaries/docs, builds, types, coverage, browsers, demo, fresh packages, sizes.
- `pnpm pack:release`: persist reviewable tarballs without publishing.
- `pnpm check:examples`: build/typecheck the minimal page from freshly installed pnpm tarballs,
  then verify native video, microphone control and leave cleanup without workspace source aliases.

## Test-first loop

List observable behaviors. Write one test, observe its expected failure, implement the smallest
honest change, run the relevant suite and refactor while green. Never weaken a regression test
to make an implementation pass. Keep pending work in the execution plan rather than skipped tests.
New behavioral slices covered terminal close, candidate ordering/glare/ICE generations, capture
cancellation, early signals, recovery deadlines, screen restoration and resource release.

## Coverage

All shipped TypeScript source is included, including unimported files. Every library has an 85%
floor for statements, lines, functions and branches; the target is 95%. Node and Chromium coverage
are combined because the actual native adapters require a browser. The deterministic tests cover
owned ports; native contracts cover actual RTCPeerConnection, MediaStreamTrack and MediaDevices.
Third-party code, type-only interfaces, apps, harness tools and the archival prototype are outside
library runtime coverage. See [quality](quality.md) for the measured totals and package metrics.

## Native contracts and applications

Real browser tests cover both glare roles, direct delivery promises, borrowed tracks, bidirectional
video, sender replacement, transceivers, data channels, ICE restart and managed data calls.
Chromium tests additionally exercise native fake camera/microphone/screen acquisition and the
complete managed capture stack. Native fake devices provide real browser tracks and permissions
behavior without assuming hardware on a CI worker. The demo suite verifies remote playback,
actual microphone controls, terminal preview cleanup and native room-name constraints, including dashed names, invalid
characters and length limits without pattern console errors. Screenshots are stored under
`.artifacts` for inspection.

End-to-end test files run sequentially because their Vite instances share the demo dependency
cache and their browsers use native media resources. Assertions and call deadlines stay enabled;
the harness does not retry failing cases.

The shared native-contract server binds to IPv4 loopback explicitly. Firefox derives its default
ICE address lookup from the page's address family: IPv6 localhost on a runner without an IPv6
route failed before gathering any candidates, including the raw browser-only reproduction.
Contract files also run sequentially because device enumeration requires a visible document.
Linux CI starts a headless PulseAudio service before native browser checks. These are harness
fixtures; no browser assertions, connection deadlines or application behavior are relaxed.

Demo readiness tests advance the page clock past the original connection/recovery deadline,
then connect a later participant and exchange actual native video. They also cover pending/late
capture cancellation, navigation/leave/rejoin with owned preview tracks stopped, signaling loss
and peer capture failure.
Pending/denied capture cases control the media acquisition boundary: fake-UI Chromium allows
devices automatically, so these cases do not claim to automate real browser permission dialogs.

The minimal page also has three-engine, light/dark, narrow-layout, keyboard, 200% zoom and axe
checks. Screenshots live in `.artifacts/minimal`. Browser-engine checks do not replace actual
devices or assistive technology review.

The richer Gyral examples, their three unchanged model/protocol test files and all 18 original
browser cases now belong to [peerweave-deployment-example](https://github.com/peerweavejs/peerweave-deployment-example).
The migrated suite preserves all 126 original browser assertion statements, including call/chat,
permission/readiness, preflight, exact file bytes, invitations and four-route accessibility.
Only app paths, authorized development memberships and the ICE/backend proxy fixture changed.

A native data-only reproduction established that initial Chromium ICE transport allocation must
precede rollback. The wrapper waits for its first candidate/completion; all existing glare
assertions remain enabled. No arbitrary signaling delay or retries hide that test.

Controlled TURN tests verify selected relay candidates. Test engines do not replace the
[real-device and external-network release checks](releasing.md). Native Safari hardware,
real permission prompts and TURN/TLS through restrictive networks remain manual validation.

## Artifacts and feedback loops

Repository checks enforce dependency direction and local links. A declaration-graph test prevents
orchestration types escaping the call API. Fresh tarball installations verify actual transitive
dependency resolution, inert imports and strict consumer typing. Bundle budgets include runtime
dependencies. The mutation audit proves behavioral assertions detect broken terminal cancellation,
late capture cleanup and recovery bounds. CI runs the framework gates and controlled TURN contract.
Production app/Traefik/Coturn deployment checks now belong to the independent
`peerweave-deployment-example` repo; see the [boundary](deploying.md).

Offline consumer installs reuse the active pnpm executable after checking it against the root's
pinned version. They disable pnpm's own version-manager lookup for that command only; package
installation still uses `--offline`. Before that install, a lockfile-only resolution prepares the
independent consumer's graph, then `pnpm fetch` prepares its dependency cache. A frozen workspace
install supplies package files but need not fetch the consumer's resolution/policy metadata.
This setup works with a cold metadata cache while preserving
the offline installation, installed-export, declaration and native-consumer assertions.
