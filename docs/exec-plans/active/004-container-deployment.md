# Container deployment behind Traefik

Historical plan: production assets and their verification moved to the independent deployment
example repo. See the [repository boundary](../../deploying.md) and plan 006.

Status: complete.

## Scope and decisions

- Build the existing private example and relay for a server deployment. Keep public packages
  private and preserve application protocols and call regression assertions.
- One multi-stage Dockerfile produces an unprivileged static web image and a Node relay image.
  A standalone shell script builds both; Compose only references image tags.
- Default to an existing Traefik Docker provider and shared external network. Traefik owns TLS
  and routes `/signaling` directly to the relay; both services have health checks and no host ports.
- Configure the exact HTTPS page origin from the deployment hostname. Preserve localhost defaults
  outside Compose. Authentication middleware is configured on both Traefik routers.
- Rooms remain in one relay's memory. Container packaging does not implement membership
  authorization, durable sessions, reconnect/resume, or TURN credential distribution.

## Acceptance checks

- [x] Build both runtime images using the shell script and the frozen pnpm dependency graph.
- [x] Validate Compose interpolation, required settings and image-only deployment.
- [x] Serve all four compiled pages and assets through an actual TLS-terminating Traefik.
- [x] Pair peers over WSS, exchange real native media/chat, and reject an unlisted origin.
- [x] Verify container health, unprivileged users and cleanup of the isolated smoke deployment.
- [x] Document deployment, image transfer/update and the current application limits.
- [x] Run repository tests, lint, types and build checks appropriate to the changes.

## Verification log

- Baseline: all 153 Node tests passed before container changes. The deployment smoke initially
  failed because `compose.yaml` did not exist, before adding deployment configuration.
- `./tools/build-images.sh` built both images from the frozen dependency graph. Corrected the
  initial fetch command to match the pinned pnpm CLI (`fetch` reads the lockfile; `install`
  enforces `--frozen-lockfile`). Runtime users are UID 101 (web) and `node` (relay).
- `pnpm test:deployment` passed actual Traefik TLS routing, four compiled pages, missing-asset
  404, rejected Origin, WSS pairing, native remote video/chat and terminal hangup. Both containers
  were healthy with read-only root filesystems. Its temporary Docker resources were removed.
- The smoke fixture detects the local Unix Docker socket, including rootless installations,
  and waits for both routers to be discovered by Traefik before exercising browser behavior.
- The first full repository check reached one support-page startup timeout; all three support
  checks and then all 18 end-to-end checks passed when rerun unchanged.
- Final `pnpm check` passed: lint, 20 linked documents and package boundaries, all builds and
  types, 163 combined coverage cases, 18 browser contracts, 18 end-to-end cases, packed-package
  validation, fresh consumer examples and bundle budgets. Coverage metrics are unchanged.
- Missing deployment hostname is rejected; custom hostname, image prefix/tag, external network
  and certificate resolver interpolation were verified. `sh -n tools/build-images.sh` passed.
- CI now builds both images and runs the deployment smoke after its existing gates. The remote
  workflow was configured, not executed here. No registry push or server deployment was performed.
