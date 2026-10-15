# Publish the two repositories under peerweavejs

Status: complete, 2026-10-15. User explicitly authorized commits and GitHub publication.

- [x] Prepare README badges, overview/motivation/architecture, conventions, build/test/config/deployment.
- [x] Add MIT/community/security/contribution guidance and issue/PR templates.
- [x] Add canonical repository metadata and cross-links; preserve unpublished package status.
- [x] Validate the framework and commit all intended work, including the user's legacy removal.
- [x] Refresh the consumer's packaged artifacts and provenance from the committed framework.
- [x] Validate and commit the independent deployment app.
- [x] Transfer/rename the existing public framework repo, preserving repository identity/history.
- [x] Create the public deployment repo, push both, configure descriptions/topics and verify results.

Transferred and renamed `mikezupper/webrtc-xstate` to
[peerweavejs/peerweave](https://github.com/peerweavejs/peerweave), preserving repository ID
388956145, history and four stars. Created the public
[peerweavejs/peerweave-deployment-example](https://github.com/peerweavejs/peerweave-deployment-example).
Both main branches track canonical SSH origins. Descriptions, 15 topics per repo, MIT detection,
community files/templates, private vulnerability reporting and dependency alerts were verified.
Editor state, local secrets and generated output remain outside commits. No npm publication or
production deployment occurred.

Local preparation: `pnpm check` passed all framework gates with 163 combined coverage cases,
18 shared browser contracts and all 18 unchanged example regressions. Package metadata points
to the organization; all manifests remain private. GitHub Actions are pinned to verified commit
SHAs. Community template YAML/frontmatter parses. IDE state and runtime files remain ignored.

Framework preparation commit: `d3ac8713c2ff3a1c5851ee5f8b0f79d8535f8d42`. The independent
consumer's archives/checksums/provenance were refreshed from that commit before its initial
`ffb27fd1e886a93c116193f89cb13c3a00cdbead` commit. Its latest documentation commit also passed
[full app/image/Traefik/Coturn CI](https://github.com/peerweavejs/peerweave-deployment-example/actions/runs/38759372809).

GitHub exposed two harness assumptions: IPv6 localhost without an IPv6 ICE route, and registry
metadata available only in a warm pnpm cache. IPv6 locally reproduced four native failures;
IPv4 loopback and sequential visible contract pages passed all 18 unchanged assertions. Linux
CI supplies headless audio. Consumer fixtures verify the active pinned pnpm, resolve/fetch their
independent graph, then retain the offline install and all artifact/native-consumer checks.
Both consumer gates passed locally with an empty metadata cache and `CI=true`.

[Complete framework CI passed](https://github.com/peerweavejs/peerweave/actions/runs/38763051432)
at `f7b5441010d602ef4cd13fcf8fb16e1fb4cd290d`: full workspace gate, controlled UDP/TCP TURN
and the behavioral mutation audit. No regression assertions, connection deadlines or library APIs
were changed; no retries were added. The deployment UI currently copies the framework samples;
consolidating that UI is a separate architecture discussion, not part of source publication.
