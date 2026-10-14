# Peerweave implementation plan

Status: implementation complete; external publication checks remain active.
Scope: the agreed package family, private calling example and reference relay.

## Objective

Deliver independent thin peer/media packages and a managed call layer, with browser-native
contracts, internal XState orchestration, and per-package coverage targeting 95% with an 85% floor.
Use the [harness engineering approach](https://openai.com/index/harness-engineering/): a short
agent map, local design knowledge, executable checks, and explicit progress.

## Decisions

- Family name: Peerweave, accepted by the user. Scope: `@peerweave`, pending registry ownership.
- pnpm workspace, shared lockfile, exact current stable direct dependencies.
- ESM-first packages with TypeScript declarations and explicit exports.
- Independent peer/media packages; call depends on their public contracts.
- XState is private to call. The peer runtime follows native perfect negotiation.
- Supplied tracks are borrowed; captured tracks are owned by capture handles.
- Library imports are inert and safe in server-side tooling.
- Keep packages private until release readiness. Publishing is a later explicit action.

## Milestone 0: foundation (complete)

- [x] Install and lock the latest stable compatible tooling.
- [x] Scaffold package builds, types, coverage thresholds, and private workbench.
- [x] Record architecture, signaling/ownership contracts, testing, and reliability.
- [x] Test-drive the first signaling parser, including malformed ID-message regression.
- [x] Verify public declaration isolation, dependency direction, and local documentation links.
- [x] Pack and smoke-test artifacts outside workspace resolution.
- [x] Run the complete gate and record measured results.

## Milestone 1: peer runtime (complete)

- [x] Explicit peer creation, native configuration, typed state subscriptions.
- [x] Idempotent close, listener cleanup, queued-work cancellation, inert imports.
- [x] Versioned/session-matched signaling with a documented send/receive contract.
- [x] Perfect negotiation for both collision roles and simultaneous offers.
- [x] Candidate sequencing, ignored-offer candidates, ICE generation handling.
- [x] Native track/sender/transceiver/data-channel/stats operations.
- [x] Real-browser data exchange, bidirectional media, and renegotiation.
- [x] Cross-browser contract suite and package-local 85% floors; target 95%.

Exit: two actual peers exchange data/media, tolerate glare, and close without late work.

## Milestone 2: owned media (complete)

- [x] Explicit camera/microphone and screen acquisition with native constraints.
- [x] Idempotent capture disposal and owned-track cleanup.
- [x] Denied permission, missing devices, disposal during pending prompts, late-result cleanup.
- [x] Device selection and supported replacement scenarios.
- [x] Browser contract tests and package-local coverage gates.

Exit: capture handles release all owned resources on every termination path.

## Milestone 3: managed calls (complete)

- [x] Compose public peer/media contracts with a private XState lifecycle.
- [x] Establish start/end semantics and application signaling/invitation boundaries.
- [x] Start, hangup, microphone controls, screen switching, and structured failure events.
- [x] Grace periods, bounded ICE recovery, and terminal cancellation.
- [x] No XState types in public declarations; layered integration tests.
- [x] Replace the validation workbench with a complete two-peer example and private signaling server.

Exit: managed sessions release owned resources and preserve caller-owned resources.

## Milestone 4: release readiness

- [ ] Own the npm scope and confirm final package names.
- [x] Decide supported browser and consumer TypeScript ranges; validate fixtures.
- [x] Validate actual fresh installs of all packed transitive dependencies.
- [x] Measure consumer bundle size, including runtime dependencies.
- [x] Controlled local TURN UDP/TCP, ICE restart and documented device/network release procedure.
- [ ] Record actual Safari/device and separate/restricted-network TURN/TLS verification.
- [x] Per-package changelogs, release intents, dependency-compatible version propagation.
- [x] Consumer documentation, examples, API stability review, and license/artifact checks.

Exit: packages are publishable and reviewable. Actual registry publication is a separate action.

## Deferred work

Framework bindings, rooms/SFU integration, and advanced diagnostics
require independent useful contracts and follow-up execution plans.

## Verification log

- Baseline: original prototype has no package manifest or automated test suite.
- Current stable versions were checked against the registry before scaffolding.
- Local runtime is Node 24; the development runtime pin is the latest Node 24 LTS patch.
- Results of milestone 0 checks are recorded here once executed.

### 2026-10-14: foundation complete

- Full local command `pnpm check` passed: 47 tests, lint, repository checks, builds,
  strict type checks, coverage, and all 3 packed-package checks.
- First parser implementation was driven from expected failures. Native acceptance
  examples and tagged-error/declaration checks were additionally proven by temporary mutations.
- Parser coverage is 100% across all 4 metrics. Media/call are type-only scaffolds;
  their behavior and package coverage remain milestone work.
- Chrome 155 workbench smoke checks passed with no page errors.
- Package manifests remain private. No commits or registry publication were performed.
- Next starter behavior: explicit peer creation followed by idempotent terminal close;
  then a real-browser two-peer data-channel exchange through application-owned signaling.

### 2026-10-14: implementation complete

- Four independent libraries, private two-tab demo and two-member signaling relay implemented.
- Full local gate passed: 134 coverage checks, 18 browser checks, two demo checks, artifacts and sizes.
- Every library clears the 85% four-metric floor. Overall line coverage is 98.52%; branches 90.50%.
- TURN UDP/TCP and ICE restart passed; three critical mutations were killed and restored.
- Public API/declaration review confirms no orchestration types escape the managed facade.
- See [quality](../../quality.md) for exact package metrics, bundle sizes and validation limits.
- Remaining work requires scope ownership and real-device/external network environments, followed
  by explicit publication authorization. No source commits, push, deployment or publication occurred.

### 2026-10-14: demo startup readiness

- Reproduced the reported sequential-start failure: the first tab exhausted connection recovery
  while the second was still idle. The regression now passes after advancing beyond that deadline.
- Added demo-owned readiness signaling after explicit Start and media acquisition. Native
  negotiation waits for both participants, with numbered instructions and live next-step guidance.
- Startup denial notifies the waiting peer; leaving releases preview tracks and pending startup.
- Eight demo checks pass, including late starts, chat-only startup, permission-boundary delay/denial,
  preview cleanup, rejoining, native media/chat and the HTML pattern regression.
- Full `pnpm check` and frozen-lockfile installation passed; library coverage and bundle sizes
  remain at the previously recorded values.
- The public package API and managed-call recovery limits are unchanged.
