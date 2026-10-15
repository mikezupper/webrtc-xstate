# Separate the production deployment application

Status: complete, 2026-10-15.

User requested `~/git-repos/peerweave-deployment-example` using the supplied harness-engineering
scaffold. User confirmed BasicAuth with explicit room membership and that samples stay here.

- [x] Baseline: all 155 existing Node cases passed before separation.
- [x] Create independent consumer app using private packed Peerweave artifacts.
- [x] Relocate production assets and their tests/gates; keep sample/controller assertions here.
- [x] Preserve the user's staged legacy-demo deletion and unrelated Vite/IDE edits.
- [x] Run the framework gate and retained TURN contract after separation.
- [x] Record final consumer/deployment verification and remaining external checks.

No framework API changes or package publication are part of this task. The new repo owns app
auth, room policy and credential acquisition; this repo retains their lower-level extension seams.

Verification: framework `pnpm check` passed all gates (163 combined coverage tests, 18 native
browser cases, 18 end-to-end cases, packed consumer and size checks). Retained `pnpm test:turn`
passed UDP/TCP exchange and ICE restart. Sample source and regression assertions are unchanged.
The independent consumer passed 42 unit/model/request cases, built native app checks, two image
builds, actual Traefik/authenticated ICE/WSS and Coturn UDP/TCP/TLS/SNI relay checks. Its built app
also exchanged relay-only native media/chat/file bytes with credentials fetched from its API.
Its own quality record separates local results from pending external DNS/ACME/network/device work.
No commit, remote creation, push, publication or production deployment was performed.
