# Quality status

Measured locally on 2026-10-14. The package family is implemented; first publication remains
subject to scope ownership, API review and real-device/external-network validation.

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
- Original legacy JS/HTML files remain byte-for-byte identical. No skipped/focused tests were found.
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
