# Publish the two repositories under peerweavejs

Status: in progress, 2026-10-15. User explicitly authorized commits and GitHub publication.

- [x] Prepare README badges, overview/motivation/architecture, conventions, build/test/config/deployment.
- [x] Add MIT/community/security/contribution guidance and issue/PR templates.
- [x] Add canonical repository metadata and cross-links; preserve unpublished package status.
- [ ] Validate the framework and commit all intended work, including the user's legacy removal.
- [ ] Refresh the consumer's packaged artifacts and provenance from the committed framework.
- [ ] Validate and commit the independent deployment app.
- [ ] Transfer/rename the existing public framework repo, preserving repository identity/history.
- [ ] Create the public deployment repo, push both, configure descriptions/topics and verify results.

The existing framework remote is `mikezupper/webrtc-xstate` (repository ID 388956145), public,
with four stars and main at the local starting commit. Target names are `peerweavejs/peerweave`
and `peerweavejs/peerweave-deployment-example`; neither exists at the start. The authenticated
user is an organization admin. Do not publish npm packages or deploy production infrastructure.
Editor state, local secrets and generated artifacts stay outside commits.

Local preparation: `pnpm check` passed all framework gates with 163 combined coverage cases,
18 shared browser contracts and all 18 unchanged example regressions. Package metadata points
to the organization; all manifests remain private. GitHub Actions are pinned to verified commit
SHAs. Community template YAML/frontmatter parses. IDE state and runtime files remain ignored.
