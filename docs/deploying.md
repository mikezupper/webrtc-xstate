# Framework and deployment repository boundary

Peerweave owns its browser packages, native/protocol tests, low-level TURN contract, and the
four lightweight samples under `apps/demo`. Use `pnpm dev` for those samples and the local
reference signaling relay. Keep package-level real-device release criteria here.

The separate **[peerweave-deployment-example](https://github.com/peerweavejs/peerweave-deployment-example)** repository owns the deployable application,
private authentication and room membership, authenticated ICE credentials, Docker images,
Traefik/Coturn Compose projects, deployment guides and application/infrastructure CI.
Its canonical GitHub home is `peerweavejs/peerweave-deployment-example`.
Start with that repo's `README.md`, `AGENTS.md` and `docs/webrtc-production.md`.

That app consumes packed public package exports with checksummed provenance. It does not
import this workspace's source tree. Framework packages remain private until their own release
criteria and publication authorization are satisfied. The app owns a copy of the sample UI;
future app requirements do not automatically expand the framework's scope.

Plans 004 and 005 record the original deployment work. Their production assets and tests now
live in the separate application repository. Their earlier verification logs are historical.
