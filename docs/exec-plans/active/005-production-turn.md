# Standalone authenticated TURN deployment

Historical plan: production assets and their verification moved to the independent deployment
example repo. See the [repository boundary](../../deploying.md) and plan 006.

Status: complete.

## Decisions

- User has one public IP shared with the Traefik application deployment. Start Coturn directly
  on UDP/TCP 3478 and TLS/TCP 5349; document optional Traefik TCP passthrough on 443.
- Separate, image-only Compose project with a pinned upstream Coturn image, host networking
  on Linux, non-root execution, read-only filesystems, file-based secrets and a bounded relay range.
- Enable Coturn REST shared-secret authentication, TLS 1.2+, private/link-local/multicast peer
  restrictions, disabled TCP peer relays, allocation quotas and bandwidth budgets.
- Supply a tested server-side credential issuer. Recommend OIDC/ForwardAuth plus application
  authorization before issuance. No anonymous credential HTTP endpoint or new identity store.
- Preserve current public packages and application regressions. Document the existing controller
  integration and credential refresh limitations explicitly rather than claiming TURN alone
  establishes production readiness.
- User additionally requested a standalone Traefik Compose project and `traefik.yaml`. Supply
  non-root Traefik with persistent ACME state, a restricted Docker socket proxy, private access
  middleware, HTTP redirection, and optional SNI-based TURN TLS passthrough on the shared 443 port.

## Acceptance list

- [x] Short-lived credentials use the Coturn protocol, validate input and disclose no shared secret.
- [x] Standalone Compose and startup validation reject missing/invalid secrets or TLS material.
- [x] Actual Coturn accepts valid credentials over UDP/TCP/TLS and exchanges relay-only data.
- [x] Expired/wrong credentials and restricted peer destinations cannot allocate/relay as applicable.
- [x] Test TLS certificate verification and bounded host-network cleanup.
- [x] Boot the supplied Traefik files and verify auth, HTTPS/WSS and Docker API restrictions.
- [x] Document deployment steps, data flow/architecture, NAT/firewalls, TLS/443, authentication,
  capacity, observability, recovery, upgrades and remaining application work.
- [x] Run relevant tests and repository verification; record measured results and limits.

## Verification log

- Credential tests first failed for the missing issuer and then for incorrect expiry/output;
  invalid-input tests failed before validation was added. The final deterministic HMAC fixture
  is independently derived using OpenSSL. Both cases run in the unit and coverage gates.
- All three image-only Compose projects validate using their example environment files.
  Both application runtime images were rebuilt successfully with `tools/build-images.sh`.
- `pnpm test:deployment` passed against the supplied Traefik project: HTTPS pages, authenticated
  WSS, Origin rejection, native video/chat/hangup, non-root health and restricted Docker APIs.
  Negative checks cover spoofed identity-header aliases, encoded paths and container archive reads.
  Repeating ACME initialization exposed an ownership issue; the corrected job preserves existing
  state and passed repeated execution with mode 0600 and UID 65532.
- `pnpm test:turn:deployment` passed the actual Coturn project as UID 24001: invalid secret and
  TLS hostname startup rejection, verified TLS certificate/hostname, private metrics, valid REST
  allocations over UDP/TCP/TLS, expired/wrong credential denial and loopback/metadata peer denial.
  Actual relay-only bytes and ICE restart passed over each transport and through the supplied
  Traefik SNI TLS passthrough. Positive local relay exchange uses a temporary loopback exception;
  production policy is unchanged. Temporary containers, volumes, networks and credentials were removed.
- The original unchanged `pnpm test:turn` passed UDP/TCP relay-only exchange and ICE restart.
- Concurrent demo test runs intermittently failed at initial page or fake-media readiness.
  Their Vite servers share one dependency cache. Test files now run sequentially; all 18 existing
  end-to-end cases passed without retries, assertion edits or deadline extensions.
- Full `pnpm check` passed all gates, including package validation, fresh consumer examples and
  bundle budgets. The coverage gate was then extended to include the root-level issuer tests
  and passed 165 cases in 19 files (155 Node and 10 native Chromium cases). All three browser
  engines passed their 18 shared contracts. Shell/JavaScript syntax and Compose validation passed.
- CI includes both deployment smokes; remote CI, public ACME/DNS/firewall/NAT, real devices and
  restrictive-network reachability were not exercised here. The authenticated ICE endpoint and
  controller credential fetch remain explicitly documented application integration work.
