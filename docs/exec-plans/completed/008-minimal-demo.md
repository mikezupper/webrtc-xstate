# Simplify the framework demo

Status: complete, 2026-10-15. User approved one minimal vanilla TypeScript video-call page.

- [x] Establish the current unit and browser baseline (153 Node, 18 browser cases).
- [x] Preserve all rich-app regression assertions in the deployment repository before retiring their framework copies.
- [x] Test the minimal page's scope and call lifecycle before implementation.
- [x] Replace the Gyral four-page demo with HTML, DOM bindings, a small session controller and layered CSS.
- [x] Preserve room validation, WS/WSS selection, readiness, permission errors, mute and cleanup/rejoin behavior.
- [x] Remove unused app dependencies; update the packed consumer check and current documentation.
- [x] Verify both repositories' relevant gates and inspect desktop/mobile screenshots in both themes.

The framework libraries and their contracts stay unchanged. The production app keeps its four
Gyral examples. Their three existing model/protocol test files are byte-identical to this repo's;
the browser cases moved with their assertions intact, adapting only app/server fixtures.
The new framework page demonstrates video/audio calls, with Join, Start, Mute and Leave.
Chat, screen sharing, stats/reporting, preflight, file transfer and support invitations belong
to the richer app. Removing these pages is an intentional scope change, not a failing-test fix.

Test list: minimal semantic page; native video and mute; wait beyond the connection deadline for
peer readiness; permission denial; pending/late capture cancellation; leave/rejoin and peer
departure cleanup; signaling failure; room validation; responsive/theme/keyboard accessibility;
fresh installed-package consumer. No hidden compatibility UI, skipped assertions or retries.

Evidence: all 18 migrated cases passed; an AST comparison confirmed all 126 original browser
assertion statements match, and the three model/protocol files already owned by the richer app
are byte-identical. The minimal-page test first failed on the absent heading, then passed.
The native-call test failed on disabled Start before implementation, then passed native video,
actual microphone enable/disable and track cleanup on Leave. A deliberate readiness bypass
made the 21-second permission-wait case fail with a terminal call; the guard was restored.

Final framework `pnpm check` passed: 138 combined coverage cases, 18 shared native contracts,
nine minimal-demo cases, fresh installed archives and consumer page, types/build/lint and size
budgets. Library coverage is unchanged (96.27% statements, 90.50% branches, 98.77% functions,
98.52% lines). The deployment repo's full gate passed its 42 unit/model/request cases, all 18
migrated browser cases and the built application smoke. No library source or API changed;
the deployment app's checksummed archives therefore need no refresh. Light/dark desktop/mobile
screenshots were inspected; axe, zoom and skip-link checks pass in Chromium, Firefox and WebKit.

Frozen installs passed in both repos. The framework's retained UDP/TCP relay-only TURN and ICE
restart checks passed. Its three existing cancellation/late-cleanup/recovery mutations were
detected, restored and followed by all 128 Node library/relay cases passing. The migration audit
includes awaited assertions (126 total); the earlier 102 count omitted the awaited statements.
