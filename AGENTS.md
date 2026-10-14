# Working in Peerweave

Peerweave is a pnpm workspace for composable browser WebRTC packages.

## Start here

- [Architecture](ARCHITECTURE.md): package direction, public boundaries, ownership.
- [Design index](docs/design/index.md): accepted decisions and proposed APIs.
- [Active implementation plan](docs/exec-plans/active/001-foundation.md): milestones and acceptance checks.
- [Testing](docs/testing.md): test-first loop, coverage, native browser contracts.
- [Reliability](docs/reliability.md): cancellation, recovery, signaling assumptions.
- [Quality status](docs/quality.md): measured progress and remaining work.
- [Examples guide](apps/demo/README.md) and [Gyral plan](docs/exec-plans/active/002-gyral-examples.md).

## Commands

- Use pnpm, with the version pinned in `package.json`.
- `pnpm install --frozen-lockfile` installs the checked-in dependency graph.
- `pnpm dev` starts the workbench on localhost.
- `pnpm check` runs lint, repository checks, build, typecheck, coverage, and package validation.
- `pnpm test -- packages/peer/tests/signal.test.ts` runs the first slice's tests.

## Invariants

- `peer` and `media` are independent. `call` composes their public entry points.
- XState is private to `call`; no public declaration may expose XState types.
- Import another workspace package through its declared package export, never its source tree.
- Browser objects are created on explicit invocation, never at module import time.
- Borrowed tracks remain caller-owned. Dispose resources owned by the current layer.
- Validate incoming signal envelopes; delegate SDP/candidate grammar to the browser.
- Test observable behavior before implementing it. See the expected failure, make it green, then refactor.
- Do not skip, loosen, or delete a regression test to obtain a passing run.
- Maintain a short, current execution plan and record decisions alongside code.
- Unit coverage has an 85% floor per production package, with 95% as the target.
- Coverage of a starter slice does not establish readiness of unimplemented packages.
- Keep packages private until their API, artifact, browser support, and release criteria are satisfied.

## Current scope

Peer, media, managed calls and the optional WebSocket adapter are implemented. The private demo
and relay run together with `pnpm dev`. Use the active plan, quality record and release procedure
for measured results and remaining external publication checks. Keep all packages private.

The private demo uses Gyral 0.3.6 for four linked examples. Keep its models/views pure and native
resources in disposable drivers/controllers. Preserve the existing call regression assertions.
Runtime Gyral dependencies must not enter public packages. `pnpm check:examples` validates a fresh
packed consumer app without source aliases. Use semantic native controls and the layered CSS system.

- `pnpm test:turn` requires Linux/Docker; it tears down its own local Coturn container.
- `pnpm release:status` previews Changeset releases; versioning and publication are separate.
- [Release procedure](docs/releasing.md) records scope ownership and real-device requirements.
