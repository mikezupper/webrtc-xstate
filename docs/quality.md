# Quality status

Measured locally on 2026-10-14. The package family is implemented; first npm publication remains
subject to scope ownership, API review and real-device/external-network validation.
Deployment checks and later measurements are recorded below with their dates.

| Package | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| peer | 95.27% | 90.50% | 98.64% | 97.01% |
| media | 100.00% | 96.55% | 100.00% | 100.00% |
| call | 96.50% | 90.37% | 97.67% | 99.58% |
| signaling-websocket | 96.03% | 88.60% | 100.00% | 99.10% |
| Overall | 96.27% | 90.50% | 98.77% | 98.52% |

These are combined Node unit and Chromium native-contract measurements over all library source.
Every package clears 85% for all four metrics; statement, function and line coverage also clear
95% per package. Some defensive native-adapter and concurrency branches remain below the 95%
target. Third-party orchestration code, tools, apps and type-only interfaces are outside runtime
library coverage. Coverage is evidence of exercised behavior, not a proof of device compatibility.

## Verified behavior

- Full `pnpm check` passed: lint, four package boundaries and 18 linked documents, all builds,
  strict package/app/test/config typing, coverage, browsers, demo, fresh archives and sizes.
- Coverage run: 159 tests in 17 files (149 Node cases plus 10 Chromium native cases).
- Shared browser suite: 18 passing cases across Chromium, Firefox and WebKit.
- The original eight demo regressions remain enabled for native fake-device video/chat/hangup, camera denial,
  native room-name validation without pattern console errors, delayed media/chat-only startup,
  pending peer capture, denied peer capture, and waiting preview cleanup with fresh re-pairing.
  Pending/denied peer capture is controlled at the acquisition boundary; real permission dialogs
  remain manual checks. Screenshot inspected locally.
- Four Gyral 0.3.6 example pages build. Twenty-five DOM-free app model/protocol tests pass;
  examples additionally verify independent preview/replacement/cancellation, exact file bytes,
  acceptance/decline/cancel and premature-receipt rejection, and support invitation races.
- End-to-end suite: 18 passing cases in eight files. All four routes pass both themes across
  Chromium, Firefox and WebKit (24 page/theme/engine combinations), mobile layout, keyboard skip
  links and 200% zoom. Axe reports no WCAG A/AA violations in these checks; mobile screenshots
  for all routes were inspected locally. This supplements, rather than replaces, manual testing.
- Fresh packed-consumer app builds and typing passed for all four routes, with actual native
  video/chat/hangup from installed archives. Gyral remains outside public library dependencies.
- Controlled authenticated TURN: UDP and TCP relay-only data exchange and ICE restart passed;
  the selected native candidate is checked as `relay`. The container is removed afterward.
- Mutation audit: broken peer cancellation, late capture cleanup and recovery bounds were
  detected by behavioral assertions, restored, and followed by a passing unit suite.
- All four pnpm tarballs passed publint, ESM type resolution, public-declaration isolation,
  actual fresh installation with transitive dependencies, inert Node imports and strict typing.
- Changeset release-status preview includes all four libraries; manifests remain private.
- At that checkpoint, the archival legacy files remained unchanged and no skipped/focused tests were found.
  The user subsequently removed the archival prototype.
- Frozen-lockfile installation passed. Local execution used Node 24.15; CI pins Node 24.21.
  Remote CI was configured, not executed in this session.

Critical regressions cover canceled/late acquisition, stream edits preserving track ownership,
stale sessions, glare candidates with reused ICE generations, bounded queues, startup reentrancy,
initial connection deadlines, recovery exhaustion, screen ending during replacement and hangup
during restoration. Actual native contracts supplement owned test ports rather than replacing
WebRTC with a DOM emulator.

## Consumer size

Minified ESM entry bundles, including runtime dependencies; measured with Vite and gzip.

| Entry | Bytes | Gzip bytes | Gzip budget |
| --- | ---: | ---: | ---: |
| createPeer | 9,788 | 3,099 | 6,000 |
| captureMedia | 1,859 | 867 | 2,500 |
| createCall | 66,555 | 18,812 | 22,000 |
| createSignalingChannel | 4,007 | 1,510 | 4,000 |

The call result includes peer, media and private orchestration. Independent low-level packages
have no runtime dependencies. Machine-readable coverage/bundle reports and reviewable archives
are generated under `coverage` and `.artifacts`.

## Publication limits

The implemented managed call API supports one camera/microphone and screen video. Production
authentication and invitation services, SFU rooms, system-audio mixing and framework bindings are
outside this preview. The support example supplies application invitation logic for a local relay.
Scope ownership, actual Safari/device verification and restrictive-network TURN/TLS
checks remain in [the release procedure](releasing.md) and [the plan](exec-plans/active/001-foundation.md).

## Container deployment verification (2026-10-15)

- Both runtime images built using the pinned pnpm version and frozen dependency graph.
  Compose references prebuilt images and requires an explicit public hostname.
- Actual Traefik TLS/WSS routing passed all four compiled pages, rejected-origin signaling,
  native two-browser video/chat and hangup. Both containers ran healthy as non-root users with
  read-only root filesystems; the smoke deployment removed its own containers and network.
- Final `pnpm check` passed with 163 combined coverage cases, 18 browser contract cases and
  18 end-to-end cases. Coverage and bundle size metrics above are unchanged. An initial support
  page startup timeout passed on unchanged isolated and full-suite reruns.
- CI includes image builds and the deployment smoke; it was configured but not run remotely.
  The relay remains a private reference with in-memory rooms; authentication, ICE credential
  distribution and external-device checks remain the application limits described in the
  [deployment guide](deploying.md).

## Standalone Traefik and Coturn verification (2026-10-15)

