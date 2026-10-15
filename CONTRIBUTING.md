# Contributing to Peerweave

Thank you for helping improve browser WebRTC development. Small fixes, docs, reproducible browser
reports and focused API proposals are useful. Follow the [code of conduct](CODE_OF_CONDUCT.md).

## Choose the right repository

Use this repo for package APIs, negotiation/media lifecycle behavior, package artifacts and
lightweight examples. Use [peerweave-deployment-example](https://github.com/peerweavejs/peerweave-deployment-example)
for authentication, room policy, ICE credential issuance, Docker, Traefik, Coturn and operations.
Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues.

## Set up

Fork the repo, clone your fork and create a focused branch. Use Node 24+ and the pnpm version
pinned in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm dev
```

See [`AGENTS.md`](AGENTS.md) for the navigation map and [architecture](ARCHITECTURE.md) before
changing package boundaries. Use distinct `PEERWEAVE_PORT` and `PEERWEAVE_DEMO_PORT` values for
parallel worktrees. Keep editor settings, generated artifacts and secrets out of commits.

## Development loop

1. Reproduce the behavior at the smallest useful boundary and observe the test fail.
2. Make the focused implementation pass; refactor on green. Do not skip, loosen or delete regressions.
3. Run the relevant tests while iterating, then `pnpm check` before submitting.
4. Update public API docs, design decisions, examples and quality evidence when behavior changes.

```sh
pnpm test -- packages/peer/tests/signal.test.ts
pnpm check
pnpm test:turn       # Linux/Docker, when changing ICE/transport behavior
pnpm test:mutations  # When changing critical cancellation/recovery behavior
```

Native/device/network checks require real environments. State exactly what you ran and what is
unverified; do not claim broad browser support from one engine. The [testing guide](docs/testing.md)
and [release procedure](docs/releasing.md) describe those boundaries.

## Pull requests

Explain the concrete problem and resulting behavior. Include reproduction steps, relevant test
commands/results, compatibility implications and remaining risks. Keep unrelated refactors separate.
Conventional subjects such as `fix:`, `feat:`, `docs:` and `test:` help reviewers scan history.
A small change does not need a long design document; API/boundary changes should reference a decision.

Package behavior changes should include a Changeset when they affect consumers. Manifests remain
private; contributors should not publish packages, change release privacy or add registry credentials.
A maintainer reviews release scope and versioning through [releasing](docs/releasing.md).

No CLA or signed-off-by requirement is currently configured. By submitting code, you agree to
license your contribution under this project's [MIT license](LICENSE). Preserve third-party notices.
Maintainers review contributions; opening a PR does not guarantee acceptance or a response deadline.