- All three Compose projects validate and use images without inline builds. Actual supplied
  Traefik files passed HTTPS/WSS and native video/chat, private access, identity-alias/path
  rejection, restricted Docker API discovery, non-root health and repeated ACME initialization.
- Actual supplied Coturn files passed non-root startup/TLS health, certificate/hostname checks,
  invalid-secret/hostname startup rejection, REST-authenticated allocations over UDP/TCP/TLS,
  wrong/expired credential denial, and loopback/cloud-metadata peer denial. Native relay-only
  bytes and ICE restart passed on all three transports and through Traefik SNI TLS passthrough.
  Positive local exchange uses a temporary loopback exception; production policy is unchanged.
- Both images were rebuilt and the original UDP/TCP TURN regression passed. Temporary deployment
  containers, networks, volumes and credentials were removed; unrelated Docker resources were retained.
- Full `pnpm check` passed all gates. A subsequent coverage run including the two new issuer
  tests passed 165 cases in 19 files (155 Node and 10 Chromium); overall statements were 96.27%,
  branches 90.72%, functions 98.77% and lines 98.52%. Bundle sizes remain those reported above.
- Shared native contracts passed 18 cases across three engines; all 18 demo end-to-end cases
  passed. Concurrent demo startup exposed intermittent page/fake-media readiness failures;
  files now run sequentially because Vite instances share a dependency cache. Assertions,
  deadlines and existing regression cases are unchanged, with no retries added.
- CI includes both deployment checks but was not run remotely. Public DNS/ACME/firewall/NAT,
  real devices and restrictive networks remain external checks. The demo still needs an
  authenticated ICE endpoint, controller credential fetch and room authorization, described in
  the [repository boundary](deploying.md); infrastructure checks do not establish that integration.

## Deployment repository separation (2026-10-15)

Production image builds, Compose projects, Traefik/Coturn configuration, credential-issuer tests
and application deployment smokes moved to the separate `peerweave-deployment-example` repository.
Earlier deployment results above are historical; new app/deployment evidence is owned there.
The framework retains all four samples, browser regressions and its low-level TURN contract.
The user's archival legacy-demo deletion is preserved. See the [boundary](deploying.md).

After separation, the framework full gate passed with 163 combined coverage cases, 18 browser
contracts and all 18 existing end-to-end cases; its retained UDP/TCP TURN and ICE restart check
also passed. The independent application owns 42 unit/model/request cases and its native app,
Traefik and Coturn deployment results. No framework sample source or regression assertion changed.

## GitHub source publication and CI (2026-10-15)

The public framework is [peerweavejs/peerweave](https://github.com/peerweavejs/peerweave), transferred
with existing history and repository identity. The independent application is
[peerweavejs/peerweave-deployment-example](https://github.com/peerweavejs/peerweave-deployment-example).
Both have canonical metadata, README badges/architecture/conventions, MIT licensing and community
guidance/templates. Private vulnerability reporting and dependency vulnerability alerts are enabled.
All package manifests remain private; GitHub source publication does not publish npm packages.

[Full framework CI passed](https://github.com/peerweavejs/peerweave/actions/runs/38763051432)
at commit `f7b5441010d602ef4cd13fcf8fb16e1fb4cd290d`: lint/boundaries/build/types, 163 combined
coverage cases, 18 native contracts across three engines, all 18 existing example regressions,
fresh packed-package/application consumers, bundle budgets, UDP/TCP TURN and mutation detection.
The independent application's [full workflow passed](https://github.com/peerweavejs/peerweave-deployment-example/actions/runs/38759372809),
including both images, authenticated Traefik HTTPS/WSS and controlled Coturn UDP/TCP/TLS/SNI paths.
Earlier entries saying CI was configured but not run describe their historical checkpoints.

Runner fixes are confined to the harness: explicit IPv4 loopback, sequential visible contract
pages, headless Linux audio and preparation of independent consumer graphs/caches before offline
installation with the already-verified pinned pnpm. Both consumer gates also passed with a cold
metadata cache under `CI=true`. No library APIs, existing assertions or deadlines changed, and
no retries were introduced. Public networks and real devices remain external acceptance work.
See the [publication record](exec-plans/completed/007-github-publication.md).

## Minimal framework demo (2026-10-15)

The framework now owns one vanilla TypeScript video-call page: Room/Join, local and remote
video, Start, Mute, Leave, status and inline errors. The richer Gyral application and its three
byte-identical model/protocol files and 18 original browser cases belong to the deployment repo.
An AST comparison confirmed preservation of all 126 browser assertion statements; only fixture
paths, authorized development room membership and the ICE API proxy changed. The earlier
four-page measurements describe historical checkpoints.

Both full local gates passed. Framework verification covers 138 library coverage cases,
18 native contract cases, nine minimal-demo cases, strict types, build, lint, repository/package
boundaries, installed archives, the fresh minimal consumer and bundle budgets. Coverage metrics
at the top of this page remain unchanged. Application verification passed 42 unit/model/request
cases, all 18 migrated browser cases and the built video/chat/file smoke.

The new page covers permission readiness past the connection deadline, denied access, canceled
and late acquisition, actual microphone enable/disable, owned-track cleanup, navigation/rejoin,
signaling loss and native room constraints. A deliberate readiness bypass was caught and
restored. Three-engine light/dark WCAG checks, narrow layouts, keyboard skip links and 200% zoom
pass; desktop/mobile screenshots were inspected. No public package source/API changed and no
tests were skipped or relaxed. See the [decision and evidence](exec-plans/completed/008-minimal-demo.md).

Frozen installations passed in both repositories. The retained UDP/TCP relay-only data and ICE
restart checks passed. All three existing critical behavior mutations were detected and restored,
followed by 128 passing Node library/relay cases.
